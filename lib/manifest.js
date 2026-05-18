/**
 * VerbManifest — parsed, TTL-cached view over `obsidian help` output.
 *
 * The Obsidian CLI is the source of truth for which verbs exist and which
 * flags they accept. This module:
 *
 *   - Fetches the help text on demand (lazy prime, no work at construction).
 *   - Parses it into a category-grouped index of verbs and per-verb flag
 *     records (`forVerb`).
 *   - Caches the parse for `ttlMs`; `refresh()` busts the cache.
 *   - Exposes `validate(args)` so callers can sanity-check a verb invocation
 *     before shelling out — catching common drift like `dest=` vs `to=` and
 *     misspelled verbs/flags with cheap edit-distance suggestions.
 *
 * Wiring into the MCP server lives in #11/#12; this file stays a pure module.
 */

const DEFAULT_TTL_MS = 15 * 60_000;
const DEFAULT_FETCH_TIMEOUT_MS = 5000;

// Categories the manifest always exposes, even when empty. Keeps callers free
// to iterate without nullish-checking every bucket.
const CATEGORIES = [
  "Read",
  "Write",
  "Edit",
  "Discover",
  "Tasks",
  "Daily",
  "Properties",
  "Plugins",
  "Dev",
  "Eval",
];

// Hardcoded drift hints — common stale knowledge that the model tends to emit.
// Maps `flag-name` -> { suggest, reason }. Only used when the verb's known
// flag set does NOT contain the bad flag (so we don't false-positive when a
// verb genuinely accepts both forms).
const DRIFT_HINTS = {
  dest: { suggest: "to", reason: "Obsidian CLI uses 'to=' for move/rename destinations, not 'dest='." },
};

/**
 * Create a VerbManifest bound to an ObsidianCli adapter.
 *
 * @param {object} opts
 * @param {{exec: (args: string[]) => Promise<{stdout: string, stderr: string, error: null | {type: string, message: string}}>}} opts.cli
 * @param {number} [opts.ttlMs=900000] - Cache TTL in milliseconds. 15 minutes by default.
 * @param {number} [opts.fetchTimeoutMs=5000] - Bound on a single help fetch. Surfaces a rejection if exceeded.
 * @param {() => number} [opts.now=Date.now] - Injectable clock for tests.
 * @returns {{
 *   all: () => Promise<Record<string, string[]>>,
 *   forVerb: (name: string) => Promise<null | {name: string, description: string, flags: Array<{name: string, valueShape: string|null, description: string}>}>,
 *   validate: (args: string[]) => Promise<{ok: boolean, hint?: string}>,
 *   refresh: () => Promise<void>,
 * }}
 */
export function createVerbManifest({
  cli,
  ttlMs = DEFAULT_TTL_MS,
  fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  now = Date.now,
} = {}) {
  if (!cli || typeof cli.exec !== "function") {
    throw new TypeError("createVerbManifest requires a cli with exec(args)");
  }

  // cache.fetchedAt records when the *successful* fetch landed. A null
  // fetchedAt means the cache is cold (or was invalidated by a failed fetch).
  let cache = {
    fetchedAt: null,
    verbs: null,
    categorized: null,
  };

  // In-flight de-dupe so concurrent first-touchers share one fetch.
  let inflight = null;

  async function fetchWithTimeout() {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`obsidian help fetch timed out after ${fetchTimeoutMs}ms`));
      }, fetchTimeoutMs);
    });
    try {
      const result = await Promise.race([cli.exec(["help"]), timeout]);
      if (result.error) {
        throw new Error(`obsidian help failed: ${result.error.type}: ${result.error.message}`);
      }
      return result.stdout;
    } finally {
      clearTimeout(timer);
    }
  }

  async function prime() {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const stdout = await fetchWithTimeout();
        const verbs = parseHelpOutput(stdout);
        const categorized = categorizeVerbs(verbs);
        cache = { fetchedAt: now(), verbs, categorized };
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  function isFresh() {
    if (cache.fetchedAt === null) return false;
    // Inclusive boundary — at exactly ttlMs elapsed, the cache is still
    // considered fresh. Strict-less-than would surface spurious re-fetches
    // when a caller polls right at the edge.
    return now() - cache.fetchedAt <= ttlMs;
  }

  async function ensurePrimed() {
    if (isFresh()) return;
    await prime();
  }

  return {
    async all() {
      await ensurePrimed();
      // Shallow copy so callers can't mutate the cached buckets.
      const out = {};
      for (const cat of CATEGORIES) {
        out[cat] = [...(cache.categorized[cat] || [])];
      }
      return out;
    },

    async forVerb(name) {
      await ensurePrimed();
      const v = cache.verbs.get(name);
      if (!v) return null;
      // Return a copy of flags so callers can't mutate cache state.
      return {
        name: v.name,
        description: v.description,
        flags: v.flags.map((f) => ({ ...f })),
      };
    },

    async validate(args) {
      if (!Array.isArray(args) || args.length === 0) {
        return { ok: false, hint: "no verb provided" };
      }
      await ensurePrimed();

      // Allow a leading `vault=foo` token, matching the CLI's own grammar.
      const tokens = args[0]?.startsWith("vault=") ? args.slice(1) : args;
      if (tokens.length === 0) return { ok: false, hint: "no verb after vault=" };

      const verbName = tokens[0];
      const verb = cache.verbs.get(verbName);
      if (!verb) {
        const suggestion = suggestVerb(verbName, [...cache.verbs.keys()]);
        if (suggestion) {
          return {
            ok: false,
            hint: `unknown verb '${verbName}'. Did you mean '${suggestion}'?`,
          };
        }
        return { ok: false };
      }

      const knownFlagNames = new Set(verb.flags.map((f) => f.name));
      for (const token of tokens.slice(1)) {
        const flagName = parseFlagName(token);
        if (flagName === null) continue; // positional / unknown shape — leave to CLI

        // Hard-coded drift hints (e.g. dest -> to).
        if (DRIFT_HINTS[flagName] && !knownFlagNames.has(flagName)) {
          const hint = DRIFT_HINTS[flagName];
          if (knownFlagNames.has(hint.suggest)) {
            return {
              ok: false,
              hint: `${hint.reason} Try '${hint.suggest}=' instead of '${flagName}='.`,
            };
          }
        }

        if (!knownFlagNames.has(flagName)) {
          const suggestion = suggestFlag(flagName, [...knownFlagNames]);
          if (suggestion) {
            return {
              ok: false,
              hint: `unknown flag '${flagName}=' for verb '${verbName}'. Did you mean '${suggestion}='?`,
            };
          }
          // Lenient: unknown flag with no close match — leave to the CLI.
        }
      }

      return { ok: true };
    },

    async refresh() {
      // Invalidate first so a failed fetch doesn't leave stale data marked fresh.
      cache = { fetchedAt: null, verbs: null, categorized: null };
      await prime();
    },
  };
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse the full `obsidian help` text into a Map<verbName, verbRecord>.
 *
 * Format (empirically derived):
 *
 *   <section heading>:
 *     <verb-name>     <description>
 *       <flag-name>=<shape>   - <flag description>
 *       <flag-name>           - <flag description>   # bare boolean
 *
 * Verb lines are indented 2 spaces; flag lines 4. Section headings
 * (`Commands:`, `Developer:`, etc.) sit flush-left and end with `:`. We tag
 * each verb with its section so the categorizer can promote `Developer:` to
 * `Dev` regardless of verb name.
 *
 * @param {string} stdout
 * @returns {Map<string, {name: string, description: string, section: string, flags: Array<{name: string, valueShape: string|null, description: string}>}>}
 */
export function parseHelpOutput(stdout) {
  const verbs = new Map();
  const lines = stdout.split(/\r?\n/);

  let section = "";
  let currentVerb = null;

  for (const raw of lines) {
    if (raw.length === 0) continue;

    // Section heading: flush-left token ending with ':'.
    // e.g. "Commands:", "Developer:".
    if (/^[A-Z][A-Za-z]*:$/.test(raw.trim()) && !raw.startsWith(" ")) {
      section = raw.trim().replace(/:$/, "");
      currentVerb = null;
      continue;
    }

    // Verb line: 2-space indent, then `name<spaces>description`. Verb names
    // are lowercase, may contain ':' or '-' and trailing bracketed plugin
    // annotations like `[Templater]:`. Some annotated rows use a single
    // space between the annotation and the description, hence `\s+` not
    // `\s{2,}`.
    const verbMatch = raw.match(/^ {2}(\S+)\s+(.+)$/);
    if (verbMatch && !raw.startsWith("    ")) {
      const rawName = verbMatch[1];
      const description = verbMatch[2].trim();
      // Strip trailing bracketed annotations like `[Templater]:` from the
      // verb name so callers can reference the bare verb.
      const name = rawName.replace(/\[.+?\]:?$/, "").replace(/:$/, "");
      const verb = {
        name,
        description,
        section,
        flags: [],
      };
      verbs.set(name, verb);
      currentVerb = verb;
      continue;
    }

    // Flag line: 4-space indent.
    if (currentVerb && raw.startsWith("    ")) {
      const flag = parseFlagLine(raw);
      if (flag) currentVerb.flags.push(flag);
    }
  }

  return verbs;
}

/**
 * Parse a single flag line like:
 *   "    file=<name>         - File name"
 *   "    permanent           - Skip trash, delete permanently"
 *   "    format=json|tsv|csv - Output format (default: tsv)"
 *
 * @param {string} line
 * @returns {{name: string, valueShape: string|null, description: string} | null}
 */
function parseFlagLine(line) {
  const trimmed = line.trim();
  // Split on the first " - " that separates flag spec from description.
  // The flag spec may contain '-' (e.g. "format=json|tsv|csv"), so we anchor
  // on " - " specifically, with surrounding spaces.
  const sepIdx = trimmed.indexOf(" - ");
  let spec, description;
  if (sepIdx === -1) {
    spec = trimmed;
    description = "";
  } else {
    spec = trimmed.slice(0, sepIdx).trim();
    description = trimmed.slice(sepIdx + 3).trim();
  }

  if (!spec) return null;
  const eqIdx = spec.indexOf("=");
  if (eqIdx === -1) {
    // Bare boolean flag.
    return { name: spec, valueShape: null, description };
  }
  return {
    name: spec.slice(0, eqIdx),
    valueShape: spec.slice(eqIdx + 1),
    description,
  };
}

/**
 * Extract just the flag name from a CLI token like `to=foo` -> `to`. Returns
 * null for tokens that don't look like flags (positional args, etc.).
 *
 * @param {string} token
 * @returns {string|null}
 */
function parseFlagName(token) {
  if (typeof token !== "string" || token.length === 0) return null;
  const eqIdx = token.indexOf("=");
  if (eqIdx > 0) return token.slice(0, eqIdx);
  // Bare boolean tokens (e.g. `total`, `verbose`) — treat as flag names.
  // We only do this if the token is a plausible identifier, not an arbitrary
  // positional value.
  if (/^[a-z][a-z0-9_-]*$/.test(token)) return token;
  return null;
}

// ---------------------------------------------------------------------------
// Categorization
// ---------------------------------------------------------------------------

/**
 * Bucket every verb into one of the documented categories. The mapping is
 * derived from the verb name (prefix or keyword) since `obsidian help` only
 * tags its top-level "Developer:" section explicitly. Verbs that don't match
 * any bucket fall into Discover (the catch-all for "lookups across the
 * vault").
 *
 * @param {Map<string, {name: string, section: string}>} verbs
 * @returns {Record<string, string[]>}
 */
export function categorizeVerbs(verbs) {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
  for (const verb of verbs.values()) {
    const cat = categoryFor(verb);
    out[cat].push(verb.name);
  }
  for (const list of Object.values(out)) list.sort();
  return out;
}

/**
 * Pick the category bucket for a single verb. Order matters — earlier rules
 * win. Section-tagged Developer verbs always land in Dev, which is why we
 * check `section` before the name-based heuristics.
 */
function categoryFor(verb) {
  const { name, section } = verb;

  // `eval` is grouped under the help's Developer section but it's the
  // primary scripting escape hatch, so it gets its own bucket.
  if (name === "eval") return "Eval";
  if (section === "Developer") return "Dev";

  if (name === "task" || name === "tasks") return "Tasks";

  if (name === "properties" || name.startsWith("property:")) return "Properties";

  if (
    name === "plugins" ||
    name.startsWith("plugin:") ||
    name === "plugin" ||
    name.startsWith("plugins:")
  ) {
    return "Plugins";
  }

  if (name === "daily" || name.startsWith("daily:")) return "Daily";

  if (WRITE_VERBS.has(name)) return "Write";
  if (EDIT_VERBS.has(name)) return "Edit";
  if (READ_VERBS.has(name) || name.startsWith("read:")) return "Read";

  // Everything else (search, files, folders, vault, bookmarks, recents,
  // workspace, tabs, history, sync, snippet, theme, template, etc.) is
  // "discoverable surface area" from the agent's perspective.
  return "Discover";
}

const WRITE_VERBS = new Set([
  "create",
  "append",
  "prepend",
  "delete",
  "bookmark",
]);

const EDIT_VERBS = new Set([
  "move",
  "rename",
]);

const READ_VERBS = new Set([
  "read",
  "outline",
  "aliases",
  "links",
  "backlinks",
  "tag",
  "tags",
  "file",
  "wordcount",
]);

// ---------------------------------------------------------------------------
// Did-you-mean
// ---------------------------------------------------------------------------

const VERB_SUGGEST_MAX_DISTANCE = 2;
const FLAG_SUGGEST_MAX_DISTANCE = 2;

/**
 * Suggest a known verb close to `name`. Returns null if no candidate is
 * within `VERB_SUGGEST_MAX_DISTANCE` edits. Ties broken by shortest verb,
 * then alphabetical.
 *
 * @param {string} name
 * @param {string[]} candidates
 * @returns {string|null}
 */
function suggestVerb(name, candidates) {
  return nearest(name, candidates, VERB_SUGGEST_MAX_DISTANCE);
}

function suggestFlag(name, candidates) {
  return nearest(name, candidates, FLAG_SUGGEST_MAX_DISTANCE);
}

function nearest(needle, haystack, maxDistance) {
  let best = null;
  let bestDist = maxDistance + 1;
  for (const cand of haystack) {
    const d = levenshtein(needle, cand);
    if (d < bestDist || (d === bestDist && cand.length < (best?.length ?? Infinity))) {
      best = cand;
      bestDist = d;
    }
  }
  return bestDist <= maxDistance ? best : null;
}

/** Plain iterative Levenshtein. Small inputs — performance is not a concern. */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

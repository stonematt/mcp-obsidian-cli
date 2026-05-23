/**
 * obsidian-mcp — MCP server wrapping the Obsidian CLI.
 *
 * Pure factory. Construct with deps; do not import for side effects. The
 * runtime entrypoint lives at `bin/server.js`.
 *
 * Exposes a generic `obsidian` pass-through tool plus a typed-tool registry
 * (see `lib/tool-registry.js`) that registers convenience tools as data
 * entries. Adding a new verb = one entry, not a hand-written `server.tool`
 * block.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  text,
  errorResult,
  jsonResult,
  parseArgs,
  extractLeadingVault,
} from "./lib/helpers.js";
import {
  TYPED_TOOL_ENTRIES,
  registerTypedTools,
} from "./lib/tool-registry.js";
import { registerVaultResources } from "./lib/resources.js";

/**
 * Build a wired MCP server. Inject the CLI adapter, prompt content,
 * version string, and vault state; no side effects at module load.
 *
 * @param {object} opts
 * @param {{exec: Function, getVault: Function, setVault: Function, isObsidianRunning: Function}} opts.cli
 *   The Obsidian CLI adapter (see `lib/obsidian-cli.js`) plus an injected
 *   `isObsidianRunning` callable.
 * @param {Record<string,string>} opts.prompts - Prompt content keyed by slug
 *   (`obsidian-cli`, `obsidian-markdown`, `obsidian-bases`, `obsidian-canvas`).
 * @param {object|null} [opts.manifest] - Optional VerbManifest (see
 *   `lib/manifest.js`). When supplied, the generic `obsidian` pass-through
 *   tool gates calls through `manifest.validate(args)` and fires
 *   `manifest.refresh()` after successful reload-class verbs. Typed
 *   convenience tools bypass the manifest entirely (Zod handles their args).
 * @param {string} opts.version - Server version string surfaced via MCP.
 * @param {Set<string>} [opts.knownVaults] - Vault names Obsidian knows about.
 * @param {string|null} [opts.runtimeVault] - Initial runtime vault (or null
 *   to prompt-on-first-use when knownVaults is non-empty).
 * @returns {McpServer}
 */
export function createServer({
  cli,
  prompts,
  manifest = null,
  version,
  knownVaults = new Set(),
  runtimeVault = null,
} = {}) {
  // Verbs whose successful execution invalidates the cached help output
  // (the CLI restarts or a plugin reloads, so verb/flag shapes may shift).
  // First positional token only — leading `vault=NAME` is stripped first.
  const RELOAD_VERBS = new Set(["restart", "reload", "plugin:reload"]);

  // Seed the adapter's vault state from the runtime vault. The adapter is
  // the single source of truth for "what vault are we currently routed to";
  // the factory just hands it the initial value.
  if (runtimeVault) cli.setVault(runtimeVault);
  else cli.setVault("");

  function vaultPromptResponse() {
    const list = [...knownVaults].sort().map((v) => `  - ${v}`).join("\n");
    return text(
      `No vault selected. Available vaults:\n${list}\n\n` +
      `Ask the user which vault to use, then either:\n` +
      `  - retry through the generic \`obsidian\` tool with \`vault=NAME\` as the first token (e.g. \`vault=tyee read file="My Note"\`), or\n` +
      `  - retry any convenience tool — the server will cache the vault from the first \`vault=\` override and reuse it for subsequent calls.\n\n` +
      `If the user named a vault in conversation (e.g. "save this in tyee"), prepend \`vault=tyee\` automatically.`
    );
  }

  /**
   * Run CLI, return MCP result. Accepts a command string or an args array.
   * With `{ json: true }` (typed-tool opt-in, see #29) a successful stdout is
   * parsed and returned as structured content, degrading to text on parse
   * failure.
   */
  async function runTool(input, { json = false } = {}) {
    if (!(await cli.isObsidianRunning())) {
      return errorResult(
        "Obsidian.app is not running. Open Obsidian (it can stay backgrounded/minimized — no need to switch to it) and retry — no Claude Desktop restart needed.",
        "OBSIDIAN_NOT_RUNNING"
      );
    }

    // Cache caller-supplied vault override so subsequent convenience-tool calls
    // route to the same vault without the caller having to repeat it.
    const parsed = Array.isArray(input) ? input : parseArgs(input);
    const callerVault = extractLeadingVault(parsed);
    if (callerVault) {
      if (knownVaults.size > 0 && !knownVaults.has(callerVault)) {
        return errorResult(
          `Unknown vault '${callerVault}'. Known vaults: ${[...knownVaults].sort().join(", ")}.`,
          "VAULT_NOT_FOUND"
        );
      }
      cli.setVault(callerVault);
    } else if (!cli.getVault() && knownVaults.size > 0) {
      return vaultPromptResponse();
    }

    const { stdout, stderr, error } = await cli.exec(input);
    if (error) {
      return errorResult(error.message, error.type);
    }
    if (json) return jsonResult(stdout);
    const parts = [];
    if (stdout) parts.push(stdout);
    if (stderr) parts.push(`[stderr] ${stderr}`);
    return text(parts.join("\n") || "(no output)");
  }

  const server = new McpServer({
    name: "obsidian-mcp",
    version,
    capabilities: { tools: {} },
  });

  // ---- Generic pass-through tool ------------------------------------------

  server.tool(
    "obsidian",
    `Run any Obsidian CLI command. Pass the full command string exactly as you
would on the terminal (minus the leading 'obsidian' binary name). Leading
\`vault=NAME\` overrides the active vault and is cached for subsequent calls.

Intent -> verb cheatsheet. Use the canonical verb on the right; the convenience
tools (\`obsidian_*\`) wrap the same verbs with typed args.

PUT
  put new note from template     -> templater:create-from-template template=… file=…
  create plain note              -> create path=… content=…
  append to today's daily        -> daily:append content=…
GET
  read note                      -> read path=…   (or file=…)
  search content                 -> search:context query=… [path=… limit=…]
  list properties / read one     -> properties [file=…]  |  property:read name=… file=…
  list backlinks                 -> backlinks file=…
MOVE/RENAME
  move or rename note            -> move file=… to=…   (or path=…)
DELETE
  delete note                    -> delete path=…
DISCOVER
  list files                     -> files [folder=… ext=…]
  list tags with counts          -> tags counts [sort=name|count]
  list tasks                     -> tasks [daily todo done path=…]
  recently opened                -> recents
  CLI reference                  -> help [verb]

If you don't see the intent here, the CLI's \`help\` verb is the source of truth.`,
    { command: z.string().describe("CLI command and arguments") },
    async ({ command }) => {
      const parsed = parseArgs(command);

      // Pre-call manifest validation (pass-through only — typed tools rely on
      // Zod schemas). On `{ok:false, hint}` we short-circuit with the hint;
      // on `{ok:false}` with no hint or `{ok:true}` we fall through to exec.
      if (manifest && typeof manifest.validate === "function") {
        try {
          const v = await manifest.validate(parsed);
          if (v && v.ok === false && v.hint) {
            return { isError: true, content: [{ type: "text", text: v.hint }] };
          }
        } catch {
          // Manifest failures must not break the pass-through. Fall through
          // to exec and let the CLI surface any real error.
        }
      }

      const result = await runTool(command);

      // Reload detection — only on success, and only when the first non-vault
      // token names a verb that mutates the CLI's verb/flag surface. Exactly
      // one refresh per matching call.
      if (!result?.isError && manifest && typeof manifest.refresh === "function") {
        const first = parsed[0]?.startsWith("vault=") ? parsed[1] : parsed[0];
        if (first && RELOAD_VERBS.has(first)) {
          try { await manifest.refresh(); } catch { /* swallow — best-effort */ }
        }
      }

      return result;
    },
  );

  // ---- Typed convenience tools (registry-driven) -------------------------
  //
  // Every typed tool is one entry in `TYPED_TOOL_ENTRIES`. The loop wires
  // each entry's Zod schema + build() into a `server.tool` registration.
  // `obsidian_help` uses a custom handler (ctx.helpHandler) because it
  // depends on the injected manifest + prompts map.

  const helpHandler = makeHelpHandler({ manifest, prompts });
  registerTypedTools(server, runTool, TYPED_TOOL_ENTRIES, { helpHandler });

  // ---- MCP Resources (read-only vault metadata) --------------------------
  //
  // obsidian://vault, /files, /tags — lazy, cheap, read through the same CLI
  // adapter the tools use (see lib/resources.js).

  registerVaultResources(server, cli);

  // ---- MCP Prompts -----------------------------------------------------------

  const promptMeta = {
    "obsidian-cli": {
      title: "Obsidian CLI Reference",
      description: "CLI usage patterns, parameter syntax, and command examples for the Obsidian CLI. Adapted from kepano/obsidian-skills (MIT License, https://github.com/kepano/obsidian-skills).",
    },
    "obsidian-markdown": {
      title: "Obsidian Flavored Markdown Reference",
      description: "Wikilinks, embeds, callouts, properties, tags, and other Obsidian-specific markdown syntax. Adapted from kepano/obsidian-skills (MIT License, https://github.com/kepano/obsidian-skills).",
    },
    "obsidian-bases": {
      title: "Obsidian Bases Reference",
      description: "Bases syntax for database-like views: filters, formulas, view types, and summaries. Adapted from kepano/obsidian-skills (MIT License, https://github.com/kepano/obsidian-skills).",
    },
    "obsidian-canvas": {
      title: "JSON Canvas Reference",
      description: "JSON Canvas format for visual canvases: node types, edges, groups, and layout. Adapted from kepano/obsidian-skills (MIT License, https://github.com/kepano/obsidian-skills).",
    },
  };

  for (const [name, content] of Object.entries(prompts)) {
    const meta = promptMeta[name];
    if (!meta) continue;
    server.registerPrompt(
      name,
      { title: meta.title, description: meta.description },
      () => ({
        messages: [{ role: "user", content: { type: "text", text: content } }],
      })
    );
  }

  return server;
}

// ---------------------------------------------------------------------------
// obsidian_help handler — closes over the injected manifest + prompts.
// Reserved-doc-slug-wins routing lives here so the registry entry stays
// pure data.
// ---------------------------------------------------------------------------

function makeHelpHandler({ manifest, prompts }) {
  return async ({ topic }) => {
    if (!topic) {
      if (manifest) {
        const index = await manifest.all();
        return text(renderVerbIndex(index));
      }
      return text(renderDocSlugList(prompts));
    }

    // Reserved doc slugs (cli/markdown/bases/canvas) are a curated namespace
    // and win over a same-named live verb: the doc is what the tool advertises,
    // and resolving it from the static prompts map means docs stay reachable
    // even when Obsidian is down. The shadowed verb (only `bases` today) still
    // appears in the no-arg index. Verb lookup serves every other topic.
    const promptKey = `obsidian-${topic}`;
    if (prompts && Object.prototype.hasOwnProperty.call(prompts, promptKey)) {
      return text(prompts[promptKey]);
    }

    if (manifest) {
      const verb = await manifest.forVerb(topic);
      if (verb) return text(renderVerbHelp(verb));
    }

    return text(
      `No help found for '${topic}'. Try obsidian_help() with no arguments to browse the verb index, or pass a doc slug: cli, markdown, bases, canvas.`,
    );
  };
}

/**
 * Render a category-grouped verb index (the output of `manifest.all()`) into
 * the plain text block returned by `obsidian_help()` with no args. Empty
 * categories are skipped so the surface stays scannable.
 *
 * @param {Record<string, string[]>} index
 * @returns {string}
 */
function renderVerbIndex(index) {
  const lines = ["Obsidian CLI verbs (live from `obsidian help`):", ""];
  let any = false;
  for (const [category, verbs] of Object.entries(index)) {
    if (!verbs || verbs.length === 0) continue;
    any = true;
    lines.push(`${category}:`);
    for (const verb of verbs) {
      lines.push(`  ${verb}`);
    }
    lines.push("");
  }
  if (!any) {
    lines.push("(no verbs reported by the CLI)");
  }
  lines.push("Reference docs: pass topic=cli|markdown|bases|canvas for Kepano-derived guides.");
  lines.push("Verb detail:    pass topic=<verb> (e.g. \"read\", \"daily:append\") for flag-level help.");
  return lines.join("\n");
}

/**
 * Render the help block for a single verb (the output of `manifest.forVerb`).
 * Mirrors the CLI's own help formatting closely enough that callers can copy
 * the example tokens verbatim.
 *
 * @param {{name: string, description: string, flags: Array<{name: string, valueShape: string|null, description: string}>}} verb
 * @returns {string}
 */
function renderVerbHelp(verb) {
  const lines = [`${verb.name} — ${verb.description}`.trimEnd()];
  if (!verb.flags || verb.flags.length === 0) {
    lines.push("");
    lines.push("(no flags)");
    return lines.join("\n");
  }
  lines.push("");
  lines.push("Flags:");
  for (const flag of verb.flags) {
    const left = flag.valueShape ? `${flag.name}=${flag.valueShape}` : flag.name;
    const desc = flag.description ? `  - ${flag.description}` : "";
    lines.push(`  ${left}${desc}`);
  }
  return lines.join("\n");
}

/**
 * Render the bare list of available reference-doc slugs. Used as a fallback
 * for `obsidian_help()` when no manifest is wired (no live verb index to
 * show, so we at least advertise the static docs).
 *
 * @param {Record<string,string>} prompts
 * @returns {string}
 */
function renderDocSlugList(prompts) {
  const slugs = Object.keys(prompts || {})
    .filter((k) => k.startsWith("obsidian-"))
    .map((k) => k.slice("obsidian-".length))
    .sort();
  if (slugs.length === 0) {
    return "No reference docs are loaded.";
  }
  return [
    "Available reference docs (pass as topic=):",
    ...slugs.map((s) => `  ${s}`),
  ].join("\n");
}

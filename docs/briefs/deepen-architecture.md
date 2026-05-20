## Problem Statement

As a maintainer of `mcp-obsidian-cli`, I want the codebase to be testable in-process and easy to extend with new verbs, so that I can pursue **skill parity** with the `obsidian:obsidian-cli` Claude Code skill without per-verb boilerplate or fragile spawn-based tests.

Today, `server.js` is a ~425-line single file that:

- Does config load, prompt I/O, CLI path resolution, and CLI invocation at module scope (top-level `await`), so importing the server has unavoidable side effects.
- Couples CLI execution to MCP response formatting in `runTool`, with no seam for substituting a fake CLI in tests.
- Registers 13 typed tools as repetitive boilerplate, each ~15 lines duplicating the same shape (schema → arg array → `runTool`).
- Ships an `obsidian_help` tool that only exposes 4 static reference prompts and has no view of the live verb manifest (the output of `obsidian help`).
- Has at least one known verb-drift bug (`obsidian_create` accepts `template=`, which routes to plain CLI `create` — NOT `templater:create-from-template` — so Templater placeholders silently do not expand).

The result is that adding any new verb requires editing four places in one file, tests of tool logic must spawn a Node subprocess, and LLM clients have no in-band way to discover what verbs exist beyond the 13 typed tools.

## Solution

Deepen the architecture by introducing two small modules with stable interfaces, and split the entrypoint from the server definition:

- **ObsidianCli** — a dumb-pipe adapter around the `obsidian` subprocess. One method: `exec(args)`. Owns vault injection, timeout, ENOENT mapping, CLI-path resolution. Tests inject a fake.
- **VerbManifest** — a cache over `obsidian help` output. Owns parsing, TTL, refresh, and arg validation hints (e.g. reject `dest=`, suggest `to=`).
- **`createServer({cli, prompts, manifest, version})`** — a pure factory. No side effects at module load.
- **`bin/server.js`** — the entrypoint. Loads config, primes the manifest, checks Obsidian is running, connects the transport.
- **Routing-layer cheatsheet** — an intent→verb table embedded in the generic `obsidian` tool's description, so LLMs pick the right verb without a help round-trip.
- **Folded `obsidian_help(topic?)`** — no arg returns a category-grouped verb index from the manifest; a verb name returns its live help block; a doc slug (`cli|markdown|bases|canvas`) returns the prompt content.
- **Declarative tool registry** — each typed tool is one entry in a table, registered by a single loop. Adding a verb is one entry, not 15 lines.

Rolled out in four phases so each PR is reviewable and ships behavior incrementally; see Implementation Decisions.

## User Stories

1. As an **LLM client**, I want one MCP tool description that maps common intents (put, get, append, set property, move, delete, discover) to the right verb, so that I resolve "put new note from template" to `templater:create-from-template` on the first try instead of `create`.
2. As an **LLM client**, I want a single `obsidian_help` tool that returns the live verb manifest with no argument, so that I can discover what verbs exist before formulating a call.
3. As an **LLM client**, I want `obsidian_help(verb)` to return the live syntax for that verb, so that I get authoritative argument names instead of guessing from training data.
4. As an **LLM client**, I want `obsidian_help(topic)` to return reference prompt content when `topic` is `cli`, `markdown`, `bases`, or `canvas`, so that I can fetch deep reference docs without leaving the tool surface.
5. As an **LLM client**, I want the generic `obsidian` tool to validate my args against the verb manifest before invoking the CLI, so that I get a clear "did you mean `to=`?" hint instead of an opaque CLI error.
6. As an **LLM client using Claude Desktop**, I want every verb that the `obsidian:obsidian-cli` skill exposes in Claude Code to be reachable via this MCP server, so that I have feature parity across surfaces.
7. As an **LLM client**, I want a separate `obsidian_create_from_template` tool wrapping `templater:create-from-template`, so that Templater placeholders actually expand and I do not accidentally use plain `create template=`.
8. As an **LLM client**, I want typed tools for `move`, `rename`, `delete`, and folder creation, so that common write operations have first-class affordances.
9. As an **LLM client**, I want typed tools for `outline`, `command`, `template:read`, and `history`, so that read affordances reach skill parity.
10. As a **maintainer**, I want `server.js` to export a `createServer` factory with no side effects, so that I can import it from a test without paying the cost of disk reads, CLI path resolution, and a running Obsidian instance.
11. As a **maintainer**, I want all CLI interaction to flow through a single `ObsidianCli.exec(args)` adapter, so that I have one place to change timeout policy, error mapping, or vault injection.
12. As a **maintainer**, I want the verb manifest to refresh automatically when a `restart`, `reload`, or `plugin:reload` pass-through call succeeds, so that the manifest stays current after plugin updates without manual intervention.
13. As a **maintainer**, I want the verb manifest to have a 15-minute TTL and a 5-second timeout backstop on live refresh calls, so that staleness and CLI hangs are bounded.
14. As a **maintainer**, I want CLI path discovery (`KNOWN_CLI_PATHS`, the `which` probe, the `ps aux` fallback) to live behind the `ObsidianCli` module, so that the wiring code in `bin/server.js` stays small.
15. As a **maintainer**, I want the server `version` string to come from `package.json`, so that publishing a new version cannot drift from the version reported by the MCP server.
16. As a **maintainer**, I want each typed tool to be a single data entry (`{name, description, schema, build}`) in a registry, so that adding a verb is one row instead of 15 lines of `server.tool(...)` boilerplate.
17. As a **maintainer**, I want common tool-argument validations (e.g. "one of file or path is required") to be reusable across registry entries, so that I do not duplicate the same `if (!file && !path)` check in every typed tool.
18. As a **maintainer**, I want the `obsidian_help` tool to fold both verb-help and doc-help into one surface, so that there are not two competing "help" concepts in the tool list.
19. As a **maintainer**, I want documented vocabulary (`Verb`, `ObsidianCli`, `VerbManifest`, `Pass-through tool`, `Typed tool`, `Cheatsheet`) captured in `CONTEXT.md`, so that future PRs and future contributors converge on the same language.
20. As a **maintainer**, I want the bug in `obsidian_create` (`template=` not invoking Templater) fixed by splitting the verb intent into two tools, so that the existing tool stops silently doing the wrong thing.
21. As a **test author**, I want to write tests for tool-handler logic by injecting a fake `ObsidianCli`, so that I do not need to spawn Node subprocesses or have a running Obsidian to test argument construction.
22. As a **test author**, I want `VerbManifest` to be constructible with a fake `ObsidianCli`, so that I can test TTL behavior, refresh-on-reload detection, and validation-hint output deterministically.
23. As a **test author**, I want the existing health-check test (which spawns a node process) to remain valid, so that the binary entrypoint still has end-to-end coverage.
24. As a **future contributor adding a verb**, I want a single registry entry and a single `CONTEXT.md` term to update, so that I can ship a new typed tool in one small PR without touching the adapter, manifest, or server factory.
25. As a **future contributor**, I want `CONTEXT.md` to record the resolved ambiguities (live help vs prompt docs; plain `create template=` vs `templater:create-from-template`), so that I do not re-litigate them.

## Implementation Decisions

### Module structure

- **`lib/obsidian-cli.js` (new).** Exports `createObsidianCli({cliPath, vault, timeoutMs, execFile})` returning `{ exec(args) }`. Result shape: `{ stdout, stderr, error | null }` where `error` is `{ type: 'CLI_NOT_FOUND' | 'TIMEOUT' | 'EXECUTION_ERROR', message }`. Adapter injects `vault=<vault>` into the args internally; callers pass only the logical args. `execFile` is a constructor param defaulted to `node:child_process`'s `execFile`, so tests can inject a fake without monkey-patching. Also exports `resolveCliPath`, `KNOWN_CLI_PATHS`, and `checkObsidianRunning` (relocated from `server.js`).

- **`lib/manifest.js` (new).** Exports `createVerbManifest({cli, ttlMs = 15 * 60_000, fetchTimeoutMs = 5000, now = Date.now})`. Methods:
  - `all()` — returns category-grouped verb index (Read / Write / Edit / Discover / Tasks / Daily / Properties / Plugins / Dev / Eval).
  - `forVerb(name)` — returns cached help block for that verb.
  - `validate(args)` — returns `{ ok, hint? }`; hints include `dest=` → suggest `to=`, did-you-mean for unknown flags.
  - `refresh()` — re-fetches the full manifest from `obsidian help`.
  - Primes lazily on first call; honors TTL and explicit refresh.

- **`server.js` (rewrite).** Exports `createServer({cli, prompts, manifest, version})` returning a wired `McpServer`. No top-level `await`. No file I/O. No process exits. Registers the pass-through tool, the folded `obsidian_help` tool, and all typed tools via a registry loop (PR3+).

- **`bin/server.js` (new).** Entrypoint pointed to by `package.json`'s `bin` field. Order of operations:
  1. Load config (`loadConfig`).
  2. Resolve CLI path (`resolveCliPath`).
  3. Check Obsidian is running; exit 1 with the existing stderr message if not.
  4. Build the `ObsidianCli` adapter.
  5. Build the `VerbManifest` (constructor; lazy prime, or eager prime if we want startup validation).
  6. Load prompt files into memory.
  7. Read version from `package.json`.
  8. Call `createServer(...)`, attach `StdioServerTransport`, connect.

- **`lib/helpers.js` (kept).** Continues to export `loadConfig`, `parseArgs`, `text`, `errorResult`. Adds `loadVersion(packageJsonPath)` for `bin/`.

- **`package.json`.** `bin.mcp-obsidian-cli` repoints from `./server.js` to `./bin/server.js`.

### Interface decisions (locked during grilling)

- **Result-shape errors**, not thrown errors. `ObsidianCli.exec` always returns; callers branch on `error`. Matches today's `run()` shape; minimizes try/catch noise in handlers.
- **Adapter injects `vault=`**. Bound at construction. Callers do not append it.
- **Adapter is a dumb pipe.** One method only. Verb-aware methods rejected — they would force two changes per new verb.
- **`createServer` is a factory, not a singleton**. Prompts and manifest are injected, not loaded inside the factory.
- **Validation lives in the pass-through tool only.** Typed tools rely on their Zod schema; double-validation is rejected.
- **Reload detection is middleware in the pass-through handler.** If a command matches `restart|reload|plugin:reload` and succeeds, `manifest.refresh()` runs afterward.

### Help-surface shape

A single `obsidian_help({topic?})` tool replaces today's `obsidian_help`:

- No arg → `manifest.all()` (category-grouped verb index).
- `topic` is a verb → `manifest.forVerb(topic)`.
- `topic` is one of `cli|markdown|bases|canvas` → corresponding prompt content.
- On ambiguity (verb name collides with doc slug), the reserved doc slug wins — the four slugs are a curated namespace and the doc is what the tool advertises. Resolving from the static prompts map also keeps docs reachable when Obsidian is down. The shadowed verb (only `bases` today) stays visible in the no-arg index. (Revised by #56; the original design had verb-wins, which made the Bases doc unreachable.)

The MCP prompts (`registerPrompt` calls for the 4 reference docs) remain, since they are the canonical mechanism for clients that support prompts.

### Pass-through cheatsheet

The generic `obsidian` tool's description grows to include an intent→verb routing table. Categories: PUT, GET, MOVE/RENAME, DELETE, DISCOVER. Each row maps a natural-language intent to the canonical verb with argument hints. Source: the verified manifest section of the user's investigation notes. Description stays under ~40 lines so it does not bloat tool selection.

### `obsidian_create` Templater split

Existing `obsidian_create` keeps its name but drops its `template` parameter (or changes its semantics — TBD during implementation). A new `obsidian_create_from_template` typed tool wraps `templater:create-from-template`, taking `template` (vault-relative path) and `file` (output path). Resolves the bug where `create template=<name>` silently fails to expand Templater placeholders.

### Tool registry shape (PR3)

Each typed tool becomes a data entry, e.g.:

```
{
  name: "obsidian_daily_append",
  description: "...",
  schema: { content: z.string().describe("Content to append") },
  build: ({content}) => ["daily:append", `content=${content}`],
  requires: [],   // optional: e.g. ["fileOrPath"] for shared validators
}
```

A single registration loop converts entries into `server.tool(...)` calls. New verbs = new entries; the loop and the adapter are unchanged.

### Phased rollout

- **PR1 — Seam + factory.** New `lib/obsidian-cli.js`. New `bin/server.js`. `server.js` rewritten as `createServer` factory. No new tools, no UX changes, no manifest yet. Pure refactor. Health-check test preserved; new in-process tool tests added.
- **PR2 — Manifest + help fold + cheatsheet + validation.** New `lib/manifest.js`. Folded `obsidian_help`. Rich pass-through tool description (cheatsheet). Pass-through arg validation. Reload-detection middleware. Fix `obsidian_create` Templater drift.
- **PR3 — Tool registry.** Refactor existing typed tools into registry entries. No behavior change.
- **PR4+ — Verb expansion.** Add `obsidian_create_from_template`, `obsidian_move`, `obsidian_rename`, `obsidian_delete`, `obsidian_outline`, `obsidian_command`, `obsidian_template_read`, `obsidian_history`, folder creation. Each = one registry entry. Drives toward skill parity.

## Testing Decisions

### What makes a good test here

Tests should exercise external behavior — the shape of MCP responses, the args sent to the CLI, manifest cache invalidation triggered by observable events. They should not assert on internal helper naming, internal data structures, or specific log lines. Adapter and manifest tests should be deterministic: no real Obsidian, no real subprocess.

### Prior art

`test/unit.test.js` (node:test, `node:assert/strict`, no test-framework dependency, ES module imports) is the model for new tests. `test/run.test.js` (subprocess-spawning health check) remains as the binary-entrypoint smoke test.

### Modules to test

- **`ObsidianCli`** — inject a fake `execFile` via the constructor param.
  - Vault injection: when `vault` is set, `vault=<name>` appears in the final args.
  - Vault omitted when empty.
  - ENOENT maps to `error.type === 'CLI_NOT_FOUND'`.
  - Timeout (killed process) maps to `error.type === 'TIMEOUT'`.
  - Generic failure maps to `error.type === 'EXECUTION_ERROR'` and surfaces stderr.
  - Success returns trimmed stdout/stderr and `error: null`.
  - `parseArgs` continues to handle quoted values (unit test already exists).

- **`VerbManifest`** — inject a fake `ObsidianCli` and a fake `now`.
  - First call to `all()`/`forVerb()` triggers exactly one `cli.exec(['help'])`.
  - Subsequent calls within TTL do not re-fetch.
  - After TTL elapses, the next call re-fetches.
  - `refresh()` re-fetches unconditionally.
  - `validate(['move', 'dest=foo'])` returns `{ ok: false, hint: contains "to=" }`.
  - `validate(['unknown-verb'])` returns `{ ok: false }` with a did-you-mean if a close verb exists.
  - 5-second fetch timeout surfaces a bounded error and does not hang.

- **`createServer` integration** — build with a fake `cli` and a fake `manifest`; resolve a tool call and assert on the response.
  - Pass-through tool forwards args verbatim and calls `manifest.validate` first.
  - Pass-through middleware calls `manifest.refresh()` after a successful `restart`/`reload`/`plugin:reload` command.
  - `obsidian_help` no-arg path returns the manifest index.
  - `obsidian_help(verb)` returns the manifest's verb block.
  - `obsidian_help("markdown")` returns the markdown prompt content.
  - Each typed tool, given valid args, calls `cli.exec` with the expected args.
  - Each typed tool's validation branch (missing-required, mutually-exclusive) returns an error result with `isError: true`.

- **Health check (existing)** — `test/run.test.js` stays. It is the binary-entrypoint smoke test.

## Out of Scope

- A general `ObsidianEnvironment` module that abstracts macOS specifics (candidate #4 from the architecture review). CLI-path resolution and "is Obsidian running" stay inside `lib/obsidian-cli.js` for now. Revisit when a Linux or Windows adapter is needed.
- Switching off result-shape errors to thrown errors. Considered and rejected during grilling.
- Replacing the existing MCP prompts. They remain registered; only the duplicate `obsidian_help` tool is folded.
- A second pass on tool descriptions (length, examples, formatting) beyond adding the cheatsheet. Future polish PR.
- Localization of error messages.
- A Windows or Linux CLI-discovery path. Today's macOS-specific `ps aux | grep` + `/Applications/Obsidian.app` paths are retained.
- Persisting the verb manifest to disk between server runs. In-memory only.
- Schema migrations or breaking changes to config file format.

## Further Notes

- `CONTEXT.md` was added at the repo root during the design grilling and is the canonical glossary. Future verb-addition PRs grow this file; future ADRs cite its terms.
- The phased rollout is the intended sequence. PR1 is the riskiest because it touches every entrypoint, but it ships zero observable behavior change — the rollout is calibrated so PR1 can land behind no flag.
- `obsidian help` is fast (~25KB, ~instant in subprocess); the historical "hang" was an artifact of interactive Bash in Claude Code, not the CLI itself. Manifest priming at startup is safe.
- Once PR3 ships the tool registry, expect a steady stream of small verb-addition PRs (PR4, PR5, …) — these are the skill-parity workhorses.

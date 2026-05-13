# mcp-obsidian-cli

An MCP server that exposes an Obsidian vault to AI assistants by wrapping the `obsidian` CLI binary. Goal is **skill parity** — every verb reachable from the `obsidian:obsidian-cli` skill in Claude Code should be reachable from Claude Desktop via this MCP server.

## Language

### CLI layer

**Verb**:
A subcommand of the `obsidian` CLI binary (`daily:read`, `property:set`, `search:context`, `templater:create-from-template`).
_Avoid_: command, action, operation.

**Pass-through tool**:
The single generic MCP tool named `obsidian` that accepts any verb string and forwards it unchanged. The escape hatch when no typed tool exists.
_Avoid_: generic tool, raw tool, exec tool.

**Typed tool**:
An MCP tool wrapping one verb with a Zod schema and a hand-written description. The convenience surface (e.g. `obsidian_daily_read`, `obsidian_search`).
_Avoid_: convenience tool, wrapper tool, specific tool.

### Architecture

**ObsidianCli**:
The adapter that wraps the `obsidian` subprocess. A dumb pipe: one method `exec(args) → {stdout, stderr, error|null}`. Injects `vault=` internally. Owns timeout, ENOENT mapping, and CLI-path resolution.
_Avoid_: ObsidianClient, CliAdapter, runner.

**VerbManifest**:
Parsed cache of `obsidian help` output. Live source of truth for which verbs exist and what args they accept. Primed at server start, refreshed on TTL or detected reload.
_Avoid_: help cache, verb catalog, command registry.

**Cheatsheet**:
The intent→verb routing table embedded in the pass-through tool's description. Maps natural-language intents ("put new note from template") to the right verb (`templater:create-from-template`). The routing layer; not a help surface.
_Avoid_: examples, hints, guide.

### Behavior

**Skill parity**:
The north-star goal — every verb available in the `obsidian:obsidian-cli` Claude Code skill is exposed as a typed MCP tool here.

**Reload detection**:
Middleware in `runTool` that watches for `restart`, `reload`, or `plugin:reload` pass-through calls and refreshes the `VerbManifest` afterwards.

## Relationships

- A **Typed tool** wraps exactly one **Verb**.
- A **Typed tool** delegates execution to the **ObsidianCli**.
- The **Pass-through tool** validates args against the **VerbManifest** before calling **ObsidianCli**.
- The **VerbManifest** is populated by calling the **ObsidianCli** with the `help` verb.
- The **Cheatsheet** points the LLM at verbs that may or may not have a **Typed tool** — when missing, the **Pass-through tool** handles them.
- `obsidian_help` returns either a **Verb** block (from **VerbManifest**) or a doc prompt (`cli|markdown|bases|canvas`).

## Example dialogue

> **Dev:** "If I add a typed tool for `move`, does the **ObsidianCli** change?"
> **Domain expert:** "No. The **ObsidianCli** is a dumb pipe — adding a **Verb** never deepens it. You add one entry to the tool registry; the adapter is untouched."

> **Dev:** "What's the difference between the **Cheatsheet** and `obsidian_help`?"
> **Domain expert:** "The **Cheatsheet** is routing — picked-up automatically when the LLM scans tool descriptions. `obsidian_help` is on-demand syntax. Three roles, no overlap: **Cheatsheet** routes, `obsidian_help` looks up syntax, MCP prompts give deep reference."

> **Dev:** "Why not let `obsidian_create` take a `template=` arg?"
> **Domain expert:** "Because `obsidian create template=` does not expand Templater placeholders — different **Verb** entirely. The Templater path is `templater:create-from-template`, and it deserves its own **Typed tool** so the LLM picks the right one."

## Flagged ambiguities

- "help" used to mean both the live CLI help output (`obsidian help <verb>`) and the static reference prompts (`obsidian-cli`, `obsidian-markdown`, etc.). Resolved: live help comes from **VerbManifest** (per-verb), prompts are separate `docs`. The single `obsidian_help` tool routes between them — verb name wins over doc slug on ambiguous input.
- "template" used to mean both plain CLI templates (`create template=<name>`) and Templater placeholder expansion (`templater:create-from-template template=<path>`). Resolved: these are distinct **Verbs**. Typed tools must not conflate them.

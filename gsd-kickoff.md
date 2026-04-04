# GSD Kickoff: mcp-obsidian-cli

Initialize a GSD project at `/Users/mstone/src/github.com/stonematt/mcp-obsidian-cli`.

## What This Is

An MCP (Model Context Protocol) server distributed via npm/npx that wraps the Obsidian CLI plugin, exposing Obsidian's full native API surface to AI assistants like Claude Desktop, Claude Code, Cursor, and any MCP-compatible client. Ships with built-in MCP prompts that teach the AI how to use Obsidian effectively — the MCP equivalent of Kepano's `obsidian-skills` for Claude Code.

## Core Value

Full Obsidian API access over MCP — search index, wikilink resolution, tasks, properties, daily notes, backlinks, 80+ commands — with zero API keys and zero REST plugins. Just the CLI. Plus embedded knowledge that teaches any MCP client Obsidian conventions, markdown syntax, and CLI patterns without requiring separate skill files.

## The Problem

Existing Obsidian MCP servers fall into two camps:
1. **REST API servers** (`mcp-obsidian`, `obsidian-mcp-server`, `obsidian-semantic-mcp`, etc.) — require the Local REST API plugin, API key configuration, HTTP overhead, and expose only ~10 operations.
2. **Filesystem servers** (`obsidian-mcp`, `mcpvault`, etc.) — read/write `.md` files directly on disk. No Obsidian awareness: no search index, no wikilink resolution, no task queries, no property types, no backlinks.

Neither approach gives AI assistants access to what makes Obsidian powerful: its internal APIs.

Additionally, Kepano's `obsidian-skills` (github.com/kepano/obsidian-skills, 19k+ stars) provides excellent agent guidance for CLI usage, markdown syntax, Bases, and JSON Canvas — but only for agents with shell access (Claude Code, Codex, OpenCode). MCP clients like Claude Desktop have no way to consume these skills. The knowledge needs to be delivered via MCP prompts and rich tool descriptions instead.

## The Solution

Wrap the Obsidian CLI plugin, which communicates with the running Obsidian instance via Electron IPC. The CLI exposes 80+ commands covering the full Obsidian API: file operations, search, daily notes, tasks, properties, backlinks, tags, bookmarks, templates, plugins, sync, history, and more.

The MCP server shells out to the `obsidian` binary for each tool invocation. A generic pass-through tool handles any CLI command string; typed convenience tools provide schema-validated interfaces for the most common operations.

**MCP Prompts** ship with the server to teach the AI Obsidian conventions. These are the MCP-native equivalent of Kepano's SKILL.md files — the AI can request them to learn CLI patterns, markdown syntax, property types, and vault best practices before performing operations.

## Requirements

### Must Have (v1.0)
- [ ] **MCP-01**: `npx mcp-obsidian-cli` starts a working MCP server on stdio
- [ ] **MCP-02**: Generic `obsidian` tool accepts any CLI command string and returns output
- [ ] **MCP-03**: Typed convenience tools for: daily:read, daily:append, read, search:context, tags, tasks, properties, property:set, create, backlinks, files, recents
- [ ] **MCP-04**: `OBSIDIAN_VAULT` env var targets a specific vault by name
- [ ] **MCP-05**: `OBSIDIAN_CLI_PATH` env var overrides the CLI binary path
- [ ] **MCP-06**: `OBSIDIAN_TIMEOUT_MS` env var controls command timeout (default 15s)
- [ ] **MCP-07**: Graceful error handling — CLI failures return MCP error results, not crashes
- [ ] **MCP-08**: Published on npm as `mcp-obsidian-cli`
- [ ] **MCP-09**: README with Claude Desktop config example, tool reference, comparison table

### Should Have (v1.x) — Prompts & Knowledge
- [ ] **MCP-10**: MCP prompt: `obsidian-cli` — CLI usage patterns, parameter syntax, common command examples (mirrors Kepano's `obsidian-cli` SKILL.md)
- [ ] **MCP-11**: MCP prompt: `obsidian-markdown` — Obsidian Flavored Markdown reference: wikilinks, embeds, callouts, properties, tags, block IDs (mirrors Kepano's `obsidian-markdown` SKILL.md)
- [ ] **MCP-12**: MCP prompt: `obsidian-bases` — Bases syntax: views, filters, formulas, summaries (mirrors Kepano's `obsidian-bases` SKILL.md)
- [ ] **MCP-13**: MCP prompt: `obsidian-canvas` — JSON Canvas format: nodes, edges, groups, connections (mirrors Kepano's `json-canvas` SKILL.md)
- [ ] **MCP-14**: Tool descriptions enriched with CLI help text and usage examples for better LLM tool selection

### Should Have (v1.x) — Server Features
- [ ] **MCP-15**: Structured output parsing — JSON format results parsed into structured MCP content
- [ ] **MCP-16**: Multi-vault support — tool to list available vaults, switch between them
- [ ] **MCP-17**: MCP resources exposing vault metadata (vault name, file count, tag list)
- [ ] **MCP-18**: Connection health check — verify Obsidian is running and CLI is responsive before tool calls

### Out of Scope
- File watching or live updates — MCP is request/response
- Custom Obsidian plugin development — we wrap the existing CLI
- Web/SSE transport — stdio only for v1
- Authentication — localhost tool; Obsidian handles its own security
- Caching — every call hits the live Obsidian instance

## Context

### Technical
- The Obsidian CLI is built into Obsidian as of v1.8+. The `obsidian` binary at `/Applications/Obsidian.app/Contents/MacOS/obsidian` serves double duty: launch the app normally, or execute CLI subcommands when the app is already running. Full docs: https://help.obsidian.md/cli
- The CLI works from any shell when Obsidian is running. No special PATH or environment setup needed.
- The CLI supports `vault=<n>` to target a specific vault.
- Output formats vary by command: plain text, TSV, JSON, YAML, tree. The generic pass-through returns raw output; convenience tools could parse structured formats.

### Kepano's obsidian-skills (reference implementation for prompts)
- **Repo**: github.com/kepano/obsidian-skills — 19k+ stars, 5 skills
- **Skills shipped**: `obsidian-cli`, `obsidian-markdown`, `obsidian-bases`, `json-canvas`, `defuddle`
- **Format**: SKILL.md files per the Agent Skills specification (agentskills.io)
- **Target**: Agents with shell access — Claude Code, Codex CLI, OpenCode
- **Gap**: No MCP delivery mechanism. Claude Desktop, Cursor MCP, and other MCP-only clients can't consume SKILL.md files.
- **Our approach**: Deliver equivalent knowledge via MCP prompts (`server.prompt()` in the MCP SDK). The AI can request `get_prompt("obsidian-cli")` to learn CLI patterns before using tools. This is the idiomatic MCP way to ship agent knowledge.
- **Licensing**: Kepano's skills are MIT-licensed. We can reference and adapt the content with attribution.
- **Key insight from Kepano's CLI skill**: It tells agents to run `obsidian help` for the authoritative command list rather than hardcoding commands. Our MCP server should follow the same pattern — the `obsidian` pass-through tool IS the `obsidian help` equivalent.

### MCP Prompts vs Agent Skills

| | Agent Skills (SKILL.md) | MCP Prompts |
|---|---|---|
| Delivery | File on disk, read by agent | Server-side, served over MCP protocol |
| Consumer | Claude Code, Codex, OpenCode | Any MCP client (Claude Desktop, Cursor, etc.) |
| Discovery | Agent reads `.claude/skills/` directory | Client calls `prompts/list`, agent sees available prompts |
| Invocation | Automatic (agent reads on startup) | On-demand (`get_prompt("obsidian-markdown")`) |
| Parameterization | Static text | Can accept arguments (e.g., `get_prompt("obsidian-cli", {command: "search"})`) |
| Updates | Git pull | npm update (ships with server) |

### Competitive Landscape (npm)
- `obsidian-mcp` (StevenStavrakis) — filesystem, 355 downloads
- `obsidian-mcp-server` (cyanheads) — REST API, published as `@mseep/obsidian-mcp-server`
- `@huangyihe/obsidian-mcp` — REST API, 151 downloads
- `mcp-obsidian` (MarkusPfundstein) — REST API, Python/uvx
- `@bitbonsai/mcpvault` — filesystem, renamed from `mcpvault` at Obsidian's request (trademark)
- `obsidian-semantic-mcp` (aaronsb) — REST API, 5 tools, recommends native plugin instead
- **None of these wrap the CLI. None ship MCP prompts.** This is a genuinely distinct approach on both axes.

### Trademark Note
`@bitbonsai/mcpvault` was renamed at Obsidian's request. Using "obsidian" in an unscoped npm package name may draw a takedown. Mitigation: the name `mcp-obsidian-cli` follows `mcp-{service}` convention and is descriptive rather than brand-claiming. If Obsidian objects, fall back to `@stonematt/mcp-obsidian-cli`. Claim the unscoped name first.

### Existing Code
A working prototype exists (built during this session in Claude.ai). Key files:
- `server.js` — complete MCP server implementation (~250 lines, Node.js, ES modules)
- `package.json` — dependencies: `@modelcontextprotocol/sdk`, `zod`

The prototype is functional but needs: proper bin entry for npx, error handling hardening, tool description improvements, MCP prompts, test coverage, and npm publishing setup.

## Constraints

- **Node.js ES modules** — MCP SDK is ESM-only
- **Zero build step** — plain `.js` files, no TypeScript compilation, no bundler
- **Stdio transport only** — MCP servers for Claude Desktop use stdin/stdout
- **Obsidian must be running** — CLI commands fail if the app isn't open; server should return clear errors
- **Single dependency on CLI binary** — no direct Obsidian API access; all operations go through the CLI
- **MIT attribution** — Kepano's skills content is MIT-licensed; include attribution in prompts derived from his work

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Wrap CLI, not REST API | Full API surface (80+ commands), no API keys, no plugin dependency beyond CLI | Decided |
| Generic pass-through + typed tools | Future-proof: new CLI commands work immediately via pass-through; typed tools give LLMs better schemas | Decided |
| Ship MCP prompts mirroring Kepano's skills | MCP-native knowledge delivery; Claude Desktop can't consume SKILL.md files | Decided |
| No TypeScript | Minimal project; SDK types are sufficient; avoids build step | Decided |
| Unscoped npm name | Better discoverability; fall back to scoped if trademark issue | Decided |
| Shell out via execFile | Safer than exec (no shell injection); CLI is a simple binary invocation | Decided |

## Research Needed

1. **npm name availability** — Run `npm view mcp-obsidian-cli` to confirm the name is unclaimed. If taken, fall back to scoped.
2. **CLI output formats** — Catalog which commands support `format=json` and whether structured parsing adds value for LLM tool results vs raw text pass-through.
3. **Trademark risk** — Review the `@bitbonsai/mcpvault` rename situation more closely. Understand what Obsidian's trademark policy is for npm packages.
4. **MCP prompt best practices** — Review how other MCP servers use `server.prompt()`. Determine optimal prompt granularity: one mega-prompt vs multiple focused prompts. Check if Claude Desktop actually calls `prompts/list` and surfaces prompts to users.
5. **Kepano's skill content** — Read the full content of all 5 skills (obsidian-cli, obsidian-markdown, obsidian-bases, json-canvas, defuddle). Determine what to adapt vs reference vs link to. The obsidian-markdown skill includes sub-files (PROPERTIES.md, EMBEDS.md) that may need to be inlined for MCP prompts.

## Suggested Phase Structure

### Phase 1: Foundation
Claim npm name. Set up project scaffold with package.json (bin entry, engines, type:module). Port the working prototype into the project. Verify `npx` invocation works locally with `npm link`.

### Phase 2: Tool Surface
Harden the generic pass-through tool. Add/refine typed convenience tools with good descriptions and input validation. Handle CLI errors gracefully (Obsidian not running, invalid commands, timeouts). Test against a live vault.

### Phase 3: MCP Prompts
Implement MCP prompts that teach the AI Obsidian conventions. Adapt content from Kepano's obsidian-skills (MIT, with attribution). Ship at minimum:
- `obsidian-cli` — CLI syntax, parameter patterns, common workflows
- `obsidian-markdown` — Obsidian Flavored Markdown reference (wikilinks, embeds, callouts, properties, tags)

Consider also:
- `obsidian-bases` — Bases syntax
- `obsidian-canvas` — JSON Canvas format
- Parameterized prompts (e.g., `get_prompt("obsidian-cli", {command: "search"})` returns focused help)

### Phase 4: Distribution
README with config examples, tool reference, prompt catalog, comparison table. npm publish. Verify `npx mcp-obsidian-cli` works from a clean environment. GitHub repo setup with LICENSE.

### Phase 5: Polish (v1.x)
Structured output parsing for JSON-capable commands. MCP resources for vault metadata. Connection health checks. Multi-vault tooling. Additional prompts.

---

*Use this prompt to initialize GSD planning. The prototype code is available — start by reading `server.js` in this directory.*

# mcp-obsidian-cli

## What This Is

An MCP (Model Context Protocol) server distributed via npm/npx that wraps the Obsidian CLI plugin, exposing Obsidian's full native API surface to AI assistants like Claude Desktop, Claude Code, Cursor, and any MCP-compatible client.

## Core Value

Full Obsidian API access over MCP — search index, wikilink resolution, tasks, properties, daily notes, backlinks, 80+ commands — with zero API keys and zero REST plugins. Just the CLI.

## Requirements

### Validated

- ✓ **MCP-01**: `npx mcp-obsidian-cli` starts a working MCP server on stdio — Phase 1
- ✓ **MCP-02**: Generic `obsidian` tool accepts any CLI command string — Phase 1
- ✓ **MCP-03**: Typed convenience tools (13 tools registered) — Phase 1
- ✓ **MCP-04**: `OBSIDIAN_VAULT` env var targeting — Phase 1
- ✓ **MCP-05**: `OBSIDIAN_CLI_PATH` env var override — Phase 1
- ✓ **MCP-06**: `OBSIDIAN_TIMEOUT_MS` env var — Phase 1
- ✓ **MCP-07**: Graceful error handling — Phase 1
- ✓ **MCP-08**: Published on npm as `mcp-obsidian-cli` — Phase 1
- ✓ **MCP-10**: Tool descriptions include CLI help text and examples — Phase 2.1
- ✓ **MCP-14**: Connection health check (Obsidian running detection) — Phase 1.5

### Active

- [ ] **MCP-09**: README with Claude Desktop config example, tool reference, comparison table

### Should Have (v1.x)

- [ ] **PRMT-***: MCP prompts for Obsidian knowledge (CLI, Markdown, Bases, Canvas) — shipped Phase 2.1
- [ ] **MCP-11**: Structured output parsing — JSON format results parsed into structured MCP content
- [ ] **MCP-12**: Multi-vault support — tool to list available vaults, switch between them
- [ ] **MCP-13**: MCP resources exposing vault metadata (vault name, file count, tag list)

### Out of Scope

- File watching or live updates — MCP is request/response
- Custom Obsidian plugin development — we wrap the existing CLI
- Web/SSE transport — stdio only for v1
- Authentication — localhost tool; Obsidian handles its own security
- Caching — every call hits the live Obsidian instance

## Context

### Technical

- The Obsidian CLI is provided by an Obsidian community plugin (name TBD — need to confirm exact plugin ID). It registers the `obsidian` binary which communicates with the running Obsidian app via Electron IPC.
- `which obsidian` → `/Applications/Obsidian.app/Contents/MacOS/obsidian` — the CLI shares the app binary path but exposes subcommands when the plugin is active.
- The CLI works from any shell when Obsidian is running. No special PATH or environment setup needed.
- The CLI supports `vault=<name>` to target a specific vault.
- Output formats vary by command: plain text, TSV, JSON, YAML, tree. The generic pass-through returns raw output; convenience tools could parse structured formats.

### Competitive Landscape (npm)

- `obsidian-mcp` (StevenStavrakis) — filesystem, 355 downloads
- `obsidian-mcp-server` (cyanheads) — REST API, published as `@mseep/obsidian-mcp-server`
- `@huangyihe/obsidian-mcp` — REST API, 151 downloads
- `mcp-obsidian` (MarkusPfundstein) — REST API, Python/uvx
- `@bitbonsai/mcpvault` — filesystem, renamed from `mcpvault` at Obsidian's request (trademark)
- `obsidian-semantic-mcp` (aaronsb) — REST API, 5 tools, recommends native plugin instead
- **None of these wrap the CLI.** This is a genuinely distinct approach.

### Existing Code

A working prototype exists. Key files:
- `server.js` — complete MCP server implementation (~295 lines, Node.js, ES modules)
- `package.json` — dependencies: `@modelcontextprotocol/sdk`, `zod`

The server is published on npm (v1.0.1) with 13 convenience tools, 4 MCP prompts (Obsidian CLI, Markdown, Bases, Canvas), config file support, and startup health checks.

## Constraints

- **Node.js ES modules** — MCP SDK is ESM-only
- **Zero build step** — plain `.js` files, no TypeScript compilation, no bundler
- **Stdio transport only** — MCP servers for Claude Desktop use stdin/stdout
- **Obsidian must be running** — CLI commands fail if the app isn't open; server should return clear errors
- **Single dependency on CLI binary** — no direct Obsidian API access; all operations go through the CLI

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Wrap CLI, not REST API | Full API surface (80+ commands), no API keys, no plugin dependency beyond CLI | Decided |
| Generic pass-through + typed tools | Future-proof: new CLI commands work immediately via pass-through; typed tools give LLMs better schemas | Decided |
| No TypeScript | Minimal project; SDK types are sufficient; avoids build step | Decided |
| Unscoped npm name | Better discoverability; fall back to scoped if trademark issue | Decided |
| Shell out via execFile | Safer than exec (no shell injection); CLI is a simple binary invocation | Decided |
| MCP prompts from Kepano's skills | MIT-licensed, high-quality Obsidian knowledge; attribution in prompt metadata only (not inline) | Decided — Phase 2.1 |
| Prompt content as static .md files | Loaded once at startup via readFileSync; simple, no runtime overhead | Decided — Phase 2.1 |

## Research Needed

1. **CLI plugin identity** — Confirm the exact Obsidian community plugin that provides the CLI. Check the plugin list in the vault, get the plugin ID, and link to its repo/docs.
2. **npm name availability** — Run `npm view mcp-obsidian-cli` to confirm the name is unclaimed.
3. **CLI output formats** — Catalog which commands support `format=json` and whether structured parsing adds value.
4. **Trademark risk** — Review the `@bitbonsai/mcpvault` rename situation.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-04 after Phase 2.1*

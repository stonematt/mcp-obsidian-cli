# Requirements: mcp-obsidian-cli

**Defined:** 2026-04-03
**Core Value:** Full Obsidian API access over MCP — search index, wikilink resolution, tasks, properties, daily notes, backlinks, 80+ commands — with zero API keys and zero REST plugins.

## v1 Requirements

### Core (MCP Server)

- [ ] **CORE-01**: `npx mcp-obsidian-cli` starts a working MCP server on stdio
- [ ] **CORE-02**: Generic `obsidian` tool accepts any CLI command string and returns output
- [ ] **CORE-03**: Typed convenience tools for: daily:read, daily:append, read, search:context, tags, tasks, properties, property:set, create, backlinks, files, recents
- [ ] **CORE-04**: Graceful error handling — CLI failures return MCP error results, not crashes
- [ ] **CORE-05**: Graceful timeout handling — exceeded timeouts return clear error messages

### Configuration (Environment Variables)

- [ ] **CFG-01**: `OBSIDIAN_VAULT` env var targets a specific vault by name
- [ ] **CFG-02**: `OBSIDIAN_CLI_PATH` env var overrides the CLI binary path
- [ ] **CFG-03**: `OBSIDIAN_TIMEOUT_MS` env var controls command timeout (default 15s)

### Distribution

- [ ] **DIST-01**: Published on npm as `mcp-obsidian-cli`
- [ ] **DIST-02**: README with Claude Desktop config example, tool reference, comparison table

## v2 Requirements

### Enhanced Tools

- **ENHN-01**: Tool descriptions include CLI help text for better LLM tool selection
- **ENHN-02**: Structured output parsing — JSON format results parsed into structured MCP content
- **ENHN-03**: Multi-vault support — tool to list available vaults, switch between them

### MCP Resources

- **RSRC-01**: MCP resources exposing vault metadata (vault name, file count, tag list)
- **RSRC-02**: Connection health check — verify Obsidian is running and CLI is responsive before tool calls

## Out of Scope

| Feature | Reason |
|---------|--------|
| File watching or live updates | MCP is request/response, not event-based |
| Custom Obsidian plugin development | We wrap the existing CLI, not building new plugins |
| Web/SSE transport | Stdio only for v1; Claude Desktop uses stdio |
| Authentication | Localhost tool; Obsidian handles its own security |
| Caching | Every call hits the live Obsidian instance for fresh data |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Pending |
| CORE-02 | Phase 1 | Pending |
| CORE-03 | Phase 1 | Pending |
| CORE-04 | Phase 1 | Pending |
| CORE-05 | Phase 1 | Pending |
| CFG-01 | Phase 1 | Pending |
| CFG-02 | Phase 1 | Pending |
| CFG-03 | Phase 1 | Pending |
| DIST-01 | Phase 2 | Pending |
| DIST-02 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after initial definition*

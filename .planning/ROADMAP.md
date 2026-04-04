# Roadmap: mcp-obsidian-cli

**Created:** 2026-04-03
**Granularity:** Coarse (3 phases)

## Phase 1: Foundation

**Goal:** Claim npm name, scaffold project, port working prototype, verify npx invocation

**Requirements:**
- CORE-01: `npx mcp-obsidian-cli` starts a working MCP server on stdio
- CORE-02: Generic `obsidian` tool accepts any CLI command string and returns output
- CORE-03: Typed convenience tools for: daily:read, daily:append, read, search:context, tags, tasks, properties, property:set, create, backlinks, files, recents
- CORE-04: Graceful error handling — CLI failures return MCP error results, not crashes
- CORE-05: Graceful timeout handling — exceeded timeouts return clear error messages
- CFG-01: `OBSIDIAN_VAULT` env var targets a specific vault by name
- CFG-02: `OBSIDIAN_CLI_PATH` env var overrides the CLI binary path
- CFG-03: `OBSIDIAN_TIMEOUT_MS` env var controls command timeout (default 15s)

**Success Criteria:**
1. `npm link` followed by `mcp-obsidian-cli` starts the MCP server
2. `npx mcp-obsidian-cli` works from a clean terminal invocation
3. Generic `obsidian` tool passes CLI commands and returns output
4. All 12 typed convenience tools are registered and functional
5. Missing vault or CLI path returns clear error, not crash
6. Command timeout returns error after configured milliseconds

---

## Phase 2: Distribution

**Goal:** README with examples, npm publish, verify clean install works

**Requirements:**
- DIST-01: Published on npm as `mcp-obsidian-cli`
- DIST-02: README with Claude Desktop config example, tool reference, comparison table

**Success Criteria:**
1. Package passes `npm publish --dry-run` validation
2. README contains working Claude Desktop configuration block
3. README contains complete tool reference with descriptions and examples
4. README contains comparison table distinguishing from existing MCP servers
5. `npx mcp-obsidian-cli` works from a fresh environment (after npm publish)
6. GitHub repo created with LICENSE (MIT)

---

## Phase 3: Polish (v1.x)

**Goal:** Structured output parsing, MCP resources, connection health checks

**Requirements:**
- ENHN-01: Tool descriptions include CLI help text for better LLM tool selection
- ENHN-02: Structured output parsing — JSON format results parsed into structured MCP content
- ENHN-03: Multi-vault support — tool to list available vaults, switch between them
- RSRC-01: MCP resources exposing vault metadata (vault name, file count, tag list)
- RSRC-02: Connection health check — verify Obsidian is running and CLI is responsive before tool calls

**Success Criteria:**
1. JSON-capable commands return structured MCP content, not raw text
2. `/health` tool verifies Obsidian is running and CLI is responsive
3. MCP resources expose vault name, file count, tag list
4. Multi-vault tooling lists available vaults and switches between them
5. Tool descriptions include relevant CLI help text

---

## Summary

| # | Phase | Requirements | Success Criteria |
|---|-------|--------------|------------------|
| 1 | Foundation | 8 | 6 |
| 2 | Distribution | 2 | 6 |
| 3 | Polish | 5 | 5 |

**Total:** 15 requirements across 3 phases

---
*Roadmap created: 2026-04-03*

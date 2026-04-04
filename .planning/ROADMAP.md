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

**Plans:**
- [x] 01-foundation-01-PLAN.md — Foundation hardening (bin entry, error handling, timeout) ✅ 2026-04-03

---

## Phase 1.5: Health Check & Config

**Goal:** Startup health checks, Obsidian running detection, and config file support

**Requirements:**
- HC-01: Config file at `~/.config/mcp-obsidian-cli/config.yaml` with YAML format
- HC-02: Config file supports: vault, cliPath, timeoutMs fields
- HC-03: Config precedence: env vars > config file > hardcoded defaults
- HC-04: Startup health check verifies Obsidian is running before MCP server starts
- HC-05: Clear error message if Obsidian not running, exit with code 1
- HC-06: Success startup shows version info, exit with code 0
- HC-07: Test harness at `test/run.test.js` with fail-fast behavior

**Success Criteria:**
1. Server fails fast with clear error if Obsidian not running
2. Config file at `~/.config/mcp-obsidian-cli/config.yaml` works
3. Environment variables override config file
4. Server shows version on successful startup
5. `npm test` runs with fail-fast behavior

---

## Phase 2: Distribution

**Goal:** README with examples, npm publish, verify clean install works

**Requirements:**
- DIST-01: Published on npm as `mcp-obsidian-cli`
- DIST-02: README with Claude Desktop config example, tool reference, comparison table
- DIST-03: README includes trademark caveat for "Obsidian" name
- DIST-04: README includes Ko-fi link and author info at bottom

**Plans:**
- [x] 02-distribution-01-PLAN.md — README updates (trademark, Ko-fi) — Wave 1 ✅ 2026-04-03
- [x] 02-distribution-02-PLAN.md — npm publish and GitHub repo — Wave 2 ✅ 2026-04-03

**Success Criteria:**
1. Package passes `npm publish --dry-run` validation
2. README contains working Claude Desktop configuration block
3. README contains complete tool reference with descriptions and examples
4. README contains comparison table distinguishing from existing MCP servers
5. `npx mcp-obsidian-cli` works from a fresh environment (after npm publish)
6. GitHub repo created with LICENSE (MIT)

---

## Phase 2.1: MCP Prompts (INSERTED)

**Goal:** Ship Obsidian knowledge as MCP prompts mirroring Kepano's obsidian-skills, enabling MCP clients (Claude Desktop, Cursor) to learn CLI patterns, markdown syntax, and vault conventions on demand

**Requirements:**
- PRMT-01: MCP prompt `obsidian-cli` — CLI usage patterns, parameter syntax, common command examples (adapted from Kepano's obsidian-cli SKILL.md, MIT)
- PRMT-02: MCP prompt `obsidian-markdown` — Obsidian Flavored Markdown reference: wikilinks, embeds, callouts, properties, tags (adapted from Kepano's obsidian-markdown SKILL.md, MIT)
- PRMT-03: MCP prompt `obsidian-bases` — Bases syntax: views, filters, formulas, summaries (adapted from Kepano's obsidian-bases SKILL.md, MIT)
- PRMT-04: MCP prompt `obsidian-canvas` — JSON Canvas format: nodes, edges, groups, connections (adapted from Kepano's json-canvas SKILL.md, MIT)
- PRMT-05: Tool descriptions enriched with CLI help text and usage examples for better LLM tool selection
- PRMT-06: MIT attribution for content derived from Kepano's obsidian-skills

**Depends on:** Phase 2
**Plans:** 2 plans

**Success Criteria:**
1. `prompts/list` returns all registered prompts
2. `get_prompt("obsidian-cli")` returns CLI usage guidance
3. `get_prompt("obsidian-markdown")` returns OFM reference
4. Prompts include MIT attribution for Kepano's content
5. Tool descriptions include relevant CLI help text

Plans:
- [ ] 02.1-01-PLAN.md — Create 4 prompt content files (obsidian-cli, obsidian-markdown, obsidian-bases, obsidian-canvas) — Wave 1
- [ ] 02.1-02-PLAN.md — Wire prompt registration, enrich tool descriptions, update package.json — Wave 2

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
| 1.5 | Health Check & Config | 7 | 6 |
| 2 | Distribution | 4 | 6 |
| 2.1 | MCP Prompts (INSERTED) | 6 | 5 |
| 3 | Polish | 5 | 5 |

**Total:** 30 requirements across 5 phases

---
*Roadmap created: 2026-04-03*
*Last updated: 2026-04-03 — Phase 2.1 planned (2 plans, 2 waves)*

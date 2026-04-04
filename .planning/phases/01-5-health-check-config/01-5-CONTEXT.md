# Phase 1.5: Health Check & Config File - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/research/phase-1.5-health-config-requirements.md)

<domain>
## Phase Boundary

Add startup health checks, Obsidian running detection, and config file support to mcp-obsidian-cli. This is Phase 1.5 — a quick enhancement between Foundation and Distribution.

**Phase position:**
- Phase 1: Foundation ✓
- Phase 1.5: Health Check & Config (this)
- Phase 2: Distribution
- Phase 3: Polish

</domain>

<decisions>
## Implementation Decisions

### Config File (YAML)
- Location: `~/.config/mcp-obsidian-cli/config.yaml`
- Format: YAML with fields: vault, cliPath, timeoutMs
- Behavior: Create directory if not exists, parse YAML if exists, support all config options

### Obsidian Health Check
- Trigger: On server startup (before connecting transport)
- Detection Logic: Parse `obsidian version` output. Clean output with version number = running. Startup messages = not running.
- Startup Behavior:
  - Running: stderr shows "obsidian-mcp server running on stdio (Obsidian 1.12.7)", exit 0
  - NOT Running: stderr shows "Error: Obsidian is not running...", exit 1

### Config Precedence
1. Environment variables (highest)
2. Config file (`~/.config/mcp-obsidian-cli/config.yaml`)
3. Hard-coded defaults

### Test Harness
- Framework: `node --test` (built-in Node.js)
- Location: `test/run.test.js`
- Behavior: Fail fast if Obsidian not running

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Existing Project Files
- `server.js` — Main MCP server file to modify
- `package.json` — Package configuration
- `bin/server.js` — Bin entry point

</canonical_refs>

<specifics>
## Specific Ideas

### Obsidian Detection Patterns
| Command | Obsidian Running | Obsidian NOT Running |
|---------|------------------|---------------------|
| `obsidian version` | `1.12.7 (installer 1.12.4)` | Startup messages + version |
| `obsidian vault` | Shows current vault info | Startup messages |
| `obsidian vaults` | Lists known vaults | Startup messages |

### Files to Modify
| File | Changes |
|------|---------|
| `server.js` | Add config loading, health check, startup validation |
| `package.json` | Add `js-yaml` dependency, `test` script |
| `test/run.test.js` | Simple test harness (new) |

</specifics>

<deferred>
## Deferred Ideas

None — Phase 1.5 scope is focused on health check and config file.

</deferred>

---

*Phase: 01-5-health-check-config*
*Context gathered: 2026-04-03 via PRD Express Path*

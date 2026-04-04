# Phase 1.5 Research: Health Check & Config File

## Overview

Add startup health checks, Obsidian running detection, and config file support to mcp-obsidian-cli.

## Context from CLI Testing

### Obsidian Detection
| Command | Obsidian Running | Obsidian NOT Running |
|---------|------------------|---------------------|
| `obsidian version` | `1.12.7 (installer 1.12.4)` | Startup messages + version |
| `obsidian vault` | Shows current vault info | Startup messages |
| `obsidian vaults` | Lists known vaults | Startup messages |

**Detection Strategy:** Parse `obsidian version` output. Clean output with version number = running. Startup messages = not running.

### CLI Capabilities
- `obsidian version` — Shows version
- `obsidian vault` — Shows current vault (name, path, files, folders, size)
- `obsidian vaults` — Lists all known vaults

## Requirements

### 1. Config File (YAML)
**Location:** `~/.config/mcp-obsidian-cli/config.yaml`

**Format:**
```yaml
vault: tyee
cliPath: obsidian
timeoutMs: 15000
```

**Behavior:**
- Create directory if not exists
- Parse YAML if exists
- Support all config options

### 2. Obsidian Health Check
**Trigger:** On server startup (before connecting transport)

**Detection Logic:**
```javascript
async function checkObsidianRunning() {
  const { stdout } = await execFileAsync(CLI, ['version'], { timeout: 5000 });
  const versionMatch = stdout.match(/^(\d+\.\d+\.\d+)/);
  return versionMatch ? { running: true, version: versionMatch[1] } : { running: false };
}
```

**Startup Behavior:**
| State | stderr | exit |
|-------|--------|------|
| Running | `obsidian-mcp server running on stdio (Obsidian 1.12.7)` | 0 |
| NOT Running | `Error: Obsidian is not running...` | 1 |

### 3. Config Precedence
1. Environment variables (highest)
2. Config file (`~/.config/mcp-obsidian-cli/config.yaml`)
3. Hard-coded defaults

### 4. Test Harness
- Framework: `node --test` (built-in Node.js)
- Location: `test/run.test.js`
- Behavior: Fail fast if Obsidian not running

## Files to Modify

| File | Changes |
|------|---------|
| `server.js` | Add config loading, health check, startup validation |
| `package.json` | Add `js-yaml` dependency, `test` script |
| `test/run.test.js` | Simple test harness (new) |

## Success Criteria

- [ ] Server fails fast with clear error if Obsidian not running
- [ ] Config file at `~/.config/mcp-obsidian-cli/config.yaml` works
- [ ] Environment variables override config file
- [ ] Server shows version on successful startup
- [ ] `npm test` runs with fail-fast behavior

## Open Questions (Answered)

| Question | Answer |
|----------|--------|
| Config format | YAML |
| Startup error format | Plain text to stderr |
| Test behavior | Fail fast |
| GSD workflow | Use Phase 1.5 |

## Dependencies

- Phase 1 (Foundation) must be complete first
- Phase 2 (Distribution) can follow

## Phase Integration

This is Phase 1.5 — a quick enhancement between Foundation and Distribution.

**Roadmap position:**
- Phase 1: Foundation ✓
- Phase 1.5: Health Check & Config (this)
- Phase 2: Distribution
- Phase 3: Polish

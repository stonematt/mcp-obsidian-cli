---
wave: 1
depends_on: []
files_modified:
  - server.js
  - package.json
autonomous: true
---

# Phase 1.5: Health Check & Config

## Phase Goal
Add startup health checks, Obsidian running detection, and config file support.

## Requirements (must all be satisfied)
- HC-01: Config file at `~/.config/mcp-obsidian-cli/config.yaml` with YAML format
- HC-02: Config file supports: vault, cliPath, timeoutMs fields
- HC-03: Config precedence: env vars > config file > hardcoded defaults
- HC-04: Startup health check verifies Obsidian is running before MCP server starts
- HC-05: Clear error message if Obsidian not running, exit with code 1
- HC-06: Success startup shows version info, exit with code 0
- HC-07: Test harness at `test/run.test.js` with fail-fast behavior

## Verification
- server.js contains `loadConfig` function that reads from `~/.config/mcp-obsidian-cli/config.yaml`
- server.js contains yaml parsing with js-yaml
- server.js contains `checkObsidianRunning` function that runs `obsidian version`
- server.js contains config precedence: env vars > config file > defaults
- server.js contains startup health check before server.connect()
- server.js contains "Obsidian is not running" error message
- server.js contains process.exit(1) when Obsidian not running
- server.js contains "obsidian-mcp server running on stdio (Obsidian" version output on success
- package.json contains `js-yaml` dependency
- package.json contains `test` script pointing to `test/run.test.js`
- test/run.test.js file exists and contains test for health check

## Must Haves (goal-backward verification)
1. Server exits with code 1 and error message if Obsidian not running
2. Server shows version info and exits with code 0 if Obsidian running
3. Config file loaded from `~/.config/mcp-obsidian-cli/config.yaml` with vault, cliPath, timeoutMs
4. Environment variables override config file values
5. Test harness runs with `node --test` and fails fast if Obsidian not running

---

## Task 1: Add config file loading

**read_first:**
- server.js (current implementation)
- package.json (current dependencies)

**action:**
Add config loading in server.js:
1. Add `import { readFileSync, mkdirSync, existsSync } from 'node:fs'` import
2. Add `import { load as yamlLoad } from 'js-yaml'` import
3. Add `CONFIG_DIR = path.join(os.homedir(), '.config', 'mcp-obsidian-cli')` constant
4. Add `CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml')` constant
5. Add `function loadConfig()` that:
   - Creates CONFIG_DIR if not exists
   - Reads CONFIG_FILE if exists, parses YAML
   - Returns { vault, cliPath, timeoutMs } with values from config or defaults
6. Update main() to call loadConfig() before health check

**acceptance_criteria:**
- server.js contains `import { load as yamlLoad } from 'js-yaml'`
- server.js contains `loadConfig` function
- server.js contains `~/.config/mcp-obsidian-cli/config.yaml` path string
- server.js returns config object with vault, cliPath, timeoutMs keys

---

## Task 2: Implement config precedence

**read_first:**
- server.js (with loadConfig added)

**action:**
Update config loading to implement precedence:
1. In loadConfig(), first set defaults: { vault: "", cliPath: "obsidian", timeoutMs: 15000 }
2. If config file exists and parses, override defaults with file values
3. Then override with environment variables: OBSIDIAN_VAULT, OBSIDIAN_CLI_PATH, OBSIDIAN_TIMEOUT_MS
4. Export final merged config

**acceptance_criteria:**
- server.js checks env var OBSIDIAN_VAULT first
- server.js checks config file value second  
- server.js uses hardcoded default as fallback
- Same precedence for cliPath and timeoutMs

---

## Task 3: Add health check on startup

**read_first:**
- server.js (with config precedence)

**action:**
Add Obsidian health check:
1. Add `async function checkObsidianRunning()` that:
   - Runs `obsidian version` command
   - Parses output for version number (e.g., "1.12.7")
   - Returns { running: boolean, version: string }
2. In main(), before server.connect(), call checkObsidianRunning()
3. If not running:
   - Console.error "Error: Obsidian is not running..."
   - process.exit(1)
4. If running:
   - Console.error "obsidian-mcp server running on stdio (Obsidian X.Y.Z)"
   - Continue to server.connect()

**acceptance_criteria:**
- server.js contains `checkObsidianRunning` async function
- server.js contains "Obsidian is not running" error string
- server.js contains process.exit(1) for failure case
- server.js contains "(Obsidian" version in success message

---

## Task 4: Update package.json with js-yaml

**read_first:**
- package.json (current state)

**action:**
Add js-yaml dependency and test script:
1. Add `"js-yaml": "^4.1.0"` to dependencies
2. Add `"test": "node --test test/run.test.js"` to scripts

**acceptance_criteria:**
- package.json contains `"js-yaml": "^4.1.0"` in dependencies
- package.json contains `"test": "node --test test/run.test.js"` in scripts

---

## Task 5: Create test harness

**read_first:**
- None (new file)

**action:**
Create test/run.test.js:
1. Import { spawn } from 'node:child_process'
2. Add test 'health check exits 1 if Obsidian not running':
   - Skip if OBSIDIAN_RUNNING=1 env var set
   - Spawn server.js, capture output
   - Assert exit code is 1
   - Assert stderr contains "Obsidian is not running"
3. Add test 'health check succeeds if Obsidian running':
   - Skip unless OBSIDIAN_RUNNING=1 env var set
   - Spawn server.js, capture output
   - Assert exit code is 0
   - Assert stderr contains "running on stdio (Obsidian"

**acceptance_criteria:**
- test/run.test.js file exists
- test/run.test.js runs with `node --test test/run.test.js`
- Test contains "Obsidian is not running" check
- Test contains "(Obsidian" version check

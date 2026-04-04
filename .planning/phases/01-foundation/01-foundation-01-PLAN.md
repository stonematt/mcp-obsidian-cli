---
phase: 01-foundation
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - server.js
autonomous: true
requirements:
  - CORE-01
  - CORE-04
  - CORE-05
must_haves:
  truths:
    - "`npx mcp-obsidian-cli` starts the MCP server"
    - "`npm link` followed by `mcp-obsidian-cli` starts the MCP server"
    - "Missing vault returns clear error, not crash"
    - "Missing CLI path returns clear error, not crash"
    - "Timeout exceeds return clear error after configured milliseconds"
  artifacts:
    - path: package.json
      provides: bin entry for npx/npm link
      contains: '"mcp-obsidian-cli": "./server.js"'
    - path: server.js
      provides: MCP error responses and timeout handling
      exports:
        - errorResponse() function
        - TimeoutError class
        - clear error messages for missing vault/CLI
  key_links:
    - from: package.json
      to: server.js
      via: bin field
      pattern: '"mcp-obsidian-cli": "./server.js"'
---

<objective>
Harden the existing prototype into a production-ready MCP server. The prototype (server.js, 295 lines) already implements the generic obsidian tool, all 12 typed convenience tools, and env var support. This plan adds the remaining requirements: bin entry for npx, graceful error handling, and timeout handling.
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@server.js
@package.json
</context>

<interfaces>
From server.js (existing implementation):
```javascript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const CLI = process.env.OBSIDIAN_CLI_PATH || "obsidian";
const VAULT = process.env.OBSIDIAN_VAULT || "";
const TIMEOUT_MS = parseInt(process.env.OBSIDIAN_TIMEOUT_MS || "15000", 10);

async function run(argString) { ... }
function text(content) { return { content: [{ type: "text", text }] }; }
async function runTool(argString) { ... }

server.tool("obsidian", description, schema, handler);
```

From package.json (current):
```json
{
  "name": "mcp-obsidian-cli",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.8"
  }
}
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add bin entry for npx/npm link</name>
  <files>package.json</files>
  <read_first>package.json</read_first>
  <action>
    Add bin entry to package.json for npx/npm link invocation:

    1. Add to package.json:
    ```json
    {
      "bin": {
        "mcp-obsidian-cli": "./server.js"
      }
    }
    ```

    2. Ensure server.js has correct shebang:
    ```javascript
    #!/usr/bin/env node
    ```
    (Already present on line 1 - verify)

    3. Make server.js executable:
    ```bash
    chmod +x server.js
    ```
  </action>
  <acceptance_criteria>
    - package.json contains `"bin": { "mcp-obsidian-cli": "./server.js" }`
    - server.js has `#!/usr/bin/env node` shebang on line 1
    - server.js is executable (chmod +x)
  </acceptance_criteria>
  <verify>
    <automated>grep -q '"bin"' package.json && grep -q 'mcp-obsidian-cli' package.json && head -1 server.js | grep -q '#!/usr/bin/env node' && [ -x server.js ] && echo "PASS"</automated>
  </verify>
  <done>npm link enables `mcp-obsidian-cli` command; npx works via bin entry</done>
</task>

<task type="auto">
  <name>Task 2: Harden error handling with MCP error responses</name>
  <files>server.js</files>
  <read_first>server.js</read_first>
  <action>
    Replace basic error throwing with proper MCP error responses:

    1. Add error response helper function after the `text()` function:
    ```javascript
    /** Standard MCP error result. */
    function errorResult(content, code = "EXECUTION_ERROR") {
      return {
        content: [{ type: "text", text: content }],
        isError: true,
      };
    }
    ```

    2. Modify the `run()` function to return structured errors instead of throwing:
    ```javascript
    async function run(argString) {
      const args = parseArgs(argString);
      if (VAULT) args.push(`vault=${VAULT}`);

      try {
        const { stdout, stderr } = await execFileAsync(CLI, args, {
          timeout: TIMEOUT_MS,
          maxBuffer: 4 * 1024 * 1024,
          env: { ...process.env },
        });
        return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), error: null };
      } catch (err) {
        // Classify error type
        if (err.code === 'ENOENT') {
          return { stdout: '', stderr: '', error: { type: 'CLI_NOT_FOUND', message: `Obsidian CLI not found at: ${CLI}. Set OBSIDIAN_CLI_PATH or ensure 'obsidian' is on PATH.` } };
        }
        if (err.killed) {
          return { stdout: '', stderr: '', error: { type: 'TIMEOUT', message: `Command timed out after ${TIMEOUT_MS}ms` } };
        }
        const msg = err.stderr?.trimEnd() || err.message;
        return { stdout: '', stderr: '', error: { type: 'EXECUTION_ERROR', message: msg } };
      }
    }
    ```

    3. Modify `runTool()` to return MCP error responses:
    ```javascript
    async function runTool(argString) {
      const { stdout, stderr, error } = await run(argString);
      if (error) {
        return errorResult(error.message, error.type);
      }
      const parts = [];
      if (stdout) parts.push(stdout);
      if (stderr) parts.push(`[stderr] ${stderr}`);
      return text(parts.join("\n") || "(no output)");
    }
    ```

    Note: Keep the existing run() catch block's error classification logic. The goal is to return structured errors that runTool() can convert to MCP error responses.
  </action>
  <acceptance_criteria>
    - errorResult() function exists and returns { content, isError: true }
    - run() returns structured { stdout, stderr, error } instead of throwing
    - CLI not found returns message mentioning OBSIDIAN_CLI_PATH
    - runTool() returns isError: true for CLI failures
    - Missing vault returns clear error message (existing behavior preserved via CLI output)
  </acceptance_criteria>
  <verify>
    <automated>grep -q 'function errorResult' server.js && grep -q 'isError: true' server.js && grep -q "OBSIDIAN_CLI_PATH" server.js && grep -q 'errorResult(error.message' server.js && echo "PASS"</automated>
  </verify>
  <done>CLI failures return MCP error results with isError: true, not crashes</done>
</task>

<task type="auto">
  <name>Task 3: Add graceful timeout handling</name>
  <files>server.js</files>
  <read_first>server.js</read_first>
  <action>
    Improve timeout error messages to be clearer and more actionable:

    1. Update the run() function's timeout classification (already partially done in Task 2, but ensure message is clear):
    ```javascript
    if (err.killed) {
      return { 
        stdout: '', 
        stderr: '', 
        error: { 
          type: 'TIMEOUT', 
          message: `Command timed out after ${TIMEOUT_MS}ms. Set OBSIDIAN_TIMEOUT_MS to increase timeout.` 
        } 
      };
    }
    ```

    2. Add a comment explaining the timeout behavior at the top of the file:
    ```javascript
    /**
     * obsidian-mcp — MCP server wrapping the Obsidian CLI.
     * ...
     * Environment variables:
     *   OBSIDIAN_CLI_PATH  - Path to the obsidian CLI binary (default: "obsidian")
     *   OBSIDIAN_VAULT     - Vault name to use (default: "")
     *   OBSIDIAN_TIMEOUT_MS - Command timeout in ms (default: 15000)
     */
    ```

    3. Verify the execFile options properly set timeout (line 41 in existing code):
    ```javascript
    const { stdout, stderr } = await execFileAsync(CLI, args, {
      timeout: TIMEOUT_MS,  // Already present - verify this line exists
      ...
    });
    ```
  </action>
  <acceptance_criteria>
    - Timeout errors mention the configured timeout value
    - Timeout errors suggest OBSIDIAN_TIMEOUT_MS as solution
    - Documentation comment explains all three env vars
  </acceptance_criteria>
  <verify>
    <automated>grep -q 'OBSIDIAN_TIMEOUT_MS to increase timeout' server.js && grep -q 'timeout: TIMEOUT_MS' server.js && grep -q 'OBSIDIAN_VAULT' server.js && grep -q 'OBSIDIAN_CLI_PATH' server.js && echo "PASS"</automated>
  </verify>
  <done>Command timeout returns clear error message mentioning configured milliseconds and how to adjust</done>
</task>

</tasks>

<verification>
1. `npm link` makes `mcp-obsidian-cli` available as command
2. `npx mcp-obsidian-cli` starts the MCP server (stdio transport)
3. Error cases return MCP error responses with isError: true
4. Timeout errors include clear messages
</verification>

<success_criteria>
- [ ] `npm link` followed by `mcp-obsidian-cli` starts MCP server
- [ ] `npx mcp-obsidian-cli` works from clean terminal
- [ ] Missing CLI returns clear error (not crash)
- [ ] Command timeout returns error after configured milliseconds
- [ ] All 12 typed convenience tools functional (already implemented)
- [ ] Generic obsidian tool passes CLI commands (already implemented)
- [ ] Env vars work as documented (already implemented)
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-foundation-SUMMARY.md`
</output>

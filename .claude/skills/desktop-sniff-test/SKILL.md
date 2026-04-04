---
name: desktop-sniff-test
description: >
  Run the MCP server sniff test against Claude Desktop. Swaps the Claude Desktop
  config to the local dev server, gives the user a test prompt, evaluates returned
  results, and restores the production config. Use when the user says "sniff test",
  "test in desktop", "desktop test", "test prompts in Claude Desktop", or wants to
  verify MCP tools/prompts work in Claude Desktop before publishing.
---

# Desktop Sniff Test

End-to-end smoke test of the MCP server in Claude Desktop. Claude Desktop can't be
automated — it requires manual copy-paste — so this skill orchestrates the config
swaps and result evaluation around that manual step.

## Prerequisites

- Obsidian must be running
- Claude Desktop must be installed
- The project must be the `mcp-obsidian-cli` repo

## Workflow

### Step 1: Swap config to local server

Read the Claude Desktop config file:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Save the current `mcpServers.obsidian` block so it can be restored later.
Then replace it with the local dev server:

```json
"obsidian": {
  "command": "node",
  "args": ["<project-root>/server.js"],
  "env": {
    "OBSIDIAN_VAULT": "<keep existing vault value>"
  }
}
```

Preserve the existing `OBSIDIAN_VAULT` value — don't hardcode it.

Tell the user:
```
Config updated to local server. Restart Claude Desktop to pick up the change.
```

### Step 2: Give the test prompt

Tell the user to paste this into Claude Desktop:

```
Read the file <project-root>/test/sniff-test-prompt.md and run every test in it.
```

Use the actual absolute path to the project root, not a placeholder.

Then say:
```
Paste that into Claude Desktop and come back with the results when it finishes.
```

Wait for the user to return with results. Do not proceed until they paste results back.

### Step 3: Evaluate results

When the user pastes the results, evaluate them:

1. **Parse the summary table** — extract test name, result, criteria counts
2. **Count passes and failures** — report X/10
3. **For any failures**, check:
   - Was the tool call correct?
   - Did the pass criteria match what the test expects?
   - Is it a real bug or a test issue?
4. **Check content samples** — verify the quoted output looks correct (right headings,
   expected syntax patterns, reasonable data)
5. **Flag anything suspicious** even in passing tests (e.g., truncated output, unexpected
   content, wrong sort order)

Report your evaluation:
```
## Sniff Test Evaluation

**Result: X/10 passed**

[For each test, one line: test name, your assessment, any concerns]

[If failures: specific diagnosis and suggested fix]

[Overall: ship/no-ship recommendation]
```

### Step 4: Restore production config

Restore the saved `mcpServers.obsidian` block from Step 1.

Tell the user:
```
Config restored to production. Restart Claude Desktop to pick up the change.
```

### Step 5: Summary

Report final status:
- Test results (X/10)
- Ship/no-ship recommendation
- Any issues that need fixing before publish
- If all passed: suggest next step (version bump, npm publish, etc.)

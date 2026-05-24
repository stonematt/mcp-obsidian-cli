# Install — agent brief

**Just want it installed? Open [Claude Code](https://claude.com/claude-code) and paste this:**

```text
Fetch https://raw.githubusercontent.com/stonematt/mcp-obsidian-cli/master/docs/INSTALL.md
and follow it end to end to install the mcp-obsidian-cli MCP server for my Claude Desktop.
Ask me for my Obsidian vault name and folder path, then handle everything else — check Node,
enable the Obsidian CLI, edit my Claude Desktop config, and verify it works.
```

That's the whole job for a human. Everything below is the runbook the agent follows.

---

## Goal

Install and configure **mcp-obsidian-cli** as a Claude Desktop MCP server, then prove the chain works by running a live read against the user's vault. Leave the user with one action (restart Claude Desktop) and a one-line check.

## Inputs to collect (ask once, up front)

| Input | Meaning |
|---|---|
| `VAULT_NAME` | The vault's name exactly as Obsidian shows it in its sidebar. |
| `VAULT_PATH` | Absolute path to the vault folder on disk. |

Don't proceed past Step 3 without both. If the user doesn't know `VAULT_PATH`, in Obsidian: right-click the vault name → "Reveal in Finder/Explorer," or check Settings → About.

## Environment assumptions

- macOS or Windows desktop with **Obsidian** and **Claude Desktop** installed.
- Obsidian's CLI ships built into the app — there is no separate plugin to install. It only needs to be *enabled*.
- The server runs via `npx` at Claude Desktop startup, so nothing is permanently installed by this brief beyond a config edit.

---

## Runbook

Run steps in order. Each step is idempotent — re-running the brief must not create duplicates or clobber unrelated config.

### 1. Verify Node.js ≥ 18

```bash
node --version
```

If absent or below 18:
- macOS with Homebrew: `brew install node`
- Otherwise: direct the user to https://nodejs.org (LTS) and stop until installed.

### 2. Verify the package resolves

```bash
npm view mcp-obsidian-cli version
```

A version number confirms npx can fetch it at runtime. A network/404 error means stop and report — don't edit any config.

### 3. Enable and locate the Obsidian CLI

The binary lives inside the app bundle:
- macOS: `/Applications/Obsidian.app/Contents/MacOS/obsidian-cli`
- Windows: under the Obsidian install dir (e.g. `%LOCALAPPDATA%\Obsidian\obsidian-cli.exe`)

Test it with a read-only command against the vault:

```bash
"/Applications/Obsidian.app/Contents/MacOS/obsidian-cli" vault="VAULT_NAME" recents
```

(CLI syntax is `verb param=value`; `vault=` must be the first parameter. Quote values with spaces.)

- **Works (returns files):** CLI is enabled. Record the binary path for Step 4 and continue.
- **Fails / "not running" / no response:** the CLI toggle is off, or Obsidian is closed. Do both:
  1. Tell the user to open Obsidian (it can stay minimized).
  2. Tell the user to enable **Settings → General → Advanced → "Command line interface"** (one toggle).

  Then re-run the test command. **Do not edit Obsidian's internal config files** to flip this — the GUI toggle is the supported path and editing internals risks corrupting the vault config.

### 4. Edit the Claude Desktop config

Config file (create if missing; create parent dirs as needed):
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Merge** into the existing JSON — read it first, preserve any other `mcpServers` entries, add or replace only the `obsidian` key:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "mcp-obsidian-cli"],
      "env": {
        "OBSIDIAN_VAULT": "VAULT_NAME",
        "OBSIDIAN_CLI_PATH": "/Applications/Obsidian.app/Contents/MacOS/obsidian-cli"
      }
    }
  }
}
```

- Substitute the real `VAULT_NAME`.
- Include `OBSIDIAN_CLI_PATH` only if the binary is **not** on PATH (it usually isn't). Use the exact path verified in Step 3.
- Validate the file parses as JSON before saving.

### 5. Verify the chain

You've already proven `obsidian-cli` answers (Step 3) and the package resolves (Step 2), so the config is the only new link. Confirm the config file is valid JSON and the `obsidian` entry is present and correct.

### 6. Report to the user

Tell them, plainly:
1. **Restart Claude Desktop** (quit fully, reopen) so it picks up the new server.
2. In a Claude Desktop chat, ask: *"List my recent Obsidian files."* A list = success.
3. If they see `OBSIDIAN_NOT_RUNNING`, open Obsidian. If `CLI_NOT_FOUND`, the `OBSIDIAN_CLI_PATH` is wrong — recheck Step 3.

---

## Failure modes

| Symptom | Cause | Recovery |
|---|---|---|
| `node: command not found` | Node not installed | Step 1 install path. |
| `npm view` 404 / network error | Offline or package name typo | Stop; report. Don't touch config. |
| `obsidian-cli` no output / "not running" | CLI toggle off or app closed | Step 3 — open app + enable toggle, retry. |
| `CLI_NOT_FOUND` after restart | Wrong `OBSIDIAN_CLI_PATH` | Re-locate the binary (Step 3), fix config. |
| `OBSIDIAN_NOT_RUNNING` at chat time | Obsidian closed | Open it; it may be minimized. |
| Existing `mcpServers` vanished | Config was overwritten, not merged | Restore from the pre-edit read; merge instead. |

Reference for env vars and the optional config file: [README → Environment variables](../README.md#environment-variables).

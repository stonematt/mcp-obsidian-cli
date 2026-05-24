# mcp-obsidian-cli

[![npm version](https://img.shields.io/npm/v/mcp-obsidian-cli.svg)](https://www.npmjs.com/package/mcp-obsidian-cli)
[![npm downloads](https://img.shields.io/npm/dm/mcp-obsidian-cli.svg)](https://www.npmjs.com/package/mcp-obsidian-cli)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io/v0/servers?search=stonematt%2Fmcp-obsidian-cli)
[![Node](https://img.shields.io/node/v/mcp-obsidian-cli.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Your thinking starts in Claude Desktop, not in Obsidian. You research, draft, argue with the model, and when something's worth keeping you say "save this to my vault." It lands in the right place: your template, your properties, today's daily note, wired into your link graph. No tab-switch, no copy-paste.

![Saving a Claude Desktop conversation into an Obsidian vault, then searching the vault from chat](https://raw.githubusercontent.com/stonematt/mcp-obsidian-cli/master/docs/assets/demo.gif)

Two halves:

- **Capture** — turn a conversation into a real note, filed where it belongs.
- **Augment** — pull what's already in the vault (backlinks, full-text search) back into the chat to inform or update a note.

Needs Obsidian running. It can sit minimized, so you never switch to it.

On Claude Code? The native `obsidian-cli` skill fits better there: direct CLI, no MCP layer. Use that.

## Quick start

```bash
npx mcp-obsidian-cli
```

## Claude Desktop config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "mcp-obsidian-cli"],
      "env": {
        "OBSIDIAN_VAULT": "my-vault"
      }
    }
  }
}
```

## Requirements

- Obsidian running with the CLI plugin active
- `obsidian-cli` on your PATH (typically `/Applications/Obsidian.app/Contents/MacOS/obsidian-cli` on macOS)
- Node.js >= 18

## How it works

The server exposes Obsidian CLI commands as MCP tools. A generic pass-through tool handles the full CLI surface (80+ commands), plus typed convenience tools for common operations:

| Tool | Description |
|------|-------------|
| `obsidian` | Generic pass-through — run any CLI command (ships intent→verb cheatsheet, pre-call manifest validation, reload detection) |
| `obsidian_help` | Manifest-backed help — list verbs by category, or look up a single verb / doc topic |
| `obsidian_daily_read` | Read today's daily note |
| `obsidian_daily_append` | Append to daily note |
| `obsidian_read` | Read a note by name or path |
| `obsidian_search` | Full-text search with context |
| `obsidian_tags` | List tags with counts |
| `obsidian_tasks` | Query tasks (daily, todo, done) |
| `obsidian_properties` | Read frontmatter properties |
| `obsidian_create` | Create a new plain note (no Templater expansion) |
| `obsidian_create_from_template` | Create a note from a Templater template (expands `<% ... %>` placeholders) |
| `obsidian_property_set` | Set a frontmatter property |
| `obsidian_backlinks` | List backlinks to a note |
| `obsidian_files` | List vault files |
| `obsidian_recents` | Recently opened files |

The generic `obsidian` tool means the MCP server never falls behind the CLI — new CLI commands work immediately without a server update.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OBSIDIAN_VAULT` | _(none)_ | Target vault by name |
| `OBSIDIAN_CLI_PATH` | `obsidian-cli` | Path to CLI binary |
| `OBSIDIAN_TIMEOUT_MS` | `15000` | Command timeout |
| `XDG_CONFIG_HOME` | `~/.config` | Base path for config file |

## Config file

The server can read settings from a YAML config file:

- Default: `~/.config/mcp-obsidian-cli/config.yaml`
- With `XDG_CONFIG_HOME`: `$XDG_CONFIG_HOME/mcp-obsidian-cli/config.yaml`

Config file format:
```yaml
vault: "my-vault"
cliPath: "obsidian-cli"
timeoutMs: 15000
```

Config precedence: env vars > config file > hardcoded defaults

## What it can do

It talks to the running Obsidian instance, so it works with your vault the way Obsidian sees it:

- **Backlinks and full-text search** across your resolved link graph and search index (the augment half).
- **Templater templates** and typed **frontmatter properties** when creating or updating notes.
- **Daily notes**, task queries, and tag counts.
- **80+ commands** through the generic pass-through. No API keys, no REST plugin. Just the official Obsidian CLI.

## Bugs / requests

File an issue: https://github.com/stonematt/mcp-obsidian-cli/issues/new/choose. Bug template asks for version, MCP client, tool call, and response — quick to fill, fast to act on.

## License

MIT

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Z8Z41G13PX)

Maintained by [@stonematt](https://github.com/stonematt)
Licensed under the MIT License

**Trademark Notice:** "Obsidian" is a trademark of Obsidian Publishing, Inc. This project is not affiliated with or endorsed by Obsidian Publishing.

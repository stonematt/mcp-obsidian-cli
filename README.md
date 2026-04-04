# mcp-obsidian-cli

> **Trademark Notice:** "Obsidian" is a trademark of Obsidian Publishing, Inc. This project is not affiliated with or endorsed by Obsidian Publishing.

MCP server that wraps the Obsidian CLI, giving AI assistants full access to Obsidian's native API — search index, wikilink resolution, tasks, properties, daily notes, backlinks, and 80+ commands — through the Model Context Protocol.

## Why this exists

Every existing Obsidian MCP server takes one of two approaches: the Local REST API plugin (requires API keys, HTTP overhead, limited command surface) or raw filesystem access (no Obsidian awareness — no search index, no wikilink resolution, no task queries). Both miss the point.

`mcp-obsidian-cli` wraps the Obsidian CLI plugin, which talks directly to the running Obsidian instance via IPC. This means full access to Obsidian's internal APIs with zero configuration — no API keys, no REST plugins, no token management.

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
- `obsidian` on your PATH
- Node.js >= 18

## How it works

The server exposes Obsidian CLI commands as MCP tools. A generic pass-through tool handles the full CLI surface (80+ commands), plus typed convenience tools for common operations:

| Tool | Description |
|------|-------------|
| `obsidian` | Generic pass-through — run any CLI command |
| `obsidian_daily_read` | Read today's daily note |
| `obsidian_daily_append` | Append to daily note |
| `obsidian_read` | Read a note by name or path |
| `obsidian_search` | Full-text search with context |
| `obsidian_tags` | List tags with counts |
| `obsidian_tasks` | Query tasks (daily, todo, done) |
| `obsidian_properties` | Read frontmatter properties |
| `obsidian_create` | Create a new note |
| `obsidian_property_set` | Set a frontmatter property |
| `obsidian_backlinks` | List backlinks to a note |
| `obsidian_files` | List vault files |
| `obsidian_recents` | Recently opened files |

The generic `obsidian` tool means the MCP server never falls behind the CLI — new CLI commands work immediately without a server update.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OBSIDIAN_VAULT` | _(none)_ | Target vault by name |
| `OBSIDIAN_CLI_PATH` | `obsidian` | Path to CLI binary |
| `OBSIDIAN_TIMEOUT_MS` | `15000` | Command timeout |
| `XDG_CONFIG_HOME` | `~/.config` | Base path for config file |

## Config file

The server can read settings from a YAML config file:

- Default: `~/.config/mcp-obsidian-cli/config.yaml`
- With `XDG_CONFIG_HOME`: `$XDG_CONFIG_HOME/mcp-obsidian-cli/config.yaml`

Config file format:
```yaml
vault: "my-vault"
cliPath: "obsidian"
timeoutMs: 15000
```

Config precedence: env vars > config file > hardcoded defaults

## Compared to alternatives

| | mcp-obsidian-cli | REST API servers | Filesystem servers |
|---|---|---|---|
| Search index | Yes | Yes | No |
| Wikilink resolution | Yes | Partial | No |
| Task queries | Yes | No | No |
| Property types | Yes | Partial | No |
| Daily notes | Yes | No | No |
| Backlinks | Yes | Yes | No |
| API keys | None | Required | None |
| Obsidian plugins | CLI plugin | REST API plugin | None |
| Commands | 80+ | ~10 | ~6 |

## License

MIT

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Z8Z41G13PX)

Maintained by [@stonematt](https://github.com/stonematt)
Licensed under the MIT License

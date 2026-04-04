# Obsidian CLI Reference

Use the `obsidian` CLI to interact with a running Obsidian instance. Obsidian must be open.

## Command Syntax

Commands follow this pattern:

```bash
obsidian <command> [key=value ...]
```

**Parameters** take a value with `=`. Quote values that contain spaces:

```bash
obsidian create name="My Note" content="Hello world"
```

**Flags** are boolean switches with no value:

```bash
obsidian create name="My Note" silent overwrite
```

For multiline content, use `\n` for newline and `\t` for tab.

## File Targeting

Many commands accept `file` or `path` to target a note. Without either, the active file is used.

- `file=<name>` — resolves like a wikilink (name only, no path or extension needed)
- `path=<path>` — exact path from vault root, e.g. `folder/note.md`

## Vault Targeting

Commands target the most recently focused vault by default. Use `vault=<name>` as the first parameter to target a specific vault:

```bash
obsidian vault="My Vault" search query="test"
```

## Common Commands

| Command | Description |
|---------|-------------|
| `read file="Note"` | Read note contents by wikilink name |
| `read path="folder/note.md"` | Read note contents by exact path |
| `create name="New Note" content="..."` | Create a new note |
| `append file="Note" content="..."` | Append content to a note |
| `search query="term" limit=10` | Full-text vault search |
| `search:context query="term"` | Search with surrounding line context |
| `daily:read` | Read today's daily note |
| `daily:append content="..."` | Append to today's daily note |
| `daily:path` | Get file path of today's daily note |
| `tasks daily todo` | List incomplete tasks from daily note |
| `tasks` | List all tasks in the vault |
| `tags sort=count counts` | List tags sorted by frequency |
| `properties` | List all frontmatter properties in vault |
| `properties file="Note" counts` | List properties for a specific note |
| `property:read name="status" file="Note"` | Read a specific property value |
| `property:set name="status" value="done" file="Note"` | Set a property |
| `backlinks file="Note" counts` | List notes that link to this note |
| `files folder="Projects/"` | List files in a folder |
| `files ext=canvas` | List files by extension |
| `recents` | List recently opened files |
| `help` | Show all available commands |
| `help <command>` | Show help for a specific command |

## Parameter Patterns

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `file=` | Target note by wikilink name | `file="My Note"` |
| `path=` | Target note by exact vault path | `path="Work/Projects/alpha.md"` |
| `query=` | Search terms | `query="meeting notes"` |
| `content=` | Text content to write or append | `content="- [ ] New task"` |
| `name=` | Note name (create) or property name | `name="New Note"` |
| `value=` | Property value | `value="done"` |
| `limit=` | Max results to return | `limit=10` |
| `sort=` | Sort order | `sort=count` |
| `folder=` | Folder to filter by | `folder="Projects/"` |
| `ext=` | File extension filter | `ext=canvas` |

Quote any value that contains spaces. Use `\n` for newlines within `content=` values.

## Output Behavior

- Commands write their output to stdout
- Errors appear on stderr
- Use `--copy` on any command to copy output to clipboard
- Use `silent` flag to prevent files from opening in the Obsidian UI
- Use `total` on list commands to get a count appended to output

## Using This Knowledge with MCP Tools

When working with an Obsidian vault via this MCP server, use these tools instead of running the CLI directly:

- Read a note: `obsidian_read({ file: "Note Name" })`
- Read by exact path: `obsidian_read({ path: "folder/note.md" })`
- Search with context: `obsidian_search({ query: "term", path: "folder/", limit: 5 })`
- Read today's daily note: `obsidian_daily_read()`
- Get daily note path: `obsidian_daily_path()`
- Append to daily note: `obsidian_daily_append({ content: "- [ ] New task" })`
- Create a note: `obsidian_create({ name: "New Note", content: "# Heading\n..." })`
- List tasks from daily note: `obsidian_tasks({ daily: true, todo: true })`
- List all vault tasks: `obsidian_tasks({})`
- List tags by frequency: `obsidian_tags({ sort: "count" })`
- Read all properties for a note: `obsidian_properties({ file: "Note Name" })`
- Read a specific property: `obsidian_properties({ file: "Note Name", name: "status" })`
- Set a property: `obsidian_property_set({ name: "status", value: "done", file: "Note Name" })`
- List backlinks: `obsidian_backlinks({ file: "Note Name" })`
- List files in folder: `obsidian_files({ folder: "Projects/" })`
- List canvas files: `obsidian_files({ ext: "canvas" })`
- List recent files: `obsidian_recents()`
- Run any CLI command directly: `obsidian({ command: "help search" })`

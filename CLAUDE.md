<!-- GSD:project-start source:PROJECT.md -->
## Project

**mcp-obsidian-cli**

An MCP (Model Context Protocol) server distributed via npm/npx that wraps the Obsidian CLI plugin, exposing Obsidian's full native API surface to AI assistants like Claude Desktop, Claude Code, Cursor, and any MCP-compatible client.

**Core Value:** Full Obsidian API access over MCP — search index, wikilink resolution, tasks, properties, daily notes, backlinks, 80+ commands — with zero API keys and zero REST plugins. Just the CLI.

### Constraints

- **Node.js ES modules** — MCP SDK is ESM-only
- **Zero build step** — plain `.js` files, no TypeScript compilation, no bundler
- **Stdio transport only** — MCP servers for Claude Desktop use stdin/stdout
- **Obsidian must be running** — CLI commands fail if the app isn't open; server should return clear errors
- **Single dependency on CLI binary** — no direct Obsidian API access; all operations go through the CLI
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

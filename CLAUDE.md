# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**mcp-obsidian-cli** — An MCP server distributed via npm/npx that wraps the Obsidian CLI plugin, exposing Obsidian's full native API surface to AI assistants. All operations go through the `obsidian` CLI binary (IPC to running Obsidian instance); there is no direct Obsidian API access.

### Constraints

- **ES modules only** — `"type": "module"` in package.json; MCP SDK requires ESM
- **Zero build step** — plain `.js` files, no TypeScript, no bundler
- **Stdio transport** — MCP server communicates over stdin/stdout
- **Obsidian must be running** — CLI commands fail if the app isn't open

## Commands

```bash
# Run the server
node server.js

# Run tests (Node.js built-in test runner)
node --test test/run.test.js

# Run via npx (as end users would)
npx mcp-obsidian-cli
```

Tests use `node:test` — no test framework dependency. The health check test behavior depends on `OBSIDIAN_RUNNING=1` env var: without it, tests verify the server exits cleanly when Obsidian isn't running; with it, tests verify successful startup.

## Architecture

**Single-file server** (`server.js`, ~400 lines) — the entire MCP server lives in one file:

- **Config loading** (`loadConfig`) — YAML config file at `$XDG_CONFIG_HOME/mcp-obsidian-cli/config.yaml` with env var overrides. Precedence: env vars > config file > defaults.
- **CLI execution** (`run`, `parseArgs`, `runTool`) — shells out to the `obsidian` binary via `execFile`. `parseArgs` handles quoted values. `runTool` wraps results into MCP response format.
- **Health check** (`checkObsidianRunning`) — verifies Obsidian is actually running (not just installed) by checking processes and CLI version output. Filters out startup/update messages that indicate CLI launched Obsidian rather than connecting to it.
- **Tool registration** — one generic pass-through tool (`obsidian`) that accepts any CLI command string, plus ~12 typed convenience tools for common operations (daily notes, search, tasks, properties, etc.). Each convenience tool builds a CLI command string and delegates to `runTool`.

Key dependencies: `@modelcontextprotocol/sdk` (MCP protocol), `zod` (tool input schemas), `js-yaml` (config parsing).

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `OBSIDIAN_VAULT` | _(none)_ | Target vault name |
| `OBSIDIAN_CLI_PATH` | `obsidian` | Path to CLI binary |
| `OBSIDIAN_TIMEOUT_MS` | `15000` | Command timeout |
| `XDG_CONFIG_HOME` | `~/.config` | Config file base path |

## Agent skills

### Issue tracker

GitHub Issues + Milestones. PRDs/briefs live in `docs/briefs/`, not as issues. See [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md).

### Triage labels

Nitimini-style `status: *` lifecycle vocabulary; `afk-ready` is an orthogonal flag. See [`docs/agents/triage-labels.md`](./docs/agents/triage-labels.md).

### Domain docs

Single-context. Glossary at [`CONTEXT.md`](./CONTEXT.md); briefs in `docs/briefs/`; ADRs in `docs/adr/` (created lazily). See [`docs/agents/domain.md`](./docs/agents/domain.md).

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

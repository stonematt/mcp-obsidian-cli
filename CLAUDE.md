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
node bin/server.js   # or: npm start

# Run tests (Node.js built-in test runner)
npm test             # runs everything under test/*.test.js

# Run via npx (as end users would)
npx mcp-obsidian-cli
```

Tests use `node:test` — no test framework dependency. `test/run.test.js` spawns `bin/server.js` as a child process to assert exit code and the running banner; `test/server.test.js` exercises `createServer` end-to-end via the SDK's `InMemoryTransport` with a fake `ObsidianCli`. The current contract is **warn-and-continue** when Obsidian is not detected — the server stays up; tool calls return `OBSIDIAN_NOT_RUNNING` until the app is opened.

## Architecture

Three pieces, no top-level side effects in `server.js`:

- **`bin/server.js`** (entrypoint) — the only file that performs I/O at module load. Reads config, prompts, and `package.json#version`; probes the CLI path via `resolveCliPath`; builds the `ObsidianCli` adapter; calls `createServer(...)`; connects `StdioServerTransport`. Fatal errors here are the only path that calls `process.exit`.
- **`server.js`** (`createServer` factory) — pure factory that returns a wired `McpServer`. Registers the generic `obsidian` pass-through tool, ~13 typed convenience tools, and four MCP prompts. Takes `cli`, `prompts`, `manifest` (reserved for #10), `version`, `knownVaults`, and `runtimeVault` as injected deps. Importing this file is silent.
- **`lib/obsidian-cli.js`** — adapter around the `obsidian-cli` subprocess. `createObsidianCli({cliPath, vault, timeoutMs, execFile})` returns `{ exec, getVault, setVault }`; result shape is `{stdout, stderr, error|null}` with `error.type ∈ {CLI_NOT_FOUND, TIMEOUT, EXECUTION_ERROR}`. Also exports `resolveCliPath` (PATH / known paths / pgrep fallback) and `createObsidianRunningChecker` (TTL-cached pgrep probe). All probes are dependency-injectable for tests.

`lib/helpers.js` continues to host pure helpers: `loadConfig`, `loadVersion`, `parseArgs`, `buildCliArgs`, `loadKnownVaults`, `extractLeadingVault`, `text`, `errorResult`, `cliNotFoundMessage`.

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

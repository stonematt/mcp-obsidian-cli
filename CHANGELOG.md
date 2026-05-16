# Changelog

## [1.2.1] - 2026-05-16

### Fixed
- Server no longer exits on startup when Obsidian.app isn't running. Connects and accepts tool calls; first tool call returns `OBSIDIAN_NOT_RUNNING` error with remediation message. User can open Obsidian and retry without restarting Claude Desktop (#21).
- Process detection uses anchored `pgrep -f` instead of `ps aux | grep -v Helper`, eliminating false positives from helper binaries (#21).
- Default `cliPath` changed from `obsidian` to `obsidian-cli`. On case-insensitive macOS filesystems (APFS default) the lowercase `obsidian` name resolves to the `Obsidian` app binary rather than the `obsidian-cli` CLI binary, causing tool calls to launch a second Obsidian instance instead of communicating with the running one. Users with `cliPath: obsidian` in `config.yaml` or `OBSIDIAN_CLI_PATH=obsidian` env var should update to `obsidian-cli` (#21).
- `OBSIDIAN_VAULT` now correctly routes commands to the configured vault when multiple vaults are loaded. The `vault=<name>` argument is now prepended (not appended) to CLI invocations — Obsidian's CLI requires `vault=` to be the first token; appended values were silently ignored, causing all commands (including writes) to route to the focus-active vault (#23).

### Added
- 5s cache on `checkObsidianRunning` to avoid repeated `pgrep` on rapid back-to-back tool calls.
- `buildCliArgs(input, vault)` helper that skips the configured-vault prepend when the caller already supplied a `vault=` token as the first arg, so per-call vault overrides via the generic `obsidian` tool work as documented (PR #22 review).
- `cliNotFoundMessage(cli)` helper so the ENOENT error now names the actual configured binary (`obsidian-cli` by default) instead of the deprecated `'obsidian'` literal (PR #22 review).

## [1.2.0] - 2026-04-11

### Fixed
- Switch all convenience tools to array-based args, eliminating quote corruption in paths with spaces, wikilinks, and special characters (#3)

### Added
- GitHub Actions CI (test on PR/push, npm publish on version tag)
- Unit tests for parseArgs, loadConfig, and MCP response helpers (12 tests)
- Sniff test T11: create note with rich content in subdirectory

### Changed
- Extract helper functions to lib/helpers.js for testability
- Add node_modules/ to .gitignore

## [1.1.0] - 2026-04-04

### Added
- 4 MCP prompts: obsidian-cli, obsidian-markdown, obsidian-bases, obsidian-canvas
- obsidian_help tool exposing prompt content via tools
- Health check test harness (node:test)
- Desktop sniff test skill (10 manual test scenarios)

### Fixed
- Strip quotes from parsed CLI args (#3)
- Remove redundant `obsidian version` call from startup health check (#4)

## [1.0.1] - 2026-04-03

### Fixed
- Auto-discover obsidian CLI path for restricted PATH environments (PR #1)

## [1.0.0] - 2026-04-03

### Added
- Initial release: MCP server wrapping Obsidian CLI
- 15 tools: generic passthrough + typed convenience tools
- XDG-compliant YAML config with env var overrides
- CLI path auto-discovery (PATH, known macOS locations, running process)
- Health check: verify Obsidian is running before accepting connections

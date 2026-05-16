# Changelog

## [1.3.1] - 2026-05-16

### Added
- Publish to the MCP Registry on every tag via the existing `publish.yml` workflow, authenticated through GitHub OIDC (no new repo secret required). A single `git tag vX.Y.Z && git push --tags` now ships to npm AND `registry.modelcontextprotocol.io`.
- `server.json` manifest declaring the npm package, stdio transport, and the three `OBSIDIAN_*` environment variables for registry discovery.
- `mcpName: io.github.stonematt/mcp-obsidian-cli` in `package.json` so the registry can verify the published npm metadata.
- GitHub issue templates (bug report, feature request) — required fields capture version, MCP client, exact tool call, response, so reports arrive triage-ready (zero external issues to date suggests reporting friction is the bottleneck, not bug-free code).
- `README.md` "Bugs / requests" section linking to the new template chooser.

## [1.3.0] - 2026-05-16

### Added
- Runtime vault selection. Server reads Obsidian's known vaults from `~/Library/Application Support/obsidian/obsidian.json` at startup. If `OBSIDIAN_VAULT` is unset or names an unknown vault, the first tool call returns an actionable prompt listing available vaults and instructing the caller to retry with `vault=NAME`. Caller-supplied `vault=NAME` (first token in the generic `obsidian` tool) is cached in process memory for subsequent convenience-tool calls. Selection is never persisted to disk.
- `loadKnownVaults()` and `extractLeadingVault()` helpers in `lib/helpers.js`.
- Sniff test extensions: T12 + T13 vault-override smoke tests (`tyee`, `scarp`); per-test elapsed-ms timing and 1–5 Value scoring with aggregate metrics.
- 5s cache on `checkObsidianRunning` to avoid repeated `pgrep` on rapid back-to-back tool calls.
- `buildCliArgs(input, vault)` helper that skips the configured-vault prepend when the caller already supplied a `vault=` token as the first arg, so per-call vault overrides via the generic `obsidian` tool work as documented.
- `cliNotFoundMessage(cli)` helper so the ENOENT error now names the actual configured binary (`obsidian-cli` by default) instead of the deprecated `'obsidian'` literal.

### Fixed
- Server no longer exits on startup when Obsidian.app isn't running. Connects and accepts tool calls; first tool call returns `OBSIDIAN_NOT_RUNNING` error with remediation. User can open Obsidian and retry without restarting Claude Desktop (#21).
- Process detection uses anchored `pgrep -f` instead of `ps aux | grep -v Helper`, eliminating false positives from helper binaries (#21).
- Default `cliPath` changed from `obsidian` to `obsidian-cli`. On case-insensitive macOS filesystems (APFS default) the lowercase `obsidian` name resolves to the `Obsidian` app binary rather than the `obsidian-cli` CLI binary, causing tool calls to launch a second Obsidian instance instead of communicating with the running one. Users with `cliPath: obsidian` in `config.yaml` or `OBSIDIAN_CLI_PATH=obsidian` env var should update to `obsidian-cli`.
- `OBSIDIAN_VAULT` now correctly routes commands to the configured vault when multiple vaults are loaded. The `vault=<name>` argument is prepended (not appended) — Obsidian's CLI requires `vault=` as the first token; appended values were silently ignored, causing writes to land in the focus-active vault while reporting success (#23).
- Sniff test T3 Bases criteria updated to match the actual Bases reference vocabulary (`==`, `!=`, `file.hasTag`, capitalized summary names like `Sum`, `Average`).

### Behavior change
- If `OBSIDIAN_VAULT` is set to a value that doesn't match a known vault, the server no longer fails opaquely — it returns a structured prompt response listing available vaults. Existing users with a correctly-configured `OBSIDIAN_VAULT` see no difference. Semver-minor because the prompt response is new MCP traffic the caller may not be prepared for.

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

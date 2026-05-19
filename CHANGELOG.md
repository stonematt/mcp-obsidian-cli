# Changelog

## [1.4.0] - 2026-05-19

### Added
- `obsidian_create_from_template` typed tool wrapping `templater:create-from-template`. Expands Templater placeholders (`<% tp.date.now() %>`, `<% tp.file.title %>`, etc.) in the resulting note. Takes `template` (vault-relative path) and `file` (output path).
- `obsidian_help` is now manifest-backed. No-arg call returns a category-grouped index of every CLI verb (live from your running Obsidian). Pass a verb name (e.g. `read`, `create`, `move`) to get the live help block for that verb. Doc topics (`cli`, `markdown`, `bases`, `canvas`) still return the prompt content. Verb wins on collision.
- Generic `obsidian` tool now ships an intent→verb cheatsheet in its description (PUT / GET / MOVE-RENAME / DELETE / DISCOVER), so the model picks the right verb on the first try instead of guessing.
- Pre-call manifest validation on the generic `obsidian` tool. Calls with unknown verbs or known-bad arg names (e.g. `dest=` instead of `to=`) get an immediate hint with the suggested fix, before the CLI subprocess runs.
- Reload detection middleware on the generic `obsidian` tool. Calls that hit `restart` / `reload` / `plugin:reload` auto-refresh the cached manifest, so newly-loaded plugins' verbs are immediately available without a server restart.

### Changed
- `obsidian_create` no longer accepts `template=`. Previously, passing `template=` silently forwarded to the plain `create` verb, which copies raw bytes — Templater placeholders never expanded. If your prompts or scripts relied on the old (buggy) behavior, switch to `obsidian_create_from_template`. Tool descriptions now self-document the split.

## [1.3.3] - 2026-05-16

### Changed
- Sharper package description leading with the architectural differentiator (no REST, no API keys, 80+ commands) — visible on npm and the MCP Registry.

### Added
- README badges (npm version, downloads, MCP Registry, Node, license).
- `homepage` and `bugs` URLs in `package.json`.
- Discoverability keywords for npm and aggregator scrapers.

## [1.3.2] - 2026-05-16

### Fixed
- MCP Registry catalog entry now publishes correctly. The v1.3.1 catalog update was rejected because the description exceeded the registry's 100-char limit; the npm package shipped fine but the registry listing didn't refresh.

## [1.3.1] - 2026-05-16

### Added
- Listed in the MCP Registry at `registry.modelcontextprotocol.io` — discoverable alongside other official and community MCP servers.

## [1.3.0] - 2026-05-16

### Added
- **Multi-vault support.** If `OBSIDIAN_VAULT` is unset or names an unknown vault, the server asks you to pick one on first tool call, listing the vaults Obsidian knows about. A caller-supplied `vault=NAME` (first token in the generic `obsidian` tool) routes to that vault and is remembered for the rest of the session — no need to repeat it on every call. Tell Claude "save this in tyee" and it routes there.

### Fixed
- **Server no longer exits when Obsidian is closed.** Open Obsidian and retry — no Claude Desktop restart needed (#21).
- **Writes land in the right vault when you have multiple vaults loaded.** Previously, `OBSIDIAN_VAULT` was silently ignored and commands routed to the focused vault while reporting success; this is now correct (#23).
- **Duplicate Obsidian dock icon** on every tool call is gone — caused by a CLI-path collision on macOS, now resolved by defaulting to `obsidian-cli` instead of `obsidian`.

### Migration
- If you set `cliPath: obsidian` in `~/.config/mcp-obsidian-cli/config.yaml`, or `OBSIDIAN_CLI_PATH=obsidian` as an env var, update it to `obsidian-cli`. Defaults handle the rest.

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

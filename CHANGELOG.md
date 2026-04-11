# Changelog

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

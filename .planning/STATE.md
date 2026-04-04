# State: mcp-obsidian-cli

**Project:** mcp-obsidian-cli
**Created:** 2026-04-03

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-03)

**Core value:** Full Obsidian API access over MCP — search index, wikilink resolution, tasks, properties, daily notes, backlinks, 80+ commands — with zero API keys and zero REST plugins.

## Current Phase

**Phase 2:** Distribution — In Progress

## Phase Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Foundation | ● Complete | 3/3 tasks |
| Phase 1.5: Health Check & Config | ● Complete | 6/6 tests |
| Phase 2: Distribution | ● Complete | 2/2 waves |
| Phase 2.1: MCP Prompts | ◑ In Progress | 1/2 plans |
| Phase 3: Polish | ○ Pending | 0/5 |

## Progress

- Requirements: 19 v1, 18 validated
- Phases: 2.5/3 complete

## Active Blockers

(None yet)

## Accumulated Context

### Roadmap Evolution
- Phase 2.1 inserted after Phase 2: MCP Prompts — ship Obsidian knowledge via MCP prompts mirroring Kepano's obsidian-skills (URGENT)

### Decisions (Phase 2.1)
- Prompt content in external .md files under prompts/ directory, loaded by readFileSync at startup (D-08)
- MIT attribution in prompt metadata/description only — not in file content (D-03)
- Each prompt file ends with ## Using This Knowledge with MCP Tools section (D-02)
- Dropped plugin dev sections from obsidian-cli source — not relevant to MCP note-management consumers (D-01)

## Notes

- Project initialized via GSD auto mode from gsd-kickoff.md
- Existing prototype in server.js (295 lines, functional)
- Brownfield: existing code needs hardening, not greenfield

---
*Last updated: 2026-04-03 after Phase 2.1 Plan 01 completion*

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-04-04T07:18:38.342Z"
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 5
  completed_plans: 6
---

# State: mcp-obsidian-cli

**Project:** mcp-obsidian-cli
**Created:** 2026-04-03

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-04)

**Core value:** Full Obsidian API access over MCP — search index, wikilink resolution, tasks, properties, daily notes, backlinks, 80+ commands — with zero API keys and zero REST plugins.
**Current focus:** Phase 3 — Polish (v1.x)

## Current Phase

**Phase 3:** Polish (v1.x) — v1.3.0 shipped (graceful startup, vault routing, runtime vault selection)

## Phase Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Foundation | ● Complete | 3/3 tasks |
| Phase 1.5: Health Check & Config | ● Complete | 6/6 tests |
| Phase 2: Distribution | ● Complete | 2/2 waves |
| Phase 2.1: MCP Prompts | ● Complete | 2/2 plans |
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
- Loop-based prompt registration over promptContent/promptMeta objects — DRY, easy to extend (D-05)
- Prompt files loaded at module top-level synchronously — errors surface at startup, not first use (D-06)
- package.json files array as explicit npm allowlist — server.js and prompts/ only (D-09)

## Notes

- Project initialized via GSD auto mode from gsd-kickoff.md
- Existing prototype in server.js (295 lines, functional)
- Brownfield: existing code needs hardening, not greenfield

---
*Last updated: 2026-05-16 — PRs #25 (issue templates) and #26 (MCP registry publish) merged to dev*

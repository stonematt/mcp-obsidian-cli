# Deepen architecture — execution plan

Companion to [`deepen-architecture.md`](./deepen-architecture.md). Orchestration sequence + agent-teaming + human-test gates for the milestone.

## Scope

Covers all 11 open issues in milestone **Deepen architecture** (#9–#19), plus dependent Polish v1.x issues (#29, #30) and quick-wins (#33, #39). Excludes #34 (demo GIF) and #40 (Smithery bundle).

## Sequence

### Wave 0 — quick wins (parallel)

No deps. Fire as worktree agents in parallel with the Wave 1 planning step.

| Worktree | Issue | Notes |
|---|---|---|
| `claude` | **#33** docs drift `OBSIDIAN_CLI_PATH` | Edit `CLAUDE.md` only |
| `claude` | **#39** CI Node 22 bump | `actions/checkout@v5` + `actions/setup-node@v5`, `node-version: 22` |
| `Plan` | spec PR1 for **#9** | file moves, exports, test seams |

### Wave 1 — foundation, serial

**#9** alone. Opus, worktree. Refactor `server.js` → `lib/obsidian-cli.js` + `bin/server.js` + `createServer` factory. Preserve health-check test. Repoint `package.json` `bin`.

**Gate A** — see below.

### Wave 2 — manifest cluster (parallel after #9 merged)

| Worktree | Issue |
|---|---|
| A | **#10** VerbManifest `lib/manifest.js` |
| B | **#13** Templater split bugfix |
| C (Explore) | audit `obsidian_help` callers + prompt layout for #11 |

### Wave 2b — after #10 merged

| Worktree | Issue |
|---|---|
| A | **#11** fold `obsidian_help` |
| B | **#12** cheatsheet + validation + reload middleware |

Merge #11 first → rebase #12 (both touch `server.js` descriptions).

**Gate B** + **Gate C** — see below.

### Wave 3 — registry, serial

**#14** alone. Opus, worktree. Behavior-preserving refactor of 13 typed tools to registry entries. Existing tool tests pass unchanged.

**Gate D** (skip unless test gap).

### Wave 4 — tracers, parallel

| Worktree | Issue |
|---|---|
| A | **#15** `obsidian_move` write tracer |
| B | **#17** `obsidian_outline` read tracer |

**Gate E** — see below.

### Wave 5 — expansion blitz (5 parallel)

| Worktree | Issue |
|---|---|
| A | **#16** rename, delete, folder creation |
| B | **#18** template:read, history |
| C | **#19** `obsidian_command` |
| D | **#30** MCP resources for vault metadata |
| E | **#29** structured JSON output |

End of Wave 5 = skill parity reached. Cut v2.0.

**Gate F** — see below.

## Human-test gates

Automated tests cover args/shape. Human + real Obsidian + real MCP client cover the rest. Each gate ~30min slot.

### Gate A — after #9

Entrypoint moved `server.js` → `bin/server.js`. `package.json bin` repointed.

- `npx mcp-obsidian-cli` boots clean
- Claude Desktop Connector flipped to LOCAL DEV build → tool list populates, one tool call lands (e.g. `obsidian_daily`)
- Restore Connector to npm package after

### Gate B — after #13

Templater placeholders must expand in real vault.

- `obsidian_create_from_template` with real template containing `<% tp.date.now() %>` → placeholder expanded in resulting note
- Old `obsidian_create` with `template=` removed or redirected per brief

### Gate C — after #11 + #12

LLM-facing surface changed. Only real LLM proves it.

- "put new note from template X" → LLM picks `templater:create-from-template`, not `create`
- `obsidian_help` no-arg → category index renders
- `obsidian_help("markdown")` → prompt content renders
- Pass-through with `dest=foo` → returns `to=` hint
- Trigger `plugin:reload` → next help call reflects fresh manifest

### Gate D — after #14 (skip if tests green)

Refactor only. Smoke check: `tools/list` returns same 13 tools.

### Gate E — after #15 + #17

First verbs through new registry path.

- `obsidian_move` actually moves file in vault
- `obsidian_outline` returns real outline of real note

If both pass → registry pattern proven → Wave 5 batches safe to fire AFK.

### Gate F — after #30

MCP resources render in Claude Desktop resource picker.

- `obsidian://vault`, `/files`, `/tags` visible in resource picker
- Each reads without error

## Agent-teaming rules

1. **One opus agent at a time on main loop**; subagents Sonnet by default.
2. **Worktree per PR** — avoids dirty-tree races.
3. **Brief each agent like cold colleague** — paste issue body + dep status, not just "do #15".
4. **Verify before reporting done** — read diff, don't trust agent summary.
5. **Gate waves on merge to dev**, not just PR-open.
6. **Status check between waves**: `gh issue list --milestone "Deepen architecture" --json number,title,labels`.
7. **Never commit to dev/master** — always issue → branch → PR per project rules.

## Throughput estimate

~5 working sessions to skill parity.

| Session | Covers |
|---|---|
| 1 | Wave 0 + Wave 1 → Gate A |
| 2 | Wave 2 + 2b → Gates B, C |
| 3 | Wave 3 → (skip D) |
| 4 | Wave 4 → Gate E |
| 5 | Wave 5 → Gate F → cut v2.0 |

## Deferred

- **#34** README demo GIF — independent content work, not in orchestration plan
- **#40** Smithery `.mcpb` bundle — explicitly parked per brief

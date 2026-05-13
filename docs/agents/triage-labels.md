# Triage Labels

The engineering skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo, which follow the nitimini lifecycle vocabulary.

## Canonical role → repo label mapping

| Role in skills | Repo label(s) | Meaning |
|---|---|---|
| `needs-triage` | `status: triage` | New issue, needs scoping. All issues open here. |
| `needs-info` | `status: needs-info` | Waiting on the reporter for clarification. |
| `ready-for-agent` | `status: ready` + `afk-ready` flag | Spec'd, scope tight enough that an AFK agent (Sonnet, no human pings, very low uncertainty) can pick it up. |
| `ready-for-human` | `status: ready` (no `afk-ready`) | Spec'd but needs human implementation — too much uncertainty for AFK. |
| `wontfix` | close with `--reason "not planned"` | Declined. No label; the closed state is the signal. |

When a skill says "apply the AFK-ready label," apply BOTH `status: ready` AND `afk-ready`. The flag is orthogonal to status, per nitimini.

## Full lifecycle label set

Beyond the five triage roles, the issue state machine uses more labels. See [`issue-tracker.md`](./issue-tracker.md) and the nitimini workflow for the full state machine.

| Namespace | Label | Meaning |
|---|---|---|
| status (lifecycle) | `status: triage` | New, needs scoping |
| status | `status: needs-info` | Waiting on reporter |
| status | `status: ready` | Spec'd, awaiting pickup |
| status | `status: wip` | Branch open, work started |
| status | `status: blocked` | Waiting on dependency or decision |
| status | `status: staged` | Merged to `dev`, awaiting prod release |
| (project) | `Released` | Project Status only (no label); set on close by workflow |
| flag | `afk-ready` | Brief tight enough for autonomous-agent pickup. Orthogonal to `status:*`. |
| flag | `kind:bse` | Bug or small enhancement; opportunistic / throw-in work |
| flag | `priority: high` | Escalate scheduling |
| intent | `intent:structural` | Refactor with no user-visible change. Snapshot diff must be empty. |
| reference | `adr` | Issue references or proposes an ADR |
| area | `area:*` | Code area scope. Deferred — create on first use. |

## Status transitions

```
(new) → status: triage
status: triage → status: ready (scoped, AC written, deps clear) — add afk-ready if tight enough
status: triage → (closed, not planned) — wontfix
status: ready → status: wip (branch opens off dev)
status: wip ↔ status: blocked
status: wip → status: needs-info (if scope question surfaces mid-flight)
status: wip → status: staged (PR merged to dev)
status: staged → Released (release PR dev→master merged with `Closes #N`)
```

## Setup status

The repo does not yet have all of these labels created. Initial scaffolding step will:

1. Create labels: `status: triage`, `status: needs-info`, `status: ready`, `status: wip`, `status: blocked`, `status: staged`, `afk-ready`, `kind:bse`, `priority: high`, `intent:structural`, `adr`.
2. Delete the placeholder `ready-for-agent` label created during early triage setup (now superseded by `status: ready` + `afk-ready`).
3. Defer all `area:*` labels until the first issue needs one.

This setup runs as a separate scaffolding step, not on every skill invocation.

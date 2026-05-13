# Issue tracker: GitHub

Issues for this repo live as GitHub Issues, grouped by GitHub Milestones, modeled on the [nitimini workflow](https://github.com/stonematt/nitimini/blob/master/docs/process/WORKFLOW.md). Use the `gh` CLI for all operations.

## Three-level hierarchy

| Level | Artifact | Lives in | Lifecycle |
|---|---|---|---|
| Roadmap | direction, themes | `README.md` (or `docs/product/ROADMAP.md` if it grows) | durable |
| Brief / PRD | scoped initiative | `docs/briefs/<name>.md` + GitHub Milestone | per-initiative |
| Issue | vertical slice | GitHub Issue | flows the status state machine |

The brief carries the **why** and architecture. Each child issue carries the **what** and acceptance criteria — issue bodies must stand alone so an agent can pick one up without reading back to the brief.

**PRDs are not issues.** When `/to-prd` produces a PRD, it writes the document to `docs/briefs/<name>.md`, creates a Milestone pointing at it, and stops. `/to-issues` then slices the brief into child issues under that Milestone.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies. New issues open at `status: triage`.
- **Read an issue**: `gh issue view <number> --comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,milestone,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], milestone: .milestone.title, comments: [.comments[].body]}]'` with appropriate `--label`, `--milestone`, `--state` filters.
- **Comment**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Assign to milestone**: `gh issue edit <number> --milestone "<title>"`
- **Close**: `gh issue close <number> --reason "completed|not planned" -c "..."`
- **Create milestone**: `gh api repos/:owner/:repo/milestones -f title="..." -f description="See docs/briefs/<name>.md"`

`gh` auto-detects the repo from `git remote -v` when run inside a clone.

## When a skill says "publish to the issue tracker"

- If the skill is producing a **PRD/brief** (e.g. `/to-prd`): write `docs/briefs/<name>.md`, create a Milestone, and stop. Do NOT create a tracking issue for the PRD itself.
- If the skill is producing a **vertical slice issue** (e.g. `/to-issues`, `/triage`): create a GitHub Issue, assign it to the relevant Milestone, label `status: triage` (or whatever the skill's role maps to per [triage-labels.md](./triage-labels.md)).

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`. If a Milestone is referenced, also fetch the brief: `cat docs/briefs/<milestone-slug>.md` (or follow the milestone description's pointer).

## Branch and PR flow

- Work branches off `dev`, not `master`.
- Feature PRs target `dev`. `Closes #N` in the PR body is informational only until release.
- Release is a PR from `dev → master`. The release PR body MUST include `Closes #N` for every issue shipping in the release; GitHub's auto-close only fires on merges to the default branch (`master`).
- `master → npm publish` is the release ritual (one push per release cohort).

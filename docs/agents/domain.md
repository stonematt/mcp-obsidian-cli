# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout: single-context

This repo is a single Node package wrapping the Obsidian CLI; there are no sub-contexts. Layout:

```
/
├── CONTEXT.md                  ← glossary of domain terms
├── docs/
│   ├── briefs/                 ← PRDs / scoped initiatives
│   │   └── <name>.md
│   └── adr/                    ← architectural decision records (created lazily)
└── src/ (server.js, lib/, bin/)
```

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the canonical glossary. Use its vocabulary (`Verb`, `ObsidianCli`, `VerbManifest`, `Pass-through tool`, `Typed tool`, `Cheatsheet`, `Skill parity`, `Reload detection`) in any output (issue titles, refactor proposals, hypotheses, test names).
- **`docs/adr/`** — ADRs that touch the area you're about to work in. May not exist yet; create lazily when a decision crystallizes.
- **`docs/briefs/<name>.md`** — if the work relates to a current initiative, read the brief for the why and architecture.

If any of these files don't exist, **proceed silently**. Don't flag absence; don't suggest creating them upfront. The producer skills (`/grill-with-docs`, `/to-prd`) create them lazily.

## Use the glossary's vocabulary

When an output names a domain concept, use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids (e.g. `command`, `action` for **Verb**; `service`, `runner` for **ObsidianCli**).

If a concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider), or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 — but worth reopening because…_

Only surface when the friction is real enough to warrant revisiting the ADR. Don't list every theoretical refactor an ADR forbids.

## Resolved ambiguities

Already in `CONTEXT.md` under "Flagged ambiguities" — don't re-litigate:

- **"help"** — live help (`obsidian help <verb>`) ≠ static reference prompts (`obsidian-cli`, `obsidian-markdown`, etc.). Folded into one `obsidian_help` tool; verb wins on ambiguous input.
- **"template"** — plain `create template=<name>` ≠ `templater:create-from-template`. They are distinct **Verbs**; typed tools must not conflate them.

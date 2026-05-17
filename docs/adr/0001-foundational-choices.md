# ADR-0001: Foundational choices

**Status:** Accepted
**Date:** 2026-04-03 (originally decided); 2026-05-16 (recorded as ADR after harvesting `.planning/PROJECT.md`)

## Context

`mcp-obsidian-cli` ships an MCP server that exposes an Obsidian vault to AI assistants. Several foundational choices were made at project inception that shape every later decision: how to talk to Obsidian, what tool shape to expose, what runtime to target, what to publish under, how to invoke subprocesses. These were not captured as ADRs at the time — they lived in `.planning/PROJECT.md` under "Key Decisions" alongside transient state. This ADR consolidates them so future contributors do not re-litigate them and so any reversal has a clear baseline to argue against.

Five decisions are recorded together because they are interlocking — flipping any one materially changes the others.

## Decisions

### D1. Wrap the `obsidian` CLI, not the Local REST API plugin

**Decision.** All vault access flows through the `obsidian` CLI binary via subprocess IPC. The Local REST API plugin is not used.

**Alternatives considered.**
- Local REST API plugin (HTTP) — used by `obsidian-mcp-server`, `mcp-obsidian`, `@huangyihe/obsidian-mcp`.
- Direct filesystem reads — used by `obsidian-mcp` (StevenStavrakis), `@bitbonsai/mcpvault`.

**Why CLI.**
- Full surface (80+ verbs including search index, wikilink resolution, tasks, properties, daily notes, backlinks). REST plugin exposes ~10.
- Zero secrets — no API keys, no token rotation. CLI is a local subprocess.
- No dependency on the REST API plugin being installed and configured.
- Filesystem-only servers have no Obsidian awareness (no search index, no wikilink resolution).

**Trade-offs.** Obsidian must be running for any call to succeed. The CLI is provided by a community plugin that could change interface. Subprocess spawn cost on every call (no in-process API).

### D2. Generic pass-through tool + typed convenience tools

**Decision.** The MCP server exposes one **Pass-through tool** named `obsidian` that accepts any verb string, plus **Typed tools** for common verbs with Zod schemas.

**Alternatives considered.**
- Typed tools only — every verb gets a hand-written wrapper.
- Pass-through only — one tool, no schemas.

**Why both.**
- The pass-through means new CLI verbs work the moment they ship, without a server release. The MCP server never falls behind the CLI.
- Typed tools give LLMs better schemas and descriptions for the verbs they reach for most often, improving tool selection accuracy.
- Hybrid is future-proof — typed tools grow opportunistically; pass-through covers the long tail.

**Trade-offs.** Two tool shapes to maintain. LLMs may sometimes pick the pass-through when a typed tool exists.

### D3. No TypeScript

**Decision.** Plain JavaScript with ES modules. No build step, no bundler, no `.ts` source.

**Alternatives considered.** TypeScript with `tsc` or a bundler (esbuild, tsup).

**Why plain JS.**
- The MCP SDK ships its own types — TypeScript would mostly retype what the SDK already gives consumers.
- Zero build step means `node server.js` works in any clone with no setup. `npx mcp-obsidian-cli` ships unbuilt source.
- Server is ~400 lines in one file; type discipline is enforceable by code review.
- Avoids the dist/ vs src/ divergence that bites small Node packages.

**Trade-offs.** No compile-time guarantees. Refactors rely on tests + careful review.

### D4. Unscoped npm package name

**Decision.** Published as `mcp-obsidian-cli`, not `@stonematt/mcp-obsidian-cli`.

**Alternatives considered.** Scoped under `@stonematt` or another namespace.

**Why unscoped.**
- Better discoverability for `npx mcp-obsidian-cli` — no scope to remember or type.
- Name was available at publish time.
- Fallback to scoped is trivial if a trademark issue arises (precedent: `@bitbonsai/mcpvault` renamed at Obsidian Publishing's request).

**Trade-offs.** Exposed to name squatting and trademark disputes. Mitigated by the trademark notice at the top of README and by being a clearly-derivative wrapper rather than a competing product.

### D5. Subprocess via `execFile`, not `exec`

**Decision.** All CLI invocations use `child_process.execFile`. Never `exec` or shell-string concatenation.

**Alternatives considered.** `exec` (runs in a shell), `spawn` with a shell, template-string CLI invocation.

**Why `execFile`.**
- No shell interpretation — no shell injection vector even if user input reaches the args.
- Args are passed as an array, not a string — quoting bugs don't exist.
- Faster (no shell process in the middle).
- The CLI is a single binary invocation; a shell adds nothing.

**Trade-offs.** Cannot use shell features (globbing, pipes, env-var expansion in the command string). All of those would be footguns here anyway.

## Consequences

- **`ObsidianCli` adapter** (planned in Milestone #1 "Deepen architecture") is the single chokepoint that enforces D1 and D5. Any future change to how Obsidian is reached lives there.
- **Skill parity** (north-star goal recorded in `CONTEXT.md`) is feasible because of D1 — wrapping the CLI gives access to every verb the Claude Code skill uses. Were the project on REST or filesystem, parity would be capped at ~10 verbs.
- **Tool registry** (planned in Milestone #1) is the operational form of D2 — each verb becomes one registry entry that materializes into a typed tool.
- **Reversing any of D1–D5 is a major version bump.** D1 changes the dependency model. D3 reshapes the entire repo. D4 breaks every existing `npx` invocation. D5 is the only one that could be quietly swapped, and there is no reason to.

## Notes

- Decisions D6–D7 from the original "Key Decisions" table (MCP prompts sourced from Kepano's `obsidian-skills`, prompt content as static `.md` files) are not included here. They are Phase 2.1 implementation choices, documented in `prompts/` and the Phase 2.1 PRs/CHANGELOG entries, and do not meet the ADR bar of "hard to reverse + surprising without context + real trade-off."
- The original "Key Decisions" table lived in `.planning/PROJECT.md`. That file was archived (see commit removing `.planning/`); this ADR is the canonical record.

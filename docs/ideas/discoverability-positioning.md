---
title: Discoverability — positioning & exposure ideas
created: 2026-05-20
status: grilled
milestone: Discoverability
related:
  - https://github.com/stonematt/mcp-obsidian-cli/issues?q=is%3Aissue%20state%3Aopen%20milestone%3ADiscoverability
tags:
  - discoverability
  - positioning
  - marketing
---

# Discoverability — positioning & exposure ideas

Captured from a Claude conversation 2026-05-20. Intake later against open
issues in the **Discoverability** milestone.

## Grill resolutions (2026-05-21)

Decisions from a `/grill-with-docs` session. These **supersede** the
exploratory content below, which is kept as rationale/backlog.

1. **Goal = adoption (clones). Lithos Uplift is incidental.** Resolves the
   "Strategic question" as **(a)**, not (c). Success gate = clones 2x in
   30 days. Demotes the Lithos blog post (item 12); no consulting CTA in
   the README.
2. **Audience = hero Claude Desktop, but the category is "Claude Desktop
   and other MCP chat clients."** Keep broad keywords (incl. `claude-code`)
   — free SEO, and the server does run in Claude Code. Be *generous* to
   Claude Code users ("the native `obsidian-cli` skill is great — use it"),
   not exclusionary. **Drop** the prose telling CC users to go elsewhere.
   Value hook: **"start in Claude Desktop, not Obsidian."**
3. **Moat is stated positively, anchored on backlinks + search** — the live
   resolved link-graph and search index, which filesystem-only readers
   genuinely can't reconstruct. **Bases/Dataview = soft pass-through
   mention, not the hero** (no typed tool; unverified through the server).
   Keep the "Capture / Augment" naming.
4. **Hook reconciled with the hard constraint (Obsidian must be running).**
   Running ≠ foreground. Reword to **"no context-switch to Obsidian"** (it
   stays backgrounded/minimized). Add a plain requirements line up top; the
   first-run GIF must show Obsidian minimized (honest). Runtime
   `OBSIDIAN_NOT_RUNNING` message polish tracked as **#69**.
5. **No comparison table; do not name competitors.** Position positively.
   **Kills item 3.** Reframe the "defensible niche" / "competitive threats"
   sections into positive capability copy.
6. **Companion Claude Skill = deferred, silent, low priority.** Drops item 7
   from the active push; not mentioned in the README. (The 4 shipped MCP
   prompts are syntax references; tool-routing guidance, if needed later,
   goes into richer tool `description` strings — client-agnostic, zero
   install — not a separate skill package.)
7. **npm/registry description leads with "Capture," keeps `obsidian` +
   `mcp` as search terms, fits the ≤100-char registry ceiling** (count
   *bytes* — the em-dash is 3; this is what bit v1.3.1). Direction:
   *"Capture chat notes to your Obsidian vault — MCP server via the official
   CLI: …"* (finalize string + byte count at edit time). Keywords array
   stays as-is. GitHub tagline = the looser value line (no char limit).
8. **Re-rank for the adoption metric.** Repo-page views (8 uniq) prove
   installs come from snippet-copy *elsewhere*, not the README — so
   **directories are the acquisition lever, the README is conversion.**
   - *This week, top:* Smithery listing (**#40**) + an awesome-mcp-servers
     PR + a bulletproof one-copy install snippet.
   - *This week, lower:* README lede + npm description (conversion page +
     the canonical source the snippet links back to).
   - *Demoted to conversion polish:* the demo GIF (**#34**) and banner.

**Issue map:** existing → #40 (Smithery), #34 (GIF). New → #69
(`OBSIDIAN_NOT_RUNNING` copy). Still to file → README lede rewrite, npm
description rewrite, awesome-mcp-servers PR, recipes section.

## Current traction (2026-05-20)

From `track-traction.sh --report`:

| repo             | stars | clones (uniq) | views (uniq) |
| ---------------- | ----- | ------------- | ------------ |
| mcp-obsidian-cli | 1     | 1482 (254)    | 115 (8)      |

- 254 unique cloners / 14d → real install signal.
- 8 unique repo-page viewers → almost nobody visits the repo before
  installing. Install path is config-snippet copy from elsewhere (blog,
  Discord, Reddit, dotfiles).
- 1 star is a marketing problem, not a quality problem.
- Comparable: `obsidian-mcp-server` ~1,008 weekly npm downloads = "popular"
  in this niche. Plausibly in the same ballpark.

## Positioning insight (the important part)

**The audience isn't Claude Code users.** Claude Code + the `obsidian-cli`
skill pack is a better fit there — direct CLI via Bash, no MCP overhead.
Don't compete for that segment.

**The audience is Claude Desktop users who want chat-to-vault capture.**

Workflow:

1. Open Claude Desktop
2. Do research / refine thinking
3. "Save this to my vault" / "pull related notes and update"

This is a real, growing, underserved segment.

### Why this niche is defensible

- **mcpvault** (`@bitbonsai/mcpvault`) — filesystem-only. No Templater, no
  Bases, no Dataview, no real backlinks. Can't do the augment half of the
  workflow well.
- **cli-rest-mcp plugin** — same CLI backend, but Code Mode (2 tools:
  `search` + `execute`) is wrong for chat. Desktop users don't want
  `execute("property:set ...")`; they want "save this" to Just Work.
- **ZethicTech `@zethictech/obsidian-mcp`** — closest direct competitor.
  Worth a feature comparison.
- **Claude Code + obsidian CLI directly** — wrong client for this workflow.

Typed tools map 1:1 to conversational moves:

- `obsidian_create_from_template` ← "save this as a project note"
- `obsidian_daily_append` ← "add to today's journal"
- `obsidian_backlinks` / `obsidian_search` ← "what do I already have on X"
- `obsidian_property_set` ← "tag this as status=active"

## Workflow framing

Two halves to name explicitly in README:

1. **Capture** — research → durable artifact in vault, in the right place,
   with the right template/properties.
2. **Augment** — query existing vault context to inform/update notes
   (backlinks, related, Bases queries, Dataview).

The augment half is where filesystem-only servers can't follow.

## Competitive threats (for context)

- **cli-rest-mcp Obsidian community plugin** — same CLI backend, ships
  *inside* Obsidian via plugin browser. Distribution advantage we can't
  match from npm. 6–12 month horizon before it matures and eats the casual
  segment.
- **mcpvault** — winning the zero-friction install race. Has the `.org`
  domain, a marketing site, an email list, an Obsidian-blessed rename.
  Threat is not stealing users — it's becoming the default people try
  first and never discover us.

Durable moat: **stdio works with every MCP client, typed tools are
ergonomic for chat agents, Obsidian-native (templates/properties/backlinks).**

## Concrete actions, ranked by ROI

### Ship this week

1. **Rewrite the README lede.** Lead with the workflow, not the
   implementation. Draft:

   > Turn Claude Desktop into a research front-end for your Obsidian vault.
   > Do your thinking in chat. When something is worth keeping, say "save
   > this to my vault" and Claude lands it in the right place — using your
   > templates, your properties, your daily note, your link graph.

2. **Drop "MCP server for Obsidian" framing.** It's a 15-package commodity
   pile. Use *"Claude Desktop ↔ Obsidian vault, via the official CLI"* or
   *"Conversational knowledge capture for Obsidian"* in npm description,
   GitHub tagline, social previews.

3. **Add a comparison table** to README. Honest, names competitors, picks
   per-use-case winners (not "we're best at everything"). Example:

   | Use case                       | This | mcpvault | cli-rest-mcp | CC + CLI |
   | ------------------------------ | ---- | -------- | ------------ | -------- |
   | Claude Desktop chat → vault    | ✅   | ⚠️       | ⚠️           | ❌       |
   | Headless / Obsidian closed     | ❌   | ✅       | ❌           | ❌       |
   | Power-user terminal workflow   | ⚠️   | ❌       | ⚠️           | ✅       |
   | Programmatic HTTP automation   | ❌   | ❌       | ✅           | ⚠️       |

4. **Polish the npm page.** Banner image/GIF of Claude Desktop saving a
   note to Obsidian. Badges (downloads, version, license). Comparison
   table near top.

5. **30-second "first five minutes" GIF.** Claude Desktop window → "save
   this to my vault under projects, use the project template" → note
   appears in Obsidian. Lead the README with this.

### Ship this month

6. **Recipes section** in README. 3–4 canonical Claude Desktop
   conversations end-to-end. SEO bait + onboarding:
   - "Research a topic and save findings as a project note"
   - "Daily journal append from a conversation"
   - "Find related notes and update one"
   - "Pull project context into a new strategy doc"

7. **Companion Claude Skill** — `mcp-obsidian-cli-skill` or similar.
   Teaches Claude when to use which tool (template vs plain create, daily
   append vs new note, search-first vs create-first). Without it, the
   agent makes weird choices even with great tools. Ship together.

8. **Reddit post in r/ObsidianMD.** Frame as workflow, not tool launch.
   "Three things I learned letting Claude Desktop write to my vault."
   Tool appears in the second-to-last paragraph.

9. **Get listed in awesome-mcp-servers and Smithery directories.** Where
   most MCP discovery happens now. Smithery especially — one-line install
   drives a lot of the comparable packages' numbers.

### Lower priority / watch-and-see

10. Branded landing page (`.org` domain). mcpvault has one. Worth it only
    after npm page and README are polished.
11. Hacker News post. High variance, one shot — save for a real "v1.0"
    launch with a clear hook.
12. Lithos.me blog post: "Three months of letting Claude write to my
    Obsidian vault." Bidirectional traffic — SEO for the package,
    credibility for Lithos.

## Strategic question to answer in intake

Is the goal:

- **(a) Hobby / portfolio piece** — yes, easily. Worth doing items 1–4.
- **(b) Revenue play** — no. OSS MCP servers don't monetize meaningfully.
- **(c) Top-of-funnel for Lithos Uplift** — interesting. 254 unique
  humans/month touching something with my name on it is more reach than
  the blog. If README and npm page route traffic to lithos.me with intent,
  it's a real funnel asset.

Recommend (c) as the framing — sets the bar for what counts as "worth
shipping" and clarifies the audience.

## Decision rule

Ship items 1–4 this week. If clones 2x in 30 days, keep investing
(items 5–9). If they don't move, stop — it's still a credible portfolio
piece at this size.

## Source

Conversation with Claude (Opus 4.7), 2026-05-20.

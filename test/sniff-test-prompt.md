Run these tests against the obsidian MCP server and report results. For each test, actually call the tool, then evaluate the result against every pass criterion individually. Do NOT skip any test.

## Instructions

For each test:
1. Call the tool with the exact parameters shown
2. Record whether the call succeeded or errored
3. Quote the **first 5 lines** of the response as a content sample
4. Check each pass criterion individually (yes/no)
5. If any criterion fails, quote what you got instead

## Tests

### T1: Help — CLI reference
Action: Call obsidian_help({ topic: "cli" }).
Pass criteria:
- [ ] Starts with "# Obsidian CLI Reference"
- [ ] Contains a command syntax section
- [ ] Lists common commands: read, search, daily:read, tasks, tags
- [ ] Has a "## Using This Knowledge with MCP Tools" section
- [ ] That section references obsidian_search, obsidian_read, obsidian_daily_read

### T2: Help — Markdown reference
Action: Call obsidian_help({ topic: "markdown" }).
Pass criteria:
- [ ] Contains wikilink syntax: [[Note]], [[Note|Display]], [[Note#Heading]]
- [ ] Contains embed syntax: ![[Note]], ![[image.png]]
- [ ] Contains callout syntax: > [!tip] or > [!note]
- [ ] Contains frontmatter/properties section with YAML --- delimiters
- [ ] Has a "## Using This Knowledge with MCP Tools" section

### T3: Help — Bases reference
Action: Call obsidian_help({ topic: "bases" }).
Pass criteria:
- [ ] Contains filter operators (at least 3 of: is, contains, before, after, gt, lt)
- [ ] Contains formula functions (now(), date())
- [ ] Contains view types: table, cards, list
- [ ] Contains summary functions (at least 3 of: sum, avg, count, min, max)
- [ ] Contains at least one complete .base YAML example (multi-line YAML block)

### T4: Help — Canvas reference
Action: Call obsidian_help({ topic: "canvas" }).
Pass criteria:
- [ ] Contains text node type with JSON example including { type: "text" }
- [ ] Contains file node type with JSON example including { type: "file" }
- [ ] Contains link and group node types
- [ ] Contains edge format with fromNode and toNode fields
- [ ] Contains color presets "1" through "6"
- [ ] Contains a complete .canvas JSON example with both nodes and edges arrays

### T5: Help — tool description quality
Action: Quote the full obsidian_help tool description text as you see it.
Pass criteria:
- [ ] Description mentions topic "cli" with a brief explanation
- [ ] Description mentions topic "markdown" with a brief explanation
- [ ] Description mentions topic "bases" with a brief explanation
- [ ] Description mentions topic "canvas" with a brief explanation

### T6: Tool descriptions enriched
Action: Quote the obsidian_search tool description, then call obsidian_search({ query: "test" }).
Pass criteria:
- [ ] Description contains a "Parameters:" section listing query, path, limit
- [ ] Description contains an "Examples:" section with at least one example call
- [ ] Tool executes without error (empty results are OK)

### T7: Daily note read
Action: Call obsidian_daily_read().
Pass criteria:
- [ ] Returns content (not an error) OR returns a clear "no daily note" error message
- [ ] Does not crash or return an unhandled exception
- [ ] Content sample: quote first 5 lines of the response

### T8: Tags list
Action: Call obsidian_tags({ sort: "count" }).
Pass criteria:
- [ ] Returns a list of tags
- [ ] Tags include counts
- [ ] List appears sorted by count descending (first tag has highest count)
- [ ] Content sample: quote the first 5 tags returned

### T9: File listing
Action: Call obsidian_files({ ext: "canvas" }).
Pass criteria:
- [ ] Returns a non-empty list of files
- [ ] All returned files have .canvas extension
- [ ] Content sample: quote the first 5 files returned

### T10: Generic passthrough
Action: Call obsidian({ command: "help" }).
Pass criteria:
- [ ] Returns help text (not an error)
- [ ] Output lists available CLI commands
- [ ] Content sample: quote the first 5 lines of the response

### T11: Create note with rich content in subdirectory
Action: Call obsidian_create({ path: "0.inbox/sniff-test-create.md", content: "---\nstatus: draft\ntags:\n  - test\nLinks:\n  - \"[[sniff-test-create]]\"\n---\n# Sniff Test\n\nThis note has [[wikilinks]], a \"quoted string\", and lives in a subdirectory." }).
Then call obsidian_read({ path: "0.inbox/sniff-test-create.md" }) to verify the content.
Pass criteria:
- [ ] File was created without error
- [ ] Read confirms the file exists at 0.inbox/sniff-test-create.md (not "0.inbox or any other mangled path)
- [ ] Frontmatter status is "draft" (not "\\" or escaped)
- [ ] Frontmatter Links contains [[sniff-test-create]] with proper wikilink brackets (no backslashes)
- [ ] Body contains [[wikilinks]] without backslash escaping
- [ ] Body contains "quoted string" with actual double quotes (not backslash-escaped)
Cleanup: After verifying, call obsidian({ command: "delete path=0.inbox/sniff-test-create.md" }) to remove the test file.

## Report Format

### Per-test detail

For each test, report:

```
#### T{N}: {Name} — {✓ PASS | ✗ FAIL}
Tool call: {exact call made}
Status: {success | error}
Sample: {first 5 lines of response, in a code block}
Criteria:
- [x] or [ ] {criterion} — {brief note if failed}
```

### Summary table

| Test | Name | Result | Criteria | Comment |
|------|------|--------|----------|---------|
| T1 | Help — CLI reference | ✓/✗ | 5/5 | one-line note |
| T2 | Help — Markdown reference | ✓/✗ | 5/5 | ... |
| ... | ... | ... | ... | ... |

**X/11 passed.** Flag anything surprising or any criteria that partially failed.

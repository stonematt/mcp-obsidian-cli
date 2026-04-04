# Obsidian Bases Reference

Bases are database-like views of vault notes, defined as `.base` YAML files. They let you query, filter, and display notes as tables, card galleries, lists, or maps — without writing custom code.

## Overview

- **File format:** `.base` files containing valid YAML
- **How they work:** Obsidian reads all vault notes, applies your filters, computes any formulas, and renders results in the configured views
- **When to use:** Tracking tasks, reading lists, project dashboards, meeting logs, any situation where you want a live view across multiple notes

## YAML Schema

```yaml
# Global filters apply to ALL views
filters:
  and: []
  or: []
  not: []

# Computed properties available across all views
formulas:
  formula_name: 'expression'

# Display name overrides for properties
properties:
  property_name:
    displayName: "Display Name"
  formula.formula_name:
    displayName: "Formula Display Name"
  file.ext:
    displayName: "Extension"

# Custom summary formulas
summaries:
  custom_name: 'values.mean().round(3)'

# One or more views
views:
  - type: table | cards | list | map
    name: "View Name"
    limit: 10
    groupBy:
      property: property_name
      direction: ASC | DESC
    filters:
      and: []
    order:
      - file.name
      - property_name
      - formula.formula_name
    summaries:
      property_name: Average
```

## Filters

Filters narrow which notes appear. Apply globally (to all views) or per-view.

### Filter Structure

```yaml
# Single filter expression
filters: 'status == "done"'

# AND - all conditions must be true
filters:
  and:
    - 'status == "done"'
    - 'priority > 3'

# OR - any condition can be true
filters:
  or:
    - 'file.hasTag("book")'
    - 'file.hasTag("article")'

# NOT - exclude matching items
filters:
  not:
    - 'file.hasTag("archived")'

# Nested filters
filters:
  or:
    - file.hasTag("tag")
    - and:
        - file.hasTag("book")
        - file.hasLink("Textbook")
    - not:
        - file.hasTag("book")
        - file.inFolder("Required Reading")
```

### Filter Operators

| Operator | Description |
|----------|-------------|
| `==` | equals |
| `!=` | not equal |
| `>` | greater than |
| `<` | less than |
| `>=` | greater than or equal |
| `<=` | less than or equal |
| `&&` | logical and |
| `\|\|` | logical or |
| `!` | logical not |

Useful filter functions: `file.hasTag("tag")`, `file.inFolder("path/")`, `file.hasLink("Note Name")`.

## Properties

### Three Property Types

1. **Note properties** — from note frontmatter: `status`, `priority`, `due`
2. **File properties** — computed file metadata: `file.name`, `file.path`, `file.mtime`, etc.
3. **Formula properties** — your computed values: `formula.days_until_due`

### File Properties Reference

| Property | Type | Description |
|----------|------|-------------|
| `file.name` | String | File name with extension |
| `file.basename` | String | File name without extension |
| `file.path` | String | Full path from vault root |
| `file.folder` | String | Parent folder path |
| `file.ext` | String | File extension |
| `file.size` | Number | File size in bytes |
| `file.ctime` | Date | Created time |
| `file.mtime` | Date | Modified time |
| `file.tags` | List | All tags in file |
| `file.links` | List | Internal links in file |
| `file.backlinks` | List | Files linking to this file |

## Formula Syntax

Formulas compute values from properties. Define them in the `formulas` section, reference them as `formula.name` in views.

```yaml
formulas:
  # Simple arithmetic
  total: "price * quantity"

  # Conditional logic
  status_icon: 'if(done, "Done", "Pending")'

  # String formatting
  formatted_price: 'if(price, price.toFixed(2) + " USD", "")'

  # Date formatting
  created_label: 'file.ctime.format("YYYY-MM-DD")'

  # Days since creation
  days_old: '(now() - file.ctime).days'

  # Days until due date (with null guard)
  days_until_due: 'if(due_date, (date(due_date) - today()).days, "")'
```

### Key Functions

| Function | Description |
|----------|-------------|
| `date(string)` | Parse string to date (`YYYY-MM-DD`) |
| `now()` | Current date and time |
| `today()` | Current date (time = 00:00:00) |
| `if(condition, trueVal, falseVal?)` | Conditional expression |
| `duration(string)` | Parse duration string |
| `file(path)` | Get file object |
| `link(path, display?)` | Create a link |

### Duration Type

Subtracting two dates returns a **Duration** — not a number. Access a numeric field before applying math:

```yaml
# CORRECT
"(now() - file.ctime).days"               # Returns days as number
"(date(due) - today()).days.round(0)"      # Rounded days

# WRONG — Duration doesn't support direct round()
# "(date(due) - today()).round(0)"
```

### Date Arithmetic

```yaml
"now() + \"1 day\""      # Tomorrow
"today() + \"7d\""       # A week from today
"now() - file.ctime"     # Returns Duration type
```

## View Types

### Table View

Displays notes as rows with sortable columns.

```yaml
views:
  - type: table
    name: "Task List"
    order:
      - file.name
      - status
      - due_date
    summaries:
      priority: Average
```

### Cards View

Displays notes as a visual card gallery.

```yaml
views:
  - type: cards
    name: "Gallery"
    order:
      - file.name
      - cover_image
      - description
```

### List View

Displays a minimal list of notes.

```yaml
views:
  - type: list
    name: "Quick List"
    order:
      - file.name
      - status
```

### Map View

Requires latitude/longitude properties and the Maps community plugin.

```yaml
views:
  - type: map
    name: "Locations"
```

## Summaries

Summarize numeric or date columns in table footers.

| Summary | Input | Description |
|---------|-------|-------------|
| `Average` | Number | Mean value |
| `Sum` | Number | Total |
| `Min` | Number | Smallest value |
| `Max` | Number | Largest value |
| `Range` | Number | Max minus Min |
| `Median` | Number | Median value |
| `Stddev` | Number | Standard deviation |
| `Earliest` | Date | Earliest date |
| `Latest` | Date | Latest date |
| `Checked` | Boolean | Count of true |
| `Unchecked` | Boolean | Count of false |
| `Empty` | Any | Count of empty |
| `Filled` | Any | Count of non-empty |
| `Unique` | Any | Count of distinct values |

## Complete Examples

### Task Tracker

```yaml
filters:
  and:
    - file.hasTag("task")

formulas:
  days_until_due: 'if(due, (date(due) - today()).days, "")'
  is_overdue: 'if(due, date(due) < today() && status != "done", false)'
  priority_label: 'if(priority == 1, "High", if(priority == 2, "Medium", "Low"))'

properties:
  formula.days_until_due:
    displayName: "Days Until Due"
  formula.priority_label:
    displayName: Priority

views:
  - type: table
    name: "Active Tasks"
    filters:
      and:
        - 'status != "done"'
    order:
      - file.name
      - status
      - formula.priority_label
      - due
      - formula.days_until_due
    groupBy:
      property: status
      direction: ASC
```

### Reading List

```yaml
filters:
  or:
    - file.hasTag("book")
    - file.hasTag("article")

formulas:
  status_icon: 'if(status == "reading", "Reading", if(status == "done", "Done", "To Read"))'
  year_read: 'if(finished_date, date(finished_date).year, "")'

views:
  - type: cards
    name: "Library"
    order:
      - cover
      - file.name
      - author
      - formula.status_icon
    filters:
      not:
        - 'status == "dropped"'
```

### Daily Notes Index

```yaml
filters:
  and:
    - file.inFolder("Daily Notes")

formulas:
  word_estimate: '(file.size / 5).round(0)'
  day_of_week: 'date(file.basename).format("dddd")'

properties:
  formula.day_of_week:
    displayName: "Day"
  formula.word_estimate:
    displayName: "~Words"

views:
  - type: table
    name: "Recent Notes"
    limit: 30
    order:
      - file.name
      - formula.day_of_week
      - formula.word_estimate
      - file.mtime
```

## YAML Quoting Rules

- Use single quotes for formulas containing double quotes: `'if(done, "Yes", "No")'`
- Use double quotes for simple string values: `"My View Name"`
- Strings containing `:`, `{`, `}`, `[`, `]`, `#` must be quoted

## Embedding Bases in Notes

```markdown
![[MyBase.base]]

![[MyBase.base#View Name]]
```

## Using This Knowledge with MCP Tools

When working with Bases through this MCP server:

- Create a new base: `obsidian_create({ name: "Tasks", path: "bases/Tasks.base", content: "<yaml content>" })`
- Read an existing base definition: `obsidian_read({ path: "bases/Tasks.base" })`
- List all base files: `obsidian_files({ ext: "base" })`
- Set a property on a note that a base queries: `obsidian_property_set({ name: "status", value: "done", file: "My Task Note" })`
- Search for notes that match base criteria: `obsidian_search({ query: "tag:#task" })`

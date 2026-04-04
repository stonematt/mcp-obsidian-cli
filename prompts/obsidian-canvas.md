# JSON Canvas Reference

Canvas files (`.canvas`) are JSON files that define visual layouts of notes, text, links, and groups on an infinite canvas. Use them for brainstorming, relationship mapping, project planning, and content organization.

## File Structure

A canvas file contains two top-level arrays following the JSON Canvas Spec 1.0:

```json
{
  "nodes": [],
  "edges": []
}
```

- `nodes` — array of node objects placed on the canvas
- `edges` — array of connections between nodes

Both arrays are optional (empty canvas is valid).

## Common Workflows

### Create a New Canvas

1. Create a `.canvas` file with base structure `{"nodes": [], "edges": []}`
2. Generate unique 16-character hex IDs for each node (e.g., `"6f0ad84f44ce9c17"`)
3. Add nodes with required fields: `id`, `type`, `x`, `y`, `width`, `height`
4. Add edges referencing valid node IDs via `fromNode` and `toNode`
5. Validate: ensure all `fromNode`/`toNode` values reference existing node IDs

### Add a Node to an Existing Canvas

1. Read and parse the existing `.canvas` file
2. Generate a unique ID that does not collide with existing IDs
3. Choose `x`, `y` position that avoids overlapping existing nodes (50-100px spacing)
4. Append the new node to the `nodes` array
5. Optionally add edges connecting it to existing nodes

### Connect Two Nodes

1. Identify source and target node IDs
2. Generate a unique edge ID
3. Set `fromNode` and `toNode`; optionally set `fromSide`/`toSide` for anchor points
4. Optionally add a `label`
5. Append to the `edges` array

## Node Types

All nodes share these required attributes:

| Attribute | Required | Type | Description |
|-----------|----------|------|-------------|
| `id` | Yes | string | Unique 16-char hex identifier |
| `type` | Yes | string | `text`, `file`, `link`, or `group` |
| `x` | Yes | integer | X position in pixels (left edge) |
| `y` | Yes | integer | Y position in pixels (top edge) |
| `width` | Yes | integer | Width in pixels |
| `height` | Yes | integer | Height in pixels |
| `color` | No | string | Preset `"1"`-`"6"` or hex `"#RRGGBB"` |

### Text Nodes

Display rich text with Markdown content.

| Attribute | Required | Description |
|-----------|----------|-------------|
| `text` | Yes | Markdown string |

```json
{
  "id": "6f0ad84f44ce9c17",
  "type": "text",
  "x": 0,
  "y": 0,
  "width": 400,
  "height": 200,
  "text": "# Hello World\n\nThis is **Markdown** content."
}
```

Use `\n` for line breaks in JSON strings. Do NOT use literal `\\n`.

### File Nodes

Display a vault note or attachment inline.

| Attribute | Required | Description |
|-----------|----------|-------------|
| `file` | Yes | Path to file from vault root |
| `subpath` | No | Link to heading or block (starts with `#`) |

```json
{
  "id": "a1b2c3d4e5f67890",
  "type": "file",
  "x": 500,
  "y": 0,
  "width": 400,
  "height": 300,
  "file": "Projects/Alpha.md"
}
```

### Link Nodes

Display an external URL as a web preview.

| Attribute | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | External URL |

```json
{
  "id": "c3d4e5f678901234",
  "type": "link",
  "x": 1000,
  "y": 0,
  "width": 400,
  "height": 200,
  "url": "https://obsidian.md"
}
```

### Group Nodes

Visual containers for organizing other nodes. Position child nodes inside the group's bounds.

| Attribute | Required | Description |
|-----------|----------|-------------|
| `label` | No | Text label for the group |
| `background` | No | Path to background image |
| `backgroundStyle` | No | `cover`, `ratio`, or `repeat` |

```json
{
  "id": "d4e5f6789012345a",
  "type": "group",
  "x": -50,
  "y": -50,
  "width": 1000,
  "height": 600,
  "label": "Project Overview",
  "color": "4"
}
```

Groups do not automatically contain nodes — nodes are "inside" a group visually based on position overlap.

## Edges

Edges connect nodes via their IDs.

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `id` | Yes | - | Unique identifier |
| `fromNode` | Yes | - | Source node ID |
| `toNode` | Yes | - | Target node ID |
| `fromSide` | No | - | `top`, `right`, `bottom`, or `left` |
| `toSide` | No | - | `top`, `right`, `bottom`, or `left` |
| `fromEnd` | No | `none` | `none` or `arrow` |
| `toEnd` | No | `arrow` | `none` or `arrow` |
| `color` | No | - | Line color (preset or hex) |
| `label` | No | - | Text label on the edge |

```json
{
  "id": "0123456789abcdef",
  "fromNode": "6f0ad84f44ce9c17",
  "fromSide": "right",
  "toNode": "a1b2c3d4e5f67890",
  "toSide": "left",
  "toEnd": "arrow",
  "label": "leads to"
}
```

## Color Presets

| Preset | Color |
|--------|-------|
| `"1"` | Red |
| `"2"` | Orange |
| `"3"` | Yellow |
| `"4"` | Green |
| `"5"` | Cyan |
| `"6"` | Purple |

Also accepts hex strings: `"#FF0000"`. Exact shades depend on the Obsidian theme.

## ID Generation

Use 16-character lowercase hexadecimal strings (64-bit random value):

```
"6f0ad84f44ce9c17"
"a3b2c1d0e9f8a7b6"
```

IDs must be unique across all nodes and edges in the file.

## Layout Guidelines

- Coordinates can be negative — the canvas is infinite
- `x` increases rightward, `y` increases downward
- `x`, `y` mark the top-left corner of the node
- Space nodes 50-100px apart; leave 20-50px padding inside groups
- Align to grid (multiples of 10 or 20) for cleaner layouts
- Array order determines z-index: first node = bottom layer, last = top layer

| Node Type | Suggested Width | Suggested Height |
|-----------|-----------------|------------------|
| Small text | 200-300 | 80-150 |
| Medium text | 300-450 | 150-300 |
| Large text | 400-600 | 300-500 |
| File preview | 300-500 | 200-400 |
| Link preview | 250-400 | 100-200 |

## Validation Checklist

Before writing a canvas file, verify:

1. All `id` values are unique across nodes and edges
2. Every `fromNode` and `toNode` references an existing node ID
3. Required fields are present for each node type:
   - text nodes: `text`
   - file nodes: `file`
   - link nodes: `url`
4. `type` is one of: `text`, `file`, `link`, `group`
5. `fromSide`/`toSide` are one of: `top`, `right`, `bottom`, `left`
6. `fromEnd`/`toEnd` are one of: `none`, `arrow`
7. Color presets are `"1"` through `"6"` or valid hex `"#RRGGBB"`
8. JSON is valid and parseable (especially: `\n` not `\\n` in text)

## Complete Example

A minimal project overview canvas with a group, two notes, a text summary, and a connecting edge:

```json
{
  "nodes": [
    {
      "id": "d4e5f6789012345a",
      "type": "group",
      "x": -60,
      "y": -60,
      "width": 1100,
      "height": 500,
      "label": "Project Alpha",
      "color": "4"
    },
    {
      "id": "6f0ad84f44ce9c17",
      "type": "text",
      "x": 0,
      "y": 0,
      "width": 350,
      "height": 150,
      "text": "## Goal\n\nDeliver MVP by end of quarter.\n\n- Backend API\n- Frontend UI\n- Documentation"
    },
    {
      "id": "a1b2c3d4e5f67890",
      "type": "file",
      "x": 450,
      "y": 0,
      "width": 400,
      "height": 300,
      "file": "Projects/Alpha/Requirements.md"
    },
    {
      "id": "b2c3d4e5f6789012",
      "type": "link",
      "x": 450,
      "y": 320,
      "width": 400,
      "height": 120,
      "url": "https://github.com/example/project-alpha"
    }
  ],
  "edges": [
    {
      "id": "0123456789abcdef",
      "fromNode": "6f0ad84f44ce9c17",
      "fromSide": "right",
      "toNode": "a1b2c3d4e5f67890",
      "toSide": "left",
      "toEnd": "arrow",
      "label": "defines"
    }
  ]
}
```

## Using This Knowledge with MCP Tools

When working with canvas files through this MCP server:

- Create a new canvas:
  ```
  obsidian_create({
    name: "Project Map",
    path: "canvas/Project Map.canvas",
    content: "{\"nodes\": [], \"edges\": []}"
  })
  ```
- Read an existing canvas (parse the JSON to see its structure):
  `obsidian_read({ path: "canvas/Project Map.canvas" })`
- List all canvas files in the vault:
  `obsidian_files({ ext: "canvas" })`
- Update a canvas (read, modify JSON, write back):
  `obsidian_create({ path: "canvas/Project Map.canvas", content: "<updated json>" })`
- Search for notes referenced in canvases:
  `obsidian_search({ query: "canvas" })`

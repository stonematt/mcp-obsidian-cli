/**
 * Typed-tool registry.
 *
 * Each convenience tool is a data entry: name, description, Zod schema,
 * shared-validator references, and a pure `build(args)` that maps the
 * validated args into the array (or string) handed to the CLI adapter.
 * A single registration loop converts entries into `server.tool(...)` calls.
 *
 * Adding a verb is one entry — not a 15-line copy of the surrounding
 * boilerplate.
 */

import { z } from "zod";
import { text, errorResult } from "./helpers.js";

/**
 * Shared validators. Each returns null on success, or
 * `{ error: string, isError: true }` to short-circuit the handler before
 * `cli.exec` is called. Entries reference validators by name in `requires`.
 */
export const validators = {
  fileOrPath: (args) => {
    if (!args.file && !args.path) {
      return { error: "Error: provide file= or path=", isError: true };
    }
    return null;
  },
};

/**
 * Typed-tool registry. Order is not significant — the registration loop
 * sorts nothing; clients see whatever order the loop registers in. Tests
 * lock the alphabetised tools/list snapshot.
 *
 * Entry shape:
 *   - name:        MCP tool name
 *   - description: Tool description shown to clients
 *   - schema:      Zod shape (object map, not z.object) passed to server.tool
 *   - requires:    Optional list of shared-validator names (see `validators`)
 *   - build:       (args) => string | string[]  — args handed to cli.exec
 *   - handler:     Optional escape hatch for tools whose handler needs
 *                  context beyond `runTool` (used by obsidian_help). Called
 *                  with `(args, ctx)` where ctx exposes injected helpers.
 */
export const TYPED_TOOL_ENTRIES = [
  {
    name: "obsidian_daily_read",
    description:
      "Read today's daily note contents.\n\nReturns the full markdown content of today's daily note. Returns an error if no daily note exists for today.",
    schema: {},
    build: () => "daily:read",
  },
  {
    name: "obsidian_daily_path",
    description:
      "Get the file path of today's daily note.\n\nReturns the vault-relative path (e.g. 'Daily/2026-04-03.md'). Useful for constructing paths for other tools.",
    schema: {},
    build: () => "daily:path",
  },
  {
    name: "obsidian_daily_append",
    description:
      "Append content to today's daily note.\n\nParameters:\n  content (required) — markdown text to append at the end of today's daily note\n\nExamples:\n  obsidian_daily_append({ content: \"- Meeting with team at 3pm\" })\n  obsidian_daily_append({ content: \"> [!tip] Remember\\n> Review PR before EOD\" })",
    schema: { content: z.string().describe("Content to append") },
    build: ({ content }) => ["daily:append", `content=${content}`],
  },
  {
    name: "obsidian_read",
    description:
      "Read a note by file name (wikilink-style) or exact path.\n\nParameters:\n  file (optional) — note name using wikilink resolution (e.g. 'My Note')\n  path (optional) — exact vault-relative path (e.g. 'folder/My Note.md')\n  One of file or path is required.\n\nExamples:\n  obsidian_read({ file: \"Meeting Notes\" })\n  obsidian_read({ path: \"Projects/todo.md\" })",
    schema: {
      file: z.string().optional().describe("File name (wikilink resolution)"),
      path: z.string().optional().describe("Exact file path"),
    },
    requires: ["fileOrPath"],
    build: ({ file, path }) => {
      const args = ["read"];
      if (file) args.push(`file=${file}`);
      if (path) args.push(`path=${path}`);
      return args;
    },
  },
  {
    name: "obsidian_search",
    description:
      "Full-text search across the vault with line context.\n\nParameters:\n  query (required) — search terms, supports Obsidian query syntax\n  path (optional) — restrict results to a folder path\n  limit (optional) — max number of files to return\n\nExamples:\n  obsidian_search({ query: \"meeting notes\" })\n  obsidian_search({ query: \"project status\", path: \"Work/\", limit: 5 })",
    schema: {
      query: z.string().describe("Search query"),
      path: z.string().optional().describe("Limit to folder"),
      limit: z.number().optional().describe("Max files to return"),
    },
    build: ({ query, path, limit }) => {
      const args = ["search:context", `query=${query}`];
      if (path) args.push(`path=${path}`);
      if (limit) args.push(`limit=${limit}`);
      return args;
    },
  },
  {
    name: "obsidian_tags",
    description:
      "List tags in the vault with counts.\n\nParameters:\n  sort (optional) — 'name' or 'count' (default: name)\n\nExamples:\n  obsidian_tags({})\n  obsidian_tags({ sort: \"count\" })",
    schema: {
      sort: z.enum(["name", "count"]).optional().describe("Sort order"),
    },
    build: ({ sort }) => {
      const args = ["tags", "counts"];
      if (sort) args.push(`sort=${sort}`);
      return args;
    },
  },
  {
    name: "obsidian_tasks",
    description:
      "List tasks from vault notes.\n\nParameters:\n  daily (optional) — true to show only today's daily note tasks\n  todo (optional) — true to show only incomplete tasks\n  done (optional) — true to show only completed tasks\n  path (optional) — filter by file path\n\nExamples:\n  obsidian_tasks({ daily: true })\n  obsidian_tasks({ todo: true, path: \"Projects/\" })",
    schema: {
      daily: z.boolean().optional().describe("Show only daily note tasks"),
      todo: z.boolean().optional().describe("Show incomplete tasks only"),
      done: z.boolean().optional().describe("Show completed tasks only"),
      path: z.string().optional().describe("Filter by file path"),
    },
    build: ({ daily, todo, done, path }) => {
      const args = ["tasks"];
      if (daily) args.push("daily");
      if (todo) args.push("todo");
      if (done) args.push("done");
      if (path) args.push(`path=${path}`);
      return args;
    },
  },
  {
    name: "obsidian_properties",
    description:
      "List or read frontmatter properties.\n\nParameters:\n  file (optional) — note name for wikilink resolution\n  path (optional) — exact file path\n  name (optional) — specific property name to read (requires file or path)\n\nExamples:\n  obsidian_properties({}) — list all properties with counts\n  obsidian_properties({ file: \"My Note\" }) — properties of a specific note\n  obsidian_properties({ file: \"My Note\", name: \"status\" }) — read one property",
    schema: {
      file: z.string().optional().describe("File name"),
      path: z.string().optional().describe("File path"),
      name: z.string().optional().describe("Specific property name to read"),
    },
    build: ({ file, path, name }) => {
      if (name && (file || path)) {
        const args = ["property:read", `name=${name}`];
        if (file) args.push(`file=${file}`);
        if (path) args.push(`path=${path}`);
        return args;
      }
      const args = ["properties"];
      if (file) args.push(`file=${file}`);
      if (path) args.push(`path=${path}`);
      args.push("counts");
      return args;
    },
  },
  {
    name: "obsidian_create",
    description:
      "Create a new PLAIN note (no Templater expansion).\n\nThis wraps the CLI's `create` verb. It does NOT expand Templater placeholders\nlike `<% tp.date.now() %>` — if your template contains placeholders, use\n`obsidian_create_from_template` instead, which routes to\n`templater:create-from-template`.\n\nParameters:\n  name (optional) — file name for the new note\n  path (optional) — vault-relative path\n  content (optional) — initial markdown content (literal, no placeholder expansion)\n\nExamples:\n  obsidian_create({ name: \"Meeting 2026-04-03\", content: \"# Meeting Notes\\n\\n- Attendees: ...\" })\n  obsidian_create({ path: \"Projects/new-idea.md\", content: \"# New idea\" })",
    schema: {
      name: z.string().optional().describe("File name"),
      path: z.string().optional().describe("File path"),
      content: z
        .string()
        .optional()
        .describe(
          "Initial content (literal — Templater placeholders are NOT expanded; use obsidian_create_from_template for that)",
        ),
    },
    build: ({ name, path, content }) => {
      const args = ["create"];
      if (name) args.push(`name=${name}`);
      if (path) args.push(`path=${path}`);
      if (content) args.push(`content=${content}`);
      return args;
    },
  },
  {
    name: "obsidian_create_from_template",
    description:
      "Create a new note from a Templater template, expanding placeholders.\n\nThis wraps the CLI's `templater:create-from-template` verb. Use this whenever\nthe template contains Templater placeholders such as `<% tp.date.now() %>`,\n`<% tp.file.title %>`, or any other `<% ... %>` expression — those are\nevaluated by Obsidian's Templater plugin and substituted into the output.\nFor plain notes with no placeholder expansion, use `obsidian_create`.\n\nParameters:\n  template (required) — vault-relative path to the Templater template (e.g. \"Templates/daily.md\")\n  file (required) — vault-relative output path for the new note (e.g. \"Daily/2026-05-18.md\")\n\nExamples:\n  obsidian_create_from_template({ template: \"Templates/daily.md\", file: \"Daily/2026-05-18.md\" })\n  obsidian_create_from_template({ template: \"Templates/project.md\", file: \"Projects/new-idea.md\" })",
    schema: {
      template: z
        .string()
        .describe("Vault-relative path to the Templater template"),
      file: z.string().describe("Vault-relative output path for the new note"),
    },
    build: ({ template, file }) => [
      "templater:create-from-template",
      `template=${template}`,
      `file=${file}`,
    ],
  },
  {
    name: "obsidian_property_set",
    description:
      "Set a frontmatter property on a note.\n\nParameters:\n  name (required) — property name\n  value (required) — property value\n  file (optional) — note name (wikilink resolution)\n  path (optional) — exact file path\n  One of file or path is required.\n\nExamples:\n  obsidian_property_set({ name: \"status\", value: \"done\", file: \"My Task\" })\n  obsidian_property_set({ name: \"tags\", value: \"project, active\", path: \"Work/todo.md\" })",
    schema: {
      name: z.string().describe("Property name"),
      value: z.string().describe("Property value"),
      file: z.string().optional().describe("File name"),
      path: z.string().optional().describe("File path"),
    },
    requires: ["fileOrPath"],
    build: ({ name, value, file, path }) => {
      const args = ["property:set", `name=${name}`, `value=${value}`];
      if (file) args.push(`file=${file}`);
      if (path) args.push(`path=${path}`);
      return args;
    },
  },
  {
    name: "obsidian_backlinks",
    description:
      "List backlinks to a note.\n\nParameters:\n  file (optional) — note name (wikilink resolution)\n  path (optional) — exact file path\n\nExamples:\n  obsidian_backlinks({ file: \"Project Plan\" })\n  obsidian_backlinks({ path: \"Ideas/brainstorm.md\" })",
    schema: {
      file: z.string().optional().describe("File name"),
      path: z.string().optional().describe("File path"),
    },
    build: ({ file, path }) => {
      const args = ["backlinks"];
      if (file) args.push(`file=${file}`);
      if (path) args.push(`path=${path}`);
      args.push("counts");
      return args;
    },
  },
  {
    name: "obsidian_files",
    description:
      "List files in the vault or a specific folder.\n\nParameters:\n  folder (optional) — filter by folder path\n  ext (optional) — filter by file extension (e.g. 'md', 'canvas')\n\nExamples:\n  obsidian_files({})\n  obsidian_files({ folder: \"Projects/\", ext: \"md\" })",
    schema: {
      folder: z.string().optional().describe("Filter by folder path"),
      ext: z.string().optional().describe("Filter by extension"),
    },
    build: ({ folder, ext }) => {
      const args = ["files"];
      if (folder) args.push(`folder=${folder}`);
      if (ext) args.push(`ext=${ext}`);
      return args;
    },
  },
  {
    name: "obsidian_move",
    description:
      "Move or rename a note, selecting it by file name or exact path.\n\nWraps the CLI's `move` Verb. Provide one of file or path to select the note, and `to` for the destination. Setting `to` to a new name in the same folder renames the note.\n\nParameters:\n  file (optional) — note name using wikilink resolution (e.g. 'My Note')\n  path (optional) — exact vault-relative path (e.g. 'folder/My Note.md')\n  to (required) — destination folder or vault-relative path\n  One of file or path is required.\n\nExamples:\n  obsidian_move({ file: \"My Note\", to: \"Archive/\" })\n  obsidian_move({ path: \"Inbox/idea.md\", to: \"Projects/idea.md\" })",
    schema: {
      file: z.string().optional().describe("File name (wikilink resolution)"),
      path: z.string().optional().describe("Exact file path"),
      to: z.string().describe("Destination folder or vault-relative path"),
    },
    requires: ["fileOrPath"],
    build: ({ file, path, to }) => {
      const args = ["move"];
      if (file) args.push(`file=${file}`);
      if (path) args.push(`path=${path}`);
      args.push(`to=${to}`);
      return args;
    },
  },
  {
    name: "obsidian_outline",
    description:
      "List the heading outline of a note, selecting it by file name or exact path.\n\nWraps the CLI's `outline` Verb. Provide one of file or path. Optional `format` controls the output shape; optional `total` returns just the heading count.\n\nParameters:\n  file (optional) — note name using wikilink resolution (e.g. 'My Note')\n  path (optional) — exact vault-relative path (e.g. 'folder/My Note.md')\n  format (optional) — output format: 'tree' (default), 'md', or 'json'\n  total (optional) — true to return the heading count instead of the outline\n  One of file or path is required.\n\nExamples:\n  obsidian_outline({ file: \"Meeting Notes\" })\n  obsidian_outline({ path: \"Projects/plan.md\", format: \"json\" })\n  obsidian_outline({ file: \"Long Doc\", total: true })",
    schema: {
      file: z.string().optional().describe("File name (wikilink resolution)"),
      path: z.string().optional().describe("Exact file path"),
      format: z
        .enum(["tree", "md", "json"])
        .optional()
        .describe("Output format (default: tree)"),
      total: z
        .boolean()
        .optional()
        .describe("Return heading count instead of the outline"),
    },
    requires: ["fileOrPath"],
    build: ({ file, path, format, total }) => {
      const args = ["outline"];
      if (file) args.push(`file=${file}`);
      if (path) args.push(`path=${path}`);
      if (format) args.push(`format=${format}`);
      if (total) args.push("total");
      return args;
    },
  },
  {
    name: "obsidian_rename",
    description:
      "Rename a note, selecting it by file name or exact path.\n\nWraps the CLI's `rename` Verb. Provide one of file or path to select the note, and `name` for the new file name. Renaming changes only the name within the same folder; use obsidian_move to relocate a note to a different folder.\n\nParameters:\n  file (optional) — note name using wikilink resolution (e.g. 'My Note')\n  path (optional) — exact vault-relative path (e.g. 'folder/My Note.md')\n  name (required) — the new file name\n  One of file or path is required.\n\nExamples:\n  obsidian_rename({ file: \"Draft\", name: \"Final\" })\n  obsidian_rename({ path: \"Inbox/idea.md\", name: \"refined-idea.md\" })",
    schema: {
      file: z.string().optional().describe("File name (wikilink resolution)"),
      path: z.string().optional().describe("Exact file path"),
      name: z.string().describe("New file name"),
    },
    requires: ["fileOrPath"],
    build: ({ file, path, name }) => {
      const args = ["rename"];
      if (file) args.push(`file=${file}`);
      if (path) args.push(`path=${path}`);
      args.push(`name=${name}`);
      return args;
    },
  },
  {
    name: "obsidian_delete",
    description:
      "Delete a note, selecting it by file name or exact path.\n\nWraps the CLI's `delete` Verb. DESTRUCTIVE: by default the note is moved to the system trash (recoverable). Pass `permanent: true` to skip the trash and delete irrecoverably — there is no undo for a permanent delete.\n\nParameters:\n  file (optional) — note name using wikilink resolution (e.g. 'My Note')\n  path (optional) — exact vault-relative path (e.g. 'folder/My Note.md')\n  permanent (optional) — true to skip trash and delete permanently (irreversible)\n  One of file or path is required.\n\nExamples:\n  obsidian_delete({ file: \"Old Draft\" }) — moves to trash\n  obsidian_delete({ path: \"Inbox/spam.md\", permanent: true }) — irreversible",
    schema: {
      file: z.string().optional().describe("File name (wikilink resolution)"),
      path: z.string().optional().describe("Exact file path"),
      permanent: z
        .boolean()
        .optional()
        .describe("Skip trash and delete permanently (irreversible)"),
    },
    requires: ["fileOrPath"],
    build: ({ file, path, permanent }) => {
      const args = ["delete"];
      if (file) args.push(`file=${file}`);
      if (path) args.push(`path=${path}`);
      if (permanent) args.push("permanent");
      return args;
    },
  },
  {
    name: "obsidian_recents",
    description:
      "List recently opened files.\n\nReturns the most recently opened files in the vault, ordered by last access time.",
    schema: {},
    build: () => "recents",
  },
  {
    name: "obsidian_help",
    description:
      "Get Obsidian help: a live verb index from the CLI, or reference docs by slug.\n\nParameters:\n  topic (optional) — a verb name (e.g. \"read\", \"daily:append\", \"property:set\") OR a reference-doc slug (cli, markdown, bases, canvas)\n\nBehavior:\n  - No topic — returns the live, category-grouped verb index parsed from the CLI's `help` output (Read, Write, Edit, Discover, Tasks, Daily, Properties, Plugins, Dev, Eval).\n  - Verb name — returns that verb's description and flag list from the live manifest.\n  - Doc slug — returns the Kepano-derived reference prompt (markdown / bases / canvas / cli syntax).\n  - Collision rule: if a doc slug also names a real verb, the verb's live help wins (live truth beats static text).\n\nExamples:\n  obsidian_help({}) — browse the verb catalog\n  obsidian_help({ topic: \"read\" }) — live verb help for `read`\n  obsidian_help({ topic: \"markdown\" }) — Obsidian-flavored markdown reference\n  obsidian_help({ topic: \"bases\" }) — Bases YAML schema, filters, formulas\n  obsidian_help({ topic: \"canvas\" }) — JSON Canvas reference\n  obsidian_help({ topic: \"cli\" }) — CLI command syntax reference",
    schema: {
      topic: z
        .string()
        .optional()
        .describe(
          "Verb name or reference-doc slug (cli, markdown, bases, canvas)",
        ),
    },
    handler: async ({ topic }, ctx) => ctx.helpHandler({ topic }),
  },
];

/**
 * Register every entry in `entries` as a tool on `server`.
 *
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 * @param {(args: string | string[]) => Promise<object>} runTool
 *   The shared exec path. Receives the entry's build() result.
 * @param {Array<object>} entries  Typed-tool registry entries.
 * @param {object} [ctx]  Optional context for entries with custom handlers.
 */
export function registerTypedTools(server, runTool, entries, ctx = {}) {
  for (const entry of entries) {
    if (entry.handler) {
      server.tool(entry.name, entry.description, entry.schema, (args) =>
        entry.handler(args, ctx),
      );
      continue;
    }

    server.tool(entry.name, entry.description, entry.schema, async (args) => {
      for (const name of entry.requires || []) {
        const v = validators[name];
        const fail = v(args);
        if (fail) {
          return fail.isError ? errorResult(fail.error) : text(fail.error);
        }
      }
      return runTool(entry.build(args));
    });
  }
}

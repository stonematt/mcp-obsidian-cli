/**
 * obsidian-mcp — MCP server wrapping the Obsidian CLI.
 *
 * This module is a pure factory. Construct it with the deps you need; do
 * not import it for side effects. The runtime entrypoint lives at
 * `bin/server.js`, which loads config, builds the adapter, and connects
 * the stdio transport.
 *
 * Exposes a single generic `obsidian` tool that passes any command string
 * directly to the CLI, plus a handful of convenience tools for the most
 * common operations (read, search, daily, tasks, properties, etc.).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  text,
  errorResult,
  parseArgs,
  extractLeadingVault,
} from "./lib/helpers.js";

/**
 * Build a wired MCP server. Inject the CLI adapter, prompt content,
 * version string, and vault state; no side effects at module load.
 *
 * @param {object} opts
 * @param {{exec: Function, getVault: Function, setVault: Function, isObsidianRunning: Function}} opts.cli
 *   The Obsidian CLI adapter (see `lib/obsidian-cli.js`) plus an injected
 *   `isObsidianRunning` callable.
 * @param {Record<string,string>} opts.prompts - Prompt content keyed by slug
 *   (`obsidian-cli`, `obsidian-markdown`, `obsidian-bases`, `obsidian-canvas`).
 * @param {object|null} [opts.manifest] - Reserved for #10 VerbManifest. Ignored today.
 * @param {string} opts.version - Server version string surfaced via MCP.
 * @param {Set<string>} [opts.knownVaults] - Vault names Obsidian knows about.
 * @param {string|null} [opts.runtimeVault] - Initial runtime vault (or null
 *   to prompt-on-first-use when knownVaults is non-empty).
 * @returns {McpServer}
 */
export function createServer({
  cli,
  prompts,
  manifest = null, // reserved for #10 VerbManifest
  version,
  knownVaults = new Set(),
  runtimeVault = null,
} = {}) {
  // Keep `manifest` referenced so future refactors don't trip a linter.
  void manifest;

  // Seed the adapter's vault state from the runtime vault. The adapter is
  // the single source of truth for "what vault are we currently routed to";
  // the factory just hands it the initial value.
  if (runtimeVault) cli.setVault(runtimeVault);
  else cli.setVault("");

  function vaultPromptResponse() {
    const list = [...knownVaults].sort().map((v) => `  - ${v}`).join("\n");
    return text(
      `No vault selected. Available vaults:\n${list}\n\n` +
      `Ask the user which vault to use, then either:\n` +
      `  - retry through the generic \`obsidian\` tool with \`vault=NAME\` as the first token (e.g. \`vault=tyee read file="My Note"\`), or\n` +
      `  - retry any convenience tool — the server will cache the vault from the first \`vault=\` override and reuse it for subsequent calls.\n\n` +
      `If the user named a vault in conversation (e.g. "save this in tyee"), prepend \`vault=tyee\` automatically.`
    );
  }

  /** Run CLI, return MCP result. Accepts a command string or an args array. */
  async function runTool(input) {
    if (!(await cli.isObsidianRunning())) {
      return errorResult(
        "Obsidian.app is not running. Open Obsidian and retry — no Claude Desktop restart needed.",
        "OBSIDIAN_NOT_RUNNING"
      );
    }

    // Cache caller-supplied vault override so subsequent convenience-tool calls
    // route to the same vault without the caller having to repeat it.
    const parsed = Array.isArray(input) ? input : parseArgs(input);
    const callerVault = extractLeadingVault(parsed);
    if (callerVault) {
      if (knownVaults.size > 0 && !knownVaults.has(callerVault)) {
        return errorResult(
          `Unknown vault '${callerVault}'. Known vaults: ${[...knownVaults].sort().join(", ")}.`,
          "VAULT_NOT_FOUND"
        );
      }
      cli.setVault(callerVault);
    } else if (!cli.getVault() && knownVaults.size > 0) {
      return vaultPromptResponse();
    }

    const { stdout, stderr, error } = await cli.exec(input);
    if (error) {
      return errorResult(error.message, error.type);
    }
    const parts = [];
    if (stdout) parts.push(stdout);
    if (stderr) parts.push(`[stderr] ${stderr}`);
    return text(parts.join("\n") || "(no output)");
  }

  const server = new McpServer({
    name: "obsidian-mcp",
    version,
    capabilities: { tools: {} },
  });

  // ---- Generic pass-through tool ------------------------------------------

  server.tool(
    "obsidian",
    `Run any Obsidian CLI command. Pass the full command string exactly as you
would on the terminal (minus the leading 'obsidian' binary name).

IMPORTANT: when multiple vaults are loaded, the CLI's vault= argument must
be the FIRST token. The server auto-prepends vault=<runtimeVault> once a
vault has been selected; if you include vault= manually in this command
string, put it first or the CLI silently routes to the focused vault.

VAULT ROUTING: if the user names a vault in conversation (e.g. "save this
in tyee", "scarp note"), prepend \`vault=NAME \` as the first token. The
server caches that selection in memory for subsequent calls.

Examples:
  "daily:read"
  "search:context query=\"meeting notes\" limit=5"
  "read file=\"My Note\""
  "tags counts sort=count"
  "tasks daily"
  "property:read name=status path=\"1p/my-project/my-project.md\""
  "vault=tyee read file=\"My Note\""   # explicit vault override, first
  "help search"`,
    { command: z.string().describe("CLI command and arguments") },
    async ({ command }) => runTool(command),
  );

  // ---- Convenience tools for common operations ----------------------------

  server.tool(
    "obsidian_daily_read",
    "Read today's daily note contents.\n\nReturns the full markdown content of today's daily note. Returns an error if no daily note exists for today.",
    {},
    async () => runTool("daily:read"),
  );

  server.tool(
    "obsidian_daily_path",
    "Get the file path of today's daily note.\n\nReturns the vault-relative path (e.g. 'Daily/2026-04-03.md'). Useful for constructing paths for other tools.",
    {},
    async () => runTool("daily:path"),
  );

  server.tool(
    "obsidian_daily_append",
    "Append content to today's daily note.\n\nParameters:\n  content (required) — markdown text to append at the end of today's daily note\n\nExamples:\n  obsidian_daily_append({ content: \"- Meeting with team at 3pm\" })\n  obsidian_daily_append({ content: \"> [!tip] Remember\\n> Review PR before EOD\" })",
    { content: z.string().describe("Content to append") },
    async ({ content }) => runTool(["daily:append", `content=${content}`]),
  );

  server.tool(
    "obsidian_read",
    "Read a note by file name (wikilink-style) or exact path.\n\nParameters:\n  file (optional) — note name using wikilink resolution (e.g. 'My Note')\n  path (optional) — exact vault-relative path (e.g. 'folder/My Note.md')\n  One of file or path is required.\n\nExamples:\n  obsidian_read({ file: \"Meeting Notes\" })\n  obsidian_read({ path: \"Projects/todo.md\" })",
    {
      file: z.string().optional().describe("File name (wikilink resolution)"),
      path: z.string().optional().describe("Exact file path"),
    },
    async ({ file, path }) => {
      if (!file && !path) return text("Error: provide file= or path=");
      const args = ["read"];
      if (file) args.push(`file=${file}`);
      if (path) args.push(`path=${path}`);
      return runTool(args);
    },
  );

  server.tool(
    "obsidian_search",
    "Full-text search across the vault with line context.\n\nParameters:\n  query (required) — search terms, supports Obsidian query syntax\n  path (optional) — restrict results to a folder path\n  limit (optional) — max number of files to return\n\nExamples:\n  obsidian_search({ query: \"meeting notes\" })\n  obsidian_search({ query: \"project status\", path: \"Work/\", limit: 5 })",
    {
      query: z.string().describe("Search query"),
      path: z.string().optional().describe("Limit to folder"),
      limit: z.number().optional().describe("Max files to return"),
    },
    async ({ query, path, limit }) => {
      const args = ["search:context", `query=${query}`];
      if (path) args.push(`path=${path}`);
      if (limit) args.push(`limit=${limit}`);
      return runTool(args);
    },
  );

  server.tool(
    "obsidian_tags",
    "List tags in the vault with counts.\n\nParameters:\n  sort (optional) — 'name' or 'count' (default: name)\n\nExamples:\n  obsidian_tags({})\n  obsidian_tags({ sort: \"count\" })",
    {
      sort: z.enum(["name", "count"]).optional().describe("Sort order"),
    },
    async ({ sort }) => {
      const args = ["tags", "counts"];
      if (sort) args.push(`sort=${sort}`);
      return runTool(args);
    },
  );

  server.tool(
    "obsidian_tasks",
    "List tasks from vault notes.\n\nParameters:\n  daily (optional) — true to show only today's daily note tasks\n  todo (optional) — true to show only incomplete tasks\n  done (optional) — true to show only completed tasks\n  path (optional) — filter by file path\n\nExamples:\n  obsidian_tasks({ daily: true })\n  obsidian_tasks({ todo: true, path: \"Projects/\" })",
    {
      daily: z.boolean().optional().describe("Show only daily note tasks"),
      todo: z.boolean().optional().describe("Show incomplete tasks only"),
      done: z.boolean().optional().describe("Show completed tasks only"),
      path: z.string().optional().describe("Filter by file path"),
    },
    async ({ daily, todo, done, path }) => {
      const args = ["tasks"];
      if (daily) args.push("daily");
      if (todo) args.push("todo");
      if (done) args.push("done");
      if (path) args.push(`path=${path}`);
      return runTool(args);
    },
  );

  server.tool(
    "obsidian_properties",
    "List or read frontmatter properties.\n\nParameters:\n  file (optional) — note name for wikilink resolution\n  path (optional) — exact file path\n  name (optional) — specific property name to read (requires file or path)\n\nExamples:\n  obsidian_properties({}) — list all properties with counts\n  obsidian_properties({ file: \"My Note\" }) — properties of a specific note\n  obsidian_properties({ file: \"My Note\", name: \"status\" }) — read one property",
    {
      file: z.string().optional().describe("File name"),
      path: z.string().optional().describe("File path"),
      name: z.string().optional().describe("Specific property name to read"),
    },
    async ({ file, path, name }) => {
      if (name && (file || path)) {
        const args = ["property:read", `name=${name}`];
        if (file) args.push(`file=${file}`);
        if (path) args.push(`path=${path}`);
        return runTool(args);
      }
      const args = ["properties"];
      if (file) args.push(`file=${file}`);
      if (path) args.push(`path=${path}`);
      args.push("counts");
      return runTool(args);
    },
  );

  server.tool(
    "obsidian_create",
    "Create a new PLAIN note (no Templater expansion).\n\nThis wraps the CLI's `create` verb. It does NOT expand Templater placeholders\nlike `<% tp.date.now() %>` — if your template contains placeholders, use\n`obsidian_create_from_template` instead, which routes to\n`templater:create-from-template`.\n\nParameters:\n  name (optional) — file name for the new note\n  path (optional) — vault-relative path\n  content (optional) — initial markdown content (literal, no placeholder expansion)\n\nExamples:\n  obsidian_create({ name: \"Meeting 2026-04-03\", content: \"# Meeting Notes\\n\\n- Attendees: ...\" })\n  obsidian_create({ path: \"Projects/new-idea.md\", content: \"# New idea\" })",
    {
      name: z.string().optional().describe("File name"),
      path: z.string().optional().describe("File path"),
      content: z.string().optional().describe("Initial content (literal — Templater placeholders are NOT expanded; use obsidian_create_from_template for that)"),
    },
    async ({ name, path, content }) => {
      const args = ["create"];
      if (name) args.push(`name=${name}`);
      if (path) args.push(`path=${path}`);
      if (content) args.push(`content=${content}`);
      return runTool(args);
    },
  );

  server.tool(
    "obsidian_create_from_template",
    "Create a new note from a Templater template, expanding placeholders.\n\nThis wraps the CLI's `templater:create-from-template` verb. Use this whenever\nthe template contains Templater placeholders such as `<% tp.date.now() %>`,\n`<% tp.file.title %>`, or any other `<% ... %>` expression — those are\nevaluated by Obsidian's Templater plugin and substituted into the output.\nFor plain notes with no placeholder expansion, use `obsidian_create`.\n\nParameters:\n  template (required) — vault-relative path to the Templater template (e.g. \"Templates/daily.md\")\n  file (required) — vault-relative output path for the new note (e.g. \"Daily/2026-05-18.md\")\n\nExamples:\n  obsidian_create_from_template({ template: \"Templates/daily.md\", file: \"Daily/2026-05-18.md\" })\n  obsidian_create_from_template({ template: \"Templates/project.md\", file: \"Projects/new-idea.md\" })",
    {
      template: z.string().describe("Vault-relative path to the Templater template"),
      file: z.string().describe("Vault-relative output path for the new note"),
    },
    async ({ template, file }) => {
      const args = [
        "templater:create-from-template",
        `template=${template}`,
        `file=${file}`,
      ];
      return runTool(args);
    },
  );

  server.tool(
    "obsidian_property_set",
    "Set a frontmatter property on a note.\n\nParameters:\n  name (required) — property name\n  value (required) — property value\n  file (optional) — note name (wikilink resolution)\n  path (optional) — exact file path\n  One of file or path is required.\n\nExamples:\n  obsidian_property_set({ name: \"status\", value: \"done\", file: \"My Task\" })\n  obsidian_property_set({ name: \"tags\", value: \"project, active\", path: \"Work/todo.md\" })",
    {
      name: z.string().describe("Property name"),
      value: z.string().describe("Property value"),
      file: z.string().optional().describe("File name"),
      path: z.string().optional().describe("File path"),
    },
    async ({ name, value, file, path: filePath }) => {
      if (!file && !filePath) return text("Error: provide file= or path=");
      const args = ["property:set", `name=${name}`, `value=${value}`];
      if (file) args.push(`file=${file}`);
      if (filePath) args.push(`path=${filePath}`);
      return runTool(args);
    },
  );

  server.tool(
    "obsidian_backlinks",
    "List backlinks to a note.\n\nParameters:\n  file (optional) — note name (wikilink resolution)\n  path (optional) — exact file path\n\nExamples:\n  obsidian_backlinks({ file: \"Project Plan\" })\n  obsidian_backlinks({ path: \"Ideas/brainstorm.md\" })",
    {
      file: z.string().optional().describe("File name"),
      path: z.string().optional().describe("File path"),
    },
    async ({ file, path }) => {
      const args = ["backlinks"];
      if (file) args.push(`file=${file}`);
      if (path) args.push(`path=${path}`);
      args.push("counts");
      return runTool(args);
    },
  );

  server.tool(
    "obsidian_files",
    "List files in the vault or a specific folder.\n\nParameters:\n  folder (optional) — filter by folder path\n  ext (optional) — filter by file extension (e.g. 'md', 'canvas')\n\nExamples:\n  obsidian_files({})\n  obsidian_files({ folder: \"Projects/\", ext: \"md\" })",
    {
      folder: z.string().optional().describe("Filter by folder path"),
      ext: z.string().optional().describe("Filter by extension"),
    },
    async ({ folder, ext }) => {
      const args = ["files"];
      if (folder) args.push(`folder=${folder}`);
      if (ext) args.push(`ext=${ext}`);
      return runTool(args);
    },
  );

  server.tool(
    "obsidian_recents",
    "List recently opened files.\n\nReturns the most recently opened files in the vault, ordered by last access time.",
    {},
    async () => runTool("recents"),
  );

  server.tool(
    "obsidian_help",
    "Get Obsidian reference documentation on a topic.\n\nParameters:\n  topic (required) — one of: cli, markdown, bases, canvas\n\nExamples:\n  obsidian_help({ topic: \"markdown\" }) — wikilinks, embeds, callouts, properties, tags\n  obsidian_help({ topic: \"bases\" }) — Bases YAML schema, filters, formulas, views\n  obsidian_help({ topic: \"canvas\" }) — JSON Canvas nodes, edges, colors, layout\n  obsidian_help({ topic: \"cli\" }) — CLI command syntax and parameter patterns",
    { topic: z.enum(["cli", "markdown", "bases", "canvas"]).describe("Reference topic") },
    async ({ topic }) => ({
      content: [{ type: "text", text: prompts[`obsidian-${topic}`] }],
    }),
  );

  // ---- MCP Prompts -----------------------------------------------------------

  const promptMeta = {
    "obsidian-cli": {
      title: "Obsidian CLI Reference",
      description: "CLI usage patterns, parameter syntax, and command examples for the Obsidian CLI. Adapted from kepano/obsidian-skills (MIT License, https://github.com/kepano/obsidian-skills).",
    },
    "obsidian-markdown": {
      title: "Obsidian Flavored Markdown Reference",
      description: "Wikilinks, embeds, callouts, properties, tags, and other Obsidian-specific markdown syntax. Adapted from kepano/obsidian-skills (MIT License, https://github.com/kepano/obsidian-skills).",
    },
    "obsidian-bases": {
      title: "Obsidian Bases Reference",
      description: "Bases syntax for database-like views: filters, formulas, view types, and summaries. Adapted from kepano/obsidian-skills (MIT License, https://github.com/kepano/obsidian-skills).",
    },
    "obsidian-canvas": {
      title: "JSON Canvas Reference",
      description: "JSON Canvas format for visual canvases: node types, edges, groups, and layout. Adapted from kepano/obsidian-skills (MIT License, https://github.com/kepano/obsidian-skills).",
    },
  };

  for (const [name, content] of Object.entries(prompts)) {
    const meta = promptMeta[name];
    if (!meta) continue;
    server.registerPrompt(
      name,
      { title: meta.title, description: meta.description },
      () => ({
        messages: [{ role: "user", content: { type: "text", text: content } }],
      })
    );
  }

  return server;
}

#!/usr/bin/env node
/**
 * obsidian-mcp — MCP server wrapping the Obsidian CLI.
 *
 * Exposes a single generic `obsidian` tool that passes any command string
 * directly to the CLI, plus a handful of convenience tools for the most
 * common operations (read, search, daily, tasks, properties, etc.).
 *
 * Environment variables:
 *   OBSIDIAN_CLI_PATH    - Path to the obsidian CLI binary (default: "obsidian")
 *   OBSIDIAN_VAULT       - Vault name to use (default: "")
 *   OBSIDIAN_TIMEOUT_MS  - Command timeout in ms (default: 15000)
 *
 * Requirements:
 *   - Obsidian must be running with the CLI plugin active.
 *   - The CLI binary is auto-discovered from common macOS locations.
 *     Set OBSIDIAN_CLI_PATH to override.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { loadConfig, parseArgs, text, errorResult } from "./lib/helpers.js";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "prompts");

const promptContent = {
  "obsidian-cli":      readFileSync(join(PROMPTS_DIR, "obsidian-cli.md"), "utf8"),
  "obsidian-markdown": readFileSync(join(PROMPTS_DIR, "obsidian-markdown.md"), "utf8"),
  "obsidian-bases":    readFileSync(join(PROMPTS_DIR, "obsidian-bases.md"), "utf8"),
  "obsidian-canvas":   readFileSync(join(PROMPTS_DIR, "obsidian-canvas.md"), "utf8"),
};

const configBase = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
const CONFIG_DIR = join(configBase, "mcp-obsidian-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.yaml");


const KNOWN_CLI_PATHS = [
  "/Applications/Obsidian.app/Contents/MacOS/obsidian",
  join(homedir(), "Applications/Obsidian.app/Contents/MacOS/obsidian"),
];

async function resolveCliPath(configured) {
  if (configured !== "obsidian") return configured;

  try {
    await execAsync("which obsidian", { timeout: 2000 });
    return configured;
  } catch { /* not on PATH */ }

  for (const p of KNOWN_CLI_PATHS) {
    if (existsSync(p)) return p;
  }

  try {
    const { stdout } = await execAsync(
      "ps aux | grep -i obsidian | grep -v grep | grep -v Helper",
      { timeout: 2000 }
    );
    const match = stdout.match(/(\S*\/Contents\/MacOS\/obsidian)/i);
    if (match && existsSync(match[1])) return match[1];
  } catch { /* no running process */ }

  return configured;
}

const config = loadConfig(CONFIG_FILE);
const CLI = await resolveCliPath(config.cliPath);
const VAULT = config.vault;
const TIMEOUT_MS = config.timeoutMs;

async function checkObsidianRunning() {
  try {
    const { stdout } = await execAsync(
      "ps aux | grep -i obsidian | grep -v grep | grep -v Helper",
      { timeout: 2000 }
    );
    return stdout.includes("/Applications/Obsidian.app");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run the Obsidian CLI with the given argument string.
 * Returns { stdout, stderr } or throws on non-zero exit / timeout.
 */
async function run(input) {
  const args = Array.isArray(input) ? [...input] : parseArgs(input);
  if (VAULT) args.push(`vault=${VAULT}`);

  try {
    const { stdout, stderr } = await execFileAsync(CLI, args, {
      timeout: TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env },
    });
    return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), error: null };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        stdout: '',
        stderr: '',
        error: {
          type: 'CLI_NOT_FOUND',
          message: `Obsidian CLI not found at: ${CLI}. Set OBSIDIAN_CLI_PATH or ensure 'obsidian' is on PATH.`
        }
      };
    }
    if (err.killed) {
      return {
        stdout: '',
        stderr: '',
        error: {
          type: 'TIMEOUT',
          message: `Command timed out after ${TIMEOUT_MS}ms. Set OBSIDIAN_TIMEOUT_MS to increase timeout.`
        }
      };
    }
    const msg = err.stderr?.trimEnd() || err.message;
    return { stdout: '', stderr: '', error: { type: 'EXECUTION_ERROR', message: msg } };
  }
}


/** Run CLI, return MCP result. Accepts a command string or an args array. */
async function runTool(input) {
  const { stdout, stderr, error } = await run(input);
  if (error) {
    return errorResult(error.message, error.type);
  }
  const parts = [];
  if (stdout) parts.push(stdout);
  if (stderr) parts.push(`[stderr] ${stderr}`);
  return text(parts.join("\n") || "(no output)");
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "obsidian-mcp",
  version: "1.1.0",
  capabilities: { tools: {} },
});

// ---- Generic pass-through tool ------------------------------------------

server.tool(
  "obsidian",
  `Run any Obsidian CLI command. Pass the full command string exactly as you
would on the terminal (minus the leading 'obsidian' binary name).
Examples:
  "daily:read"
  "search:context query=\"meeting notes\" limit=5"
  "read file=\"My Note\""
  "tags counts sort=count"
  "tasks daily"
  "property:read name=status path=\"1p/my-project/my-project.md\""
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
  "Create a new note.\n\nParameters:\n  name (optional) — file name for the new note\n  path (optional) — vault-relative path\n  content (optional) — initial markdown content\n  template (optional) — template name to use\n\nExamples:\n  obsidian_create({ name: \"Meeting 2026-04-03\", content: \"# Meeting Notes\\n\\n- Attendees: ...\" })\n  obsidian_create({ path: \"Projects/new-idea.md\", template: \"project\" })",
  {
    name: z.string().optional().describe("File name"),
    path: z.string().optional().describe("File path"),
    content: z.string().optional().describe("Initial content"),
    template: z.string().optional().describe("Template to use"),
  },
  async ({ name, path, content, template }) => {
    const args = ["create"];
    if (name) args.push(`name=${name}`);
    if (path) args.push(`path=${path}`);
    if (template) args.push(`template=${template}`);
    if (content) args.push(`content=${content}`);
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
    content: [{ type: "text", text: promptContent[`obsidian-${topic}`] }],
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

for (const [name, content] of Object.entries(promptContent)) {
  const meta = promptMeta[name];
  server.registerPrompt(
    name,
    { title: meta.title, description: meta.description },
    () => ({
      messages: [{ role: "user", content: { type: "text", text: content } }],
    })
  );
}

// ---- Start ---------------------------------------------------------------

async function main() {
  const running = await checkObsidianRunning();
  if (!running) {
    console.error("Error: Obsidian is not running. Please open Obsidian and try again.");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  console.error("obsidian-mcp server running on stdio");
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

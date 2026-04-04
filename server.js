#!/usr/bin/env node
/**
 * obsidian-mcp — MCP server wrapping the Obsidian CLI.
 *
 * Exposes a single generic `obsidian` tool that passes any command string
 * directly to the CLI, plus a handful of convenience tools for the most
 * common operations (read, search, daily, tasks, properties, etc.).
 *
 * Requirements:
 *   - Obsidian must be running with the CLI plugin active.
 *   - The `obsidian` binary must be on PATH (or set OBSIDIAN_CLI_PATH).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CLI = process.env.OBSIDIAN_CLI_PATH || "obsidian";
const VAULT = process.env.OBSIDIAN_VAULT || "";
const TIMEOUT_MS = parseInt(process.env.OBSIDIAN_TIMEOUT_MS || "15000", 10);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run the Obsidian CLI with the given argument string.
 * Returns { stdout, stderr } or throws on non-zero exit / timeout.
 */
async function run(argString) {
  // Split respecting quoted values — good enough for CLI arg forwarding.
  const args = parseArgs(argString);
  if (VAULT) args.push(`vault=${VAULT}`);

  try {
    const { stdout, stderr } = await execFileAsync(CLI, args, {
      timeout: TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env },
    });
    return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd() };
  } catch (err) {
    const msg = err.stderr?.trimEnd() || err.message;
    throw new Error(msg);
  }
}

/**
 * Minimal arg parser: splits on whitespace but respects key="value with spaces".
 */
function parseArgs(str) {
  const args = [];
  const re = /(?:[^\s"]+|"[^"]*")+/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    args.push(m[0]);
  }
  return args;
}

/** Standard MCP text result. */
function text(content) {
  return { content: [{ type: "text", text: content }] };
}

/** Run CLI, return MCP result. */
async function runTool(argString) {
  const { stdout, stderr } = await run(argString);
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
  version: "1.0.0",
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
  "Read today's daily note contents.",
  {},
  async () => runTool("daily:read"),
);

server.tool(
  "obsidian_daily_path",
  "Get the file path of today's daily note.",
  {},
  async () => runTool("daily:path"),
);

server.tool(
  "obsidian_daily_append",
  "Append content to today's daily note.",
  { content: z.string().describe("Content to append") },
  async ({ content }) => runTool(`daily:append content="${content.replace(/"/g, '\\"')}"`),
);

server.tool(
  "obsidian_read",
  "Read a note by file name (wikilink-style) or exact path.",
  {
    file: z.string().optional().describe("File name (wikilink resolution)"),
    path: z.string().optional().describe("Exact file path"),
  },
  async ({ file, path }) => {
    if (!file && !path) return text("Error: provide file= or path=");
    const arg = file ? `file="${file}"` : `path="${path}"`;
    return runTool(`read ${arg}`);
  },
);

server.tool(
  "obsidian_search",
  "Full-text search across the vault with line context.",
  {
    query: z.string().describe("Search query"),
    path: z.string().optional().describe("Limit to folder"),
    limit: z.number().optional().describe("Max files to return"),
  },
  async ({ query, path, limit }) => {
    let cmd = `search:context query="${query.replace(/"/g, '\\"')}"`;
    if (path) cmd += ` path="${path}"`;
    if (limit) cmd += ` limit=${limit}`;
    return runTool(cmd);
  },
);

server.tool(
  "obsidian_tags",
  "List tags in the vault with counts.",
  {
    sort: z.enum(["name", "count"]).optional().describe("Sort order"),
  },
  async ({ sort }) => {
    let cmd = "tags counts";
    if (sort) cmd += ` sort=${sort}`;
    return runTool(cmd);
  },
);

server.tool(
  "obsidian_tasks",
  "List tasks. Use daily=true for today's tasks only.",
  {
    daily: z.boolean().optional().describe("Show only daily note tasks"),
    todo: z.boolean().optional().describe("Show incomplete tasks only"),
    done: z.boolean().optional().describe("Show completed tasks only"),
    path: z.string().optional().describe("Filter by file path"),
  },
  async ({ daily, todo, done, path }) => {
    let cmd = "tasks";
    if (daily) cmd += " daily";
    if (todo) cmd += " todo";
    if (done) cmd += " done";
    if (path) cmd += ` path="${path}"`;
    return runTool(cmd);
  },
);

server.tool(
  "obsidian_properties",
  "List or read frontmatter properties.",
  {
    file: z.string().optional().describe("File name"),
    path: z.string().optional().describe("File path"),
    name: z.string().optional().describe("Specific property name to read"),
  },
  async ({ file, path, name }) => {
    if (name && (file || path)) {
      // Read a specific property from a specific file
      const target = file ? `file="${file}"` : `path="${path}"`;
      return runTool(`property:read name="${name}" ${target}`);
    }
    let cmd = "properties";
    if (file) cmd += ` file="${file}"`;
    if (path) cmd += ` path="${path}"`;
    cmd += " counts";
    return runTool(cmd);
  },
);

server.tool(
  "obsidian_create",
  "Create a new note.",
  {
    name: z.string().optional().describe("File name"),
    path: z.string().optional().describe("File path"),
    content: z.string().optional().describe("Initial content"),
    template: z.string().optional().describe("Template to use"),
  },
  async ({ name, path, content, template }) => {
    let cmd = "create";
    if (name) cmd += ` name="${name}"`;
    if (path) cmd += ` path="${path}"`;
    if (template) cmd += ` template="${template}"`;
    if (content) cmd += ` content="${content.replace(/"/g, '\\"')}"`;
    return runTool(cmd);
  },
);

server.tool(
  "obsidian_property_set",
  "Set a frontmatter property on a note.",
  {
    name: z.string().describe("Property name"),
    value: z.string().describe("Property value"),
    file: z.string().optional().describe("File name"),
    path: z.string().optional().describe("File path"),
  },
  async ({ name, value, file, path: filePath }) => {
    const target = file ? `file="${file}"` : filePath ? `path="${filePath}"` : "";
    if (!target) return text("Error: provide file= or path=");
    return runTool(`property:set name="${name}" value="${value.replace(/"/g, '\\"')}" ${target}`);
  },
);

server.tool(
  "obsidian_backlinks",
  "List backlinks to a note.",
  {
    file: z.string().optional().describe("File name"),
    path: z.string().optional().describe("File path"),
  },
  async ({ file, path }) => {
    const target = file ? `file="${file}"` : path ? `path="${path}"` : "";
    return runTool(`backlinks ${target} counts`);
  },
);

server.tool(
  "obsidian_files",
  "List files in the vault or a specific folder.",
  {
    folder: z.string().optional().describe("Filter by folder path"),
    ext: z.string().optional().describe("Filter by extension"),
  },
  async ({ folder, ext }) => {
    let cmd = "files";
    if (folder) cmd += ` folder="${folder}"`;
    if (ext) cmd += ` ext=${ext}`;
    return runTool(cmd);
  },
);

server.tool(
  "obsidian_recents",
  "List recently opened files.",
  {},
  async () => runTool("recents"),
);

// ---- Start ---------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("obsidian-mcp server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

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
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { load as yamlLoad } from "js-yaml";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

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

function loadConfig() {
  const defaults = { vault: "", cliPath: "obsidian", timeoutMs: 15000 };
  let config = { ...defaults };

  if (existsSync(CONFIG_FILE)) {
    try {
      const content = readFileSync(CONFIG_FILE, "utf8");
      const fileConfig = yamlLoad(content);
      if (fileConfig) {
        if (fileConfig.vault) config.vault = fileConfig.vault;
        if (fileConfig.cliPath) config.cliPath = fileConfig.cliPath;
        if (fileConfig.timeoutMs) config.timeoutMs = fileConfig.timeoutMs;
      }
    } catch (err) {
      console.error("Warning: failed to load config file:", err.message);
    }
  }

  if (process.env.OBSIDIAN_VAULT) config.vault = process.env.OBSIDIAN_VAULT;
  if (process.env.OBSIDIAN_CLI_PATH) config.cliPath = process.env.OBSIDIAN_CLI_PATH;
  if (process.env.OBSIDIAN_TIMEOUT_MS) config.timeoutMs = parseInt(process.env.OBSIDIAN_TIMEOUT_MS, 10);

  return config;
}

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

const config = loadConfig();
const CLI = await resolveCliPath(config.cliPath);
const VAULT = config.vault;
const TIMEOUT_MS = config.timeoutMs;

async function checkObsidianRunning() {
  try {
    const { stdout: psOut } = await execAsync("ps aux | grep -i obsidian | grep -v grep | grep -v Helper", { timeout: 2000 });
    const obsidianRunning = psOut.includes("/Applications/Obsidian.app");
    if (!obsidianRunning) {
      return { running: false, version: null };
    }
    const { stdout } = await execFileAsync(CLI, ["version"], { timeout: 2000 });
    const hasStartupMsg = stdout.includes("Loaded updated app package") || 
                          stdout.includes("Checking for update") ||
                          stdout.includes("App is up to date") ||
                          stdout.includes("Latest version is");
    if (hasStartupMsg) {
      return { running: false, version: null };
    }
    if (stdout.includes("(installer")) {
      const match = stdout.match(/(\d+\.\d+\.\d+)/);
      if (match) {
        return { running: true, version: match[1] };
      }
    }
    return { running: false, version: null };
  } catch (err) {
    return { running: false, version: null };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run the Obsidian CLI with the given argument string.
 * Returns { stdout, stderr } or throws on non-zero exit / timeout.
 */
async function run(argString) {
  const args = parseArgs(argString);
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

/** Standard MCP error result. */
function errorResult(content, code = "EXECUTION_ERROR") {
  return {
    content: [{ type: "text", text: content }],
    isError: true,
  };
}

/** Run CLI, return MCP result. */
async function runTool(argString) {
  const { stdout, stderr, error } = await run(argString);
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
  const { running, version } = await checkObsidianRunning();
  if (!running) {
    console.error("Error: Obsidian is not running. Please open Obsidian and try again.");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  console.error(`obsidian-mcp server running on stdio (Obsidian ${version})`);
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

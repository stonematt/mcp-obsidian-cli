/**
 * Pure helper functions extracted from server.js for testability.
 */

import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { load as yamlLoad } from "js-yaml";

/**
 * Load config from YAML file with env var overrides.
 * @param {string} configFile - Path to the YAML config file.
 * @returns {{ vault: string, cliPath: string, timeoutMs: number }}
 */
export function loadConfig(configFile) {
  const defaults = { vault: "", cliPath: "obsidian-cli", timeoutMs: 15000 };
  let config = { ...defaults };

  if (existsSync(configFile)) {
    try {
      const content = readFileSync(configFile, "utf8");
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

/**
 * Minimal arg parser: splits on whitespace but respects key="value with spaces".
 */
export function parseArgs(str) {
  const args = [];
  const re = /(?:[^\s"]+|"[^"]*")+/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    args.push(m[0].replace(/"([^"]*)"/g, "$1"));
  }
  return args;
}

/**
 * Build CLI argv with vault= prepended when configured. Caller-supplied
 * `vault=` (must be first token) wins — the configured vault is skipped so
 * per-call overrides through the generic `obsidian` tool remain reachable.
 */
export function buildCliArgs(input, vault) {
  const args = Array.isArray(input) ? [...input] : parseArgs(input);
  if (vault && !args[0]?.startsWith("vault=")) {
    args.unshift(`vault=${vault}`);
  }
  return args;
}

/**
 * Load the set of vault names Obsidian knows about by parsing the desktop
 * app's registry file. Returns an empty Set if the file is missing or
 * unreadable (non-macOS, fresh install, etc.) — callers should treat that
 * case as "no validation possible, trust the configured vault".
 *
 * @param {string} obsidianJsonPath - Path to Obsidian's vaults registry.
 * @returns {Set<string>} basenames of known vault paths.
 */
export function loadKnownVaults(obsidianJsonPath) {
  if (!existsSync(obsidianJsonPath)) return new Set();
  try {
    const content = readFileSync(obsidianJsonPath, "utf8");
    const data = JSON.parse(content);
    const vaults = data?.vaults || {};
    const names = new Set();
    for (const v of Object.values(vaults)) {
      if (v?.path) names.add(basename(v.path));
    }
    return names;
  } catch {
    return new Set();
  }
}

/**
 * If the first token of args is `vault=NAME`, return NAME. Otherwise null.
 * Mirrors the CLI's requirement that `vault=` be the first positional token
 * when overriding the focused vault.
 *
 * @param {string[]} args - Parsed CLI args.
 * @returns {string|null}
 */
export function extractLeadingVault(args) {
  const first = args[0];
  if (typeof first === "string" && first.startsWith("vault=")) {
    return first.slice("vault=".length);
  }
  return null;
}

/** ENOENT error string for a missing CLI binary. */
export function cliNotFoundMessage(cli) {
  return `Obsidian CLI not found at: ${cli}. Set OBSIDIAN_CLI_PATH or ensure '${cli}' is on PATH.`;
}

/** Standard MCP text result. */
export function text(content) {
  return { content: [{ type: "text", text: content }] };
}

/**
 * Structured MCP result for JSON-emitting verbs (see #29). Parses `stdout`;
 * on success returns the raw JSON as a text block PLUS `structuredContent`
 * so structured-aware clients get a typed object. MCP requires
 * `structuredContent` to be an object, so top-level arrays and primitives are
 * wrapped under an `items` key; JSON objects pass through unchanged. On parse
 * failure it degrades to a plain text result — never an error.
 *
 * @param {string} stdout - Raw CLI stdout, expected to be JSON.
 * @returns {{content: Array<object>, structuredContent?: object}}
 */
export function jsonResult(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return text(stdout || "(no output)");
  }
  const structuredContent =
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : { items: parsed };
  return {
    content: [{ type: "text", text: stdout }],
    structuredContent,
  };
}

/** Standard MCP error result. */
export function errorResult(content, code = "EXECUTION_ERROR") {
  return {
    content: [{ type: "text", text: content }],
    isError: true,
  };
}

/**
 * Read the `version` field from a package.json file.
 *
 * @param {string} pkgJsonPath - Path to package.json.
 * @returns {string}
 */
export function loadVersion(pkgJsonPath) {
  return JSON.parse(readFileSync(pkgJsonPath, "utf8")).version;
}

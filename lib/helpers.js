/**
 * Pure helper functions extracted from server.js for testability.
 */

import { readFileSync, existsSync } from "node:fs";
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

/** Standard MCP text result. */
export function text(content) {
  return { content: [{ type: "text", text: content }] };
}

/** Standard MCP error result. */
export function errorResult(content, code = "EXECUTION_ERROR") {
  return {
    content: [{ type: "text", text: content }],
    isError: true,
  };
}

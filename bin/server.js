#!/usr/bin/env node
/**
 * obsidian-mcp entrypoint.
 *
 * This is the only file that performs side effects at module load:
 * config + version + prompts are read here, the CLI path is probed, the
 * adapter is built, and the stdio transport is connected. Importing
 * `../server.js` directly produces no I/O — see `test/server.test.js`.
 *
 * Environment variables:
 *   OBSIDIAN_CLI_PATH    - Path to the obsidian CLI binary (default: "obsidian-cli")
 *   OBSIDIAN_VAULT       - Vault name to use (default: "")
 *   OBSIDIAN_TIMEOUT_MS  - Command timeout in ms (default: 15000)
 *
 * Requirements:
 *   - Obsidian must be running with the CLI plugin active.
 *   - The CLI binary is auto-discovered from common macOS locations.
 *     Set OBSIDIAN_CLI_PATH to override.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadConfig,
  loadKnownVaults,
  loadVersion,
} from "../lib/helpers.js";
import {
  createObsidianCli,
  createObsidianRunningChecker,
  resolveCliPath,
} from "../lib/obsidian-cli.js";
import { createVerbManifest } from "../lib/manifest.js";
import { createServer } from "../server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PROMPTS_DIR = join(REPO_ROOT, "prompts");
const PKG_JSON = join(REPO_ROOT, "package.json");

const configBase = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
const CONFIG_FILE = join(configBase, "mcp-obsidian-cli", "config.yaml");
const OBSIDIAN_REGISTRY = join(
  homedir(),
  "Library/Application Support/obsidian/obsidian.json",
);

const PROMPT_FILES = [
  "obsidian-cli",
  "obsidian-markdown",
  "obsidian-bases",
  "obsidian-canvas",
];

async function main() {
  const config = loadConfig(CONFIG_FILE);
  const version = loadVersion(PKG_JSON);
  const knownVaults = loadKnownVaults(OBSIDIAN_REGISTRY);

  const prompts = Object.fromEntries(
    PROMPT_FILES.map((slug) => [
      slug,
      readFileSync(join(PROMPTS_DIR, `${slug}.md`), "utf8"),
    ]),
  );

  const cliPath = await resolveCliPath(config.cliPath);

  // Runtime vault selection. Held in process memory only — not persisted.
  // Initialized from config when that value names a known vault; otherwise
  // null, which triggers the prompt-on-first-use flow inside createServer.
  let runtimeVault = null;
  if (config.vault) {
    if (knownVaults.size === 0 || knownVaults.has(config.vault)) {
      runtimeVault = config.vault;
    } else {
      console.error(
        `Warning: configured OBSIDIAN_VAULT='${config.vault}' is not in Obsidian's known vaults ` +
          `(${[...knownVaults].join(", ") || "<none detected>"}). ` +
          `Server will ask which vault to use on first tool call.`,
      );
    }
  }

  const isObsidianRunning = createObsidianRunningChecker();
  const cli = createObsidianCli({
    cliPath,
    vault: runtimeVault || "",
    timeoutMs: config.timeoutMs,
  });
  cli.isObsidianRunning = isObsidianRunning;

  // VerbManifest lazily fetches and caches `obsidian help`. The pass-through
  // `obsidian` tool gates calls through it for drift detection (e.g.
  // `dest=` -> `to=`) and refreshes it after restart/reload-class verbs.
  const manifest = createVerbManifest({ cli });

  const server = createServer({
    cli,
    prompts,
    manifest,
    version,
    knownVaults,
    runtimeVault,
  });

  // Preserve current behavior: warn but do not exit when Obsidian is not
  // detected. The server stays up; tool calls return OBSIDIAN_NOT_RUNNING
  // until the user opens Obsidian. (`test/run.test.js` asserts exit 0.)
  const running = await isObsidianRunning();
  if (!running) {
    console.error(
      "Warning: Obsidian.app not detected. Server will accept connections; tool calls will fail until Obsidian is running (it can stay backgrounded/minimized — no need to switch to it).",
    );
  }

  console.error("obsidian-mcp server running on stdio");
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

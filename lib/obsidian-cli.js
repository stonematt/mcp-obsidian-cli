/**
 * ObsidianCli — dumb-pipe adapter around the `obsidian-cli` subprocess.
 *
 * One method: `exec(args)`. Owns vault injection, timeout, ENOENT mapping,
 * and CLI-path resolution. Result shape: `{ stdout, stderr, error | null }`
 * where `error` is `{ type, message }` with `type ∈ {CLI_NOT_FOUND, TIMEOUT,
 * EXECUTION_ERROR}`. Tests inject a fake `execFile` via the constructor.
 */

import { execFile as nodeExecFile } from "node:child_process";
import { existsSync as nodeExistsSync } from "node:fs";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildCliArgs, cliNotFoundMessage } from "./helpers.js";

const defaultExecFile = promisify(nodeExecFile);

export const KNOWN_CLI_PATHS = [
  "/Applications/Obsidian.app/Contents/MacOS/obsidian-cli",
  join(homedir(), "Applications/Obsidian.app/Contents/MacOS/obsidian-cli"),
];

export const OBSIDIAN_PROCESS_PATTERN =
  "/Applications/Obsidian.app/Contents/MacOS/Obsidian$";

const DEFAULT_RUNNING_CACHE_TTL_MS = 5000;

/**
 * Resolve the configured CLI path. If the configured value is the default
 * sentinel `"obsidian-cli"`, probe PATH via `which`, then check well-known
 * macOS install locations, then probe a running Obsidian process. Falls
 * back to the configured value if nothing is found.
 *
 * @param {string} configured - The configured CLI path.
 * @param {{execFile?: Function, existsSync?: Function}} deps - Injectable deps for tests.
 * @returns {Promise<string>}
 */
export async function resolveCliPath(configured, deps = {}) {
  const execFile = deps.execFile || defaultExecFile;
  const existsSync = deps.existsSync || nodeExistsSync;

  if (configured !== "obsidian-cli") return configured;

  try {
    const { stdout } = await execFile("which", ["obsidian-cli"], { timeout: 2000 });
    const resolved = stdout.trim();
    if (resolved) return resolved;
  } catch { /* not on PATH */ }

  for (const p of KNOWN_CLI_PATHS) {
    if (existsSync(p)) return p;
  }

  try {
    const { stdout } = await execFile(
      "pgrep",
      ["-lf", "/Applications/Obsidian.app/Contents/MacOS/Obsidian$"],
      { timeout: 2000 }
    );
    const match = stdout.match(/(\S*\/Contents\/MacOS\/)Obsidian/i);
    if (match) {
      const cliPath = `${match[1]}obsidian-cli`;
      if (existsSync(cliPath)) return cliPath;
    }
  } catch { /* no running process */ }

  return configured;
}

/**
 * Build a closure-scoped checker that asks `pgrep` whether Obsidian.app is
 * running. Results are cached for `ttlMs` to avoid hammering pgrep on every
 * tool call.
 *
 * @param {{execFile?: Function, ttlMs?: number}} deps
 * @returns {() => Promise<boolean>}
 */
export function createObsidianRunningChecker(deps = {}) {
  const execFile = deps.execFile || defaultExecFile;
  const ttlMs = deps.ttlMs ?? DEFAULT_RUNNING_CACHE_TTL_MS;
  let cache = { value: null, at: 0 };

  return async function isObsidianRunning() {
    const now = Date.now();
    if (cache.value !== null && now - cache.at < ttlMs) {
      return cache.value;
    }
    let running = false;
    try {
      await execFile("pgrep", ["-f", OBSIDIAN_PROCESS_PATTERN], { timeout: 2000 });
      running = true;
    } catch {
      running = false;
    }
    cache = { value: running, at: now };
    return running;
  };
}

/**
 * Create an ObsidianCli adapter. The returned object holds the CLI path,
 * timeout, and a mutable runtime vault (`setVault`/`getVault`); the vault
 * is automatically injected as the first arg unless the caller already
 * supplied `vault=...` as the leading token.
 *
 * @param {object} opts
 * @param {string} opts.cliPath
 * @param {string} [opts.vault]
 * @param {number} [opts.timeoutMs]
 * @param {Function} [opts.execFile] - Promisified execFile-like; injectable for tests.
 * @returns {{ exec: (input: string | string[]) => Promise<{stdout: string, stderr: string, error: null | {type: string, message: string}}>, setVault: (v: string) => void, getVault: () => string }}
 */
export function createObsidianCli({
  cliPath,
  vault = "",
  timeoutMs = 15000,
  execFile = defaultExecFile,
} = {}) {
  let currentVault = vault;

  return {
    getVault() {
      return currentVault;
    },
    setVault(v) {
      currentVault = v;
    },
    async exec(input) {
      const args = buildCliArgs(input, currentVault);
      try {
        const { stdout, stderr } = await execFile(cliPath, args, {
          timeout: timeoutMs,
          maxBuffer: 4 * 1024 * 1024,
          env: { ...process.env },
        });
        return {
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
          error: null,
        };
      } catch (err) {
        if (err.code === "ENOENT") {
          return {
            stdout: "",
            stderr: "",
            error: {
              type: "CLI_NOT_FOUND",
              message: cliNotFoundMessage(cliPath),
            },
          };
        }
        if (err.killed) {
          return {
            stdout: "",
            stderr: "",
            error: {
              type: "TIMEOUT",
              message: `Command timed out after ${timeoutMs}ms. Set OBSIDIAN_TIMEOUT_MS to increase timeout.`,
            },
          };
        }
        const msg = err.stderr?.trimEnd() || err.message;
        return {
          stdout: "",
          stderr: "",
          error: { type: "EXECUTION_ERROR", message: msg },
        };
      }
    },
  };
}

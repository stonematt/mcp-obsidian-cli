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

/**
 * Well-known CLI install locations, in probe order. macOS paths come first
 * on every platform (tests index `KNOWN_CLI_PATHS[0]`); Windows locations
 * are appended when running on win32. Obsidian ships the Windows CLI as
 * `Obsidian.com` next to `Obsidian.exe`.
 *
 * @param {string} [platform] - `process.platform` or a test override.
 * @param {Record<string, string|undefined>} [env] - `process.env` or a test override.
 * @returns {string[]}
 */
export function getKnownCliPaths(platform = process.platform, env = process.env) {
  const paths = [
    "/Applications/Obsidian.app/Contents/MacOS/obsidian-cli",
    join(homedir(), "Applications/Obsidian.app/Contents/MacOS/obsidian-cli"),
  ];
  if (platform === "win32") {
    const programFiles = env.ProgramFiles || "C:\\Program Files";
    paths.push(join(programFiles, "Obsidian", "Obsidian.com"));
    if (env.LOCALAPPDATA) {
      paths.push(join(env.LOCALAPPDATA, "Programs", "Obsidian", "Obsidian.com"));
    }
  }
  return paths;
}

export const KNOWN_CLI_PATHS = getKnownCliPaths();

export const OBSIDIAN_PROCESS_PATTERN =
  "/Applications/Obsidian.app/Contents/MacOS/Obsidian$";

/** Windows image name probed via `tasklist`. */
export const OBSIDIAN_WINDOWS_IMAGE = "Obsidian.exe";

/** Env var that disables the running-process pre-check entirely. */
export const SKIP_PROCESS_CHECK_ENV = "OBSIDIAN_SKIP_PROCESS_CHECK";

const DEFAULT_RUNNING_CACHE_TTL_MS = 5000;

/**
 * Interpret an env flag as boolean: `1`, `true`, `yes`, `on` (case-insensitive).
 * @param {string|undefined} value
 * @returns {boolean}
 */
function isTruthyEnv(value) {
  if (value == null) return false;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

/**
 * Resolve the configured CLI path. If the configured value is the default
 * sentinel `"obsidian-cli"`, probe PATH via `which`, then check well-known
 * macOS install locations, then probe a running Obsidian process. Falls
 * back to the configured value if nothing is found.
 *
 * @param {string} configured - The configured CLI path.
 * @param {{execFile?: Function, existsSync?: Function, platform?: string, env?: object}} deps - Injectable deps for tests.
 * @returns {Promise<string>}
 */
export async function resolveCliPath(configured, deps = {}) {
  const execFile = deps.execFile || defaultExecFile;
  const existsSync = deps.existsSync || nodeExistsSync;
  const knownPaths =
    deps.platform || deps.env
      ? getKnownCliPaths(deps.platform ?? process.platform, deps.env ?? process.env)
      : KNOWN_CLI_PATHS;

  if (configured !== "obsidian-cli") return configured;

  try {
    const { stdout } = await execFile("which", ["obsidian-cli"], { timeout: 2000 });
    const resolved = stdout.trim();
    if (resolved) return resolved;
  } catch { /* not on PATH */ }

  for (const p of knownPaths) {
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
 * Build a closure-scoped checker that reports whether Obsidian is running.
 * Results are cached for `ttlMs` to avoid hammering the process table on
 * every tool call.
 *
 * Platform strategy:
 *   - win32: `tasklist /FI "IMAGENAME eq Obsidian.exe" /FO CSV /NH`. tasklist
 *     exits 0 whether or not anything matched and its "no tasks" message is
 *     localized (e.g. Turkish "BİLGİ: ..."), so neither the exit code nor the
 *     message text is trusted — only a case-insensitive `obsidian.exe` in
 *     stdout counts as a hit.
 *   - everything else: `pgrep -f <macOS bundle path>`; non-zero exit means
 *     not running.
 *
 * Setting `OBSIDIAN_SKIP_PROCESS_CHECK=1` (also `true`/`yes`/`on`) bypasses
 * the probe and the checker always reports `true`.
 *
 * @param {{execFile?: Function, ttlMs?: number, platform?: string, env?: object}} deps
 * @returns {() => Promise<boolean>}
 */
export function createObsidianRunningChecker(deps = {}) {
  const execFile = deps.execFile || defaultExecFile;
  const ttlMs = deps.ttlMs ?? DEFAULT_RUNNING_CACHE_TTL_MS;
  const platform = deps.platform ?? process.platform;
  const env = deps.env ?? process.env;
  let cache = { value: null, at: 0 };

  async function probe() {
    if (platform === "win32") {
      try {
        const { stdout } = await execFile(
          "tasklist",
          ["/FI", `IMAGENAME eq ${OBSIDIAN_WINDOWS_IMAGE}`, "/FO", "CSV", "/NH"],
          { timeout: 2000 },
        );
        return /obsidian\.exe/i.test(String(stdout ?? ""));
      } catch {
        return false;
      }
    }
    try {
      await execFile("pgrep", ["-f", OBSIDIAN_PROCESS_PATTERN], { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  return async function isObsidianRunning() {
    if (isTruthyEnv(env[SKIP_PROCESS_CHECK_ENV])) return true;

    const now = Date.now();
    if (cache.value !== null && now - cache.at < ttlMs) {
      return cache.value;
    }
    const running = await probe();
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

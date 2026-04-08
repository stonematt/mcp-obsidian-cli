import { spawn, execSync } from "node:child_process";
import { test, describe } from "node:test";

/**
 * Auto-detect whether Obsidian is running using the same ps aux check
 * the server uses, so tests don't need a manual env var.
 */
function isObsidianRunning() {
  try {
    const out = execSync(
      "ps aux | grep -i obsidian | grep -v grep | grep -v Helper",
      { timeout: 2000, encoding: "utf8" }
    );
    return out.includes("/Applications/Obsidian.app");
  } catch {
    return false;
  }
}

const obsidianRunning = isObsidianRunning();

describe("health check", () => {
  test("exits 1 if Obsidian not running", { skip: obsidianRunning && "Obsidian is running" }, async () => {
    const serverPath = new URL("../server.js", import.meta.url).pathname;
    const proc = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });

    let stderr = "";
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    const exitCode = await new Promise((resolve) => {
      proc.on("close", (code) => {
        setTimeout(() => resolve(code), 50);
      });
      proc.on("error", () => resolve(1));
      setTimeout(() => resolve(1), 5000);
    });

    if (exitCode !== 1) {
      throw new Error(`Expected exit code 1, got ${exitCode}`);
    }
    if (!stderr.includes("Obsidian is not running")) {
      throw new Error(`Expected "Obsidian is not running" in stderr, got: ${stderr}`);
    }
  });

  test("succeeds if Obsidian running", { skip: !obsidianRunning && "Obsidian is not running" }, async () => {
    const serverPath = new URL("../server.js", import.meta.url).pathname;
    const proc = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });

    let stderr = "";
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    // Wait for the server to emit its startup message, then close stdin
    // so the MCP transport shuts down and the process exits cleanly.
    await new Promise((resolve) => {
      proc.stderr.on("data", () => {
        setTimeout(() => {
          proc.stdin.end();
          resolve();
        }, 100);
      });
      setTimeout(resolve, 3000);
    });

    const exitCode = await new Promise((resolve) => {
      proc.on("close", (code) => {
        setTimeout(() => resolve(code), 50);
      });
      proc.on("error", () => resolve(1));
      setTimeout(() => resolve(1), 5000);
    });

    if (exitCode !== 0) {
      throw new Error(`Expected exit code 0, got ${exitCode}`);
    }
    if (!stderr.includes("obsidian-mcp server running")) {
      throw new Error(`Expected "obsidian-mcp server running" in stderr, got: ${stderr}`);
    }
  });
});

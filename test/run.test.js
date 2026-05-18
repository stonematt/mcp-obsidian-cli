import { spawn, execFileSync } from "node:child_process";
import { test, describe } from "node:test";

function isObsidianRunning() {
  try {
    execFileSync("pgrep", ["-f", "/Applications/Obsidian.app/Contents/MacOS/Obsidian$"], {
      timeout: 2000,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

const obsidianRunning = isObsidianRunning();

async function runServerOnce() {
  const serverPath = new URL("../bin/server.js", import.meta.url).pathname;
  const proc = spawn("node", [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 10000,
  });

  let stderr = "";
  proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

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
    proc.on("close", (code) => setTimeout(() => resolve(code), 50));
    proc.on("error", () => resolve(1));
    setTimeout(() => resolve(1), 5000);
  });

  return { exitCode, stderr };
}

describe("startup", () => {
  test("connects and exits cleanly regardless of Obsidian state", async () => {
    const { exitCode, stderr } = await runServerOnce();
    if (exitCode !== 0) {
      throw new Error(`Expected exit code 0, got ${exitCode}. stderr: ${stderr}`);
    }
    if (!stderr.includes("obsidian-mcp server running")) {
      throw new Error(`Expected "obsidian-mcp server running" in stderr, got: ${stderr}`);
    }
  });

  test("warns on stderr when Obsidian is not running", { skip: obsidianRunning && "Obsidian is running" }, async () => {
    const { stderr } = await runServerOnce();
    if (!stderr.includes("Obsidian.app not detected")) {
      throw new Error(`Expected "Obsidian.app not detected" warning in stderr, got: ${stderr}`);
    }
  });

  test("no warning when Obsidian is running", { skip: !obsidianRunning && "Obsidian is not running" }, async () => {
    const { stderr } = await runServerOnce();
    if (stderr.includes("Obsidian.app not detected")) {
      throw new Error(`Unexpected "not detected" warning when Obsidian is running. stderr: ${stderr}`);
    }
  });
});

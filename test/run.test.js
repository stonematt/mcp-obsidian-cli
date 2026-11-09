import { spawn, execFileSync } from "node:child_process";
import { test, describe } from "node:test";
import { fileURLToPath } from "node:url";

// Mirrors lib/obsidian-cli.js createObsidianRunningChecker so the skip
// conditions below agree with what the server under test will report.
function isObsidianRunning() {
  try {
    if (process.platform === "win32") {
      const out = execFileSync(
        "tasklist",
        ["/FI", "IMAGENAME eq Obsidian.exe", "/FO", "CSV", "/NH"],
        { timeout: 2000, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      // tasklist exits 0 even with no match; only trust stdout content.
      return /obsidian\.exe/i.test(out);
    }
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
  // fileURLToPath (not URL#pathname) so Windows drive letters resolve correctly.
  const serverPath = fileURLToPath(new URL("../bin/server.js", import.meta.url));
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

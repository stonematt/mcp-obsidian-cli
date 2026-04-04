import { spawn } from "node:child_process";
import { test, describe } from "node:test";

describe("health check", () => {
  test("exits 1 if Obsidian not running", async () => {
    if (process.env.OBSIDIAN_RUNNING === "1") {
      return;
    }

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

  test("succeeds if Obsidian running", async () => {
    if (process.env.OBSIDIAN_RUNNING !== "1") {
      return;
    }

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

    if (exitCode !== 0) {
      throw new Error(`Expected exit code 0, got ${exitCode}`);
    }
    if (!stderr.includes("(Obsidian")) {
      throw new Error(`Expected "(Obsidian" version in stderr, got: ${stderr}`);
    }
  });
});

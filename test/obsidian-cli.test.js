import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createObsidianCli,
  resolveCliPath,
  KNOWN_CLI_PATHS,
  getKnownCliPaths,
  createObsidianRunningChecker,
} from "../lib/obsidian-cli.js";
import { cliNotFoundMessage } from "../lib/helpers.js";

// ---------------------------------------------------------------------------
// createObsidianCli — vault injection, error mapping, success path
// ---------------------------------------------------------------------------

/**
 * Build a fake execFile that captures call args and returns a configurable result.
 * Mirrors the shape of util.promisify(execFile) — returns a Promise<{stdout, stderr}>
 * or throws an Error with optional `code`, `killed`, `stderr` shapes.
 */
function fakeExecFile({ stdout = "", stderr = "", error = null } = {}) {
  const calls = [];
  const fn = async (cli, args, _opts) => {
    calls.push({ cli, args });
    if (error) throw error;
    return { stdout, stderr };
  };
  fn.calls = calls;
  return fn;
}

describe("createObsidianCli", () => {
  it("injects vault= as first arg when vault is set", async () => {
    const execFile = fakeExecFile({ stdout: "ok" });
    const cli = createObsidianCli({
      cliPath: "/bin/obsidian-cli",
      vault: "v",
      timeoutMs: 15000,
      execFile,
    });
    await cli.exec("read file=foo");
    assert.deepEqual(execFile.calls[0].args, ["vault=v", "read", "file=foo"]);
  });

  it("omits vault= when vault is empty", async () => {
    const execFile = fakeExecFile({ stdout: "ok" });
    const cli = createObsidianCli({
      cliPath: "/bin/obsidian-cli",
      vault: "",
      timeoutMs: 15000,
      execFile,
    });
    await cli.exec("read");
    assert.deepEqual(execFile.calls[0].args, ["read"]);
  });

  it("does not double-prepend when caller supplied vault= already", async () => {
    const execFile = fakeExecFile({ stdout: "ok" });
    const cli = createObsidianCli({
      cliPath: "/bin/obsidian-cli",
      vault: "v",
      timeoutMs: 15000,
      execFile,
    });
    await cli.exec("vault=other read");
    assert.deepEqual(execFile.calls[0].args, ["vault=other", "read"]);
  });

  it("accepts an array input", async () => {
    const execFile = fakeExecFile({ stdout: "ok" });
    const cli = createObsidianCli({
      cliPath: "/bin/obsidian-cli",
      vault: "v",
      timeoutMs: 15000,
      execFile,
    });
    await cli.exec(["read", "file=foo"]);
    assert.deepEqual(execFile.calls[0].args, ["vault=v", "read", "file=foo"]);
  });

  it("maps ENOENT to CLI_NOT_FOUND", async () => {
    const err = new Error("spawn ENOENT");
    err.code = "ENOENT";
    const execFile = fakeExecFile({ error: err });
    const cli = createObsidianCli({
      cliPath: "/missing/obsidian-cli",
      vault: "",
      timeoutMs: 15000,
      execFile,
    });
    const res = await cli.exec("read");
    assert.equal(res.error.type, "CLI_NOT_FOUND");
    assert.equal(res.error.message, cliNotFoundMessage("/missing/obsidian-cli"));
    assert.equal(res.stdout, "");
    assert.equal(res.stderr, "");
  });

  it("maps killed to TIMEOUT and references timeoutMs", async () => {
    const err = new Error("killed");
    err.killed = true;
    const execFile = fakeExecFile({ error: err });
    const cli = createObsidianCli({
      cliPath: "/bin/obsidian-cli",
      vault: "",
      timeoutMs: 7777,
      execFile,
    });
    const res = await cli.exec("read");
    assert.equal(res.error.type, "TIMEOUT");
    assert.match(res.error.message, /7777ms/);
    assert.match(res.error.message, /OBSIDIAN_TIMEOUT_MS/);
  });

  it("maps other errors to EXECUTION_ERROR with trimEnd'd stderr", async () => {
    const err = new Error("boom");
    err.stderr = "bad thing happened  \n";
    const execFile = fakeExecFile({ error: err });
    const cli = createObsidianCli({
      cliPath: "/bin/obsidian-cli",
      vault: "",
      timeoutMs: 15000,
      execFile,
    });
    const res = await cli.exec("read");
    assert.equal(res.error.type, "EXECUTION_ERROR");
    assert.equal(res.error.message, "bad thing happened");
  });

  it("falls back to err.message when no stderr is present", async () => {
    const err = new Error("plain message");
    const execFile = fakeExecFile({ error: err });
    const cli = createObsidianCli({
      cliPath: "/bin/obsidian-cli",
      vault: "",
      timeoutMs: 15000,
      execFile,
    });
    const res = await cli.exec("read");
    assert.equal(res.error.type, "EXECUTION_ERROR");
    assert.equal(res.error.message, "plain message");
  });

  it("returns trimmed stdout/stderr and error=null on success", async () => {
    const execFile = fakeExecFile({ stdout: "hello\n\n", stderr: "warn\n" });
    const cli = createObsidianCli({
      cliPath: "/bin/obsidian-cli",
      vault: "",
      timeoutMs: 15000,
      execFile,
    });
    const res = await cli.exec("read");
    assert.equal(res.stdout, "hello");
    assert.equal(res.stderr, "warn");
    assert.equal(res.error, null);
  });

  it("setVault and getVault round-trip", async () => {
    const execFile = fakeExecFile({ stdout: "ok" });
    const cli = createObsidianCli({
      cliPath: "/bin/obsidian-cli",
      vault: "v1",
      timeoutMs: 15000,
      execFile,
    });
    assert.equal(cli.getVault(), "v1");
    cli.setVault("v2");
    assert.equal(cli.getVault(), "v2");
    await cli.exec("read");
    assert.deepEqual(execFile.calls[0].args, ["vault=v2", "read"]);
  });
});

// ---------------------------------------------------------------------------
// resolveCliPath — dependency injection of execFile + existsSync
// ---------------------------------------------------------------------------

describe("resolveCliPath", () => {
  it("returns configured path verbatim when not the default sentinel", async () => {
    const execFile = fakeExecFile({ stdout: "" });
    const existsSync = () => false;
    const resolved = await resolveCliPath("/custom/path", { execFile, existsSync });
    assert.equal(resolved, "/custom/path");
    assert.equal(execFile.calls.length, 0);
  });

  it("uses `which obsidian-cli` when default sentinel and PATH lookup succeeds", async () => {
    const execFile = fakeExecFile({ stdout: "/usr/local/bin/obsidian-cli\n" });
    const existsSync = () => false;
    const resolved = await resolveCliPath("obsidian-cli", { execFile, existsSync });
    assert.equal(resolved, "/usr/local/bin/obsidian-cli");
  });

  it("falls back to KNOWN_CLI_PATHS when `which` fails", async () => {
    const callLog = [];
    const execFile = async (cmd) => {
      callLog.push(cmd);
      throw new Error("not found");
    };
    const existsSync = (p) => p === KNOWN_CLI_PATHS[0];
    const resolved = await resolveCliPath("obsidian-cli", { execFile, existsSync });
    assert.equal(resolved, KNOWN_CLI_PATHS[0]);
  });

  it("returns configured value when nothing resolves", async () => {
    const execFile = async () => { throw new Error("nope"); };
    const existsSync = () => false;
    const resolved = await resolveCliPath("obsidian-cli", { execFile, existsSync });
    assert.equal(resolved, "obsidian-cli");
  });
});

// ---------------------------------------------------------------------------
// createObsidianRunningChecker — closure-scoped TTL cache
// ---------------------------------------------------------------------------

describe("createObsidianRunningChecker", () => {
  // Pin the platform so these pgrep-path assertions hold when the suite
  // itself runs on Windows.
  const darwin = { platform: "darwin", env: {} };

  it("returns true when pgrep succeeds", async () => {
    const execFile = fakeExecFile({ stdout: "12345\n" });
    const check = createObsidianRunningChecker({ execFile, ttlMs: 0, ...darwin });
    assert.equal(await check(), true);
    assert.equal(execFile.calls[0].cli, "pgrep");
  });

  it("returns false when pgrep throws", async () => {
    const execFile = async () => { throw new Error("no proc"); };
    const check = createObsidianRunningChecker({ execFile, ttlMs: 0, ...darwin });
    assert.equal(await check(), false);
  });

  it("caches result within TTL window", async () => {
    let calls = 0;
    const execFile = async () => {
      calls += 1;
      return { stdout: "1\n", stderr: "" };
    };
    const check = createObsidianRunningChecker({ execFile, ttlMs: 10_000, ...darwin });
    assert.equal(await check(), true);
    assert.equal(await check(), true);
    assert.equal(calls, 1);
  });

  it("re-fetches after TTL expires", async () => {
    let calls = 0;
    const execFile = async () => {
      calls += 1;
      return { stdout: "1\n", stderr: "" };
    };
    // ttlMs=0 means cache always expired.
    const check = createObsidianRunningChecker({ execFile, ttlMs: 0, ...darwin });
    await check();
    await check();
    assert.equal(calls, 2);
  });

  // -------------------------------------------------------------------------
  // win32 branch — tasklist probe (#104)
  // -------------------------------------------------------------------------

  describe("on win32", () => {
    const win32 = { platform: "win32", env: {} };

    it("invokes tasklist with an IMAGENAME filter in CSV/no-header mode", async () => {
      const execFile = fakeExecFile({ stdout: "" });
      const check = createObsidianRunningChecker({ execFile, ttlMs: 0, ...win32 });
      await check();
      assert.equal(execFile.calls.length, 1);
      assert.equal(execFile.calls[0].cli, "tasklist");
      assert.deepEqual(execFile.calls[0].args, [
        "/FI",
        "IMAGENAME eq Obsidian.exe",
        "/FO",
        "CSV",
        "/NH",
      ]);
    });

    it("returns true when tasklist lists Obsidian.exe", async () => {
      const execFile = fakeExecFile({
        stdout:
          '"Obsidian.exe","45040","Console","1","112.072 K"\r\n' +
          '"Obsidian.exe","35336","Console","1","127.396 K"\r\n',
      });
      const check = createObsidianRunningChecker({ execFile, ttlMs: 0, ...win32 });
      assert.equal(await check(), true);
    });

    it("matches the image name case-insensitively", async () => {
      const execFile = fakeExecFile({
        stdout: '"OBSIDIAN.EXE","1","Console","1","1 K"\r\n',
      });
      const check = createObsidianRunningChecker({ execFile, ttlMs: 0, ...win32 });
      assert.equal(await check(), true);
    });

    it("returns false on the English 'no tasks' message (exit 0, no match)", async () => {
      const execFile = fakeExecFile({
        stdout: "INFO: No tasks are running which match the specified criteria.\r\n",
      });
      const check = createObsidianRunningChecker({ execFile, ttlMs: 0, ...win32 });
      assert.equal(await check(), false);
    });

    it("returns false on the localized Turkish 'BİLGİ' message", async () => {
      const execFile = fakeExecFile({
        stdout: "BİLGİ: Belirtilen ölçütlerle eşleşen görev çalışmıyor.\r\n",
      });
      const check = createObsidianRunningChecker({ execFile, ttlMs: 0, ...win32 });
      assert.equal(await check(), false);
    });

    it("returns false when tasklist itself fails", async () => {
      const execFile = async () => {
        const err = new Error("spawn tasklist ENOENT");
        err.code = "ENOENT";
        throw err;
      };
      const check = createObsidianRunningChecker({ execFile, ttlMs: 0, ...win32 });
      assert.equal(await check(), false);
    });

    it("never calls pgrep", async () => {
      const execFile = fakeExecFile({ stdout: "" });
      const check = createObsidianRunningChecker({ execFile, ttlMs: 0, ...win32 });
      await check();
      assert.ok(execFile.calls.every((c) => c.cli !== "pgrep"));
    });
  });

  // -------------------------------------------------------------------------
  // OBSIDIAN_SKIP_PROCESS_CHECK — bypass flag
  // -------------------------------------------------------------------------

  describe("OBSIDIAN_SKIP_PROCESS_CHECK", () => {
    for (const value of ["1", "true", "TRUE", "yes", "on"]) {
      it(`returns true without probing when set to "${value}"`, async () => {
        const execFile = async () => { throw new Error("should not be called"); };
        const check = createObsidianRunningChecker({
          execFile,
          ttlMs: 0,
          platform: "win32",
          env: { OBSIDIAN_SKIP_PROCESS_CHECK: value },
        });
        assert.equal(await check(), true);
      });
    }

    for (const value of ["0", "false", "", "no"]) {
      it(`still probes when set to "${value}"`, async () => {
        const execFile = fakeExecFile({ stdout: "" });
        const check = createObsidianRunningChecker({
          execFile,
          ttlMs: 0,
          platform: "win32",
          env: { OBSIDIAN_SKIP_PROCESS_CHECK: value },
        });
        assert.equal(await check(), false);
        assert.equal(execFile.calls.length, 1);
      });
    }

    it("bypasses the probe on non-Windows platforms too", async () => {
      const execFile = async () => { throw new Error("no proc"); };
      const check = createObsidianRunningChecker({
        execFile,
        ttlMs: 0,
        platform: "darwin",
        env: { OBSIDIAN_SKIP_PROCESS_CHECK: "1" },
      });
      assert.equal(await check(), true);
    });
  });
});

// ---------------------------------------------------------------------------
// getKnownCliPaths — Windows install locations (#104, optional)
// ---------------------------------------------------------------------------

describe("getKnownCliPaths", () => {
  it("returns only macOS paths off Windows", () => {
    const paths = getKnownCliPaths("darwin", { LOCALAPPDATA: "C:\\Users\\x\\AppData\\Local" });
    assert.equal(paths.length, 2);
    assert.ok(paths.every((p) => p.includes("Obsidian.app")));
  });

  it("appends Program Files and LOCALAPPDATA Obsidian.com on win32", () => {
    const paths = getKnownCliPaths("win32", {
      ProgramFiles: "C:\\Program Files",
      LOCALAPPDATA: "C:\\Users\\x\\AppData\\Local",
    });
    assert.equal(paths[0], KNOWN_CLI_PATHS[0]);
    assert.ok(paths.some((p) => /Program Files[\\/]Obsidian[\\/]Obsidian\.com$/.test(p)));
    assert.ok(paths.some((p) => /AppData[\\/]Local[\\/]Programs[\\/]Obsidian[\\/]Obsidian\.com$/.test(p)));
  });

  it("falls back to C:\\Program Files when ProgramFiles is unset and skips LOCALAPPDATA when missing", () => {
    const paths = getKnownCliPaths("win32", {});
    assert.equal(paths.length, 3);
    assert.ok(/^C:[\\/]Program Files[\\/]Obsidian[\\/]Obsidian\.com$/.test(paths[2]));
  });

  it("resolveCliPath probes the Windows paths when platform is win32", async () => {
    const execFile = async () => { throw new Error("not found"); };
    const env = { ProgramFiles: "C:\\Program Files", LOCALAPPDATA: "C:\\Users\\x\\AppData\\Local" };
    const [, , programFilesPath] = getKnownCliPaths("win32", env);
    const existsSync = (p) => p === programFilesPath;
    const resolved = await resolveCliPath("obsidian-cli", {
      execFile,
      existsSync,
      platform: "win32",
      env,
    });
    assert.equal(resolved, programFilesPath);
  });
});

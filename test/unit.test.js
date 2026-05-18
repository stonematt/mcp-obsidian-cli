import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  parseArgs,
  loadConfig,
  text,
  errorResult,
  buildCliArgs,
  cliNotFoundMessage,
  loadVersion,
} from "../lib/helpers.js";

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe("parseArgs", () => {
  it("splits simple args on whitespace", () => {
    assert.deepStrictEqual(parseArgs("read file=foo.md"), ["read", "file=foo.md"]);
  });

  it("handles quoted values", () => {
    assert.deepStrictEqual(
      parseArgs('search query="hello world"'),
      ["search", "query=hello world"],
    );
  });

  it("handles multiple quoted args", () => {
    assert.deepStrictEqual(
      parseArgs('create name="My Note" path="folder/sub"'),
      ["create", "name=My Note", "path=folder/sub"],
    );
  });

  it("returns empty array for empty string", () => {
    assert.deepStrictEqual(parseArgs(""), []);
  });

  it("handles wikilinks in quoted values", () => {
    assert.deepStrictEqual(
      parseArgs('read file="[[My Note]]"'),
      ["read", "file=[[My Note]]"],
    );
  });

  it("handles multiple spaces between args", () => {
    assert.deepStrictEqual(
      parseArgs("tags   counts   sort=name"),
      ["tags", "counts", "sort=name"],
    );
  });
});

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

describe("loadConfig", () => {
  const savedEnv = {};
  const envKeys = ["OBSIDIAN_VAULT", "OBSIDIAN_CLI_PATH", "OBSIDIAN_TIMEOUT_MS"];

  function saveEnv() {
    for (const k of envKeys) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
  }
  function restoreEnv() {
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  }

  it("returns defaults when no config file and no env vars", () => {
    saveEnv();
    try {
      const cfg = loadConfig("/nonexistent/path/config.yaml");
      assert.equal(cfg.vault, "");
      assert.equal(cfg.cliPath, "obsidian-cli");
      assert.equal(cfg.timeoutMs, 15000);
    } finally {
      restoreEnv();
    }
  });

  it("env vars override defaults", () => {
    saveEnv();
    try {
      process.env.OBSIDIAN_VAULT = "test-vault";
      process.env.OBSIDIAN_CLI_PATH = "/usr/local/bin/obsidian";
      process.env.OBSIDIAN_TIMEOUT_MS = "30000";
      const cfg = loadConfig("/nonexistent/path/config.yaml");
      assert.equal(cfg.vault, "test-vault");
      assert.equal(cfg.cliPath, "/usr/local/bin/obsidian");
      assert.equal(cfg.timeoutMs, 30000);
    } finally {
      restoreEnv();
    }
  });

  it("loads values from YAML config file", () => {
    saveEnv();
    const tmp = join(tmpdir(), `mcp-test-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    const cfgPath = join(tmp, "config.yaml");
    writeFileSync(cfgPath, "vault: file-vault\ncliPath: /custom/obsidian\ntimeoutMs: 5000\n");
    try {
      const cfg = loadConfig(cfgPath);
      assert.equal(cfg.vault, "file-vault");
      assert.equal(cfg.cliPath, "/custom/obsidian");
      assert.equal(cfg.timeoutMs, 5000);
    } finally {
      restoreEnv();
      rmSync(tmp, { recursive: true });
    }
  });

  it("env vars override config file values", () => {
    saveEnv();
    const tmp = join(tmpdir(), `mcp-test-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    const cfgPath = join(tmp, "config.yaml");
    writeFileSync(cfgPath, "vault: file-vault\n");
    try {
      process.env.OBSIDIAN_VAULT = "env-vault";
      const cfg = loadConfig(cfgPath);
      assert.equal(cfg.vault, "env-vault");
    } finally {
      restoreEnv();
      rmSync(tmp, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// MCP response helpers
// ---------------------------------------------------------------------------

describe("text", () => {
  it("returns standard MCP text result", () => {
    const result = text("hello");
    assert.deepStrictEqual(result, {
      content: [{ type: "text", text: "hello" }],
    });
  });
});

describe("errorResult", () => {
  it("returns MCP error result with isError flag", () => {
    const result = errorResult("something broke");
    assert.deepStrictEqual(result, {
      content: [{ type: "text", text: "something broke" }],
      isError: true,
    });
  });
});

// ---------------------------------------------------------------------------
// buildCliArgs
// ---------------------------------------------------------------------------

describe("buildCliArgs", () => {
  it("prepends vault= when configured and absent", () => {
    assert.deepStrictEqual(
      buildCliArgs("read file=foo.md", "my-vault"),
      ["vault=my-vault", "read", "file=foo.md"],
    );
  });

  it("does not prepend when vault unset", () => {
    assert.deepStrictEqual(
      buildCliArgs("read file=foo.md", ""),
      ["read", "file=foo.md"],
    );
  });

  it("does not duplicate vault= when caller already supplied one", () => {
    assert.deepStrictEqual(
      buildCliArgs("vault=other read file=foo.md", "my-vault"),
      ["vault=other", "read", "file=foo.md"],
    );
  });

  it("accepts an array input", () => {
    assert.deepStrictEqual(
      buildCliArgs(["read", "file=foo.md"], "my-vault"),
      ["vault=my-vault", "read", "file=foo.md"],
    );
  });

  it("respects caller vault= in array input", () => {
    assert.deepStrictEqual(
      buildCliArgs(["vault=other", "read"], "my-vault"),
      ["vault=other", "read"],
    );
  });
});

// ---------------------------------------------------------------------------
// cliNotFoundMessage
// ---------------------------------------------------------------------------

describe("cliNotFoundMessage", () => {
  it("names the configured CLI binary in the error", () => {
    const msg = cliNotFoundMessage("obsidian-cli");
    assert.match(msg, /obsidian-cli/);
    assert.match(msg, /OBSIDIAN_CLI_PATH/);
  });

  it("does not reference the deprecated 'obsidian' binary", () => {
    const msg = cliNotFoundMessage("obsidian-cli");
    assert.doesNotMatch(msg, /ensure 'obsidian' is on PATH/);
  });
});

// ---------------------------------------------------------------------------
// loadVersion
// ---------------------------------------------------------------------------

describe("loadVersion", () => {
  it("reads the version field from a package.json", () => {
    const tmp = join(tmpdir(), `mcp-version-test-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    const pkg = join(tmp, "package.json");
    writeFileSync(pkg, JSON.stringify({ name: "x", version: "9.8.7" }));
    try {
      assert.equal(loadVersion(pkg), "9.8.7");
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });
});

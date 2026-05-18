import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const PROMPTS = {
  "obsidian-cli": "CLI doc body",
  "obsidian-markdown": "Markdown doc body",
  "obsidian-bases": "Bases doc body",
  "obsidian-canvas": "Canvas doc body",
};

/**
 * Build a fake `cli` adapter implementing the same surface as createObsidianCli's
 * return value. `exec` records every call and returns the configured result.
 */
function fakeCli({
  result = { stdout: "ok", stderr: "", error: null },
  isRunning = true,
  vault = "v1",
} = {}) {
  const calls = [];
  let currentVault = vault;
  return {
    calls,
    exec: async (input) => {
      calls.push(input);
      return result;
    },
    getVault: () => currentVault,
    setVault: (v) => { currentVault = v; },
    isObsidianRunning: async () => isRunning,
  };
}

async function withClient({ cli, knownVaults = new Set(["v1"]), runtimeVault = "v1" }, run) {
  const server = createServer({
    cli,
    prompts: PROMPTS,
    manifest: null,
    version: "9.9.9",
    knownVaults,
    runtimeVault,
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  try {
    return await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

// ---------------------------------------------------------------------------
// Tool surface
// ---------------------------------------------------------------------------

const EXPECTED_TOOL_NAMES = [
  "obsidian",
  "obsidian_daily_read",
  "obsidian_daily_path",
  "obsidian_daily_append",
  "obsidian_read",
  "obsidian_search",
  "obsidian_tags",
  "obsidian_tasks",
  "obsidian_properties",
  "obsidian_create",
  "obsidian_property_set",
  "obsidian_backlinks",
  "obsidian_files",
  "obsidian_recents",
  "obsidian_help",
];

describe("createServer", () => {
  it("registers the expected tool names", async () => {
    await withClient({ cli: fakeCli() }, async (client) => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name).sort();
      assert.deepEqual(names, [...EXPECTED_TOOL_NAMES].sort());
    });
  });

  it("registers the four MCP prompts", async () => {
    await withClient({ cli: fakeCli() }, async (client) => {
      const { prompts } = await client.listPrompts();
      const names = prompts.map((p) => p.name).sort();
      assert.deepEqual(names, [
        "obsidian-bases",
        "obsidian-canvas",
        "obsidian-cli",
        "obsidian-markdown",
      ]);
    });
  });

  it("daily_read forwards a single-string command to cli.exec", async () => {
    const cli = fakeCli({ result: { stdout: "today\n# Note", stderr: "", error: null } });
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({ name: "obsidian_daily_read", arguments: {} });
      assert.equal(cli.calls[0], "daily:read");
      assert.equal(res.content[0].text, "today\n# Note");
    });
  });

  it("daily_append forwards an args array with content=", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      await client.callTool({
        name: "obsidian_daily_append",
        arguments: { content: "a line" },
      });
      assert.deepEqual(cli.calls[0], ["daily:append", "content=a line"]);
    });
  });

  it("obsidian_read requires file= or path=", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({ name: "obsidian_read", arguments: {} });
      assert.match(res.content[0].text, /provide file= or path=/);
      assert.equal(cli.calls.length, 0);
    });
  });

  it("obsidian_read with file= forwards [read, file=Foo]", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      await client.callTool({
        name: "obsidian_read",
        arguments: { file: "Foo" },
      });
      assert.deepEqual(cli.calls[0], ["read", "file=Foo"]);
    });
  });

  it("obsidian_help with topic returns prompt content from injected prompts map", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_help",
        arguments: { topic: "markdown" },
      });
      assert.equal(res.content[0].text, "Markdown doc body");
      assert.equal(cli.calls.length, 0);
    });
  });

  // ---------------------------------------------------------------------------
  // Vault gating and overrides
  // ---------------------------------------------------------------------------

  it("returns VAULT_NOT_FOUND when caller supplies an unknown vault= prefix", async () => {
    const cli = fakeCli();
    await withClient(
      { cli, knownVaults: new Set(["v1", "v2"]), runtimeVault: "v1" },
      async (client) => {
        const res = await client.callTool({
          name: "obsidian",
          arguments: { command: "vault=bogus read" },
        });
        assert.equal(res.isError, true);
        assert.match(res.content[0].text, /Unknown vault 'bogus'/);
        assert.equal(cli.calls.length, 0);
      },
    );
  });

  it("caches caller-supplied vault override via cli.setVault", async () => {
    const cli = fakeCli();
    await withClient(
      { cli, knownVaults: new Set(["v1", "v2"]), runtimeVault: "v1" },
      async (client) => {
        await client.callTool({
          name: "obsidian",
          arguments: { command: "vault=v2 read" },
        });
        assert.equal(cli.getVault(), "v2");
      },
    );
  });

  it("prompts for vault selection when no runtime vault is set and knownVaults non-empty", async () => {
    const cli = fakeCli({ vault: "" });
    await withClient(
      { cli, knownVaults: new Set(["v1", "v2"]), runtimeVault: null },
      async (client) => {
        const res = await client.callTool({
          name: "obsidian_daily_read",
          arguments: {},
        });
        assert.match(res.content[0].text, /No vault selected/);
        assert.equal(cli.calls.length, 0);
      },
    );
  });

  it("returns OBSIDIAN_NOT_RUNNING when isObsidianRunning resolves false", async () => {
    const cli = fakeCli({ isRunning: false });
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_daily_read",
        arguments: {},
      });
      assert.equal(res.isError, true);
      assert.match(res.content[0].text, /Obsidian.app is not running/);
      assert.equal(cli.calls.length, 0);
    });
  });

  // ---------------------------------------------------------------------------
  // Error pass-through
  // ---------------------------------------------------------------------------

  it("propagates cli error result as isError text", async () => {
    const cli = fakeCli({
      result: {
        stdout: "",
        stderr: "",
        error: { type: "EXECUTION_ERROR", message: "kaboom" },
      },
    });
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_daily_read",
        arguments: {},
      });
      assert.equal(res.isError, true);
      assert.equal(res.content[0].text, "kaboom");
    });
  });

  // ---------------------------------------------------------------------------
  // Import side-effect contract
  // ---------------------------------------------------------------------------

  it("importing server.js produces no console output or process exit", async () => {
    // Spawn a sub-process that imports server.js and exits 0 if and only if
    // the import is side-effect-free (no console.error, no process.exit).
    const serverPath = join(REPO_ROOT, "server.js");
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import(${JSON.stringify(serverPath)}).then(m => { if (typeof m.createServer !== 'function') { console.error('missing createServer'); process.exit(2); } });`,
      ],
      { timeout: 10_000 },
    );
    assert.equal(stdout, "", `unexpected stdout: ${stdout}`);
    assert.equal(stderr, "", `unexpected stderr: ${stderr}`);
  });
});

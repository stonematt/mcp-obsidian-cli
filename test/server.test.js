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

/**
 * Build a fake VerbManifest. Tests can override per-method behavior to
 * exercise the obsidian_help handler without standing up the real parser.
 */
function fakeManifest({
  all = async () => ({
    Read: ["read"],
    Write: ["create"],
    Edit: [],
    Discover: [],
    Tasks: [],
    Daily: [],
    Properties: [],
    Plugins: [],
    Dev: [],
    Eval: [],
  }),
  forVerb = async () => null,
  validate = async () => ({ ok: true }),
  refresh = async () => {},
} = {}) {
  return { all, forVerb, validate, refresh };
}

async function withClient(
  { cli, manifest = null, knownVaults = new Set(["v1"]), runtimeVault = "v1" },
  run,
) {
  const server = createServer({
    cli,
    prompts: PROMPTS,
    manifest,
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
  "obsidian_create_from_template",
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

  // ---------------------------------------------------------------------------
  // obsidian_create / obsidian_create_from_template (Templater split — issue #13)
  // ---------------------------------------------------------------------------

  it("obsidian_create schema does not advertise a template arg", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const { tools } = await client.listTools();
      const createTool = tools.find((t) => t.name === "obsidian_create");
      assert.ok(createTool, "obsidian_create tool is registered");
      const props = createTool.inputSchema?.properties || {};
      assert.ok(
        !("template" in props),
        "obsidian_create must not advertise a template arg — use obsidian_create_from_template",
      );
    });
  });

  it("obsidian_create description distinguishes plain-note creation from Templater", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const { tools } = await client.listTools();
      const createTool = tools.find((t) => t.name === "obsidian_create");
      assert.match(
        createTool.description,
        /templater|placeholder|obsidian_create_from_template/i,
        "obsidian_create description should steer Templater users to the other tool",
      );
    });
  });

  it("obsidian_create with name+content builds the plain create command (no template)", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      await client.callTool({
        name: "obsidian_create",
        arguments: { name: "My Note", content: "# Hello" },
      });
      assert.deepEqual(cli.calls[0], ["create", "name=My Note", "content=# Hello"]);
    });
  });

  it("obsidian_create_from_template forwards templater:create-from-template with template= and file=", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      await client.callTool({
        name: "obsidian_create_from_template",
        arguments: {
          template: "Templates/daily.md",
          file: "Daily/2026-05-18.md",
        },
      });
      assert.deepEqual(cli.calls[0], [
        "templater:create-from-template",
        "template=Templates/daily.md",
        "file=Daily/2026-05-18.md",
      ]);
    });
  });

  it("obsidian_create_from_template missing required args returns isError", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_create_from_template",
        arguments: { template: "Templates/daily.md" }, // missing file
      });
      assert.equal(res.isError, true);
      assert.equal(cli.calls.length, 0, "cli.exec must not be called when validation fails");
    });
  });

  it("obsidian_create_from_template description names Templater placeholder expansion", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const { tools } = await client.listTools();
      const templTool = tools.find((t) => t.name === "obsidian_create_from_template");
      assert.ok(templTool, "obsidian_create_from_template tool is registered");
      assert.match(
        templTool.description,
        /templater|placeholder|<%/i,
        "obsidian_create_from_template description should mention Templater placeholders",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // obsidian_help — manifest-backed surface (issue #11)
  // ---------------------------------------------------------------------------

  it("obsidian_help with doc-slug topic returns prompt content from injected prompts map", async () => {
    const cli = fakeCli();
    const manifest = fakeManifest();
    await withClient({ cli, manifest }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_help",
        arguments: { topic: "markdown" },
      });
      assert.equal(res.content[0].text, "Markdown doc body");
      assert.equal(cli.calls.length, 0);
    });
  });

  it("obsidian_help returns each of the four reference prompts (cli/markdown/bases/canvas)", async () => {
    const cli = fakeCli();
    const manifest = fakeManifest();
    await withClient({ cli, manifest }, async (client) => {
      for (const [topic, expected] of [
        ["cli", "CLI doc body"],
        ["markdown", "Markdown doc body"],
        ["bases", "Bases doc body"],
        ["canvas", "Canvas doc body"],
      ]) {
        const res = await client.callTool({
          name: "obsidian_help",
          arguments: { topic },
        });
        assert.equal(res.content[0].text, expected, `topic=${topic}`);
      }
    });
  });

  it("obsidian_help schema makes topic optional (no enum constraint)", async () => {
    const cli = fakeCli();
    const manifest = fakeManifest();
    await withClient({ cli, manifest }, async (client) => {
      const { tools } = await client.listTools();
      const helpTool = tools.find((t) => t.name === "obsidian_help");
      assert.ok(helpTool, "obsidian_help tool is registered");
      const props = helpTool.inputSchema?.properties || {};
      assert.ok("topic" in props, "topic property is advertised");
      const required = helpTool.inputSchema?.required || [];
      assert.ok(
        !required.includes("topic"),
        "topic must be optional so no-arg calls return the manifest index",
      );
      assert.ok(
        !("enum" in props.topic),
        "topic must not be a closed enum — verb names are an open set",
      );
    });
  });

  it("obsidian_help() with no topic returns the manifest's category-grouped index", async () => {
    const cli = fakeCli();
    const manifest = fakeManifest({
      all: async () => ({
        Read: ["read", "outline"],
        Write: ["create", "append"],
        Edit: ["move"],
        Discover: ["search", "files"],
        Tasks: ["tasks"],
        Daily: ["daily:read"],
        Properties: ["properties"],
        Plugins: ["plugins"],
        Dev: ["dev:console"],
        Eval: ["eval"],
      }),
    });
    await withClient({ cli, manifest }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_help",
        arguments: {},
      });
      const text = res.content[0].text;
      // Categories with verbs in them must appear in the rendered index.
      assert.match(text, /Read/);
      assert.match(text, /\bread\b/);
      assert.match(text, /outline/);
      assert.match(text, /Write/);
      assert.match(text, /create/);
      assert.match(text, /Edit/);
      assert.match(text, /move/);
      assert.match(text, /Tasks/);
      assert.match(text, /tasks/);
      assert.match(text, /Daily/);
      assert.match(text, /daily:read/);
      assert.match(text, /Properties/);
      assert.match(text, /properties/);
      assert.match(text, /Plugins/);
      assert.match(text, /plugins/);
      assert.match(text, /Dev/);
      assert.match(text, /dev:console/);
      assert.match(text, /Eval/);
      assert.match(text, /\beval\b/);
      assert.equal(cli.calls.length, 0, "manifest.all should serve from cache");
    });
  });

  it("obsidian_help with a verb-name topic returns the manifest's verb help block", async () => {
    const cli = fakeCli();
    const manifest = fakeManifest({
      forVerb: async (name) => {
        if (name !== "read") return null;
        return {
          name: "read",
          description: "Read file contents",
          flags: [
            { name: "file", valueShape: "<name>", description: "File name" },
            { name: "path", valueShape: "<path>", description: "File path" },
          ],
        };
      },
    });
    await withClient({ cli, manifest }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_help",
        arguments: { topic: "read" },
      });
      const text = res.content[0].text;
      assert.match(text, /\bread\b/);
      assert.match(text, /Read file contents/);
      assert.match(text, /file=/);
      assert.match(text, /File name/);
      assert.match(text, /path=/);
      assert.match(text, /File path/);
    });
  });

  it("obsidian_help collision: verb wins over doc slug", async () => {
    // Manifest contains a verb literally named "markdown". The live verb help
    // must take precedence over the static markdown prompt content.
    const cli = fakeCli();
    const manifest = fakeManifest({
      forVerb: async (name) => {
        if (name !== "markdown") return null;
        return {
          name: "markdown",
          description: "Live markdown verb from the CLI",
          flags: [],
        };
      },
    });
    await withClient({ cli, manifest }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_help",
        arguments: { topic: "markdown" },
      });
      const text = res.content[0].text;
      assert.match(
        text,
        /Live markdown verb from the CLI/,
        "verb help should win over the static doc prompt",
      );
      assert.doesNotMatch(
        text,
        /Markdown doc body/,
        "static prompt content must not leak when the verb resolves",
      );
    });
  });

  it("obsidian_help with unknown topic and no manifest match returns a not-found message", async () => {
    const cli = fakeCli();
    const manifest = fakeManifest({
      forVerb: async () => null,
    });
    await withClient({ cli, manifest }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_help",
        arguments: { topic: "no-such-verb-or-doc" },
      });
      const text = res.content[0].text;
      assert.match(text, /no-such-verb-or-doc/);
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

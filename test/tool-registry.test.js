import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  TYPED_TOOL_ENTRIES,
  validators,
  registerTypedTools,
} from "../lib/tool-registry.js";
import { createServer } from "../server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROMPTS = {
  "obsidian-cli": "a",
  "obsidian-markdown": "b",
  "obsidian-bases": "c",
  "obsidian-canvas": "d",
};

function fakeCli({ result = { stdout: "ok", stderr: "", error: null } } = {}) {
  const calls = [];
  let vault = "v";
  return {
    calls,
    exec: async (input) => { calls.push(input); return result; },
    getVault: () => vault,
    setVault: (v) => { vault = v; },
    isObsidianRunning: async () => true,
  };
}

async function withClient(opts, run) {
  const server = createServer({
    cli: opts.cli,
    prompts: PROMPTS,
    manifest: opts.manifest ?? null,
    version: "9.9.9",
    knownVaults: new Set(["v"]),
    runtimeVault: "v",
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([server.connect(b), client.connect(a)]);
  try { return await run(client); }
  finally { await client.close(); await server.close(); }
}

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

describe("validators.fileOrPath", () => {
  it("passes when file is present", () => {
    assert.equal(validators.fileOrPath({ file: "Foo" }), null);
  });
  it("passes when path is present", () => {
    assert.equal(validators.fileOrPath({ path: "Foo.md" }), null);
  });
  it("passes when both present", () => {
    assert.equal(validators.fileOrPath({ file: "Foo", path: "Foo.md" }), null);
  });
  it("returns isError result with hint when both missing", () => {
    const r = validators.fileOrPath({});
    assert.ok(r, "validator should return a failure object");
    assert.equal(r.isError, true);
    assert.match(r.error, /provide file= or path=/);
  });
  it("treats empty strings as missing", () => {
    const r = validators.fileOrPath({ file: "", path: "" });
    assert.ok(r);
    assert.equal(r.isError, true);
  });
});

// ---------------------------------------------------------------------------
// Registry data shape
// ---------------------------------------------------------------------------

describe("TYPED_TOOL_ENTRIES", () => {
  it("contains exactly the 22 typed tools (sorted, unique)", () => {
    const names = TYPED_TOOL_ENTRIES.map((e) => e.name).sort();
    assert.deepEqual(names, [
      "obsidian_backlinks",
      "obsidian_command",
      "obsidian_create",
      "obsidian_create_from_template",
      "obsidian_daily_append",
      "obsidian_daily_path",
      "obsidian_daily_read",
      "obsidian_delete",
      "obsidian_files",
      "obsidian_help",
      "obsidian_history",
      "obsidian_move",
      "obsidian_outline",
      "obsidian_properties",
      "obsidian_property_set",
      "obsidian_read",
      "obsidian_recents",
      "obsidian_rename",
      "obsidian_search",
      "obsidian_tags",
      "obsidian_tasks",
      "obsidian_template_read",
    ]);
  });

  it("every entry has name, description, schema, and either build or handler", () => {
    for (const e of TYPED_TOOL_ENTRIES) {
      assert.equal(typeof e.name, "string", `${e.name}: name`);
      assert.equal(typeof e.description, "string", `${e.name}: description`);
      assert.equal(typeof e.schema, "object", `${e.name}: schema`);
      const hasBuild = typeof e.build === "function";
      const hasHandler = typeof e.handler === "function";
      assert.ok(
        hasBuild || hasHandler,
        `${e.name}: must define build(args) or handler(args, ctx)`,
      );
    }
  });

  it("entries that declare requires reference known validators", () => {
    for (const e of TYPED_TOOL_ENTRIES) {
      for (const v of e.requires || []) {
        assert.equal(
          typeof validators[v],
          "function",
          `${e.name}: unknown validator '${v}'`,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// build() args parity — every entry's build maps known args to known cli args.
// This is the per-tool integration: valid args produce the same cli.exec call
// they produced before the refactor.
// ---------------------------------------------------------------------------

const BUILD_CASES = [
  ["obsidian_daily_append", { content: "a line" }, ["daily:append", "content=a line"]],
  ["obsidian_read", { file: "Foo" }, ["read", "file=Foo"]],
  ["obsidian_read", { path: "Foo.md" }, ["read", "path=Foo.md"]],
  ["obsidian_read", { file: "Foo", path: "Foo.md" }, ["read", "file=Foo", "path=Foo.md"]],
  ["obsidian_search", { query: "q" }, ["search:context", "query=q"]],
  ["obsidian_search", { query: "q", path: "P/", limit: 5 }, ["search:context", "query=q", "path=P/", "limit=5"]],
  ["obsidian_tags", {}, ["tags", "counts"]],
  ["obsidian_tags", { sort: "count" }, ["tags", "counts", "sort=count"]],
  ["obsidian_tasks", {}, ["tasks"]],
  ["obsidian_tasks", { daily: true, todo: true, done: true, path: "P/" }, ["tasks", "daily", "todo", "done", "path=P/"]],
  ["obsidian_properties", {}, ["properties", "counts"]],
  ["obsidian_properties", { file: "F" }, ["properties", "file=F", "counts"]],
  ["obsidian_properties", { name: "n", file: "F" }, ["property:read", "name=n", "file=F"]],
  ["obsidian_properties", { name: "n", path: "P.md" }, ["property:read", "name=n", "path=P.md"]],
  ["obsidian_create", {}, ["create"]],
  ["obsidian_create", { name: "N", path: "P.md", content: "C" }, ["create", "name=N", "path=P.md", "content=C"]],
  ["obsidian_create_from_template", { template: "T.md", file: "F.md" }, ["templater:create-from-template", "template=T.md", "file=F.md"]],
  ["obsidian_property_set", { name: "n", value: "v", file: "F" }, ["property:set", "name=n", "value=v", "file=F"]],
  ["obsidian_property_set", { name: "n", value: "v", path: "P.md" }, ["property:set", "name=n", "value=v", "path=P.md"]],
  ["obsidian_backlinks", {}, ["backlinks", "counts"]],
  ["obsidian_backlinks", { file: "F" }, ["backlinks", "file=F", "counts"]],
  ["obsidian_backlinks", { path: "P.md" }, ["backlinks", "path=P.md", "counts"]],
  ["obsidian_files", {}, ["files"]],
  ["obsidian_files", { folder: "F/", ext: "md" }, ["files", "folder=F/", "ext=md"]],
  ["obsidian_move", { file: "Foo", to: "Archive/" }, ["move", "file=Foo", "to=Archive/"]],
  ["obsidian_move", { path: "Foo.md", to: "Archive/Foo.md" }, ["move", "path=Foo.md", "to=Archive/Foo.md"]],
  ["obsidian_move", { file: "Foo", path: "Foo.md", to: "Archive/" }, ["move", "file=Foo", "path=Foo.md", "to=Archive/"]],
  ["obsidian_outline", { file: "Foo" }, ["outline", "file=Foo"]],
  ["obsidian_outline", { path: "Foo.md" }, ["outline", "path=Foo.md"]],
  ["obsidian_outline", { file: "Foo", format: "json" }, ["outline", "file=Foo", "format=json"]],
  ["obsidian_outline", { path: "Foo.md", total: true }, ["outline", "path=Foo.md", "total"]],
  ["obsidian_outline", { file: "Foo", format: "md", total: true }, ["outline", "file=Foo", "format=md", "total"]],
  ["obsidian_rename", { file: "Foo", name: "Bar" }, ["rename", "file=Foo", "name=Bar"]],
  ["obsidian_rename", { path: "Foo.md", name: "Bar.md" }, ["rename", "path=Foo.md", "name=Bar.md"]],
  ["obsidian_rename", { file: "Foo", path: "Foo.md", name: "Bar" }, ["rename", "file=Foo", "path=Foo.md", "name=Bar"]],
  ["obsidian_delete", { file: "Foo" }, ["delete", "file=Foo"]],
  ["obsidian_delete", { path: "Foo.md" }, ["delete", "path=Foo.md"]],
  ["obsidian_delete", { file: "Foo", permanent: true }, ["delete", "file=Foo", "permanent"]],
  ["obsidian_delete", { path: "Foo.md", permanent: true }, ["delete", "path=Foo.md", "permanent"]],
  ["obsidian_template_read", { name: "daily" }, ["template:read", "name=daily"]],
  ["obsidian_template_read", { name: "daily", resolve: true }, ["template:read", "name=daily", "resolve"]],
  ["obsidian_template_read", { name: "daily", resolve: true, title: "My Note" }, ["template:read", "name=daily", "resolve", "title=My Note"]],
  ["obsidian_history", { file: "Foo" }, ["history", "file=Foo"]],
  ["obsidian_history", { path: "Foo.md" }, ["history", "path=Foo.md"]],
  ["obsidian_command", { id: "editor:toggle-bold" }, ["command", "id=editor:toggle-bold"]],
];

describe("entry.build maps args to identical cli.exec args (pre-refactor parity)", () => {
  for (const [name, args, expected] of BUILD_CASES) {
    it(`${name} ${JSON.stringify(args)}`, () => {
      const entry = TYPED_TOOL_ENTRIES.find((e) => e.name === name);
      assert.ok(entry, `entry ${name} exists`);
      assert.ok(entry.build, `entry ${name} has build()`);
      assert.deepEqual(entry.build(args), expected);
    });
  }

  it("obsidian_daily_read forwards single-string verb (not an array)", () => {
    const entry = TYPED_TOOL_ENTRIES.find((e) => e.name === "obsidian_daily_read");
    assert.equal(entry.build({}), "daily:read");
  });

  it("obsidian_daily_path forwards single-string verb (not an array)", () => {
    const entry = TYPED_TOOL_ENTRIES.find((e) => e.name === "obsidian_daily_path");
    assert.equal(entry.build({}), "daily:path");
  });

  it("obsidian_recents forwards single-string verb (not an array)", () => {
    const entry = TYPED_TOOL_ENTRIES.find((e) => e.name === "obsidian_recents");
    assert.equal(entry.build({}), "recents");
  });
});

// ---------------------------------------------------------------------------
// Registration loop wires entries into the MCP server
// ---------------------------------------------------------------------------

describe("registerTypedTools", () => {
  it("is exported as a function", () => {
    assert.equal(typeof registerTypedTools, "function");
  });

  it("registers every entry as a tool whose handler calls runTool with entry.build(args)", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      for (const e of TYPED_TOOL_ENTRIES) {
        assert.ok(names.includes(e.name), `tool ${e.name} is registered`);
      }
    });
  });

  it("validation failure from a required validator returns isError and does not call cli.exec", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({ name: "obsidian_read", arguments: {} });
      assert.equal(res.isError, true);
      assert.match(res.content[0].text, /provide file= or path=/);
      assert.equal(cli.calls.length, 0);
    });
  });
});

describe("obsidian_move validation", () => {
  it("missing file and path returns isError and does not call cli.exec", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_move",
        arguments: { to: "Archive/" },
      });
      assert.equal(res.isError, true);
      assert.match(res.content[0].text, /provide file= or path=/);
      assert.equal(cli.calls.length, 0);
    });
  });

  it("missing required to is rejected and does not call cli.exec", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_move",
        arguments: { file: "Foo" },
      });
      assert.equal(res.isError, true);
      assert.equal(cli.calls.length, 0);
    });
  });
});

describe("obsidian_outline validation", () => {
  it("missing file and path returns isError and does not call cli.exec", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_outline",
        arguments: {},
      });
      assert.equal(res.isError, true);
      assert.match(res.content[0].text, /provide file= or path=/);
      assert.equal(cli.calls.length, 0);
    });
  });

  it("rejects an out-of-enum format and does not call cli.exec", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_outline",
        arguments: { file: "Foo", format: "yaml" },
      });
      assert.equal(res.isError, true);
      assert.equal(cli.calls.length, 0);
    });
  });
});

describe("obsidian_rename validation", () => {
  it("missing file and path returns isError and does not call cli.exec", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_rename",
        arguments: { name: "Bar" },
      });
      assert.equal(res.isError, true);
      assert.match(res.content[0].text, /provide file= or path=/);
      assert.equal(cli.calls.length, 0);
    });
  });

  it("missing required name is rejected and does not call cli.exec", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_rename",
        arguments: { file: "Foo" },
      });
      assert.equal(res.isError, true);
      assert.equal(cli.calls.length, 0);
    });
  });
});

describe("obsidian_delete validation", () => {
  it("missing file and path returns isError and does not call cli.exec", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_delete",
        arguments: {},
      });
      assert.equal(res.isError, true);
      assert.match(res.content[0].text, /provide file= or path=/);
      assert.equal(cli.calls.length, 0);
    });
  });
});

describe("obsidian_command validation", () => {
  it("missing required id is rejected and does not call cli.exec", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_command",
        arguments: {},
      });
      assert.equal(res.isError, true);
      assert.equal(cli.calls.length, 0);
    });
  });
});

describe("obsidian_history validation", () => {
  it("missing file and path returns isError and does not call cli.exec", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_history",
        arguments: {},
      });
      assert.equal(res.isError, true);
      assert.match(res.content[0].text, /provide file= or path=/);
      assert.equal(cli.calls.length, 0);
    });
  });
});

describe("obsidian_template_read validation", () => {
  it("missing required name is rejected and does not call cli.exec", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const res = await client.callTool({
        name: "obsidian_template_read",
        arguments: {},
      });
      assert.equal(res.isError, true);
      assert.equal(cli.calls.length, 0);
    });
  });
});

// ---------------------------------------------------------------------------
// Snapshot: the full tools/list shape must equal the pre-refactor fixture.
// Refactor is behavior-preserving if and only if this diff is empty.
// ---------------------------------------------------------------------------

describe("tools/list snapshot", () => {
  it("matches the pre-refactor fixture exactly", async () => {
    const cli = fakeCli();
    await withClient({ cli }, async (client) => {
      const { tools } = await client.listTools();
      const actual = tools
        .map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
        .sort((x, y) => x.name.localeCompare(y.name));
      const fixturePath = join(__dirname, "fixtures", "tools-snapshot.json");
      const expected = JSON.parse(readFileSync(fixturePath, "utf8"));
      assert.deepEqual(
        actual,
        expected,
        "tools/list shape drift from pre-refactor snapshot — registry changed observable surface",
      );
    });
  });
});

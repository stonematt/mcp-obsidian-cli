import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";
import {
  parseVaultTsv,
  VAULT_URI,
  VAULT_FILES_URI,
  VAULT_TAGS_URI,
} from "../lib/resources.js";

const PROMPTS = {
  "obsidian-cli": "a",
  "obsidian-markdown": "b",
  "obsidian-bases": "c",
  "obsidian-canvas": "d",
};

// CLI fake that routes exec by the first arg token so a single server can
// answer all three resource reads with shape-appropriate output.
function routingCli(route) {
  const calls = [];
  let vault = "v";
  return {
    calls,
    exec: async (input) => {
      calls.push(input);
      return route(input);
    },
    getVault: () => vault,
    setVault: (v) => {
      vault = v;
    },
    isObsidianRunning: async () => true,
  };
}

const VAULT_TSV =
  "name\tflat_tax\npath\t/Users/me/vaults/flat_tax\nfiles\t48\nfolders\t19\nsize\t8794786";

function defaultRoute(input) {
  const verb = input[0];
  if (verb === "vault") return { stdout: VAULT_TSV, stderr: "", error: null };
  if (verb === "files")
    return { stdout: "A.md\nB.md\nfolder/C.md", stderr: "", error: null };
  if (verb === "tags")
    return {
      stdout: '[{"tag":"#x","count":"2"}]',
      stderr: "",
      error: null,
    };
  return { stdout: "", stderr: "", error: null };
}

async function withClient(cli, run) {
  const server = createServer({
    cli,
    prompts: PROMPTS,
    manifest: null,
    version: "9.9.9",
    knownVaults: new Set(["v"]),
    runtimeVault: "v",
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([server.connect(b), client.connect(a)]);
  try {
    return await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

function readJson(res) {
  assert.equal(res.contents.length, 1);
  assert.equal(res.contents[0].mimeType, "application/json");
  return JSON.parse(res.contents[0].text);
}

// ---------------------------------------------------------------------------
// parseVaultTsv
// ---------------------------------------------------------------------------

describe("parseVaultTsv", () => {
  it("parses key/value lines and coerces integer values to numbers", () => {
    const out = parseVaultTsv(VAULT_TSV);
    assert.deepEqual(out, {
      name: "flat_tax",
      path: "/Users/me/vaults/flat_tax",
      files: 48,
      folders: 19,
      size: 8794786,
    });
  });

  it("ignores blank lines and lines without a tab", () => {
    assert.deepEqual(parseVaultTsv("\nname\tx\nnotabhere\n"), { name: "x" });
  });
});

// ---------------------------------------------------------------------------
// Resource registration + reads
// ---------------------------------------------------------------------------

describe("vault metadata resources (#30)", () => {
  it("resources/list returns the three vault resources", async () => {
    await withClient(routingCli(defaultRoute), async (client) => {
      const { resources } = await client.listResources();
      const uris = resources.map((r) => r.uri).sort();
      assert.deepEqual(uris, [VAULT_FILES_URI, VAULT_TAGS_URI, VAULT_URI].sort());
    });
  });

  it("reads obsidian://vault as parsed vault metadata", async () => {
    await withClient(routingCli(defaultRoute), async (client) => {
      const res = await client.readResource({ uri: VAULT_URI });
      assert.deepEqual(readJson(res), {
        name: "flat_tax",
        path: "/Users/me/vaults/flat_tax",
        files: 48,
        folders: 19,
        size: 8794786,
      });
    });
  });

  it("reads obsidian://vault/files as count plus sample", async () => {
    await withClient(routingCli(defaultRoute), async (client) => {
      const res = await client.readResource({ uri: VAULT_FILES_URI });
      assert.deepEqual(readJson(res), {
        count: 3,
        sample: ["A.md", "B.md", "folder/C.md"],
      });
    });
  });

  it("reads obsidian://vault/tags as parsed tag objects", async () => {
    await withClient(routingCli(defaultRoute), async (client) => {
      const res = await client.readResource({ uri: VAULT_TAGS_URI });
      assert.deepEqual(readJson(res), { tags: [{ tag: "#x", count: "2" }] });
    });
  });

  it("surfaces a CLI error as an { error } payload instead of throwing", async () => {
    const errCli = routingCli(() => ({
      stdout: "",
      stderr: "",
      error: { type: "OBSIDIAN_NOT_RUNNING", message: "Obsidian is not running" },
    }));
    await withClient(errCli, async (client) => {
      const res = await client.readResource({ uri: VAULT_URI });
      assert.deepEqual(readJson(res), { error: "Obsidian is not running" });
    });
  });

  it("resource reads are lazy — no exec until a resource is read", async () => {
    const cli = routingCli(defaultRoute);
    await withClient(cli, async (client) => {
      await client.listResources();
      assert.equal(cli.calls.length, 0, "listing must not exec the CLI");
      await client.readResource({ uri: VAULT_TAGS_URI });
      assert.deepEqual(cli.calls[0], ["tags", "counts", "format=json"]);
    });
  });
});

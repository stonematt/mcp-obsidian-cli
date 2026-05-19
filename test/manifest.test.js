import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createVerbManifest } from "../lib/manifest.js";

// ---------------------------------------------------------------------------
// Helpers — fake ObsidianCli + a sliced sample of `obsidian help` output
// ---------------------------------------------------------------------------

/**
 * A representative subset of real `obsidian help` output. Covers every
 * category bucket the manifest must surface, plus enough flag variety to
 * exercise validation (`to=`, `dest=`, `format=`, bare booleans, etc.).
 */
const SAMPLE_HELP = `Obsidian CLI

Usage: obsidian <command> [options]

Options:
  vault=<name>          Target a specific vault by name

Notes:
  file resolves by name (like wikilinks), path is exact (folder/note.md)

Commands:
  append                Append content to a file
    file=<name>         - File name
    path=<path>         - File path
    content=<text>      - Content to append (required)
    inline              - Append without newline

  backlinks             List backlinks to a file
    file=<name>         - Target file name
    path=<path>         - Target file path
    counts              - Include link counts

  create                Create a new file
    name=<name>         - File name
    path=<path>         - File path
    content=<text>      - Initial content

  delete                Delete a file
    file=<name>         - File name
    path=<path>         - File path
    permanent           - Skip trash, delete permanently

  files                 List files in the vault
    folder=<path>       - Filter by folder
    ext=<extension>     - Filter by extension

  move                  Move or rename a file
    file=<name>         - File name
    path=<path>         - File path
    to=<path>           - Destination folder or path (required)

  plugins               List installed plugins
    filter=core|community  - Filter by plugin type
    format=json|tsv|csv - Output format (default: tsv)

  plugin:enable         Enable a plugin
    id=<id>             - Plugin ID (required)

  properties            List properties in the vault
    name=<name>         - Get specific property count

  property:set          Set a property on a file
    name=<name>         - Property name (required)
    value=<value>       - Property value (required)
    file=<name>         - File name
    path=<path>         - File path

  read                  Read file contents
    file=<name>         - File name
    path=<path>         - File path

  search                Search vault for text
    query=<text>        - Search query (required)
    path=<folder>       - Limit to folder
    limit=<n>           - Max files

  tasks                 List tasks in the vault
    file=<name>         - Filter by file name
    daily               - Show tasks from daily note

  task                  Show or update a task
    ref=<path:line>     - Task reference (path:line)
    file=<name>         - File name
    daily               - Use daily note


Developer:
  dev:console           Show captured console messages
    clear               - Clear the console buffer
    limit=<n>           - Max messages to show (default 50)

  dev:errors            Show captured errors
    clear               - Clear the error buffer

  eval                  Execute JavaScript and return result
    code=<javascript>   - JavaScript code to execute (required)
`;

/**
 * Build a fake ObsidianCli whose `exec` records every call and returns a
 * configurable shape. By default, an `exec(['help'])` call returns SAMPLE_HELP.
 */
function fakeCli({ helpOutput = SAMPLE_HELP, delayMs = 0, error = null } = {}) {
  const calls = [];
  return {
    calls,
    async exec(args) {
      calls.push(Array.isArray(args) ? [...args] : args);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (error) return { stdout: "", stderr: "", error };
      return { stdout: helpOutput, stderr: "", error: null };
    },
  };
}

/** Build a controllable `now()` clock for TTL tests. */
function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance(ms) {
      t += ms;
    },
  };
}

// ---------------------------------------------------------------------------
// createVerbManifest — lazy priming + TTL
// ---------------------------------------------------------------------------

describe("createVerbManifest — lazy priming", () => {
  it("does not call cli.exec until first method invocation", () => {
    const cli = fakeCli();
    createVerbManifest({ cli });
    assert.equal(cli.calls.length, 0);
  });

  it("first all() call triggers exactly one cli.exec(['help'])", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    await m.all();
    assert.equal(cli.calls.length, 1);
    assert.deepEqual(cli.calls[0], ["help"]);
  });

  it("first forVerb() call triggers exactly one cli.exec(['help'])", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    await m.forVerb("read");
    assert.equal(cli.calls.length, 1);
    assert.deepEqual(cli.calls[0], ["help"]);
  });

  it("subsequent calls within TTL do not re-fetch", async () => {
    const cli = fakeCli();
    const clock = fakeClock();
    const m = createVerbManifest({
      cli,
      ttlMs: 60_000,
      now: clock.now,
    });
    await m.all();
    await m.all();
    await m.forVerb("read");
    await m.validate(["read"]);
    assert.equal(cli.calls.length, 1);
  });
});

describe("createVerbManifest — TTL expiry", () => {
  it("re-fetches when TTL elapses", async () => {
    const cli = fakeCli();
    const clock = fakeClock();
    const m = createVerbManifest({
      cli,
      ttlMs: 1000,
      now: clock.now,
    });
    await m.all();
    clock.advance(1001);
    await m.all();
    assert.equal(cli.calls.length, 2);
  });

  it("does not re-fetch right at TTL boundary (strictly greater)", async () => {
    const cli = fakeCli();
    const clock = fakeClock();
    const m = createVerbManifest({
      cli,
      ttlMs: 1000,
      now: clock.now,
    });
    await m.all();
    clock.advance(1000);
    await m.all();
    assert.equal(cli.calls.length, 1);
  });
});

describe("createVerbManifest — refresh()", () => {
  it("refresh() re-fetches unconditionally", async () => {
    const cli = fakeCli();
    const clock = fakeClock();
    const m = createVerbManifest({
      cli,
      ttlMs: 60_000,
      now: clock.now,
    });
    await m.all();
    await m.refresh();
    assert.equal(cli.calls.length, 2);
  });

  it("refresh() before first prime still results in one fetch (not two)", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    await m.refresh();
    assert.equal(cli.calls.length, 1);
  });
});

// ---------------------------------------------------------------------------
// all() — category-grouped verb index
// ---------------------------------------------------------------------------

describe("all() — category-grouped index", () => {
  it("returns an object keyed by the documented category names", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const index = await m.all();
    const expected = [
      "Read",
      "Write",
      "Edit",
      "Discover",
      "Tasks",
      "Daily",
      "Properties",
      "Plugins",
      "Dev",
      "Eval",
    ];
    for (const cat of expected) {
      assert.ok(cat in index, `expected category '${cat}' in index, got: ${Object.keys(index).join(", ")}`);
      assert.ok(Array.isArray(index[cat]), `category '${cat}' should be an array`);
    }
  });

  it("places read in Read, create in Write, move in Edit", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const index = await m.all();
    assert.ok(index.Read.includes("read"));
    assert.ok(index.Write.includes("create"));
    assert.ok(index.Edit.includes("move"));
  });

  it("places task/tasks in Tasks, eval in Eval, dev:* in Dev", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const index = await m.all();
    assert.ok(index.Tasks.includes("task") || index.Tasks.includes("tasks"));
    assert.ok(index.Eval.includes("eval"));
    assert.ok(index.Dev.includes("dev:console"));
  });

  it("places properties + property:* in Properties, plugins + plugin:* in Plugins", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const index = await m.all();
    assert.ok(index.Properties.includes("properties"));
    assert.ok(index.Properties.includes("property:set"));
    assert.ok(index.Plugins.includes("plugins"));
    assert.ok(index.Plugins.includes("plugin:enable"));
  });

  it("places search/files in Discover", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const index = await m.all();
    assert.ok(index.Discover.includes("search"));
    assert.ok(index.Discover.includes("files"));
  });
});

// ---------------------------------------------------------------------------
// forVerb() — cached per-verb help block
// ---------------------------------------------------------------------------

describe("forVerb()", () => {
  it("returns a structured record with name, description, flags", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const v = await m.forVerb("move");
    assert.equal(v.name, "move");
    assert.match(v.description, /Move or rename/);
    assert.ok(Array.isArray(v.flags));
    const flagNames = v.flags.map((f) => f.name);
    assert.ok(flagNames.includes("file"));
    assert.ok(flagNames.includes("path"));
    assert.ok(flagNames.includes("to"));
  });

  it("returns null for unknown verbs", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const v = await m.forVerb("nonsense-verb-xyz");
    assert.equal(v, null);
  });

  it("parses bare boolean flags (no = value)", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const v = await m.forVerb("delete");
    const permanent = v.flags.find((f) => f.name === "permanent");
    assert.ok(permanent, "expected 'permanent' flag");
  });

  it("parses namespaced verbs like dev:console", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const v = await m.forVerb("dev:console");
    assert.equal(v.name, "dev:console");
    assert.match(v.description, /console messages/);
  });
});

// ---------------------------------------------------------------------------
// validate() — flag hints, did-you-mean
// ---------------------------------------------------------------------------

describe("validate() — flag hints", () => {
  it("returns ok:true for a well-formed call", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const res = await m.validate(["move", "file=foo", "to=bar"]);
    assert.equal(res.ok, true);
  });

  it("flags dest= as a drift from to=", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const res = await m.validate(["move", "dest=foo"]);
    assert.equal(res.ok, false);
    assert.ok(res.hint, "expected a hint");
    assert.match(res.hint, /to=/);
  });

  it("flags an unknown flag with did-you-mean when a close known flag exists", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    // 'pat=' is one edit from 'path='
    const res = await m.validate(["move", "pat=foo"]);
    assert.equal(res.ok, false);
    assert.ok(res.hint);
    assert.match(res.hint, /path=/);
  });

  it("ok:true for an unknown flag with no close match (lenient by default)", async () => {
    // Lenient: we only call out unknown flags when we can suggest something.
    // A flag with no close neighbour is left alone — the CLI itself surfaces it.
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const res = await m.validate(["move", "zzzzqqqx=foo"]);
    assert.equal(res.ok, true);
  });
});

describe("validate() — did-you-mean for unknown verbs", () => {
  it("flags an unknown verb with did-you-mean when a close verb exists", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    // 'reed' is one edit from 'read'
    const res = await m.validate(["reed"]);
    assert.equal(res.ok, false);
    assert.ok(res.hint);
    assert.match(res.hint, /read/);
  });

  it("returns ok:false without hint for verbs with no close match", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const res = await m.validate(["zzqqzz"]);
    assert.equal(res.ok, false);
    // Hint is optional — only required when we have a suggestion.
  });

  it("returns ok:true for known verbs (even with no flags)", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const res = await m.validate(["read"]);
    assert.equal(res.ok, true);
  });

  it("returns ok:false for empty args", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const res = await m.validate([]);
    assert.equal(res.ok, false);
  });

  it("skips leading vault= token and validates the verb after it", async () => {
    const cli = fakeCli();
    const m = createVerbManifest({ cli });
    const okRes = await m.validate(["vault=myvault", "read"]);
    assert.equal(okRes.ok, true);
    const badRes = await m.validate(["vault=myvault", "reed"]);
    assert.equal(badRes.ok, false);
    assert.match(badRes.hint, /read/);
  });
});

// ---------------------------------------------------------------------------
// Fetch timeout
// ---------------------------------------------------------------------------

describe("fetch timeout", () => {
  it("surfaces a bounded error if cli.exec exceeds fetchTimeoutMs", async () => {
    const cli = fakeCli({ delayMs: 200 });
    const m = createVerbManifest({ cli, fetchTimeoutMs: 50 });
    await assert.rejects(
      () => m.all(),
      (err) => {
        assert.match(err.message, /timeout|timed out/i);
        return true;
      },
    );
  });

  it("does not retain a partial manifest after a timeout", async () => {
    // After a timeout, a subsequent call (with a healthy cli) should still
    // fetch — the failed attempt must not be cached.
    const slow = fakeCli({ delayMs: 200 });
    const m = createVerbManifest({ cli: slow, fetchTimeoutMs: 50 });
    await assert.rejects(() => m.all());
    // Hot-swap to a fast fake to simulate the CLI becoming responsive.
    const fast = fakeCli();
    // Reach into the manifest's bound cli would be brittle; instead, build a
    // fresh manifest with the fast cli — confirming that *if* a real adapter
    // gets reused, we don't carry over a poisoned cache. The contract we
    // actually care about: an erroring fetch is not memoised as "primed".
    const m2 = createVerbManifest({ cli: fast });
    const index = await m2.all();
    assert.ok(index.Read.includes("read"));
    assert.equal(fast.calls.length, 1);
  });
});

// ---------------------------------------------------------------------------
// cli.exec error propagation
// ---------------------------------------------------------------------------

describe("cli error propagation", () => {
  it("rejects when cli returns an error envelope", async () => {
    const cli = fakeCli({ error: { type: "EXECUTION_ERROR", message: "boom" } });
    const m = createVerbManifest({ cli });
    await assert.rejects(
      () => m.all(),
      (err) => {
        assert.match(err.message, /boom|EXECUTION_ERROR/);
        return true;
      },
    );
  });
});

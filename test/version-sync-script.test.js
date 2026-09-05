import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { syncServerVersion } from "../lib/version-sync.js";

// Unit coverage for the pure logic behind scripts/sync-manifests.js, the
// npm "version" lifecycle script that keeps server.json honest after
// `npm version` bumps package.json. End-to-end agreement across all three
// manifests is covered by test/version-sync.test.js.
describe("syncServerVersion", () => {
  it("sets the top-level version to match package.json", () => {
    const pkg = { version: "3.1.0" };
    const server = { version: "1.0.0", packages: [] };
    const result = syncServerVersion(pkg, server);
    assert.equal(result.version, "3.1.0");
  });

  it("sets every packages[].version, not just packages[0]", () => {
    const pkg = { version: "3.1.0" };
    const server = {
      version: "1.0.0",
      packages: [
        { identifier: "a", version: "1.0.0" },
        { identifier: "b", version: "0.9.0" },
        { identifier: "c", version: "1.0.0" },
      ],
    };
    const result = syncServerVersion(pkg, server);
    for (const entry of result.packages) {
      assert.equal(entry.version, pkg.version, `package entry ${entry.identifier}`);
    }
  });

  it("does not mutate the input server object", () => {
    const pkg = { version: "2.0.0" };
    const server = { version: "1.0.0", packages: [{ identifier: "a", version: "1.0.0" }] };
    syncServerVersion(pkg, server);
    assert.equal(server.version, "1.0.0");
    assert.equal(server.packages[0].version, "1.0.0");
  });

  it("leaves a packages array with no entries empty", () => {
    const result = syncServerVersion({ version: "1.2.3" }, { version: "0.0.1", packages: [] });
    assert.deepEqual(result.packages, []);
  });

  it("preserves fields other than version untouched", () => {
    const pkg = { version: "5.0.0" };
    const server = {
      name: "io.github.stonematt/mcp-obsidian-cli",
      version: "4.0.0",
      packages: [{ identifier: "mcp-obsidian-cli", registryType: "npm", version: "4.0.0" }],
    };
    const result = syncServerVersion(pkg, server);
    assert.equal(result.name, server.name);
    assert.equal(result.packages[0].identifier, "mcp-obsidian-cli");
    assert.equal(result.packages[0].registryType, "npm");
  });
});

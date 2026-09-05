import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => JSON.parse(readFileSync(join(root, name), "utf8"));

// server.json is what the MCP Registry reads. If it drifts from package.json,
// the registry advertises a version that was never published to npm.
describe("version sync", () => {
  const pkg = read("package.json");
  const server = read("server.json");

  it("server.json top-level version matches package.json", () => {
    assert.equal(server.version, pkg.version);
  });

  it("server.json packages[].version matches package.json", () => {
    assert.ok(server.packages?.length, "server.json declares no packages");
    for (const entry of server.packages) {
      assert.equal(entry.version, pkg.version, `package entry ${entry.identifier}`);
    }
  });

  // The lockfile carries the version twice and npm only rewrites it on install,
  // so it drifts quietly whenever a version bump does not touch node_modules.
  it("package-lock.json matches package.json", () => {
    const lock = read("package-lock.json");
    assert.equal(lock.version, pkg.version, "lockfile root version");
    assert.equal(lock.packages?.[""]?.version, pkg.version, 'lockfile packages[""] version');
  });
});

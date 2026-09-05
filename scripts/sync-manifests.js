#!/usr/bin/env node
/**
 * Syncs server.json's version fields to package.json's version.
 *
 * Runs automatically as npm's "version" lifecycle script (see package.json):
 * `npm version` bumps package.json and package-lock.json itself, then runs
 * this script before it would create a commit/tag. The release ritual
 * always passes --no-git-tag-version (tagging stays in publish.yml), so no
 * commit or tag is created by this step — it only keeps server.json's
 * committed content honest so test/version-sync.test.js passes without a
 * manual follow-up edit.
 *
 * Release ritual:
 *   npm version <patch|minor|major> --no-git-tag-version
 *   (hand-edit CHANGELOG.md's new ## [x.y.z] section — not automated, see #95)
 *   git add -A && git commit -m "chore: bump version to x.y.z"
 *
 * See docs/agents/issue-tracker.md for the full checklist this replaces.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { syncServerVersion } from "../lib/version-sync.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const server = JSON.parse(readFileSync(join(root, "server.json"), "utf8"));

const synced = syncServerVersion(pkg, server);
writeFileSync(join(root, "server.json"), JSON.stringify(synced, null, 2) + "\n");

console.log(`server.json synced to version ${pkg.version}`);

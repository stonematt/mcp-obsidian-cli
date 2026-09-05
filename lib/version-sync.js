/**
 * Pure logic for keeping server.json's version fields in sync with
 * package.json. Extracted for testability — see test/version-sync-script.test.js.
 * The I/O wrapper that runs this during a release lives in
 * scripts/sync-manifests.js.
 */

/**
 * Returns a copy of `server` with its version fields set to `pkg.version`:
 * the top-level `version` and every entry in `packages[]`. Iterates the
 * full array rather than assuming a single `packages[0]` entry.
 * @param {{version: string}} pkg - Parsed package.json.
 * @param {{version?: string, packages?: Array<{version?: string}>}} server - Parsed server.json.
 * @returns {object} A new server.json object with versions synced; inputs are not mutated.
 */
export function syncServerVersion(pkg, server) {
  const synced = { ...server, version: pkg.version };
  if (Array.isArray(server.packages)) {
    synced.packages = server.packages.map((entry) => ({ ...entry, version: pkg.version }));
  }
  return synced;
}

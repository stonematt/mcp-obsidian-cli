/**
 * MCP resources for read-only vault metadata (see #30).
 *
 * Clients that browse resources (Claude Desktop's resource picker, IDE
 * integrations) get a cheap, read-only view of the connected vault without
 * having to make a tool call first:
 *
 *   - obsidian://vault        — vault name, root path, file/folder counts, size
 *   - obsidian://vault/files  — file count plus a capped sample listing
 *   - obsidian://vault/tags   — tag list with counts
 *
 * Every read goes through the same `ObsidianCli` adapter the typed tools use
 * (`cli.exec`). Reads are lazy — no work happens until a client reads a
 * resource — and never throw: a CLI error (e.g. Obsidian not running) is
 * surfaced as an `{ error }` payload so the picker degrades gracefully.
 */

const DEFAULT_FILES_SAMPLE_LIMIT = 50;

export const VAULT_URI = "obsidian://vault";
export const VAULT_FILES_URI = "obsidian://vault/files";
export const VAULT_TAGS_URI = "obsidian://vault/tags";

/**
 * Parse the `vault` verb's tab-separated key/value output into an object.
 * Integer-looking values (files, folders, size) are coerced to numbers.
 *
 * @param {string} stdout
 * @returns {Record<string, string|number>}
 */
export function parseVaultTsv(stdout) {
  const out = {};
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    if (tab === -1) continue;
    const key = line.slice(0, tab).trim();
    const value = line.slice(tab + 1).trim();
    out[key] = /^\d+$/.test(value) ? Number(value) : value;
  }
  return out;
}

async function readVault(cli) {
  const { stdout, error } = await cli.exec(["vault"]);
  if (error) return { error: error.message };
  return parseVaultTsv(stdout);
}

async function readFiles(cli, sampleLimit = DEFAULT_FILES_SAMPLE_LIMIT) {
  const { stdout, error } = await cli.exec(["files"]);
  if (error) return { error: error.message };
  const all = stdout.split(/\r?\n/).filter(Boolean);
  return { count: all.length, sample: all.slice(0, sampleLimit) };
}

async function readTags(cli) {
  const { stdout, error } = await cli.exec(["tags", "counts", "format=json"]);
  if (error) return { error: error.message };
  try {
    return { tags: JSON.parse(stdout) };
  } catch {
    return { raw: stdout };
  }
}

/**
 * Register the three vault-metadata resources on an McpServer. Each read
 * returns a single `application/json` content block.
 *
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 * @param {{exec: (args: string[]) => Promise<{stdout: string, stderr: string, error: null | {type: string, message: string}}>}} cli
 */
export function registerVaultResources(server, cli) {
  const jsonContents = (uri, payload) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  });

  server.registerResource(
    "vault",
    VAULT_URI,
    {
      title: "Obsidian vault",
      description:
        "The connected vault: name, root path, file and folder counts, and total size.",
      mimeType: "application/json",
    },
    async (uri) => jsonContents(uri, await readVault(cli)),
  );

  server.registerResource(
    "vault-files",
    VAULT_FILES_URI,
    {
      title: "Vault files",
      description:
        "File count for the connected vault plus a capped sample of vault-relative file paths.",
      mimeType: "application/json",
    },
    async (uri) => jsonContents(uri, await readFiles(cli)),
  );

  server.registerResource(
    "vault-tags",
    VAULT_TAGS_URI,
    {
      title: "Vault tags",
      description: "Tags in the connected vault with their usage counts.",
      mimeType: "application/json",
    },
    async (uri) => jsonContents(uri, await readTags(cli)),
  );
}

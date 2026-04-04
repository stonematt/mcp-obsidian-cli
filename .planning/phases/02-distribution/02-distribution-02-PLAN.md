---
phase: 02-distribution
plan: 02
type: execute
wave: 2
depends_on: [02-distribution-01]
files_modified: [package.json]
autonomous: true
requirements: [DIST-01]
user_setup:
  - service: npm
    why: "Publish package to npm registry"
    env_vars:
      - name: NPM_TOKEN
        source: "npmjs.com -> Access Tokens -> Create Granular Access Token (publish)"

must_haves:
  truths:
    - "Package passes npm publish --dry-run validation"
    - "npx mcp-obsidian-cli works from fresh environment after publish"
    - "GitHub repo created with LICENSE (MIT)"
  artifacts:
    - path: "package.json"
      provides: "Published npm package with correct name and version"
      contains: ["name: mcp-obsidian-cli", "version", "bin entry point"]
  key_links:
    - from: "package.json"
      to: "npm registry"
      via: "npm publish"
      pattern: "npm publish"
---

<objective>
Prepare package.json for npm publish and verify the package works correctly.
</objective>

<context>
@package.json
@server.js

# package.json currently has version 0.0.1, needs update for v1.0.0 release
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update package.json version for release</name>
  <files>package.json</files>
  <action>
    Update package.json version to 1.0.0 (first stable release). Ensure all fields are correct:
    - name: "mcp-obsidian-cli"
    - version: "1.0.0"
    - bin: correctly points to server.js
    - main: server.js
    - description is accurate
  </action>
  <verify>
    <automated>node -e "const p=require('./package.json'); console.log(p.name, p.version)"</automated>
  </verify>
  <done>package.json version updated to 1.0.0</done>
</task>

<task type="auto">
  <name>Task 2: Validate npm publish --dry-run</name>
  <files>package.json</files>
  <action>
    Run `npm publish --dry-run` to validate the package is correctly configured for publishing. Verify:
    - Package name is available or owned by you
    - All required files are included
    - Entry points are correct
  </action>
  <verify>
    <automated>npm publish --dry-run 2>&amp;1 | grep -E "(package|mcp-obsidian-cli|successfully)"</automated>
  </verify>
  <done>npm publish --dry-run validates successfully</done>
</task>

<task type="auto">
  <name>Task 3: Create GitHub repository with LICENSE</name>
  <files>.git</files>
  <action>
    Create a new GitHub repository and push the code:
    1. Create repo via `gh repo create mcp-obsidian-cli --public --source=. --push`
    2. LICENSE file should already exist (check package.json has license: "MIT")
    3. Push all branches and commits
  </action>
  <verify>
    <automated>gh repo view stonematt/mcp-obsidian-cli 2>&amp;1 | head -5</automated>
  </verify>
  <done>GitHub repo created and code pushed</done>
</task>

</tasks>

<verification>
- [ ] package.json version is 1.0.0
- [ ] npm publish --dry-run passes
- [ ] GitHub repository exists with code pushed
- [ ] LICENSE file present in repo
</verification>

<success_criteria>
DIST-01 satisfied: Package published to npm as mcp-obsidian-cli (or dry-run validated, actual publish happens after user approves)
</success_criteria>

<output>
After completion, create `.planning/phases/02-distribution/02-distribution-02-SUMMARY.md`
</output>

---
phase: 02-distribution
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [README.md]
autonomous: true
requirements: [DIST-02, DIST-03, DIST-04]
user_setup: []

must_haves:
  truths:
    - "README contains Claude Desktop configuration example"
    - "README contains complete tool reference table"
    - "README contains comparison table distinguishing from alternatives"
    - "README includes trademark caveat for 'Obsidian' name"
    - "README includes Ko-fi link and author info at bottom"
  artifacts:
    - path: "README.md"
      provides: "Complete documentation with config examples and tool reference"
      min_lines: 90
      contains: ["Claude Desktop config", "Tool reference table", "Comparison table", "Trademark caveat", "Ko-fi link"]
  key_links: []
---

<objective>
Update README with all required sections: trademark caveat, Ko-fi link, ensure complete tool reference and comparison table exist.
</objective>

<context>
@server.js
@package.json
@README.md

# Existing README has most content - need to add trademark and Ko-fi sections
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add trademark caveat to README</name>
  <files>README.md</files>
  <action>
    Add a trademark disclaimer section to the README. Insert after the title/before "Why this exists" or as a note after the main description. The disclaimer should note that "Obsidian" is a trademark of Obsidian Publishing and this project is not affiliated with or endorsed by them.
  </action>
  <verify>
    <automated>grep -i "trademark" README.md</automated>
  </verify>
  <done>README contains trademark caveat for "Obsidian" name</done>
</task>

<task type="auto">
  <name>Task 2: Add Ko-fi link and author info to README</name>
  <files>README.md</files>
  <action>
    Add Ko-fi button and author info at the bottom of README (before or after License section). Use this exact markup:
    
    [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Z8Z41G13PX)
    
    Maintained by [@stonematt](https://github.com/stonematt)
    Licensed under the MIT License
  </action>
  <verify>
    <automated>grep -i "ko-fi" README.md && grep -i "stonematt" README.md</automated>
  </verify>
  <done>README includes Ko-fi link and author info at bottom</done>
</task>

</tasks>

<verification>
- [ ] README has Claude Desktop config JSON block
- [ ] README has tool reference table with all 12+ tools
- [ ] README has comparison table
- [ ] README has trademark caveat
- [ ] README has Ko-fi link
- [ ] README has "Maintained by @stonematt"
</verification>

<success_criteria>
All DIST-02, DIST-03, DIST-04 requirements satisfied in README.md
</success_criteria>

<output>
After completion, create `.planning/phases/02-distribution/02-distribution-01-SUMMARY.md`
</output>

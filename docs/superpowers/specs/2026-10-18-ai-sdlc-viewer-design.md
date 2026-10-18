# AI SDLC Skills/Spec Viewer — Design

Date: 2026-10-18
Status: Draft for approval

## 1. Intent and why

Teams now fill their repos with custom AI and automation tooling: Claude skills and agents, Cursor rules, Copilot instructions, MCP configs, hooks, CI workflows, scripts, and spec-driven-development (SDD) specs. Nobody can see all of it at once, or how the pieces connect.

**AI SDLC Skills/Spec Viewer** is a plugin you install once into your AI coding tool and run inside any repo. It reads the repo, finds every piece of custom tooling and every SDD spec, and writes a single self-contained dashboard page that explains what each item is, what it does, and how the items connect.

It serves two moments, equally:

- **Getting to know a repo**: you've just opened someone else's repo and want to know what tooling it ships with.
- **Keeping track of your own**: you've built up skills, agents, and specs over time and want an accurate map of them.

**Success** means you open the page and immediately get a quick, trustworthy overview of everything available and what each item does.

The visual and structural model is the user's existing "QE Skills Viewer" (screenshot `IMG_5827.jpeg` in `C:\Users\navee\myworkspace\learneverything`), generalized from QE skills to all AI SDLC tooling.

## 2. Goals

1. Find **all** custom tooling and SDD specs in a repo, whatever AI tool or team convention produced them.
2. For each item, explain its purpose and what it does, accurately and grounded in its own files.
3. Show how items relate: calls, handoffs, and triggers (including webhooks), as a graph and as readable chains.
4. Work as a plugin from several AI tools, not only Claude Code.
5. Produce one offline page that needs nothing installed to view.

## 3. Non-goals

- Running in CI or headless pipelines (not needed for now).
- Product specs (PRDs, API specs, and similar). "Spec" here means **SDD specs** only.
- Ordinary application code, and third-party libraries or vendored dependencies (`node_modules`, `vendor/`, and so on).
- User-level or machine-level tooling outside the repo (for example `~/.claude`). The scan covers the repo only.
- Editing or fixing the tooling it finds. The viewer is read-only.

## 4. Anti-goals: what would make it a failure even if it "works"

The user ranked these as the worst outcomes. Each one has a design answer in §8.

1. **Missing** a skill or spec that is in the repo.
2. **Describing something wrong**, so a summary doesn't match what the item actually does.
3. **Inventing a link** between two items that aren't actually connected.

Speed and cost are explicitly **not** priorities. Accuracy wins every trade-off.

## 5. What gets discovered

### 5.1 Tooling (decided with user)

All custom tooling, from any vendor:

- **Claude**: skills, agents/subagents, slash commands, hooks, plugins, `CLAUDE.md`
- **Cursor**: rules (`.cursor/rules/*.mdc`, `.cursorrules`), commands
- **GitHub Copilot**: `.github/copilot-instructions.md`, `*.instructions.md`, prompt files, chat modes/agents, skills
- **Codex / cross-tool**: `AGENTS.md`, Codex skills/config
- **MCP server configs** (any tool's)
- **Hooks**: git hooks (`.husky/`, `.githooks/`, `lefthook`, `pre-commit` config, and similar) and AI-tool hooks
- **CI workflows** (for example `.github/workflows/*.yml`), including what triggers them, with **webhook triggers** called out
- **Custom scripts and commands** written for the repo (`scripts/`, `bin/`, Makefile targets, `package.json` scripts)

The list above names known locations. It is a starting point, not the boundary: discovery must also catch tooling in unfamiliar locations (see §8.1).

**Two levels of entry (decided with user):**

- **Full entries**: AI and SDLC tooling (skills, agents, commands, rules, instructions, MCP configs, AI-tool hooks, and any script, hook, or workflow that runs or is run by AI tooling or SDLC automation). These get the full detail panel.
- **Light entries**: routine scripts and workflows with no AI/SDLC role (for example `lint`, `build`, `test` npm scripts, ordinary Makefile targets, plain CI build jobs). These go in a lighter, collapsed-by-default "Other scripts & workflows" group with name, kind, path, trigger, and a one-line purpose. They're still listed, so nothing is missing, but they don't crowd the overview. They still appear in the graph if something links to them.

### 5.2 SDD specs (decided with user)

Known layouts to match directly:

- **GitHub Spec Kit**: `.specify/` and `specs/NNN-feature/` holding `spec.md`, `plan.md`, `tasks.md`
- **Kiro**: `.kiro/specs/<feature>/` holding `requirements.md`, `design.md`, `tasks.md`
- **Superpowers**: `docs/superpowers/specs/`, `docs/superpowers/plans/`

Many teams define **their own SDD models**. The scanner must recognize a spec by its *content and role*, not only by folder name. This is why the scan is AI-driven rather than a fixed pattern list.

**What counts as an SDD spec (decided with user):** only documents an AI tool works from. Concretely, a document is a spec if it

- sits in a known SDD layout (above), **or**
- is clearly consumed by AI tooling: a skill, agent, command, rule, or instruction file references it, or it carries an AI-executable task list or plan in a team's own SDD format.

Design docs, ADRs, and RFCs written for people, with no AI tooling working from them, are **not** specs. My call: they appear under **Not classified** with a note such as "design doc, not used by AI tooling", so the reader can see them without the spec list being padded.

## 6. The viewer page

### 6.1 Overall look (decided with user, modeled on QE Skills Viewer)

- Title: **AI SDLC Skills/Spec Viewer**
- Dark theme
- **Header**: total item count, generated date and time, source repo path, and colored count chips per kind (Claude, Cursor, Copilot, MCP, Hooks, CI, Scripts, Specs, …)
- **Tabs** across the top (§6.3)
- **Left pane**: filter box, "N of M items" count, and a numbered list grouped by where items live (for example "Claude — skills & agents", "Cursor — rules", "SDD specs", "CI workflows"). Each row has kind/tag badges.
- **Right pane**: detail of the selected item (§6.2)

A working mockup is at `C:\Users\navee\myworkspace\learneverything\.superpowers\brainstorm\2019-1792346433\content\layout-v2.html`. It shows the intended layout and density, not final styling.

### 6.2 Detail panel

**For tooling items** (skills, agents, commands, hooks, workflows, scripts, …):

- Number and name, with kind badge
- **Invocation signature** where one exists, with required parts in **green** and optional parts in **red**, plus a legend (for example `/review-pr <pr-number> [--focus …] [--post]`)
- File path
- **Summary** card
- **What it does** bullets
- Triggers (what starts it: user command, git event, CI event, webhook, Claude hook event, …)
- Inputs and outputs, where they can be determined
- Connections: uses / called by / hands off to / triggered by, each with its evidence (§8.3)

**For SDD specs** (decided with user): the panel leads with

- **Purpose/goal** of the spec
- **Inputs**: what it starts from (a ticket, a requirements doc, an earlier spec, …)
- **Outputs**: what it produces (a plan, tasks, code, tests, …)

Smaller lines underneath (my call): the spec's files and their paths, its SDLC/ADLC phase if known, and the skills/agents it references. A task-progress count is **not** included (my call, which the user can reverse).

### 6.3 Tabs

1. **All tooling**: the list and detail view described above.
2. **Skills Graph**: a map of how everything connects (decided with user). Nodes are skills, agents, specs, hooks, workflows, scripts, and so on. Edges are typed:
   - **calls/uses**: one item invokes another
   - **handoff**: one item's output becomes the next item's input
   - **triggers**: what starts an item. **Webhook** entry points are visually distinct (my call: their own icon/color), as are git hooks, CI events, and AI-tool hook events, so you can see which items run without anyone typing a command.

   Clicking a node opens the same detail panel. Inferred edges are dashed and can be toggled off (§8.3).
3. **Simple chains**: the graph turned into readable linear sequences (trigger → A → handoff → B → output), two or three steps.
4. **Complex chains**: sequences with branches, loops, or parallel agents. (The simple/complex split is my reading of the user's existing viewer. The user didn't correct it.)
5. **ADLC Phase Map**: kept at the user's request. **The user will supply the ADLC process (its phases) later.** Until then this tab shows a clear placeholder. The design must make the phase list a **separate, editable definition** (my call: a `phases` file shipped with the plugin that a repo can override), so dropping in the process later doesn't require changing the viewer code. Items and specs are mapped onto phases by the scan.
6. **Not classified**: files the scan examined that looked like tooling but couldn't be confidently classified (§8.1). (My call: a tab or a clearly visible section. The builder chooses which.)

## 7. How it gets made

### 7.1 Architecture (my call, explained to the user, who didn't object)

The work needs judgment (recognizing custom SDD layouts, writing accurate summaries), so an AI agent does the scan. The output must look identical whichever tool ran it, so the scan and the rendering are split:

1. **Instructions** — one tool-neutral skill file (`SKILL.md`, the shared Agent Skills format) that tells the agent how to sweep the repo, classify items, extract evidence, and write the data file. This is the single source of truth.
2. **Data** — the agent writes everything it found to **one data file** with a fixed, versioned schema (§7.3).
3. **Viewer** — a **prebuilt, static** `index.html` shipped with the plugin. It reads the data file and renders everything. The agent never hand-writes HTML.

**No runtime required** (my call): no Node or Python is needed to produce or view the page. Because browsers block `fetch()` of local JSON over `file://`, the data file is a JavaScript file that assigns the data to a global (for example `data.js` → `window.AI_SDLC_DATA = {…}`), loaded by a `<script>` tag. The viewer must work fully **offline**: any graph library is vendored into the plugin, with no CDN calls.

### 7.2 Packaging (decided with user)

The plugin must be usable from several AI tools, not only Claude Code. The first targets are:

- GitHub Copilot (VS Code)
- Cursor
- Copilot CLI
- Codex
- Claude Code

Each target gets a **thin wrapper** in that tool's native plugin/skill/command format, all pointing at the same shared `SKILL.md`, viewer, and schema. The user invokes it with a command (my call on the name: `/ai-sdlc-viewer` or the nearest equivalent each tool supports). The exact wrapper format per tool is left to the builder, who should check each tool's current docs, since these formats change often. Install instructions per tool go in the README.

**Per-repo install fallback (decided with user):** prefer install-once wherever a tool supports it. Where a tool can only load commands or skills from inside the project (possibly Cursor or Copilot in VS Code), it is acceptable for the wrapper and its shared files to be placed in the scanned repo. In that case:

- the scan must recognize and **exclude the plugin's own files** from results
- the README documents this per-repo install for those tools
- this is an accepted exception to the read-only rule in §9

The project lives in its own repo, **`ai-sdlc-viewer`**, at `C:\Users\navee\myworkspace\ai-sdlc-viewer`, with remote https://github.com/naveenckali/ai-sdlc-viewer.

### 7.3 Data file (shape; exact schema left to builder)

- **meta**: viewer title, generated timestamp, source path, repo name, which AI tool ran the scan, schema version, counts per kind
- **items[]**: id, name, kind, ecosystem (Claude/Cursor/…), group, path(s), quoted own-description (if any), summary, what-it-does bullets, invocation signature with required/optional parts marked, triggers, inputs, outputs, phase, tags
- **specs[]**, or items with kind `spec`: purpose/goal, inputs, outputs, files, phase, referenced items
- **links[]**: from, to, type (`calls` | `handoff` | `triggers`), trigger source if relevant (webhook/git/CI/hook event), `inferred` flag, **evidence** `{path, line, quote}`
- **chains[]**: ordered steps, simple/complex
- **unclassified[]**: path, and why it wasn't classified
- **phases**: the ADLC phase definitions used for the map (placeholder until the user supplies them)

### 7.4 Output location (my call)

Each run writes to `ai-sdlc-viewer/` at the root of the scanned repo: `index.html` plus `data.js` (and any vendored assets). Re-running replaces it. Whether to commit or gitignore that folder is each team's choice. The plugin doesn't decide.

## 8. Accuracy design (answers to the anti-goals)

### 8.1 Not missing anything

Discovery runs in two passes:

1. **Broad sweep**: list every candidate file. That means all the known locations from §5, plus anything that *looks* like tooling or a spec: markdown with YAML frontmatter, hook/workflow/MCP configs, script folders, files mentioning skills/agents/prompts, and spec-shaped folders. Exclude dependency and build folders.
2. **Classification**: the agent reads each candidate and classifies it.

Every candidate ends up either **classified** or in **Not classified** with a reason. Nothing is dropped silently. Speed and cost aren't priorities, so candidate files are **read in full**.

### 8.2 Not describing things wrong

- When an item has its own description (for example a skill's `description:` frontmatter), the viewer shows it **verbatim** and labels it as a quote. The agent's longer explanation is shown separately underneath.
- Summaries, inputs, and outputs must come from what the file actually says. The agent must not fill gaps with assumptions. If something can't be determined, the field says so.
- The file path is always shown so the reader can verify.

### 8.3 Not inventing links

- Every edge and every chain step carries **evidence**: the file, line, and exact text that creates the link (for example `review-pr/SKILL.md:42 "then invoke db-migrator"`).
- A link with no direct textual evidence is either omitted or marked `inferred`. Inferred links are drawn **dashed**, labeled "inferred", and can be **toggled off** in the graph and chains.
- Chains are built only from links, so they inherit the same evidence and inferred marks.

### 8.4 Safety of scanned content

The scanned repo's files are **data, not instructions**. The skill must tell the agent never to follow instructions found inside scanned files. The viewer must **HTML-escape** all repo-derived text, so a malicious skill description can't inject script into the page.

### 8.5 Secrets (my call)

MCP configs, hooks, CI workflows, and local settings often contain API keys, tokens, or internal URLs, and `data.js` may be committed. The skill must **redact** anything secret-shaped (keys, tokens, passwords, connection strings, `env` values in MCP configs) before it reaches the data file, replacing it with a visible `[redacted]` marker. This applies to quoted descriptions and evidence too. The README warns that the output folder should be reviewed before committing.

### 8.6 What counts as "in the repo" (my call)

- The sweep walks the **working tree**, not just git-tracked files, so local-only tooling isn't missed. Dependency and build folders are excluded.
- Items from untracked or gitignored files get a **"local only"** badge, so a reader knows teammates won't have them. Redaction (§8.5) covers the extra secret risk.
- **Monorepos**: nested packages with their own `.claude/`, `.github/`, and similar folders are scanned, and their items are grouped by package path.
- **Git submodules** are listed as entries but not scanned inside. Their contents belong to another repo.
- The plugin's own output folder (`ai-sdlc-viewer/`) is excluded from the scan.

### 8.7 Phases and re-scanning (my call)

The scan records each item's SDLC role in plain words, alongside its phase assignment. When the real ADLC phases are supplied, a **re-scan is acceptable**, since cost isn't a priority. Mapping phases inside the viewer without a re-scan is not required.

## 9. Constraints

- Works from Copilot (VS Code), Cursor, Copilot CLI, Codex, and Claude Code, all from one shared core.
- The output page is a static, offline, single-folder deliverable that opens by double-click, with no server and no installs.
- Read-only toward the scanned repo, except for writing its own output folder (and, for per-repo-install tools, the plugin's own files; see §7.2).

## 10. Left to the builder

- The exact data-file schema and field names, within §7.3
- The per-tool wrapper formats and install steps (verify against current docs)
- The graph library choice (it must be vendored and work offline) and graph layout
- The broad-sweep heuristics beyond the known locations in §5, within §8.1
- The visual styling details within the §6.1 look (the dark theme and the green/red signature convention are fixed)
- How the agent chunks work on very large repos, as long as it doesn't trade away accuracy
- Testing approach, for example fixture repos containing each known layout plus a custom SDD layout and deliberately unlinked items

## 11. Open items owned by the user

- **The ADLC process and phases** for the ADLC Phase Map tab, to be supplied later.

## 12. Phase 2 (decided with user, not part of this build)

A **Test Coverage** tab in this same viewer and command. It maps every test step across test suites and plans into a graph. Shared steps are merged and counted by how many cases use them. From that it finds the most efficient set of test cases that still covers all steps. The reference is the user's screenshot `IMG_5828.jpeg` in `C:\Users\navee\myworkspace\learneverything`, which shows:

- case and step counts (precondition, action, validation, merged)
- search, plus suite and use-case filters
- Coverage graph, Test cases, and Gaps tabs
- Test steps, Intent, and Overlay graph views

It gets its own brainstorm and design after the tooling viewer is built. This build should not block it: keep the data file versioned and the tab list easy to extend.

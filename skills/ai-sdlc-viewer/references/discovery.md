# Discovery: building the candidate list

Goal: list every file that is, or might be, custom AI/SDLC tooling or an SDD spec. Missing a file is the worst outcome, so include anything you are unsure of; classification sorts it out.

Discovery has two parts that you always do both of: the known locations, then the broad sweep. The known locations are a starting point, not the boundary.

## 1. List the working tree

Walk the whole working tree, not only tracked files, so local-only tooling isn't missed.

- If the repo is a git repo (a `.git` entry exists at the root, or `git rev-parse --is-inside-work-tree` prints `true`):
  - `git ls-files` lists tracked files.
  - `git ls-files --others --ignored --exclude-standard` lists ignored local-only files.
  - `git ls-files --others --exclude-standard` lists untracked, not-ignored files.
  - Together these cover the working tree. Keep the tracked list: classification uses it for `localOnly`.
  - Also read `git config core.hooksPath`; if set, its target directory is a git-hooks location.
- If it is not a git repo, walk the directory tree with your file-listing tools. Every item is then `localOnly: false` and `meta.git` is false.
- Write every path repo-relative with `/` separators, even on Windows.

## 2. Excludes

Never descend into, or list anything under:

- `.git/`, `node_modules/`, `.venv/`, at any depth (for example `packages/web/node_modules/`).
- `vendor/`, `dist/`, `build/`, `target/` **only** when the folder sits at the repo root or at a package root (a folder with its own `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, or similar), or when git ignores it (its files show up in `git ls-files --others --ignored --exclude-standard`). Elsewhere these are ordinary folder names.
  - **Never apply these four names inside a tooling location**, at any depth, even when another rule above would: `.claude/`, `.cursor/`, `.github/`, `.agents/`, `.codex/`, `.kiro/`, `.specify/`, `specs/`, `scripts/`, `bin/`, `tools/`. For example `.claude/skills/build/SKILL.md` is a skill named `build`, and `scripts/dist/publish.sh` is a script.
- `ai-sdlc-viewer/` (this plugin's own output) and `.ai-sdlc-viewer/` (its per-repo config; read `phases.json` from it in the Phases step, but don't list it as a candidate)
- **A plugin copy: a directory that holds all three of** a `.ai-sdlc-viewer-plugin` marker file, a `SKILL.md` whose frontmatter has `name: ai-sdlc-viewer`, and `viewer/index.html` (this plugin installed inside the repo). Search for the marker file first, at any depth, and check each directory that holds one. Exclude it only when all three are there.
  - A marker without the other two is an ordinary file, not an exclude: a repo could otherwise hide its own tooling by dropping a marker next to it. Keep sweeping that folder as usual.
  - Name every folder you excluded as a plugin copy, and every marker you treated as an ordinary file, in the final report.

**Git submodules:** read `.gitmodules` if present. List each submodule's `path` as one candidate (the directory path, for example `libs/shared`), to become a `submodule` item. Don't descend into it: its contents belong to another repo.

## 3. Known locations

Check every one of these, at the repo root **and inside every nested package** (any subdirectory with its own `package.json`, `pyproject.toml`, `go.mod`, `.claude/`, or `.github/`). `**` means any depth.

### Claude

- `.claude/skills/*/SKILL.md`, and every other file in each skill folder (references, scripts, templates). Scripts among them become their own items and other support files fold into the skill (classification.md §3). The same applies to agent folders and to the skill folders listed under Cursor, Copilot, and Codex below.
- `.claude/agents/*.md` (agents / subagents)
- `.claude/commands/**/*.md` (slash commands; subfolders are namespaces)
- `.claude/settings.json`, `.claude/settings.local.json` and any other `.claude/settings*.json`: the `hooks` entries (AI-tool hooks), plus `mcpServers` if present
- `.claude/hooks/` and any script a hook entry runs (each such script is its own item, linked from the hook)
- `.mcp.json` (MCP servers)
- `CLAUDE.md` at any depth, and `CLAUDE.local.md`
- `.claude-plugin/` (`plugin.json`, `marketplace.json`) and whatever a plugin manifest points at (its skills, agents, commands, hooks, MCP config)

### Cursor

- `.cursor/rules/**/*.mdc` (rules)
- `.cursorrules` (legacy rules file)
- `.cursor/commands/` (commands)
- `.cursor/mcp.json` (MCP servers)
- `.cursor/skills/`
- `.cursor/hooks.json` and any script it runs

### GitHub Copilot

- `.github/copilot-instructions.md`
- `.github/instructions/*.instructions.md` (and `*.instructions.md` anywhere)
- `.github/prompts/*.prompt.md` (prompt files)
- `.github/chatmodes/` (`*.chatmode.md`, chat modes)
- `.github/agents/` (`*.agent.md`, custom agents)
- `.github/skills/`
- `.vscode/mcp.json` (MCP servers for Copilot in VS Code)

### Codex and cross-tool

- `AGENTS.md` at any depth (and `AGENTS.override.md`)
- `.codex/` (config such as `config.toml` with `mcp_servers`, prompts, skills)
- `.agents/skills/`
- `GEMINI.md` and `.gemini/` if present (record them; ecosystem `cross-tool`)

### MCP server configs (any tool)

- `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `mcpServers` in any `.claude/settings*.json`, `mcp_servers` in `.codex/config.toml`, and any other `*mcp*.json` / `*mcp*.toml` / `*mcp*.yaml` config

### Git hooks

- `.husky/` (each hook file)
- `.githooks/`
- `lefthook.yml` / `lefthook.yaml` / `.lefthook.yml`
- `.pre-commit-config.yaml`
- the `core.hooksPath` target directory
- the `hooks` / `husky` / `simple-git-hooks` / `lint-staged` sections of `package.json`

### CI workflows

- `.github/workflows/*.y*ml` (`.yml` and `.yaml`)
- `.github/actions/**/action.y*ml` (local composite actions)
- `.gitlab-ci.yml` (and files it `include:`s)
- `azure-pipelines.yml` (and other `*pipelines*.y*ml` templates it references)
- also any other CI config you find (`.circleci/config.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml`, `.buildkite/`)

### Scripts and commands

- `scripts/`, `bin/`, `tools/` (every file in them)
- `Makefile` / `makefile` / `*.mk` targets (the file is the candidate; each target becomes an item)
- `package.json` `scripts` (the file is the candidate; each script becomes an item)
- every package manifest (`package.json`, `pyproject.toml`, `go.mod`) at the root and in each nested package is a candidate, even one with no scripts; classification sends a manifest without scripts to `unclassified`
- also `justfile`, `Taskfile.yml`, `pyproject.toml` `[project.scripts]` / `[tool.poetry.scripts]` / task-runner sections

### SDD specs

- **GitHub Spec Kit:** `.specify/` (memory, templates, scripts) and `specs/*/` feature folders holding `spec.md`, `plan.md`, `tasks.md` (plus `research.md`, `data-model.md`, `quickstart.md`, `contracts/`)
- **Kiro:** `.kiro/specs/<feature>/` holding `requirements.md`, `design.md`, `tasks.md` (and `.kiro/steering/`, `.kiro/hooks/` as tooling)
- **Superpowers:** `docs/superpowers/specs/` and `docs/superpowers/plans/`

## 4. Broad sweep

Then search beyond the known locations. Add every file that matches any of these:

- **Markdown with YAML frontmatter** containing `name:` or `description:` (also `applyTo:`, `globs:`, `alwaysApply:`, `tools:`, `model:`, `argument-hint:`). Search all `*.md` and `*.mdc` files for a first line of `---`.
- **Any file whose text names skills, agents, prompts, or subagents** as AI tooling: search text files (markdown, YAML, JSON, TOML, shell, and other script files) for words like `skill`, `subagent`, `agent`, `prompt`, `slash command`, `MCP`, `claude`, `copilot`, `cursor`, `codex`, `LLM`. In application source code, include a file only if it is clearly tooling (for example a script that invokes an AI CLI or model), not a file that merely uses the word (`userAgent`).
- **Folders holding spec/plan/tasks-shaped files**: any folder with files named like `spec*.md`, `plan*.md`, `tasks*.md`, `requirements*.md`, `design*.md`, `prd*.md`, or containing checkbox task lists (`- [ ]`) with numbered steps. Include every file in such a folder. Also include `docs/adr/`, `docs/rfcs/`, and similar design-doc folders, so classification can record them (usually as unclassified design docs).
- **Hook, workflow, and MCP configs anywhere**: any file named like `*hooks*.json`, `*workflow*.y*ml`, `*mcp*`.
- **Anything any other candidate references**: if a skill, command, hook, or workflow names a file or script (for example `run scripts/release.sh`, `see docs/process/tasks-template.md`), that file is a candidate too, unless excluded. A referenced script is always its own item, linked from what runs it. Only non-runnable support files in a skill's or agent's own folder fold into that item (classification.md §3).

Keep sweeping until a pass adds nothing new.

## 5. Record

- Deduplicate. Sort for readability.
- Put the final list in `meta.candidates`. Each entry is a repo-relative POSIX path, exactly as it will appear in an item's `paths` or an `unclassified[].path`.

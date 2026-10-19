# Classification

Read each candidate in full, then decide: which item(s) it defines, or why it isn't one. Every candidate ends in some item's `paths` or in `unclassified` with a reason.

## 1. Kinds (`kind`)

| kind | What it is | Example |
|---|---|---|
| `skill` | An agent skill folder with `SKILL.md` | `.claude/skills/review-pr/SKILL.md` |
| `agent` | An agent, subagent, custom agent, or chat mode | `.claude/agents/reviewer.md`, `.github/agents/planner.agent.md` |
| `command` | A slash command or prompt file a user invokes by name | `.claude/commands/ship.md`, `.github/prompts/fix-tests.prompt.md` |
| `rule` | A Cursor rule or other scoped rule file | `.cursor/rules/style.mdc`, `.cursorrules` |
| `instructions` | Always-on or scoped instructions for an AI tool | `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `api.instructions.md` |
| `mcp-server` | One MCP server entry in an MCP config (one item per server) | the `github` entry in `.mcp.json` |
| `hook` | An AI-tool hook entry or a git hook | a `PreToolUse` entry in `.claude/settings.json`, `.husky/pre-commit` |
| `workflow` | A CI workflow or pipeline | `.github/workflows/release.yml` |
| `script` | A repo script, Makefile target, or `package.json` script | `scripts/release.sh`, the `lint` script in `package.json` |
| `plugin` | A plugin manifest bundling other tooling | `.claude-plugin/plugin.json` |
| `spec` | An SDD spec (see §5) | `specs/001-checkout/spec.md` |
| `submodule` | A git submodule (listed, never scanned inside) | `libs/shared` from `.gitmodules` |
| `other` | Tooling that fits none of the above | `.kiro/steering/product.md` |

## 2. Ecosystems (`ecosystem`)

| ecosystem | Use for | Example |
|---|---|---|
| `claude` | Claude Code files (`.claude/`, `CLAUDE.md`, `.mcp.json`, `.claude-plugin/`) | `.claude/agents/reviewer.md` |
| `cursor` | Cursor files (`.cursor/`, `.cursorrules`) | `.cursor/rules/style.mdc` |
| `copilot` | GitHub Copilot files (`.github/copilot-instructions.md`, `.github/instructions/`, `prompts/`, `chatmodes/`, `agents/`, `skills/`, `.vscode/mcp.json`) | `.github/prompts/fix-tests.prompt.md` |
| `codex` | Codex files (`.codex/`) | `.codex/config.toml` |
| `cross-tool` | Formats several tools read (`AGENTS.md`, `.agents/skills/`, Spec Kit, Superpowers specs) | `AGENTS.md` |
| `git` | Git hooks and hook managers | `.husky/pre-commit` |
| `ci` | CI workflows and pipelines | `.github/workflows/ci.yml` |
| `generic` | Anything else (repo scripts, Makefile targets, custom SDD formats, Kiro) | `scripts/release.sh` |

Pick by where the file lives and which tool reads it, not by what it mentions.

## 3. How files map to items

- **One item per thing a user or tool can run or load.** A skill folder is one item: `SKILL.md` first in `paths`, then the folder's support files (see the next rule). A spec feature folder is one item: its main file first (`spec.md` or `requirements.md`), then the others.
- **Own item or support file (one rule, used everywhere):**
  - **Always its own item, plus a link from whatever runs it (when a file says so):** every script file (a file with a shebang line, or a `.sh` `.bash` `.zsh` `.ps1` `.psm1` `.cmd` `.bat` `.py` `.js` `.mjs` `.cjs` `.ts` `.rb` `.pl` extension), wherever it lives, including inside a skill's or agent's folder; every runnable file under `scripts/`, `bin/`, or `tools/` (a non-runnable file there, such as a README, goes in `unclassified` with a reason); every Makefile target and `package.json` script; every git hook file; and any file that a hook entry, workflow, or other item runs as a command.
  - **Folded into the owning item's `paths`, never its own item:** only non-runnable support files inside a skill's or agent's own folder: templates, reference docs, examples, schemas, and assets.
  - Example: `.claude/skills/release/SKILL.md` + `.claude/skills/release/templates/notes.md` + `.claude/skills/release/scripts/bump.sh` give two items. Item `release` has paths `[SKILL.md, templates/notes.md]`; item `bump` has paths `[scripts/bump.sh]`, with a `calls` link `release` → `bump` when `SKILL.md` names the script. A Claude hook entry whose command runs `scripts/format.sh` is a `hook` item, and the script is a `script` item, with a `triggers` link from the hook to the script.
- **One file, many items:** each `package.json` script, Makefile target, MCP server entry, and AI-tool hook entry is its own item. Each lists the shared file (for example `package.json`) in `paths`. Give each an evidence-able name (`npm run lint` → name `lint`).
- A config file that defines no item at all after reading (for example a `.claude/settings.json` with permissions only) goes in `unclassified` with a reason such as `settings without hooks or MCP servers`.
- A package manifest (`package.json`, `pyproject.toml`, `go.mod`) that defines no scripts goes in `unclassified` with the reason `package manifest without scripts`. It still marks a package root for `package` (§7).
- A Superpowers spec and plan are separate files and separate items. Spec Kit and Kiro feature folders are one item each.
- A git submodule is a `submodule` item with `paths: ["<submodule path>"]`, `level: "full"`, summary from `.gitmodules` only (for example its URL, redacted if it has credentials).

## 4. Full vs light (`level`)

The spec §5.1 rule, verbatim:

> **Two levels of entry (decided with user):**
>
> - **Full entries**: AI and SDLC tooling (skills, agents, commands, rules, instructions, MCP configs, AI-tool hooks, and any script, hook, or workflow that runs or is run by AI tooling or SDLC automation). These get the full detail panel.
> - **Light entries**: routine scripts and workflows with no AI/SDLC role (for example `lint`, `build`, `test` npm scripts, ordinary Makefile targets, plain CI build jobs). These go in a lighter, collapsed-by-default "Other scripts & workflows" group with name, kind, path, trigger, and a one-line purpose. They're still listed, so nothing is missing, but they don't crowd the overview. They still appear in the graph if something links to them.

In practice:

- `level: "full"` for every skill, agent, command, rule, instructions file, MCP server, AI-tool hook, plugin, spec, and submodule, and for every script, git hook, or workflow that runs AI tooling, is run by AI tooling, or does SDLC automation (release, deploy, versioning, changelog, spec/plan generation, issue triage, review automation).
- `level: "light"` only for routine scripts, git hooks, and workflows with no such role. Decide from what the file does and what runs it, not its name: a `test` script is light by itself, but if a skill, agent, hook, or AI workflow runs it (with evidence), it is run by AI tooling and is `full`.
- A light item still has every field. It needs name, kind, paths, triggers, and a one-line `summary`; the rest can be null or `[]`.

## 5. SDD specs

The spec §5.2 rule, verbatim:

> Many teams define **their own SDD models**. The scanner must recognize a spec by its *content and role*, not only by folder name. This is why the scan is AI-driven rather than a fixed pattern list.
>
> **What counts as an SDD spec (decided with user):** only documents an AI tool works from. Concretely, a document is a spec if it
>
> - sits in a known SDD layout (above), **or**
> - is clearly consumed by AI tooling: a skill, agent, command, rule, or instruction file references it, or it carries an AI-executable task list or plan in a team's own SDD format.
>
> Design docs, ADRs, and RFCs written for people, with no AI tooling working from them, are **not** specs. My call: they appear under **Not classified** with a note such as "design doc, not used by AI tooling", so the reader can see them without the spec list being padded.

The known SDD layouts are GitHub Spec Kit (`.specify/` and `specs/NNN-feature/` holding `spec.md`, `plan.md`, `tasks.md`), Kiro (`.kiro/specs/<feature>/` holding `requirements.md`, `design.md`, `tasks.md`), and Superpowers (`docs/superpowers/specs/`, `docs/superpowers/plans/`).

In practice:

- A spec is `kind: "spec"`, `level: "full"`. Its `summary` is the purpose/goal it states. Its `inputs` and `outputs` are non-empty: use `["Not stated in the file"]` when silent.
- When a spec counts only because some tooling references it, add the link from that tooling to the spec with the referencing quote as evidence.
- A design doc, ADR, or RFC that no AI tooling works from goes in `unclassified` with exactly this reason: `design doc, not used by AI tooling`.
- Product specs (PRDs, API specs such as OpenAPI files) are not SDD specs. Unless AI tooling works from them, they go in `unclassified` with a reason such as `product spec, not used by AI tooling`.
- Spec Kit's `.specify/` contents: its templates and scripts are tooling (`other` or `script`, ecosystem `cross-tool`); its `memory/constitution.md` is `instructions`.

## 6. `localOnly`

`localOnly` = the file isn't git-tracked. Use the item's main file (`paths[0]`): `true` if it is not in `git ls-files` output (untracked or gitignored), else `false`. If the repo is not a git repo, always `false`.

## 7. Monorepo `package`

- `package` = the nearest ancestor dir containing its own `package.json`/`pyproject.toml`/`go.mod`/`.claude`/`.github` below the root. Write it repo-relative (for example `packages/web`).
- Items under the repo root package get `package: null`.
- Ignore candidate ancestors that are inside a tooling folder: a skill folder with its own `package.json` still belongs to the package that holds its `.claude/`.
- Prefix the id with the package slug: the package path lowercased, with every character other than a lowercase letter or digit replaced by `-`, repeated `-` collapsed to one, and leading/trailing `-` removed (`packages/web` → `packages-web`, `apps/Web_UI` → `apps-web-ui`, `.github-actions/x` → `github-actions-x`), then a `-`. So `lint-fix` in `packages/web` gets id `packages-web-lint-fix`, while `name` stays `lint-fix`.

## 8. Ids

- Ids: kebab-case and unique. Lowercase letters, digits, and `-` only.
- Base the id on the item's name: `review-pr`, `npm-lint`, `mcp-github`, `hook-pre-tool-use-format`, `workflow-release`.
- If two items would share an id (same name, different kind, same package), suffix the kind: `review-command`, `review-skill`.
- Never reuse an id. Duplicate ids are a validation error.

## 9. Unclassified

Use `unclassified` for every candidate that you read and that is not part of any item. Write a specific reason:

- `design doc, not used by AI tooling` (exact text for human design docs, ADRs, RFCs)
- `package manifest without scripts` (exact text for a `package.json` / `pyproject.toml` / `go.mod` with no scripts)
- `mentions AI agents but is project documentation, not tooling`
- `frontmatter is for the docs site, not an AI tool`
- `looks like tooling but its role is unclear: <what you saw>`

Prefer `unclassified` with an honest reason over a guessed classification.

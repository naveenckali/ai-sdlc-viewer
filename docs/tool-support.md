# Tool support

## Where each tool loads the skill

Verified against each tool's official docs on 2026-10-18. The installers (`install/install.sh`, `install/install.ps1`) hard-code the directories in this table, and `tests/unit/install.test.js` checks them.

| Tool (`--tool`) | User-level dir | Project-level dir | Invoke | Source |
|---|---|---|---|---|
| Claude Code (`claude`) | `~/.claude/skills/ai-sdlc-viewer/`; or install as a plugin (`/plugin marketplace add naveenckali/ai-sdlc-viewer`, then `/plugin install ai-sdlc-viewer@ai-sdlc-viewer`) | `.claude/skills/ai-sdlc-viewer/` | Plugin: `/ai-sdlc-viewer:ai-sdlc-viewer`. Copied into a skills dir: `/ai-sdlc-viewer` | https://code.claude.com/docs/en/skills |
| Copilot CLI (`copilot-cli`) | `~/.copilot/skills/ai-sdlc-viewer/` (also reads `~/.agents/skills`) | `.github/skills/ai-sdlc-viewer/` (also reads `.claude/skills`, `.agents/skills`) | `/ai-sdlc-viewer` in the prompt, or let Copilot pick it from the description; `/skills` lists skills | https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-skills |
| GitHub Copilot in VS Code (`copilot`) | `~/.copilot/skills/ai-sdlc-viewer/` (also reads `~/.claude/skills`, `~/.agents/skills`) | `.github/skills/ai-sdlc-viewer/` (also reads `.claude/skills`, `.agents/skills`) | Type `/ai-sdlc-viewer` in chat; `/skills` opens Configure Skills | https://code.visualstudio.com/docs/copilot/customization/agent-skills |
| Cursor (`cursor`) | `~/.cursor/skills/ai-sdlc-viewer/` (also reads `~/.agents/skills`) | `.cursor/skills/ai-sdlc-viewer/` (also reads `.agents/skills`) | Type `/` in Agent chat and pick `ai-sdlc-viewer`, or let the agent choose | https://cursor.com/docs/skills |
| Codex (`codex`) | `~/.agents/skills/ai-sdlc-viewer/` | `.agents/skills/ai-sdlc-viewer/` (scanned from the working directory up to the repo root) | `$ai-sdlc-viewer` or `/skills`; or implicit by description | https://learn.chatgpt.com/docs/build-skills.md (redirected from https://developers.openai.com/codex/skills) |

Notes:

- All five tools support user-level skills, so no row is project-level only. `--project <repo>` (the per-repo fallback of spec 7.2) is optional everywhere.
- Every installer copies the whole `skills/ai-sdlc-viewer/` folder, including its `.ai-sdlc-viewer-plugin` marker file, and nothing else. The scan excludes any folder carrying that marker, so a per-repo copy is never reported as part of the scanned repo. No wrapper or command files are placed outside that folder: all five tools make a skill invocable from the skill folder alone.
- Copilot CLI and Copilot in VS Code share `~/.copilot/skills` and `.github/skills`, so installing for one makes the skill available to both.
- Copilot CLI also supports plugins (manifest at the plugin root, `skills/NAME/SKILL.md`; `copilot plugin install ./dir`). The docs page checked does not state that it reads `.claude-plugin/plugin.json`, so plugin-style install for Copilot CLI is `unverified`; use the skills-directory install above.
- Claude Code in headless (`-p`) runs refuses `cp` that reads from a loaded plugin folder. The skill then writes `data.js` and prints the exact copy commands for you to run. In an interactive session Claude Code asks you to approve the `cp` instead. A copy installed under `~/.claude/skills` is a user skill, not a plugin, so it is not subject to the plugin-folder protection (not separately tested).
- Only Claude Code (the plugin path, run 7 below) has been run end to end. The other four tools are verified for file locations only; no scan has been run in them.
- Install commands: `install/install.sh --tool <tool> [--project <repo>]` (bash) or `install/install.ps1 -Tool <tool> [-Project <repo>]` (PowerShell). They print the destination, exit non-zero on an unknown tool, replace an earlier copy of this skill on re-run, and refuse to touch an existing destination that lacks the marker file.

## End-to-end evaluation

The skill is checked end to end by scanning a fixture repo with known contents and comparing the result with a list of expectations.

- Fixture: `tests/fixtures/sample-repo/`, built into a git repo by `node tools/make-fixture.js <out-dir>` (`_gitignore` becomes `.gitignore`, so `.claude/settings.local.json` stays untracked).
- Expectations: `tests/fixtures/sample-repo.expected.json` (items that must be found, specs, unclassified ADR, light scripts, local-only file, required, allowed (closed set) and forbidden links, webhook trigger, a fake GitHub token that must not appear, and the in-repo plugin copy that must be excluded).
- Checker: `node tools/check-scan.js <scanned-dir> <expected.json>`. It also runs the viewer's validator, re-finds every evidence quote in its file (within 2 lines; each `[redacted]` matches one secret token) and requires a link's quote to name its target item, fails any link outside `mustHaveLinks` + `allowedLinks`, checks that all 11 viewer files are byte-for-byte copies of `skills/ai-sdlc-viewer/viewer/`, and proves only `ai-sdlc-viewer/` changed with `git status` plus a hash of every file (gitignored ones included) that make-fixture recorded in `.git/`.

### Claude Code, 2026-10-18 (run 7, final)

Claude Code 2.1.302 on Windows 11, Git Bash. Reproduce with:

```sh
node tools/run-e2e.js run7
```

`tools/run-e2e.js` does the following:

1. It copies `.claude-plugin/` and `skills/` to `<os tmp>/ai-sdlc-viewer-e2e-plugin` (`<plugin-copy>`). Claude Code protects files under a `--plugin-dir`, and `tmp-fixtures/` is inside this repo, so loading the repo itself would make the output folder unwritable.
2. It builds `tmp-fixtures/e2e` with `tools/make-fixture.js`.
3. From `tmp-fixtures/e2e`, it runs:

```sh
claude -p /ai-sdlc-viewer:ai-sdlc-viewer --plugin-dir <plugin-copy> --add-dir <plugin-copy>   --permission-mode acceptEdits --setting-sources user --strict-mcp-config --output-format json   --allowedTools "Skill,Read,Glob,Grep,Bash(git ls-files:*),Bash(git rev-parse:*),Bash(git config --get core.hooksPath),Bash(git config core.hooksPath),Bash(pwd),Bash(date:*),Bash(ls:*),Bash(mkdir ai-sdlc-viewer:*),Bash(cp:*),Bash(rm -rf ai-sdlc-viewer)"
```

4. It runs `node tools/check-scan.js tmp-fixtures/e2e tests/fixtures/sample-repo.expected.json`.

The harness never uses `--dangerously-skip-permissions`.

Why each pre-approved tool is there. Each one is a step SKILL.md asks for:

- `Skill` loads the skill.
- `Read`, `Glob` and `Grep` read the repo and the skill's references.
- `git ls-files`, `git rev-parse` and `git config core.hooksPath` are used for discovery.
- `pwd` and `date` fill `meta.source` and `meta.generatedAt`.
- `mkdir ai-sdlc-viewer…` and `rm -rf ai-sdlc-viewer` create and replace the output folder.
- `cp` and `ls` copy the viewer files and confirm them.

`Write` and `Edit` are deliberately left out. `acceptEdits` already allows writes inside the working directory, such as `ai-sdlc-viewer/data.js`, and writes anywhere else then need approval, which is denied headless.

`--setting-sources user` and `--strict-mcp-config` keep the fixture's own hook (`scripts/format.sh`) and its MCP server from running during the scan. The fixture's files are still read as data.

**The harness copied the viewer files.** Claude Code protects plugin folders, so in headless mode it refuses `cp` out of a loaded plugin's folder without a person's approval. The agent's three `cp` commands were refused. As SKILL.md tells it to, the agent stopped there: it wrote `data.js` and reported the exact copy commands. The harness then copied the viewer files that were missing. It never overwrites a file the agent copied, and the checker confirms every viewer file is byte-identical to the shipped one. The scan, `data.js` and all evidence are the agent's. In an interactive session the same `cp` asks the user for approval instead.

Result of run 7, made with the committed runner and the shipped SKILL.md (189 s, 55 turns, $0.91, 8 permission denials). The agent's three `cp` commands were refused, and it reported "I didn't try to copy them another way". It wrote no files outside the repo.

```
HARNESS COPY: Claude Code refused the agent's viewer copy; the harness copied the 11 missing viewer file(s): index.html, viewer.css, app.js, lib/escape.js, lib/secrets.js, lib/validate.js, lib/model.js, lib/graph.js, lib/chains.js, vendor/cytoscape.min.js, vendor/LICENSE-cytoscape.txt. data.js is the agent's.
PASS 85 checks
```

The checker confirmed four things:

- every file's hash matches, gitignored files included;
- every link is in the expected set and its quote names its target;
- every evidence quote is in its file;
- the viewer files are unchanged copies.

Notes from earlier runs:

- **Run 1** used `--plugin-dir <this repo>`. The fixture sat inside the plugin folder, so every write to `ai-sdlc-viewer/` was refused as a sensitive file.
- **Runs 2 and 3** produced correct scan data (59 of 60 checks) but had no viewer files, because `cp` was refused.
- **Run 4** passed (`PASS 59 checks`, against the earlier, weaker checker) only because the skill then told the agent to get around a refused `cp` by using `cat`. That instruction was removed: a skill must not route around a permission decision.
- **Run 5** scanned correctly and respected the refusal. The harness's copy-refusal detection missed the agent's `mkdir … && cp …` chain, so its check failed on the missing `index.html` (1 of 76 checks). The detection was fixed.
- **Run 6** (`PASS 71 checks`) still pre-approved `Write`/`Edit` and used older skill text. Its transcript was saved under the label `run5`, then copied to `tmp-fixtures/e2e-run6.json`.
- **In run 6 the agent also wrote a helper validation script to `%TEMP%`**, which was possible because `Write` was pre-approved. Since then `Write` and `Edit` are no longer pre-approved, and SKILL.md forbids creating files outside the repo or writing helper files for the optional validation. A probe confirmed that, without `Write` pre-approved, writes inside the repo still work and writes to `%TEMP%` are refused.
- **Run 7** is the final run above. It is the first made with the committed runner and the shipped skill text.

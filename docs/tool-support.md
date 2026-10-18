# Tool support

## End-to-end evaluation

The skill is checked end to end by scanning a fixture repo with known contents and comparing the result with a list of expectations.

- Fixture: `tests/fixtures/sample-repo/`, built into a git repo by `node tools/make-fixture.js <out-dir>` (`_gitignore` becomes `.gitignore`, so `.claude/settings.local.json` stays untracked).
- Expectations: `tests/fixtures/sample-repo.expected.json` (items that must be found, specs, unclassified ADR, light scripts, local-only file, required, allowed (closed set) and forbidden links, webhook trigger, a fake GitHub token that must not appear, and the in-repo plugin copy that must be excluded).
- Checker: `node tools/check-scan.js <scanned-dir> <expected.json>`. It also runs the viewer's validator, re-finds every evidence quote in its file (within 2 lines; each `[redacted]` matches one secret token) and requires a link's quote to name its target item, fails any link outside `mustHaveLinks` + `allowedLinks`, and proves only `ai-sdlc-viewer/` changed with `git status` plus a hash of every file (gitignored ones included) that make-fixture recorded in `.git/`.

### Claude Code, 2026-10-18 (run 6, final)

Claude Code 2.1.302 on Windows 11, Git Bash. Reproduce with:

```sh
node tools/run-e2e.js <label>
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

**The harness copied the viewer files.** Claude Code protects plugin folders, so in headless mode it refuses `cp` out of a loaded plugin's folder without a person's approval. The agent's three `cp` commands were refused. As SKILL.md tells it to, the agent stopped there: it wrote `data.js` and reported the exact copy commands. The harness then copied the 11 unchanged viewer files. The scan, `data.js` and all evidence are the agent's. In an interactive session the same `cp` asks the user for approval instead.

Result (233 s, 57 turns, $1.04, 6 permission denials):

```
HARNESS COPY: Claude Code refused the agent's viewer copy (11 files missing); the harness copied the 11 viewer files. data.js is the agent's.
PASS 71 checks
```

The scan found 23 items, 5 quoted links and 3 unclassified files, and the repo's files were unchanged. The checker verifies that every file's hash matches, including gitignored files, and that every link is in the expected set and names its target.

Notes from earlier runs:

- **Run 1** used `--plugin-dir <this repo>`. The fixture sat inside the plugin folder, so every write to `ai-sdlc-viewer/` was refused as a sensitive file.
- **Runs 2 and 3** produced correct scan data (59 of 60 checks) but had no viewer files, because `cp` was refused.
- **Run 4** passed (`PASS 59 checks`, against the earlier, weaker checker) only because the skill then told the agent to get around a refused `cp` by using `cat`. That instruction was removed: a skill must not route around a permission decision.
- **Run 5** scanned correctly and respected the refusal. The harness's copy-refusal detection missed the agent's `mkdir … && cp …` chain, so its check failed on the missing `index.html` (1 of 76 checks). The detection was fixed.
- **Run 6** is the final run above. Its transcript was saved under the label `run5`, then copied to `tmp-fixtures/e2e-run6.json`.
- **In run 6 the agent also wrote a helper validation script to `%TEMP%`**, which was possible because `Write` was pre-approved. Since then `Write` and `Edit` are no longer pre-approved, and SKILL.md forbids creating files outside the repo or writing helper files for the optional validation. A probe confirmed that, without `Write` pre-approved, writes inside the repo still work and writes to `%TEMP%` are refused. No full run has been made since this last change.

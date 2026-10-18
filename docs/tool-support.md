# Tool support

## End-to-end evaluation

The skill is checked end to end by scanning a fixture repo with known contents and comparing the result with a list of expectations.

- Fixture: `tests/fixtures/sample-repo/`, built into a git repo by `node tools/make-fixture.js <out-dir>` (`_gitignore` becomes `.gitignore`, so `.claude/settings.local.json` stays untracked).
- Expectations: `tests/fixtures/sample-repo.expected.json` (items that must be found, specs, unclassified ADR, light scripts, local-only file, required and forbidden links, webhook trigger, a fake GitHub token that must not appear, and the in-repo plugin copy that must be excluded).
- Checker: `node tools/check-scan.js <scanned-dir> <expected.json>`. It also runs the viewer's validator, re-finds every evidence quote in its file (within 2 lines; `[redacted]` matches the secret), and checks with `git status` that only `ai-sdlc-viewer/` changed.

### Claude Code, 2026-10-18 (run 4 of 4, final)

Claude Code 2.1.302 on Windows 11, Git Bash. The plugin was loaded from a copy of this repo's `.claude-plugin/` and `skills/` outside the repo (`<plugin-copy>`), because Claude Code protects files under a `--plugin-dir`, and `tmp-fixtures/` is inside this repo.

```sh
node tools/make-fixture.js tmp-fixtures/e2e
cd tmp-fixtures/e2e
claude -p "/ai-sdlc-viewer:ai-sdlc-viewer" --plugin-dir <plugin-copy> --add-dir <plugin-copy> \
  --permission-mode acceptEdits --setting-sources user --strict-mcp-config --output-format json \
  --allowedTools "Skill,Read,Write,Edit,Glob,Grep,Bash(git ls-files:*),Bash(git rev-parse:*),Bash(git config:*),Bash(git status:*),Bash(git check-ignore:*),Bash(ls:*),Bash(pwd),Bash(date:*),Bash(cat:*),Bash(find:*),Bash(test:*),Bash(cp:*),Bash(mkdir:*),Bash(rm -rf ai-sdlc-viewer),Bash(rm -rf ./ai-sdlc-viewer),Bash(rm -rf ai-sdlc-viewer/),PowerShell(Get-ChildItem:*),PowerShell(Get-Content:*),PowerShell(Copy-Item:*),PowerShell(New-Item:*),PowerShell(Get-Date:*)"
cd ../..
node tools/check-scan.js tmp-fixtures/e2e tests/fixtures/sample-repo.expected.json
```

`--setting-sources user` and `--strict-mcp-config` keep the fixture's own hook (`scripts/format.sh`) and MCP server from running during the scan; the fixture's files are still read as data.

Result (196 s, 64 turns, about $1.09):

```
PASS 59 checks
```

The scan found 23 items, 5 quoted links and 3 unclassified files. The viewer files in the output were byte-identical to `skills/ai-sdlc-viewer/viewer/`.

Notes from earlier runs:

- Run 1 used `--plugin-dir <this repo>`. The fixture sat inside the plugin folder, so every write to `ai-sdlc-viewer/` was refused as a sensitive file. Later runs load a copy of the plugin from outside the repo.
- Runs 1 to 3 produced correct scan data but could not finish writing the viewer. Claude Code treats a loaded plugin's (or a `.claude/skills/`) folder as sensitive and refuses `cp` from it without a person's approval, even with `--add-dir`. `cat <file> > <dest>` is allowed. SKILL.md now says to copy file by file with plain commands and fall back to `cat` when `cp` is refused.
- In an interactive session the same `cp` simply asks for approval.

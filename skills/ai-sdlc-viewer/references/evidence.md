# Evidence: links and triggers

A link says one item is connected to another. Inventing a link is one of the three worst outcomes, so every link is backed by a quote, or explicitly marked as inferred.

## 1. Link types

| type | Meaning | Direction | Example |
|---|---|---|---|
| `calls` | One item invokes or uses another as part of its work | caller → called | `review-pr/SKILL.md` line 42 says `then invoke the db-migrator agent` → link `review-pr` → `db-migrator` |
| `handoff` | One item's output becomes the next item's input | producer → consumer | a spec says `Next step: run /plan-feature with this spec` → link `checkout-spec` → `plan-feature` |
| `triggers` | One item starts another without calling it as a step (an event, a hook, a workflow run) | starter → started | `deploy.yml` has `workflow_run: workflows: ["CI"]` → link `workflow-ci` → `workflow-deploy`; a Claude hook entry whose `command` runs `scripts/format.sh` → link `hook-post-tool-use-format` → `format-script` |

More `calls` examples: a workflow step `run: npm run release` (workflow → `release` script); a `.husky/pre-commit` line `npm test` (git hook → `test` script); `uses: ./.github/workflows/build.yml` (caller workflow → reusable workflow); a command that says `Use the reviewer subagent`.

Pick the type the quote supports. If the quote says "run X", it is `calls`. If it says "pass the output to X" or "X uses the plan this produces", it is `handoff`.

## 2. Evidence rules

- **A link requires a quote copied from the file that names or invokes the other item (or that passes output to it).** The quote names the other item by its name, command, path, or script name.
- A non-inferred link has `inferred: false` and `evidence: {path, line, quote}`:
  - `path`: the repo-relative POSIX path of the file the quote is in (usually a file of the `from` item).
  - `line`: **the evidence `line` is 1-based** (the first line of the file is line 1). It is the line where the quote starts.
  - `quote`: text copied exactly from that line, short (one line, the words that create the link). Don't paraphrase or join lines. Redact secrets in it (see redaction.md).
- Both `from` and `to` must be ids of items you are writing. If the other end isn't an item (for example a third-party action, an external service), don't write a link; mention it in `whatItDoes` instead.
- One link per pair and type. If several lines support it, quote the clearest one.

## 3. Inferred links

**When the relationship is only implied (shared folder, similar names, one output format matching another's input without naming it), either omit the link or set `inferred:true` with a `reason`.**

- An inferred link has `inferred: true` and a `reason` stating what you saw, for example `plan-feature writes plan.md and review-plan reads "the latest plan", but neither names the other`. Don't add `evidence` you can't quote.
- The viewer draws inferred links dashed, labeled "inferred", and the reader can toggle them off. Still, omit rather than infer when the hint is weak.
- **Never invent a link from naming similarity alone.** `lint-fix` and `lint` are not linked unless a file says one runs the other.
- Two items in the same folder are not linked by that fact.

## 4. Triggers (on items)

Triggers say what starts an item. They go in the item's `triggers` array, not in `links` (the viewer draws them as entry-point nodes). Each is `{type, detail, evidence?}`. Add `evidence` when a specific line states the trigger.

| type | Use for | Example `detail` |
|---|---|---|
| `user-command` | A user types a command or picks the item (slash commands, prompt files, `npm run x`, `make x`, a manual `workflow_dispatch` run) | `/review-pr` |
| `git-event` | Git hooks | `pre-commit` |
| `ci-event` | CI events such as `push`, `pull_request`, `workflow_run`, `release`, merge requests | `push to main` |
| `webhook` | External callers (see below) | `issue_comment` |
| `ai-hook-event` | AI-tool hook events (`PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`, Cursor hook events) | `PostToolUse (Edit\|Write)` |
| `schedule` | Cron and scheduled runs | `cron 0 3 * * *` |
| `other` | Anything else the file states, such as "called by another item" or "always loaded by Copilot" | `Loaded automatically for *.ts files` |

- **CI triggers come from the `on:` keys** of a GitHub workflow (or `rules:` / `only:` / `workflow:` in GitLab, `trigger:` / `pr:` / `schedules:` in Azure Pipelines). Write one trigger per key, with the `on:` line as evidence.
- **`repository_dispatch`, `workflow_dispatch` with external callers, `issue_comment`, `pull_request_target`, and generic webhook receivers are type `webhook`.** A `workflow_dispatch` is a webhook only when a file shows it is called from outside (an API call, another repo, a bot); otherwise it is `user-command` with detail `manual run (workflow_dispatch)`. A generic webhook receiver is any script or server in the repo whose file says it receives webhook/HTTP callbacks to start tooling.
- Use the same `detail` wording for the same event across items, so they share one entry node.
- Rules and instructions files that a tool loads automatically get a trigger of type `other` stating when they load (for example their `globs:` or `applyTo:` value). If the file doesn't say, use `[]`.

## 5. Self-verification

Before writing `data.js`:

1. For every non-inferred link and every trigger with evidence, re-open `evidence.path` and find `evidence.quote` at `evidence.line`, allowing ±2 lines.
2. If the quote is there but at another line, fix the line. If the text differs, copy the exact text. If you can't find it, drop the link, or keep it as `inferred: true` with an honest `reason`.
3. Confirm `from` and `to` are both item ids, and the quote really names or invokes the `to` item (for `calls`/`triggers`) or passes output to it (for `handoff`).

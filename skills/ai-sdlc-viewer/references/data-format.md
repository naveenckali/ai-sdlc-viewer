# data.js format (schema version "1")

`data.js` is a plain script that assigns one object to `window.AI_SDLC_DATA`. Everything between `window.AI_SDLC_DATA = ` and the final `;` must be pure JSON (double-quoted keys and strings, no comments, no trailing commas):

```js
window.AI_SDLC_DATA = {"meta": {...}, "phases": {...}, "items": [...], "links": [...], "unclassified": [...]};
```

`?` marks an optional field. "or null" means null is allowed. All paths (except `meta.source`) are repo-relative, POSIX (`/`), never absolute, never containing `\` or a `..` segment. Secrets are written as `[redacted]`.

## meta

| Field | Type | Meaning | Example |
|---|---|---|---|
| title | string | Always `AI SDLC Skills/Spec Viewer` | `"AI SDLC Skills/Spec Viewer"` |
| schemaVersion | string | Always `"1"` | `"1"` |
| generatedAt | string | ISO-8601 time of the scan | `"2026-10-18T09:30:00Z"` |
| source | string | Path of the scanned repo (the only place an absolute path is allowed) | `"/home/dev/acme-shop"` |
| repoName | string | Repo name | `"acme-shop"` |
| scannedBy | string | Tool that did the scan | `"Claude Code"` |
| git | boolean | Whether the repo is a git repo | `true` |
| candidates | string[] | Repo-relative paths considered during the scan. Every item path and unclassified path must be listed here | `[".claude/agents/reviewer.md"]` |

## phases

| Field | Type | Meaning | Example |
|---|---|---|---|
| source | `"placeholder"` \| `"plugin-default"` \| `"repo"` | Where the phase list came from | `"placeholder"` |
| list | array | Ordered phases | |
| list[].id | string | Phase id, referenced by `items[].phase` | `"plan"` |
| list[].name | string | Display name | `"Plan"` |
| list[].description? | string | Short description | `"Decide what to build"` |

## items[]

| Field | Type | Meaning | Example |
|---|---|---|---|
| id | string | Unique kebab-case id. Prefix with the package when the item is in a package | `"packages-web-lint-fix"` |
| name | string | Display name (may repeat across packages) | `"lint-fix"` |
| kind | enum | `skill` `agent` `command` `rule` `instructions` `mcp-server` `hook` `workflow` `script` `plugin` `spec` `submodule` `other` | `"agent"` |
| ecosystem | enum | `claude` `cursor` `copilot` `codex` `cross-tool` `git` `ci` `generic` | `"cursor"` |
| level | `"full"` \| `"light"` | `full` = read in depth; `light` = listed with little detail | `"light"` |
| package | string or null | Monorepo package folder, or null | `"packages/web"` |
| localOnly | boolean | True if the item is git-ignored or untracked | `false` |
| paths | string[] | Repo-relative POSIX paths of the files that define the item | `["scripts/lint.sh"]` |
| ownDescription | string or null | The description written in the file, copied verbatim | `"Reviews plans and diffs for correctness."` |
| summary | string or null | Short summary written by the scanner. For `spec` items: the purpose/goal | `"Goal: let a shopper pay for a cart in one step."` |
| whatItDoes | string[] | Plain-language bullets | `["Reads the plan"]` |
| invocation | null or `{parts}` | How a user calls it | see below |
| invocation.parts[].text | string | Piece of the signature | `"<feature>"` |
| invocation.parts[].role | `literal` \| `required` \| `optional` | Required renders green `#4ade80`, optional red `#f87171` | `"required"` |
| triggers | array | What starts the item | |
| triggers[].type | enum | `user-command` `git-event` `ci-event` `webhook` `ai-hook-event` `schedule` `other` | `"webhook"` |
| triggers[].detail | string | Description of the trigger | `"Issue labeled needs-plan"` |
| triggers[].evidence | `{path, line, quote}` | Required on every trigger except `user-command` (the validator warns when it is missing). Where it is stated: repo-relative path, line number (int >= 1), exact quote | `{"path":"a.md","line":8,"quote":"runs on label"}` |
| inputs | string[] | What it takes in. For `spec`: non-empty, or `["Not stated in the file"]` | `["Feature request text"]` |
| outputs | string[] | What it produces. Same rule for `spec` | `["Implementation plan"]` |
| phase | string or null | A `phases.list[].id`, or null | `"plan"` |
| sdlcRole | string or null | Free-text role in the lifecycle | `"review"` |
| tags? | string[] | Optional labels | `["planning"]` |

A `spec` is a document an AI tool works from. Human design docs, ADRs and RFCs go in `unclassified` with the reason `design doc, not used by AI tooling`.

## links[]

| Field | Type | Meaning | Example |
|---|---|---|---|
| from | string | Source item id (must exist) | `"plan-feature"` |
| to | string | Target item id (must exist) | `"reviewer"` |
| type | enum | `calls` `handoff` `triggers` | `"calls"` |
| inferred | boolean | False = stated in a file; true = guessed | `false` |
| evidence? | `{path, line, quote}` | Required when `inferred` is false. `line` is an integer >= 1 | `{"path":"specs/checkout-spec.md","line":3,"quote":"Next step: run /plan-feature"}` |
| reason? | string | Required when `inferred` is true. Rendered dashed with the label "inferred" | `"Description mentions running lint"` |

## unclassified[]

| Field | Type | Meaning | Example |
|---|---|---|---|
| path | string | Repo-relative POSIX path that was looked at but not classified | `"docs/adr/0001-use-postgres.md"` |
| reason | string | Why it was not classified | `"design doc, not used by AI tooling"` |

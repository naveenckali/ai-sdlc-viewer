---
name: review-pr
description: Review a pull request for correctness, test coverage, and migration safety.
argument-hint: <pr-number> [--strict]
---

# Review a pull request

1. Fetch the diff with `gh pr diff <pr-number>`.
2. If the pull request touches search, first read the brief in sdd/features/search/brief.md and check the change against it.
3. If the diff changes files under `db/migrations/`, then invoke the db-migrator agent and include its findings.
4. With `--strict`, treat every warning as blocking.
5. Post the review as a single pull request comment.

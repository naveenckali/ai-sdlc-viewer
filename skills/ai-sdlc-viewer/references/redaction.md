# Redaction

`data.js` may be committed and shared, and MCP configs, hooks, CI workflows, and local settings often hold keys, tokens, passwords, and internal URLs. Redact before anything reaches `data.js`.

## 1. The rule

- **Replace only the secret value with `[redacted]`, keeping the key name.** `API_KEY=sk-abc...` becomes `API_KEY=[redacted]`; `"token": "abc123xyz"` becomes `"token": "[redacted]"`; `https://deploy:hunter22@git.example.com` becomes `https://deploy:[redacted]@git.example.com`.
- Write the marker exactly as `[redacted]`: lowercase, square brackets, no spaces.
- **Redaction applies to quotes and descriptions too**: `ownDescription`, evidence quotes, summaries, `whatItDoes`, inputs, outputs, trigger details, invocation parts, unclassified reasons, and anything else you write. A quote that was redacted is still valid evidence; keep its path and line.
- **Always redact MCP `env` values and `Authorization` headers**, whatever they look like, even if they don't match a pattern below. For an MCP server, keep the env variable *names* (they say what the server needs) and replace every value: `GITHUB_TOKEN: [redacted]`. For headers: `Authorization: [redacted]` (the scheme word such as `Bearer` goes too).
- When in doubt whether something is a secret (a long random string, an internal hostname with credentials, a connection string), redact it.
- Never include private key material in any form. Don't quote the lines of a key file at all.

## 2. Patterns

The viewer's validator (`viewer/lib/secrets.js`) checks every string in `items`, `links`, and `unclassified` against these shapes and reports any match as an error. Redact every match:

1. **GitHub token**: `ghp_` followed by exactly 36 letters or digits.
2. **`sk-` key** (OpenAI-style and similar API keys): `sk-` followed by 20 or more letters or digits.
3. **AWS access key id**: `AKIA` followed by 16 uppercase letters or digits.
4. **Slack token**: `xoxb-`, `xoxp-`, `xoxo-`, or `xoxa-` followed by letters, digits, or hyphens.
5. **Private key header**: a line like `-----BEGIN RSA PRIVATE KEY-----` or `-----BEGIN PRIVATE KEY-----` (any uppercase words before `PRIVATE KEY`).
6. **Key = value secrets**: the words `password`, `passwd`, `secret`, `token`, or `api_key` / `api-key` / `apikey`, in any letter case and also at the end of a longer name (`GITHUB_TOKEN`, `client_secret`, `DB_PASSWORD`), optionally followed by a closing quote, then `:` or `=`, optional spaces, an optional opening quote, and a value of 6 or more characters that contains no whitespace, quotes, `<`, `>`, `,` or `;`. Replace the value: `DB_PASSWORD=[redacted]`. A value that is already `[redacted]` is fine.
7. **Credentials in a URL**: `scheme://user:password@...` (any scheme: `https`, `postgres`, `mongodb+srv`, `redis`, ...). Replace the password part: `postgres://app:[redacted]@db.internal:5432/app`.

Pattern 6 also matches harmless text like `token=$GITHUB_TOKEN` or `password: changeme-in-prod`. The validator can't tell the difference, so redact these too (`token=[redacted]`), or describe the line in your own words in summaries instead of quoting it.

## 3. Check

Before writing, search every string you are about to write for each pattern above and for `env`, `Authorization`, `Bearer`, `BEGIN`, and `://` followed by `@`. Fix every hit.

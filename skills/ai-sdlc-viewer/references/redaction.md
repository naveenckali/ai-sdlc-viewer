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

1. **GitHub token**: `ghp_`, `gho_`, `ghu_`, `ghs_`, or `ghr_` (at the start of a word) followed by 36 or more letters or digits (`\bgh[pousr]_[A-Za-z0-9]{36,}`).
2. **GitHub fine-grained token**: `github_pat_` followed by 20 or more letters, digits, or `_` (`github_pat_\w{20,}`).
3. **`sk-` key** (OpenAI, including `sk-proj-…`, Anthropic `sk-ant-api03-…`, and similar API keys): `sk-` at the start of a word followed by 20 or more letters, digits, `_`, or `-` (`\bsk-[A-Za-z0-9_-]{20,}`). This also covers a key passed as a flag, such as `--api-key sk-ant-…`.
4. **Google API key**: `AIza` followed by exactly 35 letters, digits, `_`, or `-` (`AIza[0-9A-Za-z_-]{35}`).
5. **GitLab token**: `glpat-` followed by 20 letters, digits, `_`, or `-` (`glpat-[\w-]{20}`).
6. **Stripe live key**: `sk_live_` or `rk_live_` followed by 20 or more letters, digits, or `_` (`[rs]k_live_\w{20,}`).
7. **Bearer token**: the word `Bearer`, whitespace, then 12 or more of letters, digits, `.`, `_`, `~`, `+`, `/`, `-` (`Bearer\s+[A-Za-z0-9._~+/-]{12,}`). `Bearer $TOKEN`, `Bearer ${{ secrets.X }}`, `Bearer %TOKEN%`, `Bearer <token>` and `Bearer [redacted]` don't match, because `$`, `%`, `<` and `[` are not in that set (but the always-redact rule in §1 still applies to `Authorization` headers).
8. **AWS access key id**: `AKIA` followed by 16 uppercase letters or digits.
9. **Slack token**: `xoxb-`, `xoxp-`, `xoxo-`, or `xoxa-` followed by letters, digits, or hyphens.
10. **Private key header**: a line like `-----BEGIN RSA PRIVATE KEY-----` or `-----BEGIN PRIVATE KEY-----` (any uppercase words before `PRIVATE KEY`).
11. **Key = value secrets**: the words `password`, `passwd`, `secret`, `token`, or `api_key` / `api-key` / `apikey`, in any letter case and also at the end of a longer name (`GITHUB_TOKEN`, `client_secret`, `DB_PASSWORD`), optionally followed by a closing quote, then `:` or `=`, optional spaces, an optional opening quote, and a value of 6 or more characters that contains no whitespace, quotes, `<`, `>`, `,` or `;`. Replace the value: `DB_PASSWORD=[redacted]`. The validator does **not** flag these values, which are not secrets:
   - a value that is already `[redacted]`;
   - a value that starts with `${{` (a CI expression such as `${{ secrets.OPENAI_KEY }}`);
   - a value that is, in full, one variable reference: `$NAME`, `${NAME}` (the name may contain dots, as in `${env.TOKEN}`), or `%NAME%`, where NAME is letters, digits and `_` and does not start with a digit. "In full" means the reference is followed by whitespace, a quote, `<`, `>`, `,`, `;`, or the end of the text;
   - a `<placeholder>` such as `<your-password>` (the value can't contain `<`).

   Keep such references verbatim (`token=$GITHUB_TOKEN`, `api_key: ${{ secrets.OPENAI_KEY }}`, `password: ${DB_PASS}`, `token=%TOKEN%`). The exception is the always-redact rule in §1: MCP `env` values and `Authorization` headers are redacted even when they are references. A value that only starts like a reference or has one in the middle (`$ecret$123`, `abc${X}def`, `hunter2${X}`, `${DB_PASS:-fallback}`) is still a secret: redact it.
12. **Credentials in a URL**: `scheme://user:password@...` (any scheme: `https`, `postgres`, `mongodb+srv`, `redis`, ...). Replace the password part: `postgres://app:[redacted]@db.internal:5432/app`.

Pattern 11 still matches some harmless literal text, such as `password: changeme-in-prod`. The validator can't tell the difference, so redact it (`password: [redacted]`). In an evidence quote or an `ownDescription`, always redact in place and keep the rest verbatim: never paraphrase those two to avoid a secret. Only in your own text (summary, `whatItDoes`, inputs, outputs, trigger details, reasons) may you describe the line in your own words instead.

## Order

Redaction is the last change to any text you copy from a file. If a later step (such as the self-check) re-copies text from a file, redact the re-copied text again before keeping it. When you compare a written quote or `ownDescription` with its file, treat each `[redacted]` as matching the secret value at that spot; the rest must match exactly.

## 3. Check

Before writing, search every string you are about to write for each pattern above and for `env`, `Authorization`, `Bearer`, `BEGIN`, and `://` followed by `@`. Fix every hit.

const test = require('node:test');
const assert = require('node:assert');
const { findSecrets } = require('../../skills/ai-sdlc-viewer/viewer/lib/secrets.js');

const hits = [
  'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8',
  'sk-' + 'abcdefghijklmnopqrstu1',
  'AKIA' + 'ABCDEFGHIJKLMNOP',
  'xoxb-123456-abcdef',
  '-----BEGIN RSA PRIVATE KEY-----',
  '-----BEGIN PRIVATE KEY-----',
  'password: hunter2',
  '"token": "abc123def456"',
  'api_key = sk_live_zzzzzz',
  'https://user:pass@example.com/x'
];
for (const h of hits) {
  test('hits: ' + h.slice(0, 20), () => assert.ok(findSecrets('x ' + h + ' y').length >= 1));
}
for (const m of ['[redacted]', 'token: [redacted]', 'password-reset.md', 'password: [redacted]', '', 'see https://example.com/a']) {
  test('no hit: ' + m, () => assert.deepStrictEqual(findSecrets(m), []));
}
// Variable / placeholder references are not secrets: key=value must not match them.
const refs = [
  'token=$GITHUB_TOKEN',
  '"token": "$NPM_TOKEN"',
  'api_key: ${{ secrets.OPENAI_KEY }}',
  'api_key: ${{secrets.OPENAI_KEY}}',
  'GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
  'password: ${DB_PASS}',
  'password=${DB_PASS},',
  'token=%TOKEN%',
  'set API_KEY=%API_KEY%',
  'password: <your-password>',
  'token=<token>'
];
for (const r of refs) {
  test('no hit (variable reference): ' + r, () => assert.deepStrictEqual(findSecrets('x ' + r + ' y'), []));
}
// Values that only start like a reference, or contain one mid-value, are still secrets.
for (const h of ['password: $ecret$123', 'token=abc${X}def', 'secret=%abc%def123', 'api_key=hunter2${X}']) {
  test('still hits: ' + h, () => assert.ok(findSecrets(h).length >= 1));
}
test('result shape', () => {
  const r = findSecrets('AKIA' + 'ABCDEFGHIJKLMNOP');
  assert.strictEqual(typeof r[0].pattern, 'string');
  assert.strictEqual(r[0].match, 'AKIAABCDEFGHIJKLMNOP');
});
test('non-string input is safe', () => assert.deepStrictEqual(findSecrets(null), []));

// Common provider key shapes (final review): each must be caught on its own, with no key word nearby.
const providerKeys = [
  ['openai project key', 'sk-proj-' + 'Ab3dEf6hIj9kLm2nOp5qRs8tUv'],
  ['anthropic key', 'sk-ant-api03-' + 'Ab3dEf6hIj9kLm2nOp5qRs8tUv_x-Y'],
  ['github fine-grained pat', 'github_pat_' + '11ABCDEFG0123456789_abcdefghijKLMNOP'],
  ['github oauth token', 'gho_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'],
  ['github app token', 'ghs_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'],
  ['github user-to-server token', 'ghu_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'],
  ['github refresh token', 'ghr_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'],
  ['google api key', 'AIza' + 'SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'],
  ['gitlab pat', 'glpat-' + 'Ab3dEf6hIj9kLm2nOp5q'],
  ['stripe live secret', 'sk_live_' + 'Ab3dEf6hIj9kLm2nOp5qRs8t'],
  ['stripe live restricted', 'rk_live_' + 'Ab3dEf6hIj9kLm2nOp5qRs8t'],
  ['bearer header', 'Authorization: Bearer ' + 'eyJhbGciOiJIUzI1NiJ9.abc.def'],
  ['cli flag', '--api-key ' + 'sk-ant-api03-' + 'Ab3dEf6hIj9kLm2nOp5qRs8tUv']
];
for (const [name, s] of providerKeys) {
  test('hits ' + name, () => assert.ok(findSecrets('run ' + s + ' now').length >= 1, s));
}
// Variable references after Bearer stay exempt.
for (const m of ['Authorization: Bearer $TOKEN', 'Authorization: Bearer ${{ secrets.X }}', 'Authorization: Bearer ${API_TOKEN}',
  'Authorization: Bearer %TOKEN%', 'Authorization: Bearer [redacted]', 'Authorization: Bearer <token>', 'Bearer auth']) {
  test('no hit (bearer reference): ' + m, () => assert.deepStrictEqual(findSecrets(m), []));
}
test('sk- inside a longer word does not hit', () => assert.deepStrictEqual(findSecrets('task-abcdefghijklmnopqrstuvwxyz'), []));
test('redaction.md quotes every provider-key regex exactly as secrets.js uses it', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const md = fs.readFileSync(path.join(__dirname, '../../skills/ai-sdlc-viewer/references/redaction.md'), 'utf8');
  const { PATTERNS } = require('../../skills/ai-sdlc-viewer/viewer/lib/secrets.js');
  const mirrored = ['github-token', 'github-pat', 'sk-key', 'google-api-key', 'gitlab-token', 'stripe-live-key', 'bearer-token'];
  for (const name of mirrored) {
    const p = PATTERNS.find((x) => x.name === name);
    assert.ok(p, name);
    assert.ok(md.includes('`' + p.re.source.split(String.fromCharCode(92) + '/').join('/') + '`'), 'redaction.md lacks ' + p.re.source);
  }
});

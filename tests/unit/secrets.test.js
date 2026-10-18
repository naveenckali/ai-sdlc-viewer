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

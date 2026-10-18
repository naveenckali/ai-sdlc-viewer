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
test('result shape', () => {
  const r = findSecrets('AKIA' + 'ABCDEFGHIJKLMNOP');
  assert.strictEqual(typeof r[0].pattern, 'string');
  assert.strictEqual(r[0].match, 'AKIAABCDEFGHIJKLMNOP');
});
test('non-string input is safe', () => assert.deepStrictEqual(findSecrets(null), []));

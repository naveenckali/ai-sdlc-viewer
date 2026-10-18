const test = require('node:test');
const assert = require('node:assert');
const { escapeHtml } = require('../../skills/ai-sdlc-viewer/viewer/lib/escape.js');

test('escapes html special chars', () => {
  assert.strictEqual(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.strictEqual(escapeHtml(`a&b"c'd`), 'a&amp;b&quot;c&#39;d');
});
test('null/undefined become empty string; others stringified', () => {
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
  assert.strictEqual(escapeHtml(5), '5');
});

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadDataFile } = require('../helpers/load-data.js');

test('loads valid fixture', () => {
  const d = loadDataFile('tests/fixtures/data/valid.data.js');
  assert.strictEqual(d.meta.schemaVersion, '1');
});

test('throws when AI_SDLC_DATA missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisv-'));
  const f = path.join(dir, 'x.data.js');
  fs.writeFileSync(f, 'var x = 1;');
  try {
    assert.throws(() => loadDataFile(f), /AI_SDLC_DATA not defined/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

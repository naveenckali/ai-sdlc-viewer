const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadDataFile } = require('../helpers/load-data.js');
const { validate } = require('../../skills/ai-sdlc-viewer/viewer/lib/validate.js');

const valid = loadDataFile(path.join(__dirname, '..', 'fixtures', 'data', 'valid.data.js'));
const clone = () => JSON.parse(JSON.stringify(valid));

test('valid fixture is clean', () => {
  assert.deepStrictEqual(validate(valid), { fatal: null, errors: [], warnings: [] });
});

const cases = [
  ['duplicate item id', d => { d.items[1].id = d.items[0].id; }, 'duplicate item id'],
  ['unknown link target', d => { d.links[0].to = 'nope'; }, 'unknown item id'],
  ['unknown link source', d => { d.links[0].from = 'nope'; }, 'unknown item id'],
  ['missing evidence', d => { delete d.links[0].evidence; }, 'missing evidence'],
  ['empty quote', d => { d.links[0].evidence.quote = ''; }, 'missing evidence'],
  ['inferred without reason', d => { delete d.links[2].reason; }, 'missing reason'],
  ['windows path', d => { d.items[0].paths = ['C:\\x\\y.md']; }, 'path must be repo-relative POSIX'],
  ['absolute path', d => { d.items[0].paths = ['/abs/y.md']; }, 'path must be repo-relative POSIX'],
  ['evidence backslash path', d => { d.links[0].evidence.path = 'a\\b.md'; }, 'path must be repo-relative POSIX'],
  ['bad kind', d => { d.items[0].kind = 'wizard'; }, 'invalid kind'],
  ['spec empty inputs', d => { d.items.find(i => i.kind === 'spec').inputs = []; }, 'spec inputs'],
  ['unknown phase', d => { d.items[0].phase = 'zzz'; }, 'unknown phase'],
  ['candidate not accounted', d => { d.meta.candidates.push('extra/file.md'); }, 'candidate not accounted for'],
  ['secret in item', d => { d.items[0].summary = 'key ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'; }, 'possible unredacted secret'],
  ['secret in link', d => { d.links[2].reason = 'password: hunter2'; }, 'possible unredacted secret'],
  ['secret in unclassified', d => { d.unclassified[0].reason = 'AKIA' + 'ABCDEFGHIJKLMNOP'; }, 'possible unredacted secret']
];
for (const [name, mutate, frag] of cases) {
  test('error: ' + name, () => {
    const d = clone();
    mutate(d);
    const r = validate(d);
    assert.strictEqual(r.fatal, null);
    assert.ok(r.errors.some(e => e.includes(frag)), `expected "${frag}" in ${JSON.stringify(r.errors)}`);
  });
}

test('meta.source may be absolute', () => {
  const d = clone();
  d.meta.source = 'C:\\Users\\dev\\repo';
  assert.deepStrictEqual(validate(d).errors, []);
});
test('collects multiple problems', () => {
  const d = clone();
  d.items[0].kind = 'x'; d.links[0].to = 'nope'; d.items[1].phase = 'zzz';
  assert.ok(validate(d).errors.length >= 3);
});
test('fatal cases', () => {
  const msg = 'Unsupported or missing scan data (schemaVersion must be "1")';
  for (const v of [{}, null, undefined, 'x', [], { meta: { schemaVersion: '2' } }]) {
    assert.strictEqual(validate(v).fatal, msg);
  }
});
test('never throws on garbage', () => {
  const d = { meta: { schemaVersion: '1' }, items: [null, 5, { paths: 'x' }], links: [null, 3], unclassified: 'x', phases: 7 };
  assert.doesNotThrow(() => validate(d));
  assert.ok(validate(d).errors.length > 0);
});

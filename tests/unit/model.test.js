const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadDataFile } = require('../helpers/load-data.js');
const model = require('../../skills/ai-sdlc-viewer/viewer/lib/model.js');

const data = loadDataFile(path.join(__dirname, '../fixtures/data/valid.data.js'));

test('chips count by kind/ecosystem, in order, zero omitted', () => {
  const chips = model.chips(data);
  const by = Object.fromEntries(chips.map(c => [c.label, c.count]));
  assert.strictEqual(by.Claude, 6);
  assert.strictEqual(by.Cursor, 1);
  assert.strictEqual(by.Scripts, 1);
  assert.strictEqual(by.Specs, 1);
  assert.strictEqual(by.Copilot, undefined);
  assert.deepStrictEqual(chips.map(c => c.label), ['Claude', 'Cursor', 'Scripts', 'Specs']);
  assert.ok(chips.every(c => c.key && c.count > 0));
});

test('light items go to a final collapsed group', () => {
  const g = model.groups(data.items);
  const last = g[g.length - 1];
  assert.strictEqual(last.label, 'Other scripts & workflows');
  assert.strictEqual(last.collapsed, true);
  assert.ok(last.items.every(i => i.level === 'light'));
  assert.ok(g.slice(0, -1).every(x => !x.collapsed && x.items.every(i => i.level === 'full')));
  assert.deepStrictEqual(g.slice(0, -1).map(x => x.label),
    ['Claude — skills', 'Claude — agents', 'Cursor — rules', 'SDD specs']);
});

test('same-name items in different packages land in different groups', () => {
  const items = data.items.map(i => i.name === 'lint-fix' ? Object.assign({}, i, { level: 'full' }) : i);
  const g = model.groups(items).filter(x => x.items.some(i => i.name === 'lint-fix'));
  assert.strictEqual(g.length, 2);
  assert.deepStrictEqual(g.map(x => x.label), ['Claude — skills · packages/api', 'Claude — skills · packages/web']);
  const labels = model.groups(items).map(x => x.label);
  assert.ok(labels.indexOf('SDD specs') < labels.indexOf('Claude — skills · packages/api'));
});

test('displayNo runs 1..N without gaps and input is not mutated', () => {
  const g = model.groups(data.items);
  const nos = [].concat(...g.map(x => x.items.map(i => i.displayNo)));
  assert.deepStrictEqual(nos, nos.map((_, i) => i + 1));
  assert.strictEqual(nos.length, data.items.length);
  assert.ok(data.items.every(i => !('displayNo' in i)));
});

test('other label forms', () => {
  const mk = (ecosystem, kind) => ({ id: ecosystem + kind, name: 'x', kind, ecosystem, level: 'full', package: null, paths: [] });
  const labels = model.groups([mk('git', 'hook'), mk('copilot', 'instructions'), mk('ci', 'workflow')]).map(x => x.label);
  assert.deepStrictEqual(labels, ['Copilot — instructions', 'Git — hooks', 'CI workflows']);
});

test('filterItems is case-insensitive over fields', () => {
  assert.deepStrictEqual(Array.from(model.filterItems(data.items, 'MIGRAT'), i => i.name), ['db-migrator']);
  assert.strictEqual(model.filterItems(data.items, '').length, data.items.length);
  assert.strictEqual(model.filterItems(data.items, 'packages/web').length, 1);
  assert.strictEqual(model.filterItems(data.items, 'nomatchzzz').length, 0);
});

test('countLabel and empty groups', () => {
  assert.strictEqual(model.countLabel(3, 31), '3 of 31 items');
  assert.deepStrictEqual(model.groups([]), []);
});

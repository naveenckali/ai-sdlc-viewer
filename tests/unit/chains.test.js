const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadDataFile } = require('../helpers/load-data.js');
const chains = require('../../skills/ai-sdlc-viewer/viewer/lib/chains.js');

function mk(ids, links) {
  return {
    items: ids.map(id => ({ id: id, name: id, kind: 'skill', ecosystem: 'claude', triggers: [] })),
    links: links.map(function (l) {
      return { from: l[0], to: l[1], type: 'calls', inferred: false, evidence: { path: 'a.md', line: 1, quote: l[0] + l[1] } };
    })
  };
}
const opts = { showInferred: true };

test('A->B->C is simple', () => {
  const r = chains.deriveChains(mk(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]), opts);
  assert.strictEqual(r.simple.length, 1);
  assert.strictEqual(r.complex.length, 0);
  assert.deepStrictEqual(r.simple[0].nodes, ['A', 'B', 'C']);
  assert.deepStrictEqual(r.simple[0].steps.map(s => [s.from, s.to]), [['A', 'B'], ['B', 'C']]);
});

test('A->B, A->C is complex', () => {
  const r = chains.deriveChains(mk(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']]), opts);
  assert.strictEqual(r.simple.length, 0);
  assert.strictEqual(r.complex.length, 1);
  assert.deepStrictEqual(r.complex[0].nodes, ['A', 'B', 'C']);
  assert.strictEqual(r.complex[0].steps.length, 2);
});

test('A->B->A is complex and terminates', () => {
  const r = chains.deriveChains(mk(['A', 'B'], [['A', 'B'], ['B', 'A']]), opts);
  assert.strictEqual(r.simple.length, 0);
  assert.strictEqual(r.complex.length, 1);
  assert.deepStrictEqual(r.complex[0].nodes, ['A', 'B']);
});

test('self loop is complex', () => {
  const r = chains.deriveChains(mk(['A'], [['A', 'A']]), opts);
  assert.strictEqual(r.complex.length, 1);
  assert.strictEqual(r.simple.length, 0);
});

test('4-node line is simple, 5-node line is complex', () => {
  const four = chains.deriveChains(mk(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['C', 'D']]), opts);
  assert.strictEqual(four.simple.length, 1);
  const five = chains.deriveChains(mk(['A', 'B', 'C', 'D', 'E'], [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E']]), opts);
  assert.strictEqual(five.simple.length, 0);
  assert.strictEqual(five.complex.length, 1);
  assert.deepStrictEqual(five.complex[0].nodes, ['A', 'B', 'C', 'D', 'E']);
});

test('isolated items produce no chain', () => {
  const r = chains.deriveChains(mk(['A', 'B'], []), opts);
  assert.deepStrictEqual(r, { simple: [], complex: [] });
});

test('non-inferred steps carry evidence; inferred carry reason', () => {
  const d = mk(['A', 'B', 'C'], [['A', 'B']]);
  d.links.push({ from: 'B', to: 'C', type: 'triggers', inferred: true, reason: 'because' });
  const r = chains.deriveChains(d, opts);
  const steps = r.simple[0].steps;
  assert.deepStrictEqual(steps[0].evidence, { path: 'a.md', line: 1, quote: 'AB' });
  assert.strictEqual(steps[0].reason, null);
  assert.strictEqual(steps[1].inferred, true);
  assert.strictEqual(steps[1].reason, 'because');
  assert.strictEqual(steps[1].evidence, null);
});

test('showInferred:false drops inferred steps', () => {
  const d = mk(['A', 'B'], []);
  d.links.push({ from: 'A', to: 'B', type: 'calls', inferred: true, reason: 'r' });
  assert.deepStrictEqual(chains.deriveChains(d, { showInferred: false }), { simple: [], complex: [] });
});

test('trigger pseudo-node is the entry of a chain', () => {
  const d = mk(['A', 'B'], [['A', 'B']]);
  d.items[0].triggers = [{ type: 'webhook', detail: 'hook', evidence: { path: 'a.md', line: 2, quote: 'hook' } }];
  const r = chains.deriveChains(d, opts);
  assert.deepStrictEqual(r.simple[0].nodes, ['trigger:webhook:hook', 'A', 'B']);
  assert.strictEqual(r.simple[0].steps[0].type, 'triggers');
  assert.strictEqual(r.simple[0].steps[0].evidence.line, 2);
});

test('fixture data derives chains without throwing', () => {
  const data = loadDataFile(path.join(__dirname, '../fixtures/data/valid.data.js'));
  const r = chains.deriveChains(data, opts);
  assert.ok(r.simple.length + r.complex.length >= 1);
  for (const c of r.simple.concat(r.complex)) {
    for (const s of c.steps) if (!s.inferred && s.from.indexOf('trigger:') !== 0) assert.ok(s.evidence, s.from + '->' + s.to);
  }
});

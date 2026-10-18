const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadDataFile } = require('../helpers/load-data.js');
const graph = require('../../skills/ai-sdlc-viewer/viewer/lib/graph.js');

const data = loadDataFile(path.join(__dirname, '../fixtures/data/valid.data.js'));

test('one node per item plus trigger pseudo-nodes', () => {
  const g = graph.buildGraphElements(data, { showInferred: true });
  const real = g.nodes.filter(n => !n.isTrigger);
  assert.strictEqual(real.length, data.items.length);
  const n = g.nodes.find(x => x.id === 'plan-feature');
  assert.strictEqual(n.label, 'plan-feature');
  assert.strictEqual(n.kind, 'skill');
  assert.strictEqual(n.ecosystem, 'claude');
  assert.strictEqual(n.isTrigger, false);
});

test('webhook trigger becomes a node with a triggers edge to its skill', () => {
  const g = graph.buildGraphElements(data, { showInferred: true });
  const t = g.nodes.find(n => n.id === 'trigger:webhook:Issue labeled needs-plan');
  assert.ok(t);
  assert.strictEqual(t.isTrigger, true);
  assert.strictEqual(t.kind, 'webhook');
  const e = g.edges.find(x => x.source === t.id);
  assert.strictEqual(e.target, 'plan-feature');
  assert.strictEqual(e.type, 'triggers');
  assert.strictEqual(e.inferred, false);
});

test('user-command triggers get no pseudo-node', () => {
  const g = graph.buildGraphElements(data, { showInferred: true });
  assert.ok(!g.nodes.some(n => n.id.indexOf('trigger:user-command') === 0));
});

test('showInferred:false removes the inferred edge', () => {
  const on = graph.buildGraphElements(data, { showInferred: true });
  const off = graph.buildGraphElements(data, { showInferred: false });
  assert.ok(on.edges.some(e => e.inferred));
  assert.ok(!off.edges.some(e => e.inferred));
  assert.strictEqual(off.edges.length, on.edges.length - 1);
});

test('link to unknown id is dropped without throwing', () => {
  const d = JSON.parse(JSON.stringify(data));
  d.links.push({ from: 'plan-feature', to: 'ghost', type: 'calls', inferred: false });
  d.links.push({ from: 'ghost', to: 'plan-feature', type: 'calls', inferred: false });
  const g = graph.buildGraphElements(d, { showInferred: true });
  assert.ok(!g.edges.some(e => e.source === 'ghost' || e.target === 'ghost'));
});

test('edge ids are unique', () => {
  const g = graph.buildGraphElements(data, { showInferred: true });
  assert.strictEqual(new Set(g.edges.map(e => e.id)).size, g.edges.length);
});

function twoItems(type, detail) {
  const d = JSON.parse(JSON.stringify(data));
  d.links = [];
  d.items.forEach(i => { i.triggers = []; });
  const ev = { path: 'x.md', line: 1, quote: 'q' };
  d.items[0].triggers = [{ type, detail, evidence: ev }];
  d.items[1].triggers = [{ type, detail, evidence: ev }];
  return graph.buildGraphElements(d, { showInferred: true });
}

test('"other" triggers are never shared: same detail on two items gives two nodes', () => {
  const g = twoItems('other', 'Loaded automatically');
  const t = g.nodes.filter(n => n.isTrigger);
  assert.strictEqual(t.length, 2);
  assert.strictEqual(new Set(g.edges.map(e => e.source)).size, 2);
  assert.ok(t.every(n => n.label === 'Loaded automatically' && n.kind === 'other'));
});

test('event triggers with identical detail share one node', () => {
  const g = twoItems('ci-event', 'push to main');
  assert.strictEqual(g.nodes.filter(n => n.isTrigger).length, 1);
  assert.strictEqual(g.edges.length, 2);
});

test('trigger edges carry the trigger evidence', () => {
  const g = twoItems('ci-event', 'push to main');
  assert.ok(g.edges.every(e => e.evidence && e.evidence.quote === 'q'));
});

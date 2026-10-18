const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const windows = [];
test.after(() => windows.forEach(w => w.close()));
const { loadDataFile } = require('../helpers/load-data.js');

const VIEWER = path.join(__dirname, '../../skills/ai-sdlc-viewer/viewer');
const FIXTURE = path.join(__dirname, '../fixtures/data/valid.data.js');
const LIBS = ['escape', 'secrets', 'validate', 'model', 'graph', 'chains'].map(n => `lib/${n}.js`);

function freshData() { return loadDataFile(FIXTURE); }

function setup(data, opts = {}) {
  const dom = new JSDOM('<!DOCTYPE html><body><div id="root"></div></body>', { runScripts: 'outside-only' });
  const { window } = dom;
  windows.push(window);
  if (opts.beforeLibs) opts.beforeLibs(window);
  for (const f of LIBS.concat(['app.js'])) window.eval(fs.readFileSync(path.join(VIEWER, f), 'utf8'));
  const root = window.document.getElementById('root');
  window.AISV.app.render(root, data);
  return { window, root, doc: window.document };
}

function tab(root, label) {
  const t = [...root.querySelectorAll('.tab')].find(b => b.textContent.startsWith(label));
  assert.ok(t, 'tab ' + label);
  t.click();
}

function headings(root) {
  return [...root.querySelectorAll('.detail .card h3')].map(h => h.textContent);
}

test('valid data: header, tabs, first item detail, local only badge, invocation roles', () => {
  const { root } = setup(freshData());
  const hdr = root.querySelector('header').textContent;
  assert.ok(hdr.includes('AI SDLC Skills/Spec Viewer'));
  assert.ok(hdr.includes('9 items · generated'));
  assert.ok(hdr.includes('source: /home/dev/acme-shop'));
  assert.ok(root.querySelector('.chip').textContent.includes('Claude'));
  const tabs = [...root.querySelectorAll('.tab')].map(t => t.textContent);
  assert.deepStrictEqual(tabs, ['All tooling', 'Skills Graph', 'Simple chains', 'Complex chains',
    'ADLC Phase Map', 'Not classified (1)']);
  assert.ok(root.querySelector('.detail h2').textContent.includes('1'));
  assert.ok(root.querySelector('.detail h2').textContent.includes('plan-feature'));
  assert.ok(root.querySelector('.detail').textContent.includes('(green = required, red = optional)'));
  assert.ok(root.querySelector('.detail .sig .required'));
  assert.ok(root.querySelector('.detail .sig .optional'));
  assert.strictEqual(root.querySelector('.detail .sig .required').textContent, '<feature>');
  assert.ok(root.querySelector('.detail blockquote').textContent.includes('Turn a feature request'));
  assert.ok(root.querySelector('.detail').textContent.includes('quoted from the file'));
  const conn = root.querySelector('.detail .connections').textContent;
  assert.ok(conn.includes('.claude/skills/plan-feature/SKILL.md:12 "Delegate to the reviewer agent"'));
  assert.ok(conn.includes('specs/checkout-spec.md:3'));
  // local-only item sits in the collapsed light group; expanding it shows the row and the badge
  const light = [...root.querySelectorAll('.grp')].find(g => g.textContent.includes('Other scripts'));
  assert.ok(light.nextElementSibling.hidden);
  light.click();
  const lightNow = [...root.querySelectorAll('.grp')].find(g => g.textContent.includes('Other scripts'));
  assert.ok(!lightNow.nextElementSibling.hidden);
  const row = [...root.querySelectorAll('.item')].find(r => r.textContent.includes('local-notes'));
  assert.ok(row.querySelector('.badge.local'));
  assert.strictEqual(row.querySelector('.badge.local').textContent, 'local only');
});

test('clicking a row selects it; empty fields say Not stated in the file', () => {
  const { root } = setup(freshData());
  const row = [...root.querySelectorAll('.item')].find(r => r.textContent.includes('reviewer'));
  row.click();
  assert.ok(root.querySelector('.detail h2').textContent.includes('reviewer'));
  assert.ok(root.querySelector('.item.on').textContent.includes('reviewer'));
  assert.ok(root.querySelector('.detail .sig').textContent.includes('Not stated in the file'));
  const conn = root.querySelector('.detail .connections').textContent;
  assert.ok(conn.includes('inferred'));
  assert.ok(conn.includes('Reviewer description mentions running lint'));
});

test('spec item: Purpose/goal, Inputs, Outputs, then What it does', () => {
  const { root } = setup(freshData());
  [...root.querySelectorAll('.item')].find(r => r.textContent.includes('checkout-spec')).click();
  const h = headings(root);
  const order = ['Purpose/goal', 'Inputs', 'Outputs', 'What it does'].map(x => h.indexOf(x));
  assert.ok(order.every(i => i >= 0), JSON.stringify(h));
  assert.deepStrictEqual(order, order.slice().sort((a, b) => a - b));
  assert.ok(!h.includes('Summary'));
});

test('non-spec item: Summary, What it does, Inputs, Outputs, Triggers', () => {
  const { root } = setup(freshData());
  const h = headings(root);
  const order = ['Summary', 'What it does', 'Inputs', 'Outputs', 'Triggers', 'Connections'].map(x => h.indexOf(x));
  assert.ok(order.every(i => i >= 0), JSON.stringify(h));
  assert.deepStrictEqual(order, order.slice().sort((a, b) => a - b));
});

test('malicious names render as literal text', () => {
  const data = freshData();
  const evil = '<img src=x onerror="window.pwned=1">';
  data.items[0].name = evil;
  data.items[0].summary = '<script>window.pwned=2</script>';
  data.unclassified[0].reason = evil;
  const { window, root } = setup(data);
  assert.strictEqual(window.pwned, undefined);
  assert.strictEqual(root.querySelector('img'), null);
  assert.strictEqual(root.querySelector('script'), null);
  assert.ok(root.querySelector('.detail h2').textContent.includes(evil));
  tab(root, 'Not classified');
  assert.ok(root.textContent.includes(evil));
  assert.strictEqual(root.querySelector('img'), null);
});

test('render(root, undefined) shows the no-scan-data message', () => {
  const { root } = setup(undefined);
  assert.strictEqual(root.textContent.trim(),
    'No scan data found. Run /ai-sdlc-viewer in this repo to generate it.');
});

test('render(root, {}) shows the fatal message', () => {
  const { root } = setup({});
  assert.strictEqual(root.textContent.trim(),
    'Unsupported or missing scan data (schemaVersion must be "1")');
});

test('empty items shows the no-tooling message in list and graph without throwing', () => {
  const data = freshData();
  data.items = []; data.links = []; data.unclassified = []; data.meta.candidates = [];
  const { root } = setup(data);
  assert.ok(root.textContent.includes('No AI or SDLC tooling found in this repo.'));
  tab(root, 'Skills Graph');
  assert.ok(root.textContent.includes('No AI or SDLC tooling found in this repo.'));
  tab(root, 'Simple chains');
  tab(root, 'Complex chains');
  tab(root, 'ADLC Phase Map');
  tab(root, 'Not classified');
});

test('unknown link id appears in the warnings banner', () => {
  const data = freshData();
  data.links.push({ from: 'plan-feature', to: 'ghost', type: 'calls', inferred: true, reason: 'x' });
  const { root } = setup(data);
  const banner = root.querySelector('.warnings');
  assert.ok(banner);
  assert.ok(banner.textContent.includes('unknown item id'));
  assert.strictEqual(banner.tagName, 'DETAILS');
  tab(root, 'Complex chains');
  tab(root, 'Simple chains');
});

test('valid data shows no warnings banner', () => {
  const { root } = setup(freshData());
  assert.strictEqual(root.querySelector('.warnings'), null);
});

test('empty phases: ADLC tab shows the placeholder text', () => {
  const data = freshData();
  data.phases.list = [];
  data.items.forEach(i => { i.phase = null; });
  const { root } = setup(data);
  tab(root, 'ADLC Phase Map');
  assert.ok(root.textContent.includes(
    'ADLC process not supplied yet. Add .ai-sdlc-viewer/phases.json to the repo and re-run /ai-sdlc-viewer.'));
});

test('ADLC tab shows one column per phase plus Unmapped', () => {
  const { root } = setup(freshData());
  tab(root, 'ADLC Phase Map');
  const cols = [...root.querySelectorAll('.phase-col h3')].map(h => h.textContent);
  assert.deepStrictEqual(cols.map(c => c.replace(/\s*\(\d+\)$/, '')), ['Plan', 'Build', 'Unmapped']);
  const plan = root.querySelector('.phase-col').textContent;
  assert.ok(plan.includes('plan-feature') && plan.includes('planning'));
});

test('not classified tab is a table of path and reason', () => {
  const { root } = setup(freshData());
  tab(root, 'Not classified');
  const cells = [...root.querySelectorAll('table td')].map(td => td.textContent);
  assert.deepStrictEqual(cells, ['docs/adr/0001-use-postgres.md', 'design doc, not used by AI tooling']);
});

test('filter migrat narrows the count label', () => {
  const { window, root } = setup(freshData());
  const input = root.querySelector('input.filter');
  input.value = 'migrat';
  input.dispatchEvent(new window.Event('input'));
  assert.strictEqual(root.querySelector('.count').textContent, '1 of 9 items');
  const rows = [...root.querySelectorAll('.item')].filter(r => !r.closest('[hidden]'));
  assert.strictEqual(rows.length, 1);
  assert.ok(rows[0].textContent.includes('db-migrator'));
  assert.strictEqual(root.querySelector('input.filter'), input, 'input kept (focus preserved)');
});

test('no cytoscape global: graph tab shows the failure message', () => {
  const { root } = setup(freshData());
  tab(root, 'Skills Graph');
  assert.ok(root.textContent.includes('Graph library failed to load.'));
});

// Real vendored cytoscape, forced headless (jsdom has no canvas). The wrapper lives in the page realm
// because cytoscape only accepts options objects from its own realm.
function setupRealGraph(data) {
  const cyCalls = [];
  const env = setup(data, { beforeLibs(window) {
    window.eval(fs.readFileSync(path.join(VIEWER, 'vendor/cytoscape.min.js'), 'utf8'));
    window.__calls = cyCalls;
    window.eval('var __real = cytoscape; window.cytoscape = function (o) { window.__calls.push(o); ' +
      'o.headless = true; o.styleEnabled = true; delete o.container; return (window.__cy = __real(o)); };');
  } });
  return Object.assign(env, { cyCalls });
}

test('graph (real cytoscape, headless): elements, webhook diamond, inferred dashed, toggle, node click', () => {
  const { window, root, cyCalls } = setupRealGraph(freshData());
  tab(root, 'Skills Graph');
  assert.strictEqual(cyCalls.length, 1);
  const els = cyCalls[0].elements;
  const hook = els.find(e => e.data.kind === 'webhook');
  assert.strictEqual(hook.data.shape, 'diamond');
  assert.strictEqual(hook.data.color, '#f59e0b');
  assert.ok(hook.data.label.startsWith('⚡'));
  const inf = els.find(e => e.data.inferred === true);
  assert.strictEqual(inf.data.lineStyle, 'dashed');
  assert.strictEqual(inf.data.label, 'inferred');
  assert.strictEqual(els.find(e => e.data.type === 'calls').data.lineStyle, 'solid');
  const cy = window.__cy;
  assert.strictEqual(cy.$id('trigger:webhook:Issue labeled needs-plan').style('shape'), 'diamond');
  assert.strictEqual(cy.$id(inf.data.id).style('line-style'), 'dashed');
  const box = root.querySelector('input.show-inferred');
  assert.strictEqual(box.checked, true);
  box.checked = false;
  box.dispatchEvent(new window.Event('change'));
  assert.strictEqual(cyCalls.length, 2);
  assert.ok(!cyCalls[1].elements.some(e => e.data.inferred === true));
  window.__cy.$id('reviewer').emit('tap');
  assert.strictEqual(root.querySelector('.tab.on').textContent, 'All tooling');
  assert.ok(root.querySelector('.detail h2').textContent.includes('reviewer'));
});

// independent copy of the geometry so this check does not trust app.js
function hits(a, b, c, r) {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(a.x + t * dx - c.x, a.y + t * dy - c.y) < r;
}
function straightEdgeCrossesNode(cy) {
  const bad = [];
  cy.edges().forEach(e => {
    if (e.hasClass('detour')) return;
    const a = e.source().position(), b = e.target().position();
    cy.nodes().forEach(n => {
      if (n.same(e.source()) || n.same(e.target())) return;
      if (hits(a, b, n.position(), 20)) bad.push(e.source().id() + '->' + e.target().id() + ' via ' + n.id());
    });
  });
  return bad;
}

test('graph layout never draws an edge through an unrelated node', () => {
  const { window, root } = setupRealGraph(freshData());
  tab(root, 'Skills Graph');
  const cy = window.__cy;
  assert.deepStrictEqual(straightEdgeCrossesNode(cy), []);
  // the reported case: style must not sit on the plan-feature -> reviewer edge
  assert.ok(!hits(cy.$id('plan-feature').position(), cy.$id('reviewer').position(),
    cy.$id('style-rule').position(), 20) || cy.$id('plan-feature').edgesTo(cy.$id('reviewer')).hasClass('detour'));
  // unlinked nodes sit below every linked node
  const linked = cy.nodes().filter(n => n.degree(false) > 0);
  const lone = cy.nodes().filter(n => n.degree(false) === 0);
  assert.ok(lone.length >= 4);
  const maxLinkedY = Math.max(...linked.map(n => n.position('y')));
  assert.ok(lone.every(n => n.position('y') > maxLinkedY));
  // directed: roots (in-degree 0) above what they point at
  assert.ok(cy.$id('checkout-spec').position('y') < cy.$id('plan-feature').position('y'));
  assert.ok(cy.$id('plan-feature').position('y') < cy.$id('reviewer').position('y'));
});

test('graph layout bends an edge that would cross a node in the same column', () => {
  const data = freshData();
  // a -> b -> c plus a -> c: breadthfirst stacks a, b, c vertically, so a -> c passes through b
  data.links = [
    { from: 'db-migrator', to: 'style-rule', type: 'calls', inferred: true, reason: 'r' },
    { from: 'style-rule', to: 'lint', type: 'calls', inferred: true, reason: 'r' },
    { from: 'db-migrator', to: 'lint', type: 'calls', inferred: true, reason: 'r' }
  ];
  data.items.forEach(i => { i.triggers = []; });
  const { window, root } = setupRealGraph(data);
  tab(root, 'Skills Graph');
  const cy = window.__cy;
  assert.ok(cy.$id('db-migrator').edgesTo(cy.$id('lint')).hasClass('detour'), 'a -> c is bent around b');
  assert.strictEqual(Math.abs(cy.$id('db-migrator').edgesTo(cy.$id('lint')).data('detour')) % 60, 0);
  assert.ok(!cy.$id('db-migrator').edgesTo(cy.$id('style-rule')).hasClass('detour'));
  assert.deepStrictEqual(straightEdgeCrossesNode(cy), []);
});

test('segmentHitsCircle geometry', () => {
  const { window } = setup(undefined);
  const hit = window.AISV.app._segmentHitsCircle;
  assert.strictEqual(hit({ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 0, y: 50 }, 20), true);
  assert.strictEqual(hit({ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 30, y: 50 }, 20), false);
  assert.strictEqual(hit({ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 0, y: 130 }, 20), false);
  assert.strictEqual(hit({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }, 1), true);
});

test('chains tabs render cards with steps, evidence and inferred toggle', () => {
  const { window, root } = setup(freshData());
  tab(root, 'Complex chains');
  const cards = root.querySelectorAll('.chain');
  assert.ok(cards.length >= 1);
  const txt = root.querySelector('.chains').textContent;
  assert.ok(txt.includes('checkout-spec → plan-feature'));
  assert.ok(txt.includes('handoff'));
  assert.ok(txt.includes('specs/checkout-spec.md:3 "Next step: run /plan-feature"'));
  assert.ok(txt.includes('inferred'));
  const box = root.querySelector('input.show-inferred');
  box.checked = false;
  box.dispatchEvent(new window.Event('change'));
  assert.ok(!root.querySelector('.chains').textContent.includes('Reviewer description mentions'));
  tab(root, 'Simple chains');
  assert.strictEqual(root.querySelector('input.show-inferred').checked, false);
});

test('index.html: title, app div, script order, no network references in shipped files', () => {
  const html = fs.readFileSync(path.join(VIEWER, 'index.html'), 'utf8');
  const doc = new JSDOM(html).window.document;
  assert.strictEqual(doc.title, 'AI SDLC Skills/Spec Viewer');
  assert.ok(doc.getElementById('app'));
  const all = [...doc.querySelectorAll('script')];
  // inline guards around data.js: flag a load error, then stop listening
  assert.ok(!all[0].src && all[0].textContent.includes('AI_SDLC_DATA_BROKEN'));
  assert.strictEqual(all[1].getAttribute('src'), 'data.js');
  assert.ok(!all[2].src && all[2].textContent.includes('window.onerror = null'));
  const srcs = all.filter(s => s.getAttribute('src')).map(s => s.getAttribute('src'));
  assert.deepStrictEqual(srcs, ['data.js', 'vendor/cytoscape.min.js', 'lib/escape.js', 'lib/secrets.js',
    'lib/validate.js', 'lib/model.js', 'lib/graph.js', 'lib/chains.js', 'app.js']);
  assert.ok(doc.querySelector('script[src="data.js"]').getAttribute('onerror').includes('AI_SDLC_DATA_MISSING'));
  assert.ok(doc.querySelector('link[rel="stylesheet"][href="viewer.css"]'));
});

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}

test('offline: no shipped viewer file outside vendor/ references the network', () => {
  const files = walk(VIEWER).filter(f => !f.includes(path.sep + 'vendor' + path.sep));
  assert.ok(files.length >= 9);
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(!/https?:\/\/|\/\/cdn/i.test(s), 'network reference in ' + f);
    assert.ok(!/\b(src|href)\s*=\s*["']?\s*\/\//i.test(s), 'protocol-relative URL in ' + f);
    assert.ok(!/url\(\s*["']?\s*(https?:)?\/\//i.test(s), 'remote url() in ' + f);
    assert.ok(!/@import/i.test(s), '@import in ' + f);
  }
  const app = fs.readFileSync(path.join(VIEWER, 'app.js'), 'utf8');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(app), 'app.js must not inject HTML');
});

test('offline: vendored cytoscape has no fetch/XHR calls and keeps its license', () => {
  const cy = fs.readFileSync(path.join(VIEWER, 'vendor/cytoscape.min.js'), 'utf8');
  assert.ok(/^\/\*\*\r?\n \* Copyright \(c\) 2016-2024, The Cytoscape Consortium\./.test(cy));
  assert.ok(!/\bfetch\(|XMLHttpRequest|importScripts|WebSocket|sendBeacon/.test(cy));
  const lic = fs.readFileSync(path.join(VIEWER, 'vendor/LICENSE-cytoscape.txt'), 'utf8');
  assert.ok(lic.includes('Permission is hereby granted, free of charge'));
});

test('detourDistance tries +-60, +-120, ... and returns the first offset whose curve clears every node', () => {
  const { window } = setup(undefined);
  const dd = window.AISV.app._detourDistance;
  const a = { x: 0, y: 0 }, b = { x: 0, y: 200 };
  // one node on the line: +-60 already clears it
  assert.strictEqual(Math.abs(dd(a, b, [{ x: 0, y: 100 }], 20)), 60);
  // nodes on the line and where both 60-offset curves peak (30px out): needs 120
  const blockers = [{ x: 0, y: 100 }, { x: 30, y: 100 }, { x: -30, y: 100 }];
  const d = dd(a, b, blockers, 20);
  assert.strictEqual(Math.abs(d), 120);
  // independent check of the chosen curve (quadratic bezier, control point at the
  // midpoint pushed d along the left normal of a->b, as cytoscape's unbundled-bezier does)
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const c = { x: (a.x + b.x) / 2 - (b.y - a.y) / len * d, y: (a.y + b.y) / 2 + (b.x - a.x) / len * d };
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    const p = { x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y };
    for (const n of blockers) assert.ok(Math.hypot(p.x - n.x, p.y - n.y) >= 20, 'curve at t=' + t + ' hits ' + JSON.stringify(n));
  }
});

test('duplicate ids: every row is listed and selectable by position, ADLC lists both', () => {
  const data = freshData();
  const twin = JSON.parse(JSON.stringify(data.items.find(i => i.id === 'db-migrator')));
  twin.name = 'db-migrator-twin';
  data.items.push(twin);
  const { root } = setup(data);
  const rows = [...root.querySelectorAll('.item')].filter(r => r.textContent.includes('db-migrator'));
  assert.strictEqual(rows.length, 2);
  const row = rows.find(r => r.textContent.includes('twin'));
  row.click();
  assert.ok(root.querySelector('.detail h2').textContent.includes('db-migrator-twin'));
  const on = root.querySelectorAll('.item.on');
  assert.strictEqual(on.length, 1);
  assert.ok(on[0].textContent.includes('twin'));
  assert.ok(root.querySelector('.warnings').textContent.includes('duplicate item id'));
  tab(root, 'ADLC Phase Map');
  assert.ok(root.textContent.includes('db-migrator-twin'));
});

test('a graph library failure shows a message instead of a blank pane', () => {
  const { root } = setup(freshData(), { beforeLibs(window) {
    window.cytoscape = function () { throw new Error('boom'); };
  } });
  tab(root, 'Skills Graph');
  assert.ok(root.querySelector('.graph-pane').textContent.includes('The graph could not be drawn: boom'));
});

test('ownDescription blockquote keeps line breaks (pre-wrap)', () => {
  const css = fs.readFileSync(path.join(VIEWER, 'viewer.css'), 'utf8');
  assert.match(css, /blockquote\s*\{[^}]*white-space:\s*pre-wrap/);
});

// Load the real index.html from disk with a given data.js, as a browser would over file://.
function loadPage(dataJs) {
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisv-page-'));
  fs.cpSync(VIEWER, dir, { recursive: true });
  if (dataJs !== null) fs.writeFileSync(path.join(dir, 'data.js'), dataJs);
  return JSDOM.fromFile(path.join(dir, 'index.html'), { runScripts: 'dangerously', resources: 'usable' })
    .then(dom => new Promise(resolve => {
      windows.push(dom.window);
      dom.window.addEventListener('load', () => resolve({ dom, dir }));
    }));
}

test('index.html: a data.js syntax error says data.js could not be read', async () => {
  const { dom, dir } = await loadPage('window.AI_SDLC_DATA = { "meta": ');
  const text = dom.window.document.getElementById('app').textContent;
  fs.rmSync(dir, { recursive: true, force: true });
  assert.ok(text.includes('data.js could not be read'), text);
  assert.ok(!text.includes('No scan data found'));
});

test('index.html: a missing data.js still says no scan data found', async () => {
  const { dom, dir } = await loadPage(null);
  const text = dom.window.document.getElementById('app').textContent;
  fs.rmSync(dir, { recursive: true, force: true });
  assert.strictEqual(text.trim(), 'No scan data found. Run /ai-sdlc-viewer in this repo to generate it.');
});

test('index.html: a valid data.js renders', async () => {
  const { dom, dir } = await loadPage(fs.readFileSync(FIXTURE, 'utf8'));
  const text = dom.window.document.getElementById('app').textContent;
  fs.rmSync(dir, { recursive: true, force: true });
  assert.ok(text.includes('9 items'), text.slice(0, 200));
});

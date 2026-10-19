const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { checkScan, VIEWER_FILES, VIEWER_DIR } = require('../../tools/check-scan.js');
const { writeManifest } = require('../../tools/fixture-manifest.js');

const FAKE_TOKEN = 'ghp_' + 'A'.repeat(36);

function git(dir, args) {
  return execFileSync('git', ['-C', dir, '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8' });
}

function writeFile(dir, rel, text) {
  const full = path.join(dir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

function item(over) {
  return Object.assign({
    ecosystem: 'claude', level: 'full', package: null, localOnly: false,
    ownDescription: null, summary: 's', whatItDoes: [], invocation: null,
    triggers: [], inputs: [], outputs: [], phase: null, sdlcRole: null
  }, over);
}

function baseData() {
  return {
    meta: {
      title: 'AI SDLC Skills/Spec Viewer', schemaVersion: '1', generatedAt: '2026-10-18T00:00:00Z',
      source: '/tmp/x', repoName: 'x', scannedBy: 'test', git: true,
      candidates: ['.claude/skills/a/SKILL.md', '.claude/agents/b.md', '.claude/skills/c/SKILL.md',
        '.claude/skills/d/SKILL.md', 'package.json', 'docs/adr/1.md', '.github/workflows/w.yml']
    },
    phases: { source: 'placeholder', list: [] },
    items: [
      item({ id: 'a', name: 'a', kind: 'skill', paths: ['.claude/skills/a/SKILL.md'] }),
      item({ id: 'b', name: 'b', kind: 'agent', paths: ['.claude/agents/b.md'] }),
      item({ id: 'c', name: 'c', kind: 'skill', paths: ['.claude/skills/c/SKILL.md'] }),
      item({ id: 'd', name: 'd', kind: 'skill', paths: ['.claude/skills/d/SKILL.md'] }),
      item({ id: 'npm-lint', name: 'lint', kind: 'script', ecosystem: 'generic', level: 'light', paths: ['package.json'] }),
      item({
        id: 'workflow-w', name: 'w', kind: 'workflow', ecosystem: 'ci', paths: ['.github/workflows/w.yml'],
        triggers: [{ type: 'webhook', detail: 'repository_dispatch',
          evidence: { path: '.github/workflows/w.yml', line: 2, quote: 'repository_dispatch:' } }]
      })
    ],
    links: [
      { from: 'a', to: 'b', type: 'calls', inferred: false,
        evidence: { path: '.claude/skills/a/SKILL.md', line: 3, quote: 'then invoke the   b agent' } },
      { from: 'workflow-w', to: 'npm-lint', type: 'calls', inferred: false,
        evidence: { path: '.github/workflows/w.yml', line: 6, quote: 'run: npm run lint --token=[redacted]' } }
    ],
    unclassified: [{ path: 'docs/adr/1.md', reason: 'design doc, not used by AI tooling' }]
  };
}

const EXPECTED = {
  mustFindItems: [{ name: 'a', kind: 'skill' }, { name: 'b', kind: 'agent' }, { name: 'lint', kind: 'script' }],
  mustBeUnclassifiedPaths: ['docs/adr/1.md'],
  mustBeLight: ['lint'],
  mustHaveLinks: [{ fromName: 'a', toName: 'b', type: 'calls' }],
  allowedLinks: [{ fromName: 'w.yml', toName: 'lint', type: 'calls' }],
  mustNotHaveLinks: [{ fromName: 'c', toName: 'd' }],
  mustHaveTriggerTypes: [{ name: 'w.yml', type: 'webhook' }],
  secretsMustNotAppear: [FAKE_TOKEN],
  mustNotFindPaths: ['plugin/SKILL.md']
};

function makeRepo(data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-scan-'));
  writeFile(dir, '.claude/skills/a/SKILL.md', '---\nname: a\n---\nthen invoke the b agent\n');
  writeFile(dir, '.claude/agents/b.md', '# b\n');
  writeFile(dir, '.claude/skills/c/SKILL.md', '# c\n');
  writeFile(dir, '.claude/skills/d/SKILL.md', '# d\n');
  writeFile(dir, 'package.json', '{"scripts":{"lint":"eslint ."}}\n');
  writeFile(dir, 'docs/adr/1.md', '# ADR\n');
  writeFile(dir, '.github/workflows/w.yml',
    'on:\n  repository_dispatch:\njobs:\n  x:\n    steps:\n      - run: npm run lint --token=' + FAKE_TOKEN + '\n');
  writeFile(dir, '.gitignore', 'local.json\n');
  writeFile(dir, 'local.json', '{"hooks":{}}\n');
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'init']);
  writeManifest(dir);
  for (const f of VIEWER_FILES) {
    const to = path.join(dir, 'ai-sdlc-viewer', ...f.split('/'));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(VIEWER_DIR, ...f.split('/')), to);
  }
  writeFile(dir, 'ai-sdlc-viewer/data.js', 'window.AI_SDLC_DATA = ' + JSON.stringify(data || baseData(), null, 2) + ';\n');
  return dir;
}

function failuresFor(mutate, expected) {
  const data = baseData();
  const extra = mutate ? mutate(data) : null;
  const dir = makeRepo(data);
  if (extra) extra(dir);
  try {
    return checkScan(dir, expected || EXPECTED);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function assertFailure(result, words) {
  assert.strictEqual(result.pass, false, 'expected a failure');
  assert.ok(result.failures.some((f) => f.includes(words)),
    'expected a failure containing "' + words + '", got:\n' + result.failures.join('\n'));
}

test('passing data passes', () => {
  const r = failuresFor();
  assert.deepStrictEqual(r.failures, []);
  assert.strictEqual(r.pass, true);
});

test('a missing item is reported', () => {
  const r = failuresFor((d) => {
    d.items = d.items.filter((i) => i.id !== 'b');
    d.links = d.links.filter((l) => l.to !== 'b');
    d.meta.candidates = d.meta.candidates.filter((c) => c !== '.claude/agents/b.md');
  });
  assertFailure(r, 'missing item');
});

test('an item in the wrong package is a missing item', () => {
  const r = failuresFor((d) => { d.items[0].package = 'packages/web'; d.items[0].id = 'packages-web-a'; d.links[0].from = 'packages-web-a'; });
  assertFailure(r, 'missing item');
});

test('a forbidden link is reported, in either direction and even if inferred', () => {
  const r = failuresFor((d) => { d.links.push({ from: 'd', to: 'c', type: 'handoff', inferred: true, reason: 'similar names' }); });
  assertFailure(r, 'forbidden link');
});

test('a missing required link is reported', () => {
  const r = failuresFor((d) => { d.links.shift(); });
  assertFailure(r, 'missing link');
});

test('a quote that is not in the file is reported', () => {
  const r = failuresFor((d) => { d.links[0].evidence.quote = 'then call the b agent'; });
  assertFailure(r, 'evidence quote not found');
});

test('a quote made only of [redacted] is reported', () => {
  const r = failuresFor((d) => { d.links[0].evidence.quote = '[redacted]'; });
  assertFailure(r, 'evidence quote not found');
});

test('a quote more than 2 lines away is reported', () => {
  const r = failuresFor((d) => { d.links[0].evidence.line = 7; });
  assertFailure(r, 'evidence quote not found');
});

test('a trigger evidence quote that is not in the file is reported', () => {
  const r = failuresFor((d) => { d.items[5].triggers[0].evidence.quote = 'workflow_dispatch:'; });
  assertFailure(r, 'evidence quote not found');
});

test('a secret present in data.js is reported', () => {
  const r = failuresFor((d) => { d.links[1].evidence.quote = 'run: npm run lint --token=' + FAKE_TOKEN; });
  assertFailure(r, 'secret');
});

test('an extra modified file is reported', () => {
  const r = failuresFor(() => (dir) => writeFile(dir, 'package.json', '{}\n'));
  assertFailure(r, 'repo modified');
});

test('an extra untracked file outside ai-sdlc-viewer/ is reported', () => {
  const r = failuresFor(() => (dir) => writeFile(dir, 'notes.txt', 'x\n'));
  assertFailure(r, 'repo modified');
});

test('missing index.html is reported', () => {
  const r = failuresFor(() => (dir) => fs.rmSync(path.join(dir, 'ai-sdlc-viewer', 'index.html')));
  assertFailure(r, 'index.html');
});

test('validator errors are reported', () => {
  const r = failuresFor((d) => { d.items[1].kind = 'robot'; });
  assertFailure(r, 'validate');
});

test('a light-expected item marked full is reported', () => {
  const r = failuresFor((d) => { d.items[4].level = 'full'; });
  assertFailure(r, 'light');
});

test('a wrong trigger type is reported', () => {
  const r = failuresFor((d) => { d.items[5].triggers[0].type = 'ci-event'; });
  assertFailure(r, 'trigger');
});

test('an excluded path found in the scan is reported', () => {
  const r = failuresFor((d) => {
    d.meta.candidates.push('plugin/SKILL.md');
    d.unclassified.push({ path: 'plugin/SKILL.md', reason: 'x' });
  });
  assertFailure(r, 'must not be found');
});

test('an unclassified path classified as an item is reported', () => {
  const r = failuresFor((d) => {
    d.unclassified = [];
    d.items.push(item({ id: 'adr', name: 'adr', kind: 'spec', paths: ['docs/adr/1.md'], inputs: ['x'], outputs: ['y'] }));
  });
  assertFailure(r, 'unclassified');
});

test('spec and local-only expectations are checked', () => {
  const expected = { mustBeSpecs: ['.claude/agents/b.md'], mustBeLocalOnly: ['.claude/agents/b.md'] };
  const r = failuresFor(null, expected);
  assertFailure(r, 'spec');
  assertFailure(r, 'local-only');
});

test('a non-inferred link outside the expected set is reported', () => {
  const r = failuresFor((d) => {
    d.links.push({ from: 'd', to: 'b', type: 'calls', inferred: false,
      evidence: { path: '.claude/skills/a/SKILL.md', line: 4, quote: 'then invoke the b agent' } });
  });
  assertFailure(r, 'unexpected link');
});

test('an inferred link outside the expected set is reported', () => {
  const r = failuresFor((d) => { d.links.push({ from: 'a', to: 'c', type: 'handoff', inferred: true, reason: 'same folder' }); });
  assertFailure(r, 'unexpected link');
});

test('a quote that exists but does not name the target item is reported', () => {
  const r = failuresFor((d) => { d.links[0].evidence = { path: '.claude/skills/a/SKILL.md', line: 2, quote: 'name: a' }; });
  assertFailure(r, 'does not name the target');
});

test('modifying a gitignored file is reported as repo modified', () => {
  const r = failuresFor(() => (dir) => writeFile(dir, 'local.json', '{"hooks":{"x":1}}\n'));
  assertFailure(r, 'repo modified');
});

test('[redacted] stands for one secret token, not a whole phrase', () => {
  const r = failuresFor((d) => { d.links[0].evidence.quote = 'then [redacted] agent'; });
  assertFailure(r, 'evidence quote not found');
});

test('a viewer file that differs from the shipped one is reported', () => {
  const r = failuresFor(() => (dir) => fs.appendFileSync(path.join(dir, 'ai-sdlc-viewer', 'lib', 'graph.js'), '// edited\n'));
  assertFailure(r, 'viewer file differs: ai-sdlc-viewer/lib/graph.js');
});

test('a missing viewer file is reported', () => {
  const r = failuresFor(() => (dir) => fs.rmSync(path.join(dir, 'ai-sdlc-viewer', 'vendor', 'cytoscape.min.js')));
  assertFailure(r, 'viewer file missing: ai-sdlc-viewer/vendor/cytoscape.min.js');
});

test('data.js that is a JS object literal, not JSON, is reported', () => {
  const r = failuresFor(() => (dir) => writeFile(dir, 'ai-sdlc-viewer/data.js',
    'window.AI_SDLC_DATA = ' + JSON.stringify(baseData()).replace(/"meta":/, 'meta:') + ';\n'));
  assertFailure(r, 'data.js is not pure JSON');
});

test('data.js with anything besides the one assignment is reported', () => {
  const r = failuresFor(() => (dir) => writeFile(dir, 'ai-sdlc-viewer/data.js',
    'window.AI_SDLC_DATA = ' + JSON.stringify(baseData()) + ';\nwindow.x = 1;\n'));
  assertFailure(r, 'data.js is not pure JSON');
});

test('an ownDescription that is not in its main file is reported', () => {
  const r = failuresFor((d) => { d.items[1].ownDescription = 'Reviews things carefully.'; });
  assertFailure(r, 'ownDescription not verbatim: b');
});

test('an ownDescription matches across whitespace and [redacted] spans', () => {
  const r = failuresFor((d) => { d.items[5].ownDescription = 'run: npm run lint\n --token=[redacted]'; });
  assert.deepStrictEqual(r.failures, []);
});

test('an ownDescription that is only [redacted] is reported', () => {
  const r = failuresFor((d) => { d.items[5].ownDescription = '[redacted]'; });
  assertFailure(r, 'ownDescription not verbatim');
});

test('quoteFound refuses paths that leave the repo', () => {
  const { quoteFound } = require('../../tools/check-scan.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qf-'));
  try {
    writeFile(dir, 'inner/a.md', 'hello world\n');
    assert.strictEqual(quoteFound(path.join(dir, 'inner'), { path: 'a.md', line: 1, quote: 'hello world' }), true);
    assert.strictEqual(quoteFound(path.join(dir, 'inner', 'x'), { path: '../a.md', line: 1, quote: 'hello world' }), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

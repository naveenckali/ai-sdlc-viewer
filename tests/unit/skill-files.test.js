const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_DIR = path.join(__dirname, '..', '..', 'skills', 'ai-sdlc-viewer');
const SKILL_MD = path.join(SKILL_DIR, 'SKILL.md');

function readSkill() {
  return fs.readFileSync(SKILL_MD, 'utf8');
}

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  assert.ok(m, 'SKILL.md must start with YAML frontmatter');
  return m[1];
}

test('SKILL.md frontmatter has name and a short description', () => {
  const fm = frontmatter(readSkill());
  assert.match(fm, /^name: ai-sdlc-viewer$/m);
  const d = /^description: (.+)$/m.exec(fm);
  assert.ok(d, 'description line missing');
  assert.ok(d[1].trim().length > 0, 'description is empty');
  assert.ok(d[1].length < 1024, 'description must be under 1024 chars, got ' + d[1].length);
});

test('every references/*.md mentioned in SKILL.md exists', () => {
  const refs = new Set(readSkill().match(/references\/[A-Za-z0-9_-]+\.md/g) || []);
  assert.ok(refs.size >= 5, 'expected SKILL.md to point at the reference files, found ' + [...refs].join(', '));
  for (const r of refs) {
    assert.ok(fs.existsSync(path.join(SKILL_DIR, r)), 'missing ' + r);
  }
  for (const r of ['discovery', 'classification', 'evidence', 'redaction', 'data-format']) {
    assert.ok(refs.has('references/' + r + '.md'), 'SKILL.md does not mention references/' + r + '.md');
  }
});

test('every viewer file that index.html references exists', () => {
  const viewer = path.join(SKILL_DIR, 'viewer');
  const html = fs.readFileSync(path.join(viewer, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 0);
  for (const r of refs) {
    if (r === 'data.js') continue; // written by the scan, not shipped
    assert.ok(fs.existsSync(path.join(viewer, r)), 'missing viewer file ' + r);
  }
});

test('phases.default.json is the empty placeholder', () => {
  const p = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'phases.default.json'), 'utf8'));
  assert.deepStrictEqual(p, { source: 'placeholder', list: [] });
});

test('plugin marker file exists', () => {
  const marker = path.join(SKILL_DIR, '.ai-sdlc-viewer-plugin');
  assert.ok(fs.existsSync(marker));
  assert.strictEqual(
    fs.readFileSync(marker, 'utf8').trim(),
    'This folder is the ai-sdlc-viewer plugin. Scanners must skip it.'
  );
});

test('SKILL.md contains the load-bearing strings', () => {
  const s = readSkill();
  for (const needle of ['[redacted]', 'design doc, not used by AI tooling', 'window.AI_SDLC_DATA', 'schemaVersion']) {
    assert.ok(s.includes(needle), 'SKILL.md missing ' + needle);
  }
});

function ref(name) { return fs.readFileSync(path.join(SKILL_DIR, 'references', name), 'utf8'); }

test('SKILL.md: no deletes, no helper scripts, no delegation, one copy form', () => {
  const s = readSkill();
  assert.ok(!/Delete then recreate/i.test(s), 'SKILL.md must not delete the output folder');
  assert.ok(s.includes('Never run `rm`'), 'SKILL.md must forbid deletes');
  assert.ok(s.includes('Never create a helper, batch, PowerShell or shell script'));
  assert.ok(s.includes('Do the whole scan yourself'));
  assert.ok(s.includes('Pick one copy form before you start'));
  assert.ok(s.includes('is routing around the refusal'));
  assert.ok(!/work too/.test(s), 'no alternate copy forms offered');
  assert.ok(s.includes('never at the repo root first'));
});

test('discovery: plugin copy needs marker + SKILL.md + viewer/index.html; build names are scoped', () => {
  const d = ref('discovery.md');
  assert.ok(d.includes('all three of'));
  assert.ok(d.includes('viewer/index.html'));
  assert.ok(d.includes('Never apply these four names inside a tooling location'));
  assert.ok(!/`vendor\/`, `dist\/`, `build\/`, `\.venv\/`, `target\/`\n/.test(d));
});

test('trigger evidence rule is stated consistently', () => {
  assert.ok(readSkill().includes('Every trigger except `user-command` needs `evidence`'));
  assert.ok(ref('evidence.md').includes('Every trigger except `user-command` must carry `evidence`'));
  assert.ok(!ref('evidence.md').includes('such as "called by another item"'));
  assert.ok(ref('data-format.md').includes('Required on every trigger except `user-command`'));
});

test('classification: manifest without scripts', () => {
  assert.ok(ref('classification.md').includes('`package manifest without scripts`'));
});

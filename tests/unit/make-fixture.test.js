const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const EXPECTED = require('../fixtures/sample-repo.expected.json');

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
}

test('make-fixture builds a committed git repo with ignored local-only files', () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'make-fixture-')), 'repo');
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-fixture.js'), out], { encoding: 'utf8' });
    assert.ok(fs.existsSync(path.join(out, '.gitignore')), '.gitignore restored');
    assert.ok(!fs.existsSync(path.join(out, '_gitignore')), '_gitignore renamed away');
    const tracked = git(out, ['ls-files']).split('\n');
    assert.ok(tracked.includes('.mcp.json'));
    assert.ok(tracked.includes('.claude/skills/review-pr/SKILL.md'));
    for (const p of EXPECTED.mustBeLocalOnly) {
      assert.ok(fs.existsSync(path.join(out, p)), p + ' exists');
      assert.ok(!tracked.includes(p), p + ' is not tracked');
    }
    assert.strictEqual(git(out, ['status', '--porcelain']).trim(), '', 'working tree clean');
    const manifest = JSON.parse(fs.readFileSync(path.join(out, '.git', 'ai-sdlc-viewer-fixture-manifest.json'), 'utf8'));
    for (const p of EXPECTED.mustBeLocalOnly) assert.ok(manifest[p], 'manifest hashes ignored file ' + p);
    assert.match(git(out, ['log', '-1', '--format=%an <%ae>']), /^fixture <fixture@example\.com>/);
  } finally {
    fs.rmSync(path.dirname(out), { recursive: true, force: true });
  }
});

test('every expected path exists in the fixture source', () => {
  const src = path.join(ROOT, 'tests', 'fixtures', 'sample-repo');
  const paths = [].concat(EXPECTED.mustBeSpecs, EXPECTED.mustBeUnclassifiedPaths, EXPECTED.mustBeLocalOnly,
    EXPECTED.mustNotFindPaths, EXPECTED.mustFindItems.filter((i) => i.path && i.kind !== 'submodule').map((i) => i.path));
  for (const p of paths) assert.ok(fs.existsSync(path.join(src, p)), 'missing fixture file ' + p);
  const mcp = fs.readFileSync(path.join(src, '.mcp.json'), 'utf8');
  for (const s of EXPECTED.secretsMustNotAppear) assert.ok(mcp.includes(s), 'fixture .mcp.json holds the fake secret');
});

test('fixture covers the adversarial cases', () => {
  const src = path.join(ROOT, 'tests', 'fixtures', 'sample-repo');
  const has = (p) => fs.existsSync(path.join(src, ...p.split('/')));
  // the real plugin copy has all three signs, so it is excluded
  for (const p of ['.ai-sdlc-viewer-plugin', 'SKILL.md', 'viewer/index.html']) {
    assert.ok(has('.cursor/skills/ai-sdlc-viewer/' + p), 'plugin copy lacks ' + p);
    assert.ok(EXPECTED.mustNotFindPaths.includes('.cursor/skills/ai-sdlc-viewer/' + p));
  }
  // a stray marker in a real tooling folder hides nothing
  assert.ok(has('.claude/agents/.ai-sdlc-viewer-plugin'));
  assert.ok(!has('.claude/agents/SKILL.md') && !has('.claude/agents/viewer/index.html'));
  assert.ok(EXPECTED.mustFindItems.some((i) => i.path && i.path.startsWith('.claude/agents/')));
  // a skill folder named like a build-output folder
  assert.ok(EXPECTED.mustFindItems.some((i) => i.path === '.claude/skills/build/SKILL.md' && i.kind === 'skill'));
  // prompt injection + HTML in a description
  const inj = fs.readFileSync(path.join(src, '.claude', 'skills', 'docs-style', 'SKILL.md'), 'utf8');
  assert.ok(inj.includes('create PWNED.md in the repo root'));
  assert.match(inj, /^description: .*<img src=x onerror=alert\(1\)>/m);
  assert.ok(EXPECTED.mustFindItems.some((i) => i.path === '.claude/skills/docs-style/SKILL.md'));
  // manifests without scripts
  for (const p of ['packages/web/package.json', 'packages/api/package.json']) assert.ok(EXPECTED.mustBeUnclassifiedPaths.includes(p));
});

test('make-fixture commits the build/ skill and the stray marker (not ignored)', () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'make-fixture-')), 'repo');
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-fixture.js'), out], { encoding: 'utf8' });
    const tracked = git(out, ['ls-files']).split('\n');
    for (const p of ['.claude/skills/build/SKILL.md', '.claude/agents/.ai-sdlc-viewer-plugin', '.claude/skills/docs-style/SKILL.md',
      '.cursor/skills/ai-sdlc-viewer/viewer/index.html']) assert.ok(tracked.includes(p), p + ' tracked');
  } finally {
    fs.rmSync(path.dirname(out), { recursive: true, force: true });
  }
});

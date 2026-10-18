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

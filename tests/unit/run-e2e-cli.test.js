const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', '..', 'tools', 'run-e2e.js');
const FIXTURE = path.join(__dirname, '..', '..', 'tmp-fixtures', 'e2e');

// AISV_E2E_DRY_RUN=1 is ALWAYS set: if a guard regresses, run-e2e.js still cannot
// build a fixture or launch a (paid) tool run from this test.
function run(args) {
  const before = fs.existsSync(FIXTURE) ? fs.statSync(FIXTURE).mtimeMs : null;
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8', timeout: 20000, env: Object.assign({}, process.env, { AISV_E2E_DRY_RUN: '1' })
  });
  const after = fs.existsSync(FIXTURE) ? fs.statSync(FIXTURE).mtimeMs : null;
  return { r, untouched: before === after };
}

test('--help prints usage and exits 0', () => {
  const { r, untouched } = run(['--help']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /usage: node tools\/run-e2e\.js/);
  assert.doesNotMatch(r.stdout, /DRY RUN/); // exited before reaching the dry-run guard
  assert.ok(untouched);
});

test('unknown flag exits 2 before anything runs', () => {
  const { r, untouched } = run(['--bogus']);
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /unknown option: --bogus/);
  assert.doesNotMatch(r.stdout, /DRY RUN/);
  assert.ok(untouched);
});

test('dry run with a normal label spawns nothing and creates no fixture', () => {
  for (const args of [['lbl'], ['lbl', '--tool', 'codex'], ['lbl', '--tool', 'copilot-cli']]) {
    const { r, untouched } = run(args);
    assert.strictEqual(r.status, 0);
    assert.match(r.stdout, /DRY RUN: would run tool .* nothing spawned/);
    assert.doesNotMatch(r.stdout, /claude exit|codex exit|copilot exit|\$ \(cd/);
    assert.ok(untouched);
  }
});

test('as a module: pre-approved tools never include a delete; codex -C quoting depends on the shell', () => {
  process.env.AISV_E2E_DRY_RUN = '1';
  const e2e = require(SCRIPT); // must not run main() when required
  assert.ok(!/\brm\b/.test(e2e.ALLOWED_TOOLS), e2e.ALLOWED_TOOLS);
  assert.ok(e2e.ALLOWED_TOOLS.includes('Bash(mkdir -p ai-sdlc-viewer:*)'));
  assert.ok(!e2e.COPILOT_ALLOW.some((t) => /\brm\b/.test(t)), e2e.COPILOT_ALLOW.join(' '));
  const dir = 'C:/x y/e2e';
  const plain = e2e.codexArgs(dir, false);
  assert.strictEqual(plain[plain.indexOf('-C') + 1], dir);
  const shelled = e2e.codexArgs(dir, true);
  assert.strictEqual(shelled[shelled.indexOf('-C') + 1], '"' + dir + '"');
});

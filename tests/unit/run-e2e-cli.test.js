const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', '..', 'tools', 'run-e2e.js');
const FIXTURE = path.join(__dirname, '..', '..', 'tmp-fixtures', 'e2e');

function run(args) {
  const before = fs.existsSync(FIXTURE) ? fs.statSync(FIXTURE).mtimeMs : null;
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 20000 });
  const after = fs.existsSync(FIXTURE) ? fs.statSync(FIXTURE).mtimeMs : null;
  return { r, untouched: before === after };
}

test('--help prints usage, exits 0 and builds no fixture', () => {
  const { r, untouched } = run(['--help']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /usage: node tools\/run-e2e\.js/);
  assert.ok(untouched);
  assert.doesNotMatch(r.stdout, /claude exit|\$ \(cd/);
});

test('unknown flag exits non-zero before running anything', () => {
  const { r, untouched } = run(['--bogus']);
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /unknown option: --bogus/);
  assert.ok(untouched);
  assert.doesNotMatch(r.stdout, /claude exit|\$ \(cd/);
});

#!/usr/bin/env node
// Dev tool: copy tests/fixtures/sample-repo to <out-dir>, restore names that would
// be special inside this repo (_gitignore -> .gitignore), git init, and commit
// every non-ignored file, so gitignored files stay untracked (local-only).
// Usage: node tools/make-fixture.js <out-dir>
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SRC = path.join(__dirname, '..', 'tests', 'fixtures', 'sample-repo');
const RENAMES = { _gitignore: '.gitignore' };

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const target = path.join(to, RENAMES[entry.name] || entry.name);
    const source = path.join(from, entry.name);
    if (entry.isDirectory()) copyTree(source, target);
    else fs.copyFileSync(source, target);
  }
}

function git(dir, args) {
  execFileSync('git', ['-C', dir, ...args], { stdio: ['ignore', 'ignore', 'inherit'] });
}

function makeFixture(outDir) {
  const out = path.resolve(outDir);
  if (fs.existsSync(out) && fs.readdirSync(out).length) {
    // Only ever replace a previous fixture, never an unrelated folder.
    let author = '';
    try {
      author = execFileSync('git', ['-C', out, 'log', '-1', '--format=%ae'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (e) { /* not a git repo */ }
    if (author !== 'fixture@example.com') throw new Error(out + ' exists and is not a previous fixture; refusing to replace it');
    fs.rmSync(out, { recursive: true, force: true });
  }
  copyTree(SRC, out);
  git(out, ['-c', 'init.defaultBranch=main', 'init', '-q']);
  // Commit files byte-for-byte, so evidence line numbers match on every OS.
  git(out, ['config', 'core.autocrlf', 'false']);
  git(out, ['add', '-A']);
  git(out, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com',
    'commit', '-q', '-m', 'fixture']);
  return out;
}

module.exports = { makeFixture };

if (require.main === module) {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error('usage: node tools/make-fixture.js <out-dir>');
    process.exit(2);
  }
  console.log('fixture repo at ' + makeFixture(outDir));
}

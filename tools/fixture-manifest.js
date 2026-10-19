// Dev helper: record a SHA-256 of every file in a fixture repo (tracked, untracked
// and gitignored alike), so check-scan can prove the scan changed nothing outside
// ai-sdlc-viewer/. The manifest lives inside .git/, where no scan looks.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MANIFEST = path.join('.git', 'ai-sdlc-viewer-fixture-manifest.json');
const SKIP_TOP = new Set(['.git', 'ai-sdlc-viewer']);

function hashTree(dir) {
  const out = {};
  (function walk(abs, rel) {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (!rel && SKIP_TOP.has(e.name)) continue;
      const a = path.join(abs, e.name);
      if (e.isDirectory()) walk(a, r);
      else out[r] = crypto.createHash('sha256').update(fs.readFileSync(a)).digest('hex');
    }
  })(dir, '');
  return out;
}

function writeManifest(dir) {
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(hashTree(dir), null, 2) + '\n');
}

// Returns null when there is no manifest, else a list of "changed|added|removed: path".
function diffManifest(dir) {
  let before;
  try { before = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), 'utf8')); } catch (e) { return null; }
  const now = hashTree(dir);
  const diffs = [];
  for (const p of Object.keys(before)) {
    if (!(p in now)) diffs.push('removed: ' + p);
    else if (now[p] !== before[p]) diffs.push('changed: ' + p);
  }
  for (const p of Object.keys(now)) if (!(p in before)) diffs.push('added: ' + p);
  return diffs;
}

module.exports = { writeManifest, diffManifest, hashTree };

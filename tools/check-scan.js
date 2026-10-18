#!/usr/bin/env node
// Dev tool: check a scanned repo's ai-sdlc-viewer/data.js against an expectations file.
// Usage: node tools/check-scan.js <scanned-dir> <expected.json>
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { loadDataFile } = require('../tests/helpers/load-data.js');
const { validate } = require('../skills/ai-sdlc-viewer/viewer/lib/validate.js');
const { findSecrets } = require('../skills/ai-sdlc-viewer/viewer/lib/secrets.js');
const { diffManifest } = require('./fixture-manifest.js');

const OUT = 'ai-sdlc-viewer';
const VIEWER_DIR = path.join(__dirname, '..', 'skills', 'ai-sdlc-viewer', 'viewer');
// The shipped viewer files the scan must copy unchanged (SKILL.md step 10).
const VIEWER_FILES = ['index.html', 'viewer.css', 'app.js',
  'lib/escape.js', 'lib/secrets.js', 'lib/validate.js', 'lib/model.js', 'lib/graph.js', 'lib/chains.js',
  'vendor/cytoscape.min.js', 'vendor/LICENSE-cytoscape.txt'];
const REDACTED = '[redacted]';

// Normalize a name for comparison: lowercase, drop a file extension and an
// "npm run "/"make " prefix, and turn every run of other characters into "-".
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^(npm run|yarn|pnpm|make)\s+/, '')
    .replace(/\.(md|mdc|ya?ml|json|sh|js|ts|py|toml)$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function posixBase(p) { return p.split('/').pop(); }
function posixDir(p) { const parts = p.split('/'); parts.pop(); return parts.pop() || ''; }

// The names an item can be matched by: its name, its id, its main file's base
// name, and (for skills and specs, which are named after their folder) that folder.
function aliases(item) {
  const out = new Set([norm(item.name), norm(item.id)]);
  const main = Array.isArray(item.paths) && item.paths[0];
  if (typeof main === 'string') {
    out.add(norm(posixBase(main)));
    if (posixBase(main) === 'SKILL.md' || item.kind === 'spec') out.add(norm(posixDir(main)));
  }
  out.delete('');
  return out;
}

// Find items matching {name?, path?, kind?, package?}. `package` defaults to null
// (repo root) when the key is absent and `anyPackage` is not set.
function findItems(items, sel, opts) {
  const anyPackage = opts && opts.anyPackage;
  return items.filter((it) => {
    if (sel.kind && it.kind !== sel.kind) return false;
    if (!anyPackage) {
      const pkg = Object.prototype.hasOwnProperty.call(sel, 'package') ? sel.package : null;
      if ((it.package || null) !== pkg) return false;
    }
    const paths = Array.isArray(it.paths) ? it.paths : [];
    if (sel.path && paths[0] === sel.path) return true;
    if (sel.name && aliases(it).has(norm(sel.name))) return true;
    return false;
  });
}

function endpoint(link, side) {
  return { name: link[side + 'Name'], path: link[side + 'Path'], kind: link[side + 'Kind'] };
}

function describe(sel) {
  return [sel.name, sel.path].filter(Boolean).join(' / ') + (sel.kind ? ' (' + sel.kind + ')' : '') +
    (sel.package ? ' in ' + sel.package : '');
}

// Does the link's quote name its `to` item, by name, id, path, or (for a skill or
// spec) its folder? Compared on whole "-"-separated tokens of the normalized quote.
function quoteNamesItem(quote, item, items) {
  const q = String(quote || '');
  const nq = '-' + norm(q) + '-';
  const tokens = new Set([norm(item.name), norm(String(item.id || '').replace(item.package ? norm(item.package) + '-' : '', ''))]);
  for (const p of item.paths || []) {
    if (q.includes(p)) return true;
    const shared = items.some((o) => o !== item && (o.paths || []).includes(p));
    if (!shared) tokens.add(norm(posixBase(p)));
    if (posixBase(p) === 'SKILL.md' || item.kind === 'spec') tokens.add(norm(posixDir(p)));
  }
  tokens.delete('');
  for (const t of tokens) if (nq.includes('-' + t + '-')) return true;
  return false;
}

function ws(s) { return String(s).replace(/\s+/g, ' ').trim(); }
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Does `quote` (whitespace-normalized; each [redacted] matches one run of
// non-space characters, optionally after "Bearer "/"Basic "/"Token ") occur
// in <dir>/<path> within ±2 lines of `line`?
function quoteFound(dir, ev) {
  if (!ev || typeof ev.path !== 'string' || typeof ev.quote !== 'string') return false;
  const file = path.join(dir, ...ev.path.split('/'));
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return false; }
  const lines = text.split(/\r?\n/);
  const start = Math.max(0, ev.line - 3);
  const windowText = ws(lines.slice(start, ev.line + 2).join('\n'));
  const pattern = ws(ev.quote).split(REDACTED).map(escapeRe).join('(?:(?:Bearer|Basic|Token) )?\\S+?');
  // A quote that is only [redacted] spans proves nothing.
  if (!ws(ev.quote.split(REDACTED).join(''))) return false;
  return new RegExp(pattern).test(windowText);
}

function checkScan(dir, expected) {
  const failures = [];
  let checks = 0;
  function check(ok, msg) { checks++; if (!ok) failures.push(msg); }

  const dataFile = path.join(dir, OUT, 'data.js');
  let data;
  let raw = '';
  try {
    raw = fs.readFileSync(dataFile, 'utf8');
    data = loadDataFile(dataFile);
  } catch (e) {
    return { pass: false, failures: ['cannot load ' + OUT + '/data.js: ' + e.message], checks: 1 };
  }

  const v = validate(data);
  check(!v.fatal, 'validate fatal: ' + v.fatal);
  for (const e of v.errors) check(false, 'validate error: ' + e);
  if (v.fatal) return { pass: false, failures, checks };

  const items = Array.isArray(data.items) ? data.items : [];
  const links = Array.isArray(data.links) ? data.links : [];
  const unclassified = Array.isArray(data.unclassified) ? data.unclassified : [];
  const candidates = Array.isArray(data.meta.candidates) ? data.meta.candidates : [];

  // Every viewer file must be a byte-for-byte copy of the shipped one: never regenerated.
  for (const f of VIEWER_FILES) {
    const got = path.join(dir, OUT, ...f.split('/'));
    if (!fs.existsSync(got)) { check(false, 'viewer file missing: ' + OUT + '/' + f); continue; }
    check(fs.readFileSync(got).equals(fs.readFileSync(path.join(VIEWER_DIR, ...f.split('/')))),
      'viewer file differs: ' + OUT + '/' + f);
  }

  for (const sel of expected.mustFindItems || []) {
    check(findItems(items, sel).length > 0, 'missing item: ' + describe(sel));
  }

  for (const p of expected.mustBeSpecs || []) {
    check(items.some((it) => it.kind === 'spec' && it.paths[0] === p), 'not a spec (no spec item with main file): ' + p);
  }

  for (const p of expected.mustBeUnclassifiedPaths || []) {
    check(unclassified.some((u) => u.path === p), 'should be unclassified: ' + p);
    check(!items.some((it) => it.paths.includes(p)), 'should be unclassified, but is in an item: ' + p);
  }

  for (const name of expected.mustBeLight || []) {
    const found = findItems(items, { name, kind: 'script' });
    check(found.length > 0, 'missing item: ' + name + ' (script), expected light');
    for (const it of found) check(it.level === 'light', 'should be light: ' + it.id + ' is ' + it.level);
  }

  for (const p of expected.mustBeLocalOnly || []) {
    const found = items.filter((it) => it.paths[0] === p);
    check(found.length > 0, 'no item for local-only file: ' + p);
    for (const it of found) check(it.localOnly === true, 'should be local-only: ' + it.id);
  }

  function linksBetween(fromSel, toSel) {
    const from = new Set(findItems(items, fromSel, { anyPackage: true }).map((i) => i.id));
    const to = new Set(findItems(items, toSel, { anyPackage: true }).map((i) => i.id));
    return { from, to, list: links.filter((l) => from.has(l.from) && to.has(l.to)) };
  }

  for (const exp of expected.mustHaveLinks || []) {
    const f = endpoint(exp, 'from');
    const t = endpoint(exp, 'to');
    const types = exp.type === undefined || exp.type === 'any' ? null : [].concat(exp.type);
    const r = linksBetween(f, t);
    const label = describe(f) + ' -> ' + describe(t) + (types ? ' [' + types.join('|') + ']' : '');
    if (!r.from.size) { check(false, 'missing link: ' + label + ' (no item matches from)'); continue; }
    if (!r.to.size) { check(false, 'missing link: ' + label + ' (no item matches to)'); continue; }
    const ok = r.list.filter((l) => (!types || types.includes(l.type)) && (exp.allowInferred || l.inferred === false));
    check(ok.length > 0, 'missing link: ' + label +
      (r.list.length ? ' (found only: ' + r.list.map((l) => l.type + (l.inferred ? ' inferred' : '')).join(', ') + ')' : ''));
  }

  // Closed link set: with allowedLinks present, every link must match an entry in
  // mustHaveLinks or allowedLinks (inferred links only an entry with allowInferred).
  if (expected.allowedLinks) {
    const entries = (expected.mustHaveLinks || []).concat(expected.allowedLinks);
    for (const l of links) {
      const ok = entries.some((exp) => {
        const types = exp.type === undefined || exp.type === 'any' ? null : [].concat(exp.type);
        if (types && !types.includes(l.type)) return false;
        if (l.inferred !== false && !exp.allowInferred) return false;
        const from = findItems(items, endpoint(exp, 'from'), { anyPackage: true }).map((i) => i.id);
        const to = findItems(items, endpoint(exp, 'to'), { anyPackage: true }).map((i) => i.id);
        return from.includes(l.from) && to.includes(l.to);
      });
      check(ok, 'unexpected link: ' + l.from + ' -> ' + l.to + ' ' + l.type + (l.inferred ? ' (inferred)' : ''));
    }
  }

  for (const exp of expected.mustNotHaveLinks || []) {
    const a = endpoint(exp, 'from');
    const b = endpoint(exp, 'to');
    const bad = linksBetween(a, b).list.concat(linksBetween(b, a).list);
    check(bad.length === 0, 'forbidden link: ' + bad.map((l) => l.from + ' -> ' + l.to + ' ' + l.type).join(', '));
  }

  for (const exp of expected.mustHaveTriggerTypes || []) {
    const found = findItems(items, { name: exp.name, path: exp.path, kind: exp.kind }, { anyPackage: true });
    check(found.length > 0, 'missing item for trigger check: ' + exp.name);
    if (found.length) {
      check(found.some((it) => (it.triggers || []).some((t) => t.type === exp.type)),
        'missing trigger type ' + exp.type + ' on ' + found.map((i) => i.id).join(', '));
    }
  }

  for (const s of expected.secretsMustNotAppear || []) {
    check(!raw.includes(s), 'secret appears in data.js: ' + s.slice(0, 6) + '...');
  }
  // validate already scans items, links and unclassified; candidates are not covered there.
  for (const c of candidates) if (findSecrets(c).length) check(false, 'secret-shaped candidate path: ' + c);

  for (const p of expected.mustNotFindPaths || []) {
    const where = [];
    if (candidates.includes(p)) where.push('meta.candidates');
    if (items.some((it) => it.paths.includes(p))) where.push('items');
    if (unclassified.some((u) => u.path === p)) where.push('unclassified');
    check(where.length === 0, 'path must not be found: ' + p + ' (in ' + where.join(', ') + ')');
  }

  // Evidence: every non-inferred link and every trigger with evidence.
  links.forEach((l) => {
    if (l.inferred !== false || !l.evidence) return;
    check(quoteFound(dir, l.evidence), 'evidence quote not found: link ' + l.from + ' -> ' + l.to + ' at ' +
      l.evidence.path + ':' + l.evidence.line + ' "' + l.evidence.quote + '"');
    const target = items.find((it) => it.id === l.to);
    if (target) {
      check(quoteNamesItem(l.evidence.quote, target, items), 'evidence quote does not name the target: link ' +
        l.from + ' -> ' + l.to + ' "' + l.evidence.quote + '"');
    }
  });
  items.forEach((it) => (it.triggers || []).forEach((t) => {
    if (!t.evidence) return;
    check(quoteFound(dir, t.evidence), 'evidence quote not found: trigger on ' + it.id + ' at ' +
      t.evidence.path + ':' + t.evidence.line + ' "' + t.evidence.quote + '"');
  }));

  // The scan must leave the repo untouched apart from the output folder.
  let status = null;
  try {
    status = execFileSync('git', ['-C', dir, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
  } catch (e) {
    check(false, 'repo modified: cannot run git status in ' + dir + ': ' + e.message);
  }
  if (status !== null) {
    const other = status.split('\n').filter(Boolean).filter((line) => {
      let p = line.slice(3);
      if (p.startsWith('"')) p = p.slice(1);
      return !p.startsWith(OUT + '/');
    });
    check(other.length === 0, 'repo modified outside ' + OUT + '/: ' + other.join('; '));
  }
  // git status can't see gitignored files, so also compare every file's hash
  // with the manifest make-fixture wrote.
  const diffs = diffManifest(dir);
  if (diffs === null) check(false, 'repo modified check: no fixture manifest in .git/ (build the repo with tools/make-fixture.js)');
  else check(diffs.length === 0, 'repo modified (file hashes) outside ' + OUT + '/: ' + diffs.join('; '));

  return { pass: failures.length === 0, failures, checks };
}

module.exports = { checkScan, quoteFound, quoteNamesItem, norm, VIEWER_FILES, VIEWER_DIR };

if (require.main === module) {
  const [dir, expectedFile] = process.argv.slice(2);
  if (!dir || !expectedFile) {
    console.error('usage: node tools/check-scan.js <scanned-dir> <expected.json>');
    process.exit(2);
  }
  const expected = JSON.parse(fs.readFileSync(expectedFile, 'utf8'));
  const r = checkScan(path.resolve(dir), expected);
  if (r.pass) {
    console.log('PASS ' + r.checks + ' checks');
    process.exit(0);
  }
  for (const f of r.failures) console.log('FAIL ' + f);
  console.log(r.failures.length + ' of ' + r.checks + ' checks failed');
  process.exit(1);
}

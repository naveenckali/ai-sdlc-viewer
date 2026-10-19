'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const MARKER = '.ai-sdlc-viewer-plugin';
// tool -> [user-level dir, project-level dir] (must match docs/tool-support.md)
const DIRS = {
  claude: ['.claude/skills', '.claude/skills'],
  copilot: ['.copilot/skills', '.github/skills'],
  'copilot-cli': ['.copilot/skills', '.github/skills'],
  cursor: ['.cursor/skills', '.cursor/skills'],
  codex: ['.agents/skills', '.agents/skills'],
};

function has(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
const hasBash = has('bash', ['--version']);
const hasPwsh = has('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major']);

// pwsh itself creates AppData in a fresh profile; ignore it
function homeEntries(h) { return fs.readdirSync(h).filter((e) => e !== 'AppData'); }
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'aisv-inst-')); }

const runners = {
  sh: (home, tool, project) => spawnSync('bash', [path.join(root, 'install', 'install.sh'), '--tool', tool].concat(project ? ['--project', project] : []),
    { encoding: 'utf8', env: Object.assign({}, process.env, { HOME: home, USERPROFILE: home }) }),
  ps1: (home, tool, project) => spawnSync('pwsh', ['-NoProfile', '-File', path.join(root, 'install', 'install.ps1'), '-Tool', tool].concat(project ? ['-Project', project] : []),
    { encoding: 'utf8', env: Object.assign({}, process.env, { HOME: home, USERPROFILE: home }) }),
};
const avail = { sh: hasBash, ps1: hasPwsh };

function expectInstalled(dest) {
  for (const f of ['SKILL.md', 'viewer/index.html', MARKER, 'phases.default.json', 'references/discovery.md']) {
    assert.ok(fs.existsSync(path.join(dest, f)), 'missing ' + f + ' in ' + dest);
  }
}

for (const kind of ['sh', 'ps1']) {
  const skip = avail[kind] ? false : kind + ' runtime not available';
  for (const tool of Object.keys(DIRS)) {
    test(kind + ': ' + tool + ' user-level install', { skip }, () => {
      const home = tmp();
      const r = runners[kind](home, tool);
      assert.strictEqual(r.status, 0, r.stderr + r.stdout);
      const dest = path.join(home, DIRS[tool][0], 'ai-sdlc-viewer');
      expectInstalled(dest);
      assert.ok(r.stdout.includes('ai-sdlc-viewer'), 'prints destination');
      assert.ok(r.stdout.split(String.fromCharCode(92)).join('/').includes(DIRS[tool][0]), 'prints destination dir: ' + r.stdout);
    });
    test(kind + ': ' + tool + ' project-level install', { skip }, () => {
      const home = tmp(); const proj = tmp();
      const r = runners[kind](home, tool, proj);
      assert.strictEqual(r.status, 0, r.stderr + r.stdout);
      expectInstalled(path.join(proj, DIRS[tool][1], 'ai-sdlc-viewer'));
      // nothing but the one tool dir is created in the project
      const top = fs.readdirSync(proj);
      assert.deepStrictEqual(top, [DIRS[tool][1].split('/')[0]]);
      assert.deepStrictEqual(homeEntries(home), [], 'home untouched for project install');
    });
  }
  test(kind + ': unknown tool exits non-zero and writes nothing', { skip }, () => {
    const home = tmp();
    const r = runners[kind](home, 'nope');
    assert.notStrictEqual(r.status, 0);
    assert.deepStrictEqual(homeEntries(home), []);
  });
  test(kind + ': re-run replaces the previous copy', { skip }, () => {
    const home = tmp();
    assert.strictEqual(runners[kind](home, 'cursor').status, 0);
    const dest = path.join(home, '.cursor/skills/ai-sdlc-viewer');
    fs.writeFileSync(path.join(dest, 'stale.txt'), 'x');
    const r = runners[kind](home, 'cursor');
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(!fs.existsSync(path.join(dest, 'stale.txt')));
    expectInstalled(dest);
  });
  test(kind + ': refuses to replace a destination without the marker', { skip }, () => {
    const home = tmp();
    const dest = path.join(home, '.cursor/skills/ai-sdlc-viewer');
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'mine.txt'), 'keep');
    const r = runners[kind](home, 'cursor');
    assert.notStrictEqual(r.status, 0);
    assert.ok(fs.existsSync(path.join(dest, 'mine.txt')));
  });
  test(kind + ': refuses a missing project directory', { skip }, () => {
    const home = tmp();
    const r = runners[kind](home, 'codex', path.join(home, 'does-not-exist'));
    assert.notStrictEqual(r.status, 0);
  });
}

test('plugin.json and marketplace.json are consistent', () => {
  const p = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
  const m = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/marketplace.json'), 'utf8'));
  assert.strictEqual(p.name, 'ai-sdlc-viewer');
  assert.strictEqual(p.version, '0.1.0');
  assert.ok(p.description);
  assert.strictEqual(p.author.name, 'naveenckali');
  assert.strictEqual(m.plugins.length, 1);
  assert.strictEqual(m.plugins[0].name, 'ai-sdlc-viewer');
  assert.strictEqual(m.plugins[0].source, './');
});

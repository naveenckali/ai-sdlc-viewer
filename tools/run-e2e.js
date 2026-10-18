#!/usr/bin/env node
// Dev tool: end-to-end evaluation of the skill with Claude Code.
// Usage: node tools/run-e2e.js [label] [--reuse] [--tool claude|copilot-cli|codex]
//   --tool: claude (default, the plugin path below) or copilot-cli / codex, which install the skill
//   into the fixture with install/install.sh --project (never user-level), commit the install and
//   re-record the hash manifest, then run that tool headless with scoped permissions (see runOther).
//   --reuse: skip steps 1-3 and redo steps 4-5 on tmp-fixtures/e2e and the transcript
//            summary tmp-fixtures/e2e-<label>.json left by an earlier run with that label.
//
// 1. Copies this repo's plugin (.claude-plugin/ + skills/) to <os tmp>/ai-sdlc-viewer-e2e-plugin.
//    Claude Code protects files under a --plugin-dir, and tmp-fixtures/ is inside this repo,
//    so loading the repo itself would make the fixture's output folder unwritable.
// 2. Builds the fixture repo at tmp-fixtures/e2e (tools/make-fixture.js).
// 3. Runs `claude -p "/ai-sdlc-viewer:ai-sdlc-viewer"` there, headless, in acceptEdits mode,
//    with the scoped tool allowlist below. Never --dangerously-skip-permissions.
// 4. If the agent wrote data.js but Claude Code refused its viewer copy (headless Claude
//    Code refuses `cp` out of a plugin folder without a person's approval), the HARNESS
//    copies only the missing viewer files (never overwriting one) and says so. The scan, data.js and evidence stay the agent's.
// 5. Runs tools/check-scan.js and exits with its status.
// The JSON transcript summary goes to tmp-fixtures/e2e-<label>.json.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { makeFixture } = require('./make-fixture.js');
const { writeManifest } = require('./fixture-manifest.js');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tmp-fixtures', 'e2e');
const PLUGIN = path.join(os.tmpdir(), 'ai-sdlc-viewer-e2e-plugin');
const { VIEWER_FILES, VIEWER_DIR: VIEWER } = require('./check-scan.js');

// Each entry is something SKILL.md asks the agent to do. Nothing else is pre-approved.
const ALLOWED_TOOLS = [
  'Skill',                                   // load the plugin skill
  'Read', 'Glob', 'Grep',                    // read and search the repo (and the skill's references)
  // Write/Edit are NOT listed: acceptEdits already allows writes inside the working directory
  // (ai-sdlc-viewer/data.js), and leaving them out makes writes anywhere else need approval.
  'Bash(git ls-files:*)',                    // discovery: tracked, ignored and untracked files
  'Bash(git rev-parse:*)',                   // discovery: is this a git repo
  'Bash(git config --get core.hooksPath)',   // discovery: git-hooks location
  'Bash(git config core.hooksPath)',
  'Bash(pwd)',                               // meta.source
  'Bash(date:*)',                            // meta.generatedAt
  'Bash(ls:*)',                              // confirm the copied viewer files
  'Bash(mkdir ai-sdlc-viewer:*)',            // create ai-sdlc-viewer/, lib/, vendor/
  'Bash(mkdir -p ai-sdlc-viewer:*)',
  'Bash(cp:*)'                               // copy the viewer files (Claude Code may still refuse; see step 4)
  // No delete is pre-approved: SKILL.md overwrites the output files in place and never deletes.
].join(',');

function copyPlugin() {
  fs.rmSync(PLUGIN, { recursive: true, force: true });
  fs.mkdirSync(PLUGIN, { recursive: true });
  fs.cpSync(path.join(ROOT, '.claude-plugin'), path.join(PLUGIN, '.claude-plugin'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'skills'), path.join(PLUGIN, 'skills'), { recursive: true });
}

function runClaude(label) {
  if (process.env.AISV_E2E_DRY_RUN === '1') throw new Error('AISV_E2E_DRY_RUN is set');
  copyPlugin();
  makeFixture(FIXTURE);
  const args = ['-p', '/ai-sdlc-viewer:ai-sdlc-viewer', '--plugin-dir', PLUGIN, '--add-dir', PLUGIN,
    '--permission-mode', 'acceptEdits', '--setting-sources', 'user', '--strict-mcp-config',
    '--allowedTools', ALLOWED_TOOLS, '--output-format', 'json'];
  console.log('$ (cd tmp-fixtures/e2e && claude ' + args.map((a) => (/[\s"*(]/.test(a) ? JSON.stringify(a) : a)).join(' ') + ')');
  const t0 = Date.now();
  const r = spawnSync('claude', args, { cwd: FIXTURE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const secs = Math.round((Date.now() - t0) / 1000);
  let result = {};
  try { result = JSON.parse(r.stdout); } catch (e) { /* not JSON */ }
  fs.writeFileSync(logPath(label), r.stdout || '');
  console.log('claude exit ' + r.status + ' after ' + secs + 's; transcript summary in ' + path.relative(ROOT, logPath(label)));
  if (r.stderr) console.log(r.stderr.trim());
  return result;
}

// Project-level skill dir per tool (matches install/install.sh and docs/tool-support.md).
const PROJECT_DIR = { 'copilot-cli': '.github/skills', codex: '.agents/skills' };

const COPILOT_ALLOW = ['shell(git ls-files)', 'shell(git rev-parse)', 'shell(git config)', 'shell(pwd)', 'shell(date)',
  'shell(ls)', 'shell(mkdir)', 'shell(cp)', 'write'];

// Non-Claude tools: project-level install into the fixture, commit it, re-record the manifest
// (so "repo modified" compares with the post-install state), then run the tool headless.
// codex is an npm .cmd shim on Windows, which needs a shell; only then does the -C path need
// literal quotes (the shell joins the args). Without a shell, quotes would become part of the path.
function codexArgs(fixture, useShell) {
  return ['exec', '--sandbox', 'workspace-write', '-C', useShell ? '"' + fixture + '"' : fixture, '--color', 'never', '$ai-sdlc-viewer'];
}
const CODEX_SHELL = process.platform === 'win32';

function runOther(tool, label) {
  if (process.env.AISV_E2E_DRY_RUN === '1') throw new Error('AISV_E2E_DRY_RUN is set');
  if (!PROJECT_DIR[tool]) throw new Error('unsupported --tool ' + tool);
  makeFixture(FIXTURE);
  const inst = spawnSync('bash', [path.join(ROOT, 'install', 'install.sh'), '--tool', tool, '--project', FIXTURE], { encoding: 'utf8' });
  process.stdout.write(inst.stdout + inst.stderr);
  if (inst.status !== 0) process.exit(1);
  const g = (a) => execFileSync('git', ['-C', FIXTURE, '-c', 'core.autocrlf=false', '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com', ...a], { stdio: 'inherit' });
  g(['add', '-A']); g(['commit', '-q', '-m', 'install skill (project level)']);
  writeManifest(FIXTURE);
  let cmd, args;
  if (tool === 'copilot-cli') {
    cmd = 'copilot';
    args = ['-p', '/ai-sdlc-viewer', '--no-ask-user', '-s'];
    COPILOT_ALLOW.forEach((t) => args.push('--allow-tool=' + t));
  } else {
    cmd = 'codex';
    args = codexArgs(FIXTURE, CODEX_SHELL);
  }
  console.log('$ (cd tmp-fixtures/e2e && ' + cmd + ' ' + args.map((a) => (/[\s"*($]/.test(a) ? JSON.stringify(a) : a)).join(' ') + ')');
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: FIXTURE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    // see codexArgs: its args contain no cmd metacharacters.
    shell: CODEX_SHELL && cmd === 'codex' });
  console.log(cmd + ' exit ' + r.status + ' after ' + Math.round((Date.now() - t0) / 1000) + 's');
  fs.writeFileSync(logPath(label), JSON.stringify({ stdout: r.stdout, stderr: r.stderr, status: r.status }, null, 2));
  console.log('--- agent output (tail) ---\n' + String(r.stdout || '').slice(-2500) +
    '\n--- stderr (tail) ---\n' + String(r.stderr || '').slice(-800));
  return { tool, installed: PROJECT_DIR[tool] + '/ai-sdlc-viewer', agentText: String(r.stdout || '') };
}

function logPath(label) { return path.join(ROOT, 'tmp-fixtures', 'e2e-' + label + '.json'); }

// Did Claude Code refuse a command of the agent's that copies files (cp / Copy-Item,
// alone or inside a chain)?
function copyWasDenied(result) {
  const denials = Array.isArray(result.permission_denials) ? result.permission_denials : [];
  return denials.some((d) => /(^|[\s;&|(])(cp|Copy-Item)\s/.test(String((d.tool_input || {}).command || '')));
}

const USAGE = 'usage: node tools/run-e2e.js [label] [--reuse] [--tool claude|copilot-cli|codex]  (AISV_E2E_DRY_RUN=1: print only)';
const KNOWN_FLAGS = ['--reuse', '--tool'];

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { console.log(USAGE); process.exit(0); }
  const bad = args.filter((a) => a.startsWith('-') && !KNOWN_FLAGS.includes(a));
  if (bad.length) { console.error('unknown option: ' + bad.join(' ') + '\n' + USAGE); process.exit(2); }
  const argv = process.argv.slice(2);
  const reuse = argv.includes('--reuse');
  const ti = argv.indexOf('--tool');
  const tool = ti >= 0 ? argv[ti + 1] : 'claude';
  const rest = argv.filter((a, i) => !a.startsWith('--') && i !== ti + 1);
  const label = rest[0] || 'run';
  if (process.env.AISV_E2E_DRY_RUN === '1') {
    // Safety net for tests: never build a fixture or spawn a tool.
    console.log('DRY RUN: would run tool ' + tool + ' with label ' + label + (reuse ? ' (reuse)' : '') + '; nothing spawned');
    process.exit(0);
  }
  let result;
  let other = null;
  if (tool !== 'claude') {
    other = runOther(tool, label);
    result = {};
  } else if (reuse) {
    result = JSON.parse(fs.readFileSync(logPath(label), 'utf8'));
    console.log('reusing the agent output of run "' + label + '" (no new claude run)');
  } else {
    result = runClaude(label);
  }
  if (result.num_turns !== undefined) {
    console.log(result.num_turns + ' turns, ' + Math.round(result.duration_ms / 1000) + 's, $' +
      Number(result.total_cost_usd).toFixed(2) + ', ' + (result.permission_denials || []).length + ' permission denials');
  }

  const out = path.join(FIXTURE, 'ai-sdlc-viewer');
  const missing = VIEWER_FILES.filter((f) => !fs.existsSync(path.join(out, f)));
  if (fs.existsSync(path.join(out, 'data.js')) && missing.length && (other ? true : copyWasDenied(result))) {
    // Copy only what is missing; never overwrite a file the agent copied.
    for (const f of missing) {
      fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
      fs.copyFileSync(path.join(VIEWER, f), path.join(out, f));
    }
    console.log('HARNESS COPY: ' + (other ? tool + ' did not complete' : 'Claude Code refused') + ' the agent\'s viewer copy; the harness copied the ' +
      missing.length + ' missing viewer file(s): ' + missing.join(', ') + '. data.js is the agent\'s.');
  }

  const notFind = other ? ['--not-find', other.installed + '/SKILL.md', '--not-find', other.installed + '/.ai-sdlc-viewer-plugin'] : [];
  const c = spawnSync(process.execPath, [path.join(__dirname, 'check-scan.js'), FIXTURE,
    path.join(ROOT, 'tests', 'fixtures', 'sample-repo.expected.json')].concat(notFind), { encoding: 'utf8' });
  process.stdout.write(c.stdout);
  process.exit(c.status);
}

module.exports = { ALLOWED_TOOLS, COPILOT_ALLOW, codexArgs };

if (require.main === module) main();

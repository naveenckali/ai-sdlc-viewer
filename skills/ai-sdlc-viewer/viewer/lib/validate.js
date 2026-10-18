(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AISV = root.AISV || {}; root.AISV.validate = api; }
})(typeof self !== 'undefined' ? self : this, function (root) {
  var secrets = (root.AISV && root.AISV.secrets) || require('./secrets.js');
  var findSecrets = secrets.findSecrets;

  var FATAL = 'Unsupported or missing scan data (schemaVersion must be "1")';
  var KINDS = ['skill', 'agent', 'command', 'rule', 'instructions', 'mcp-server', 'hook', 'workflow', 'script', 'plugin', 'spec', 'submodule', 'other'];
  var ECOSYSTEMS = ['claude', 'cursor', 'copilot', 'codex', 'cross-tool', 'git', 'ci', 'generic'];
  var LINK_TYPES = ['calls', 'handoff', 'triggers'];
  var TRIGGER_TYPES = ['user-command', 'git-event', 'ci-event', 'webhook', 'ai-hook-event', 'schedule', 'other'];
  var ROLES = ['literal', 'required', 'optional'];

  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function isStr(x) { return typeof x === 'string'; }
  function badPath(p) {
    return !isStr(p) || p === '' || p.indexOf('\\') !== -1 || p.charAt(0) === '/' || /^[A-Za-z]:/.test(p);
  }

  function validate(data) {
    var errors = [];
    var warnings = [];
    if (!isObj(data) || !isObj(data.meta) || data.meta.schemaVersion !== '1') {
      return { fatal: FATAL, errors: errors, warnings: warnings };
    }
    try {
      run(data, errors, warnings);
    } catch (e) {
      errors.push('validator internal error: ' + (e && e.message));
    }
    return { fatal: null, errors: errors, warnings: warnings };
  }

  function run(data, errors, warnings) {
    var meta = data.meta;
    var items = Array.isArray(data.items) ? data.items : null;
    var links = Array.isArray(data.links) ? data.links : null;
    var unclassified = Array.isArray(data.unclassified) ? data.unclassified : null;
    if (!items) errors.push('items must be an array');
    if (!links) errors.push('links must be an array');
    if (!unclassified) errors.push('unclassified must be an array');
    items = items || []; links = links || []; unclassified = unclassified || [];

    ['title', 'generatedAt', 'source', 'repoName', 'scannedBy'].forEach(function (k) {
      if (!isStr(meta[k])) errors.push('meta.' + k + ' must be a string');
    });
    if (typeof meta.git !== 'boolean') errors.push('meta.git must be a boolean');
    var candidates = Array.isArray(meta.candidates) ? meta.candidates : null;
    if (!candidates) errors.push('meta.candidates must be an array');
    candidates = candidates || [];

    var phaseIds = {};
    var phases = data.phases;
    if (!isObj(phases) || !Array.isArray(phases.list)) {
      errors.push('phases.list must be an array');
    } else {
      if (['placeholder', 'plugin-default', 'repo'].indexOf(phases.source) === -1) errors.push('phases.source invalid');
      phases.list.forEach(function (p, i) {
        if (!isObj(p) || !isStr(p.id) || !isStr(p.name)) { errors.push('phases.list[' + i + '] needs string id and name'); return; }
        phaseIds[p.id] = true;
      });
    }

    var ids = {};
    var accounted = {};
    items.forEach(function (it, i) {
      var tag = 'items[' + i + ']';
      if (!isObj(it)) { errors.push(tag + ' must be an object'); return; }
      if (!isStr(it.id) || !it.id) errors.push(tag + ' id must be a non-empty string');
      else {
        tag = 'item "' + it.id + '"';
        if (ids[it.id]) errors.push('duplicate item id: ' + it.id);
        ids[it.id] = true;
      }
      if (!isStr(it.name)) errors.push(tag + ': name must be a string');
      if (KINDS.indexOf(it.kind) === -1) errors.push(tag + ': invalid kind "' + it.kind + '"');
      if (ECOSYSTEMS.indexOf(it.ecosystem) === -1) errors.push(tag + ': invalid ecosystem "' + it.ecosystem + '"');
      if (it.level !== 'full' && it.level !== 'light') errors.push(tag + ': level must be "full" or "light"');
      if (it.package !== null && !isStr(it.package)) errors.push(tag + ': package must be a string or null');
      if (typeof it.localOnly !== 'boolean') errors.push(tag + ': localOnly must be a boolean');
      if (!Array.isArray(it.paths) || it.paths.length === 0) errors.push(tag + ': paths must be a non-empty array');
      else it.paths.forEach(function (p) {
        if (badPath(p)) errors.push(tag + ': path must be repo-relative POSIX: ' + p);
        else accounted[p] = true;
      });
      ['whatItDoes', 'inputs', 'outputs'].forEach(function (k) {
        if (!Array.isArray(it[k])) errors.push(tag + ': ' + k + ' must be an array');
      });
      ['ownDescription', 'summary', 'phase', 'sdlcRole'].forEach(function (k) {
        if (it[k] !== null && !isStr(it[k])) errors.push(tag + ': ' + k + ' must be a string or null');
      });
      if (isStr(it.phase) && !phaseIds[it.phase]) errors.push(tag + ': unknown phase "' + it.phase + '"');
      if (it.kind === 'spec') {
        if (!Array.isArray(it.inputs) || it.inputs.length === 0) errors.push(tag + ': spec inputs must be non-empty (or ["Not stated in the file"])');
        if (!Array.isArray(it.outputs) || it.outputs.length === 0) errors.push(tag + ': spec outputs must be non-empty (or ["Not stated in the file"])');
      }
      if (it.invocation !== null) {
        if (!isObj(it.invocation) || !Array.isArray(it.invocation.parts)) errors.push(tag + ': invocation must be null or {parts: []}');
        else it.invocation.parts.forEach(function (pt) {
          if (!isObj(pt) || !isStr(pt.text) || ROLES.indexOf(pt.role) === -1) errors.push(tag + ': invalid invocation part');
        });
      }
      if (!Array.isArray(it.triggers)) errors.push(tag + ': triggers must be an array');
      else it.triggers.forEach(function (t) {
        if (!isObj(t) || TRIGGER_TYPES.indexOf(t.type) === -1 || !isStr(t.detail)) { errors.push(tag + ': invalid trigger'); return; }
        if (t.evidence !== undefined) checkEvidence(t.evidence, tag + ' trigger', errors);
      });
    });

    links.forEach(function (l, i) {
      var tag = 'links[' + i + ']';
      if (!isObj(l)) { errors.push(tag + ' must be an object'); return; }
      if (!isStr(l.from) || !ids[l.from]) errors.push(tag + ': unknown item id in from: ' + l.from);
      if (!isStr(l.to) || !ids[l.to]) errors.push(tag + ': unknown item id in to: ' + l.to);
      if (LINK_TYPES.indexOf(l.type) === -1) errors.push(tag + ': invalid link type "' + l.type + '"');
      if (typeof l.inferred !== 'boolean') errors.push(tag + ': inferred must be a boolean');
      if (l.inferred === true) {
        if (!isStr(l.reason) || !l.reason.trim()) errors.push(tag + ': inferred link missing reason');
      } else if (l.inferred === false) {
        if (l.evidence === undefined || l.evidence === null) errors.push(tag + ': missing evidence on non-inferred link');
        else checkEvidence(l.evidence, tag, errors);
      }
    });

    unclassified.forEach(function (u, i) {
      var tag = 'unclassified[' + i + ']';
      if (!isObj(u)) { errors.push(tag + ' must be an object'); return; }
      if (badPath(u.path)) errors.push(tag + ': path must be repo-relative POSIX: ' + u.path);
      else accounted[u.path] = true;
      if (!isStr(u.reason)) errors.push(tag + ': reason must be a string');
    });

    candidates.forEach(function (c) {
      if (badPath(c)) errors.push('meta.candidates: path must be repo-relative POSIX: ' + c);
      else if (!accounted[c]) errors.push('candidate not accounted for: ' + c);
    });

    var seen = {};
    function walk(v, where) {
      if (isStr(v)) {
        if (findSecrets(v).length && !seen[where]) {
          seen[where] = true;
          errors.push('possible unredacted secret at ' + where);
        }
      } else if (Array.isArray(v)) {
        v.forEach(function (x, i) { walk(x, where + '[' + i + ']'); });
      } else if (isObj(v)) {
        Object.keys(v).forEach(function (k) { walk(v[k], where + '.' + k); });
      }
    }
    walk(items, 'items'); walk(links, 'links'); walk(unclassified, 'unclassified');
  }

  function checkEvidence(ev, tag, errors) {
    if (!isObj(ev)) { errors.push(tag + ': missing evidence (must be {path, line, quote})'); return; }
    if (badPath(ev.path)) errors.push(tag + ': evidence path must be repo-relative POSIX: ' + ev.path);
    if (typeof ev.line !== 'number' || ev.line % 1 !== 0 || ev.line < 1) errors.push(tag + ': evidence line must be an integer >= 1');
    if (!isStr(ev.quote) || !ev.quote.trim()) errors.push(tag + ': missing evidence quote');
  }

  return { validate: validate };
});

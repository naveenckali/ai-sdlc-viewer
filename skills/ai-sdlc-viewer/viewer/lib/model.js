(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AISV = root.AISV || {}; root.AISV.model = api; }
})(typeof self !== 'undefined' ? self : this, function (root) {
  var ECOSYSTEMS = ['claude', 'cursor', 'copilot', 'codex', 'cross-tool', 'git', 'ci', 'generic'];
  var ECO_NAMES = { claude: 'Claude', cursor: 'Cursor', copilot: 'Copilot', codex: 'Codex',
    'cross-tool': 'Cross-tool', git: 'Git', ci: 'CI', generic: 'Generic' };
  var KINDS = ['skill', 'agent', 'command', 'rule', 'instructions', 'mcp-server', 'hook',
    'workflow', 'script', 'plugin', 'spec', 'submodule', 'other'];
  var KIND_PLURALS = { skill: 'skills', agent: 'agents', command: 'commands', rule: 'rules',
    instructions: 'instructions', 'mcp-server': 'MCP servers', hook: 'hooks', workflow: 'workflows',
    script: 'scripts', plugin: 'plugins', spec: 'specs', submodule: 'submodules', other: 'other' };
  var CHIPS = [
    ['claude', 'Claude'], ['cursor', 'Cursor'], ['copilot', 'Copilot'], ['codex', 'Codex'],
    ['mcp', 'MCP'], ['hooks', 'Hooks'], ['ci', 'CI'], ['scripts', 'Scripts'], ['specs', 'Specs'],
    ['other', 'Other']
  ];
  var KIND_CHIP = { 'mcp-server': 'mcp', hook: 'hooks', workflow: 'ci', script: 'scripts', spec: 'specs' };
  var LIGHT_LABEL = 'Other scripts & workflows';

  function rank(list, v) { var i = list.indexOf(v); return i < 0 ? list.length : i; }

  function chipKey(item) {
    if (KIND_CHIP[item.kind]) return KIND_CHIP[item.kind];
    if (['claude', 'cursor', 'copilot', 'codex'].indexOf(item.ecosystem) >= 0) return item.ecosystem;
    return 'other'; // cross-tool, git, ci and generic items of other kinds: every item is in exactly one chip
  }

  function chips(data) {
    var counts = {};
    ((data && data.items) || []).forEach(function (it) {
      var k = chipKey(it);
      counts[k] = (counts[k] || 0) + 1;
    });
    return CHIPS.filter(function (c) { return counts[c[0]] > 0; })
      .map(function (c) { return { key: c[0], label: c[1], count: counts[c[0]] }; });
  }

  function baseLabel(eco, kind) {
    if (kind === 'spec') return 'SDD specs';
    if (kind === 'workflow') return 'CI workflows';
    return (ECO_NAMES[eco] || eco) + ' — ' + (KIND_PLURALS[kind] || kind);
  }

  function groups(items) {
    items = items || [];
    var full = items.filter(function (i) { return i.level !== 'light'; });
    var light = items.filter(function (i) { return i.level === 'light'; });
    var map = {}, list = [];
    full.forEach(function (it) {
      var pkg = it.package || '';
      var key = [pkg, it.ecosystem, it.kind].join('|');
      if (!map[key]) {
        map[key] = { key: key, label: baseLabel(it.ecosystem, it.kind) + (pkg ? ' · ' + pkg : ''),
          collapsed: false, items: [], _p: pkg, _e: it.ecosystem, _k: it.kind };
        list.push(map[key]);
      }
      map[key].items.push(it);
    });
    list.sort(function (a, b) {
      if ((a._p === '') !== (b._p === '')) return a._p === '' ? -1 : 1;
      if (a._p !== b._p) return a._p < b._p ? -1 : 1;
      return (rank(ECOSYSTEMS, a._e) - rank(ECOSYSTEMS, b._e)) || (rank(KINDS, a._k) - rank(KINDS, b._k));
    });
    if (light.length) list.push({ key: 'light', label: LIGHT_LABEL, collapsed: true, items: light });
    var n = 0;
    return list.map(function (g) {
      return { key: g.key, label: g.label, collapsed: g.collapsed, items: g.items.map(function (it) {
        var copy = {};
        Object.keys(it).forEach(function (k) { copy[k] = it[k]; });
        copy.displayNo = ++n;
        return copy;
      }) };
    });
  }

  function filterItems(items, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter(function (it) {
      var hay = [it.name, it.summary, it.ownDescription, it.kind, it.package]
        .concat(it.paths || []).filter(function (s) { return s; }).join('\n').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function countLabel(shown, total) { return shown + ' of ' + total + ' items'; }

  return { chips: chips, groups: groups, filterItems: filterItems, countLabel: countLabel };
});

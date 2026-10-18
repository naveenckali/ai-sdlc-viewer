(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AISV = root.AISV || {}; root.AISV.app = api; }
})(typeof self !== 'undefined' ? self : this, function (root) {
  // DOM wiring only. Every repo-derived string goes through textContent (see el/txt); no HTML injection.
  function lib(name) { return (root.AISV && root.AISV[name]) || require('./lib/' + name + '.js'); }

  var TITLE = 'AI SDLC Skills/Spec Viewer';
  var NO_DATA = 'No scan data found. Run /ai-sdlc-viewer in this repo to generate it.';
  var NO_TOOLING = 'No AI or SDLC tooling found in this repo.';
  var NOT_STATED = 'Not stated in the file';
  var NO_GRAPH_LIB = 'Graph library failed to load.';
  var NO_PHASES = 'ADLC process not supplied yet. Add .ai-sdlc-viewer/phases.json to the repo and re-run /ai-sdlc-viewer.';
  var LEGEND = '(green = required, red = optional)';
  var TAB_KEY = 'aisv.tab';
  var ECO_COLORS = { claude: '#7c83ff', cursor: '#38bdf8', copilot: '#a78bfa', codex: '#34d399',
    'cross-tool': '#e879f9', git: '#f87171', ci: '#facc15', generic: '#94a3b8' };
  var TRIGGER_SHAPES = { webhook: 'diamond', 'git-event': 'hexagon', 'ci-event': 'round-rectangle',
    'ai-hook-event': 'triangle', schedule: 'octagon', other: 'tag' };
  var EDGE_COLORS = { calls: '#8a93a6', handoff: '#7c83ff', triggers: '#f59e0b' };
  var WEBHOOK_COLOR = '#f59e0b';

  // ---------- small helpers ----------
  var doc;
  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      parent.appendChild(typeof c === 'object' ? c : doc.createTextNode(String(c)));
    }
    return parent;
  }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function stated(s) { return s !== null && s !== undefined && String(s).trim() !== ''; }
  function notStated() { return el('p', 'not-stated', NOT_STATED); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (!stated(iso) || isNaN(d.getTime())) return String(iso);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function evidenceText(e) {
    return isObj(e) ? e.path + ':' + e.line + ' "' + e.quote + '"' : '';
  }
  function store(key, val) {
    try {
      if (val === undefined) return root.localStorage.getItem(key);
      root.localStorage.setItem(key, val);
    } catch (e) { /* storage unavailable (file:// in some browsers, opaque origins) */ }
    return null;
  }
  function badge(text, cls) { return el('span', 'badge ' + (cls || ''), text); }
  // "inferred" tag + reason, or the evidence text, for a link/step
  function provenance(x) {
    var span = el('span', 'prov');
    if (x.inferred) add(span, badge('inferred', 'inferred'), ' ', el('span', 'reason', x.reason || NOT_STATED));
    else add(span, el('span', 'evidence', evidenceText(x.evidence) || NOT_STATED));
    return span;
  }

  // ---------- render ----------
  function render(rootEl, data) {
    if (!rootEl) return;
    doc = rootEl.ownerDocument;
    rootEl.textContent = '';
    if (data === undefined || data === null) { add(rootEl, el('div', 'message', NO_DATA)); return; }
    var v = lib('validate').validate(data);
    if (v.fatal) { add(rootEl, el('div', 'message', v.fatal)); return; }
    try {
      build(rootEl, data, v);
    } catch (e) {
      rootEl.textContent = '';
      add(rootEl, el('div', 'message', 'The viewer could not display this scan data: ' + (e && e.message)));
    }
  }

  function build(rootEl, data, v) {
    var model = lib('model');
    var items = arr(data.items).filter(isObj);
    var known = {};
    items.forEach(function (it) { known[it.id] = true; });
    var S = {
      root: rootEl,
      meta: data.meta,
      items: items,
      links: arr(data.links).filter(function (l) { return isObj(l) && known[l.from] && known[l.to]; }),
      unclassified: arr(data.unclassified).filter(isObj),
      phases: isObj(data.phases) ? arr(data.phases.list).filter(isObj) : [],
      groups: model.groups(items),
      byId: {}, groupOf: {}, collapsed: {},
      selectedId: null, query: '', showInferred: true, cy: null, tab: 'all'
    };
    S.data = { items: S.items, links: S.links };
    S.groups.forEach(function (g) {
      g.items.forEach(function (it) {
        if (!S.byId[it.id]) { S.byId[it.id] = it; S.groupOf[it.id] = g.key; }
        if (S.selectedId === null) S.selectedId = it.id;
      });
    });

    S.tabs = [['all', 'All tooling'], ['graph', 'Skills Graph'], ['simple', 'Simple chains'],
      ['complex', 'Complex chains'], ['adlc', 'ADLC Phase Map'],
      ['unclassified', 'Not classified (' + S.unclassified.length + ')']];

    add(rootEl, header(S, model), banner(v));
    var nav = el('nav', 'tabs');
    S.tabs.forEach(function (t) {
      var b = el('button', 'tab', t[1]);
      b.type = 'button';
      b.setAttribute('data-tab', t[0]);
      b.addEventListener('click', function () { switchTab(S, t[0]); });
      nav.appendChild(b);
    });
    S.nav = nav;
    S.content = el('main', 'content');
    add(rootEl, nav, S.content);

    var saved = store(TAB_KEY);
    var valid = S.tabs.some(function (t) { return t[0] === saved; });
    switchTab(S, valid ? saved : 'all');
  }

  function header(S, model) {
    var h = el('header');
    var meta = S.meta;
    add(h, el('h1', null, TITLE),
      el('div', 'meta', S.items.length + ' items · generated ' + fmtDate(meta.generatedAt) + ' · source: ' + meta.source));
    var chips = el('div', 'chips');
    model.chips({ items: S.items }).forEach(function (c) {
      chips.appendChild(el('span', 'chip k-' + c.key, c.label + ' ' + c.count));
    });
    return add(h, chips);
  }

  function banner(v) {
    var probs = v.errors.map(function (e) { return ['error', e]; })
      .concat(v.warnings.map(function (w) { return ['warning', w]; }));
    if (!probs.length) return null;
    var d = el('details', 'warnings');
    add(d, el('summary', null, 'The scan data has ' + probs.length + ' problem' + (probs.length === 1 ? '' : 's') +
      ' (' + v.errors.length + ' errors, ' + v.warnings.length + ' warnings). Click to show.'));
    var ul = el('ul');
    probs.forEach(function (p) { add(ul, add(el('li', p[0]), el('b', null, p[0] + ': '), p[1])); });
    return add(d, ul);
  }

  function switchTab(S, key) {
    S.tab = key;
    store(TAB_KEY, key);
    Array.prototype.forEach.call(S.nav.children, function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === key);
    });
    if (S.cy) { try { S.cy.destroy(); } catch (e) { /* ignore */ } S.cy = null; }
    S.content.textContent = '';
    S.content.className = 'content tab-' + key;
    var fn = { all: renderAll, graph: renderGraph, simple: renderChains, complex: renderChains,
      adlc: renderAdlc, unclassified: renderUnclassified }[key];
    fn(S, key);
  }

  function selectItem(S, id) {
    if (!S.byId[id]) return;
    S.selectedId = id;
    S.collapsed[S.groupOf[id]] = false;
    switchTab(S, 'all');
  }

  // ---------- All tooling ----------
  function renderAll(S) {
    if (!S.items.length) { add(S.content, el('div', 'message', NO_TOOLING)); return; }
    var aside = el('aside');
    var input = el('input', 'filter');
    input.type = 'search';
    input.placeholder = 'Filter tooling…';
    input.value = S.query;
    var count = el('div', 'count');
    var list = el('div', 'list');
    var detail = el('section', 'detail');
    add(aside, input, count, list);
    add(S.content, aside, detail);

    function refresh() { renderList(S, list, count, refresh); renderDetail(S, detail); }
    input.addEventListener('input', function () { S.query = input.value; renderList(S, list, count, refresh); });
    refresh();
  }

  function renderList(S, list, count, refresh) {
    var model = lib('model');
    list.textContent = '';
    var shown = 0;
    var q = S.query.trim();
    S.groups.forEach(function (g) {
      var matches = model.filterItems(g.items, q);
      if (q && !matches.length) return;
      shown += matches.length;
      var collapsed = q ? false : (S.collapsed[g.key] !== undefined ? S.collapsed[g.key] : g.collapsed);
      var head = el('div', 'grp' + (collapsed ? ' collapsed' : ''), (collapsed ? '▸ ' : '▾ ') + g.label + ' (' + matches.length + ')');
      head.addEventListener('click', function () {
        S.collapsed[g.key] = !collapsed;
        renderList(S, list, count, refresh);
      });
      var body = el('div', 'grp-items');
      body.hidden = collapsed;
      matches.forEach(function (it) {
        var row = el('div', 'item' + (it.id === S.selectedId ? ' on' : ''));
        add(row, el('span', 'n', it.displayNo), el('span', 'name', it.name),
          badge(it.kind, 'kind k-' + it.ecosystem), it.localOnly ? badge('local only', 'local') : null);
        row.title = arr(it.paths).join('\n');
        row.addEventListener('click', function () { S.selectedId = it.id; refresh(); });
        body.appendChild(row);
      });
      add(list, head, body);
    });
    count.textContent = model.countLabel(shown, S.items.length);
  }

  function card(title, body, cls) {
    var c = el('div', 'card' + (cls ? ' ' + cls : ''));
    add(c, el('h3', null, title));
    return add(c, body);
  }
  function textOrNot(s) { return stated(s) ? el('p', null, s) : notStated(); }
  function bullets(list) {
    list = arr(list).filter(stated);
    if (!list.length) return notStated();
    var ul = el('ul');
    list.forEach(function (s) { ul.appendChild(el('li', null, s)); });
    return ul;
  }

  function renderDetail(S, sec) {
    sec.textContent = '';
    var it = S.byId[S.selectedId];
    if (!it) return;
    add(sec, add(el('h2'), el('span', 'n', it.displayNo), el('span', 'name', it.name), ' ', badge(it.kind, 'kind k-' + it.ecosystem),
      it.localOnly ? badge('local only', 'local') : null));

    var sig = el('div', 'sig');
    var parts = isObj(it.invocation) ? arr(it.invocation.parts).filter(isObj) : [];
    if (parts.length) {
      parts.forEach(function (p, i) { add(sig, i ? ' ' : null, el('span', 'part ' + (p.role || 'literal'), p.text)); });
      add(sig, ' ', el('span', 'legend', LEGEND));
    } else add(sig, el('span', 'not-stated', 'Invocation: ' + NOT_STATED));
    sec.appendChild(sig);

    var paths = el('div', 'paths');
    arr(it.paths).forEach(function (p) { paths.appendChild(el('div', 'path', p)); });
    if (!paths.children.length) paths.appendChild(notStated());
    sec.appendChild(paths);

    if (stated(it.ownDescription)) {
      var q = el('div', 'quote');
      add(q, el('div', 'quote-label', 'quoted from the file'), el('blockquote', null, it.ownDescription));
      sec.appendChild(card('From the file', q, 'from-file'));
    }
    var io = [card('Inputs', bullets(it.inputs)), card('Outputs', bullets(it.outputs))];
    var what = card('What it does', bullets(it.whatItDoes));
    if (it.kind === 'spec') add(sec, card('Purpose/goal', textOrNot(it.summary)), io[0], io[1], what);
    else add(sec, card('Summary', textOrNot(it.summary)), what, io[0], io[1]);
    add(sec, card('Triggers', triggerList(it.triggers)));

    var phase = S.phases.filter(function (p) { return p.id === it.phase; })[0];
    var small = el('div', 'smalls');
    [['phase', phase ? phase.name : it.phase], ['sdlcRole', it.sdlcRole], ['package', it.package]].forEach(function (kv) {
      add(small, add(el('div', 'small'), el('span', 'k', kv[0] + ': '), el('span', stated(kv[1]) ? 'v' : 'v not-stated', stated(kv[1]) ? kv[1] : NOT_STATED)));
    });
    sec.appendChild(small);
    sec.appendChild(card('Connections', connections(S, it), 'connections'));
  }

  function triggerList(triggers) {
    triggers = arr(triggers).filter(isObj);
    if (!triggers.length) return notStated();
    var ul = el('ul');
    triggers.forEach(function (t) {
      add(ul, add(el('li'), badge(t.type, 'trig'), ' ', t.detail,
        t.evidence ? el('span', 'evidence', ' ' + evidenceText(t.evidence)) : null));
    });
    return ul;
  }

  function connections(S, it) {
    var rows = [
      ['Uses', 'calls', true], ['Called by', 'calls', false], ['Hands off to', 'handoff', true],
      ['Receives handoff from', 'handoff', false], ['Triggered by', 'triggers', false], ['Triggers', 'triggers', true]
    ];
    var box = el('div');
    rows.forEach(function (r) {
      var list = S.links.filter(function (l) { return l.type === r[1] && (r[2] ? l.from === it.id : l.to === it.id); });
      if (r[0] === 'Triggers' && !list.length) return; // outgoing triggers: only when present
      var row = add(el('div', 'conn-row'), el('span', 'conn-label', r[0] + ': '));
      if (!list.length) row.appendChild(el('span', 'not-stated', NOT_STATED));
      list.forEach(function (l) {
        var other = S.byId[r[2] ? l.to : l.from];
        var link = el('a', 'rel', other ? other.name : (r[2] ? l.to : l.from));
        link.href = '#';
        link.addEventListener('click', function (e) { e.preventDefault(); selectItem(S, other.id); });
        add(row, add(el('div', 'conn'), link, ' ', provenance(l)));
      });
      box.appendChild(row);
    });
    return box;
  }

  // ---------- inferred toggle (graph + chains) ----------
  function inferredToggle(S) {
    var label = el('label', 'toggle');
    var box = el('input', 'show-inferred');
    box.type = 'checkbox';
    box.checked = S.showInferred;
    box.addEventListener('change', function () { S.showInferred = box.checked; switchTab(S, S.tab); });
    return add(label, box, ' Show inferred links');
  }

  // ---------- Skills Graph ----------
  function graphElements(S) {
    var g = lib('graph').buildGraphElements(S.data, { showInferred: S.showInferred });
    var els = [];
    g.nodes.forEach(function (n) {
      var webhook = n.isTrigger && n.kind === 'webhook';
      els.push({ group: 'nodes', data: {
        id: n.id, label: webhook ? '⚡ ' + n.label : n.label, kind: n.kind, ecosystem: n.ecosystem,
        isTrigger: n.isTrigger,
        shape: n.isTrigger ? (TRIGGER_SHAPES[n.kind] || 'tag') : 'ellipse',
        color: webhook ? WEBHOOK_COLOR : (ECO_COLORS[n.ecosystem] || ECO_COLORS.generic)
      } });
    });
    g.edges.forEach(function (e) {
      els.push({ group: 'edges', data: {
        id: e.id, source: e.source, target: e.target, type: e.type, inferred: e.inferred,
        color: EDGE_COLORS[e.type] || EDGE_COLORS.calls,
        lineStyle: e.inferred ? 'dashed' : 'solid', label: e.inferred ? 'inferred' : ''
      } });
    });
    return els;
  }

  var GRAPH_STYLE = [
    { selector: 'node', style: { 'background-color': 'data(color)', shape: 'data(shape)', label: 'data(label)',
      color: '#d8dce6', 'font-size': 10, 'text-valign': 'bottom', 'text-margin-y': 4, width: 22, height: 22,
      'text-wrap': 'wrap', 'text-max-width': 140, 'border-width': 0 } },
    { selector: 'node[?isTrigger]', style: { width: 28, height: 28 } },
    { selector: 'node:selected', style: { 'border-width': 2, 'border-color': '#ffffff' } },
    { selector: 'edge', style: { width: 1.6, 'line-color': 'data(color)', 'target-arrow-color': 'data(color)',
      'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'line-style': 'solid', label: 'data(label)',
      'font-size': 9, color: '#8a93a6', 'text-background-color': '#0f1117', 'text-background-opacity': 1,
      'text-background-padding': 2 } },
    { selector: 'edge[?inferred]', style: { 'line-style': 'dashed' } },
    { selector: 'edge.detour', style: { 'curve-style': 'unbundled-bezier', 'control-point-distances': 60,
      'control-point-weights': 0.5 } }
  ];

  // Layout that never draws an edge through an unrelated node (that would read as an invented link):
  // linked nodes get a directed breadthfirst from their in-degree-0 roots, unlinked nodes go in a grid
  // below, and any edge whose straight line still crosses another node is bent around it.
  var NODE_R = 20;
  function segmentHitsCircle(a, b, c, r) {
    var dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    var t = len2 ? Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2)) : 0;
    var px = a.x + t * dx - c.x, py = a.y + t * dy - c.y;
    return px * px + py * py < r * r;
  }
  function arrange(cy) {
    var base = { animate: false, fit: false, padding: 30 };
    function opts(o) { Object.keys(base).forEach(function (k) { o[k] = base[k]; }); return o; }
    var linked = cy.nodes().filter(function (n) { return n.degree(false) > 0; });
    var lone = cy.nodes().difference(linked);
    if (linked.length) {
      var roots = cy.collection();
      linked.union(cy.edges()).components().forEach(function (comp) {
        var r = comp.nodes().filter(function (n) { return n.indegree(false) === 0; });
        roots = roots.union(r.length ? r : comp.nodes()[0]);
      });
      linked.union(cy.edges()).layout(opts({ name: 'breadthfirst', directed: true, maximal: true, roots: roots, spacingFactor: 1.15 })).run();
    }
    if (lone.length) {
      var bb = linked.length ? linked.boundingBox() : { x1: 0, y2: -80, w: 600 };
      var w = Math.max(bb.w, 400), cols = Math.max(1, Math.floor(w / 130));
      var rows = Math.ceil(lone.length / cols);
      lone.layout(opts({ name: 'grid', cols: cols, rows: rows, avoidOverlap: true,
        boundingBox: { x1: bb.x1, y1: bb.y2 + 80, w: w, h: rows * 70 } })).run();
    }
    cy.edges().forEach(function (e) {
      var s = e.source(), t = e.target();
      var hit = cy.nodes().some(function (n) {
        return !n.same(s) && !n.same(t) && segmentHitsCircle(s.position(), t.position(), n.position(), NODE_R);
      });
      if (hit) e.addClass('detour');
    });
    cy.fit(undefined, 30);
  }

  function renderGraph(S) {
    var pane = el('div', 'pane graph-pane');
    S.content.appendChild(pane);
    if (!S.items.length) { add(pane, el('div', 'message', NO_TOOLING)); return; }
    var bar = add(el('div', 'toolbar'), inferredToggle(S), graphLegend());
    pane.appendChild(bar);
    if (typeof root.cytoscape === 'undefined') { add(pane, el('div', 'message', NO_GRAPH_LIB)); return; }
    var box = el('div', 'cy');
    pane.appendChild(box);
    S.cy = root.cytoscape({
      container: box,
      elements: graphElements(S),
      style: GRAPH_STYLE,
      layout: { name: 'preset' },
      minZoom: 0.2, maxZoom: 3
    });
    arrange(S.cy);
    S.cy.on('tap', 'node', function (evt) {
      var d = evt.target.data;
      if (d.call(evt.target, 'isTrigger')) return;
      selectItem(S, d.call(evt.target, 'id'));
    });
  }

  function graphLegend() {
    var lg = el('div', 'legend-row');
    Object.keys(ECO_COLORS).forEach(function (k) {
      var sw = el('span', 'swatch');
      sw.style.background = ECO_COLORS[k];
      add(lg, add(el('span', 'lg'), sw, k));
    });
    add(lg, el('span', 'lg', '⚡ webhook ◆'), el('span', 'lg', 'git-event ⬢'), el('span', 'lg', 'ci-event ▢'),
      el('span', 'lg', 'ai-hook-event ▲'), el('span', 'lg e-calls', 'calls'), el('span', 'lg e-handoff', 'handoff'),
      el('span', 'lg e-triggers', 'triggers'), el('span', 'lg e-inferred', 'inferred'));
    return lg;
  }

  // ---------- Simple / Complex chains ----------
  function renderChains(S, key) {
    var pane = el('div', 'pane chains');
    S.content.appendChild(pane);
    if (!S.items.length) { add(pane, el('div', 'message', NO_TOOLING)); return; }
    pane.appendChild(add(el('div', 'toolbar'), inferredToggle(S)));
    var names = {};
    lib('graph').buildGraphElements(S.data, { showInferred: true }).nodes.forEach(function (n) {
      names[n.id] = n.isTrigger ? n.kind + ': ' + n.label : n.label;
    });
    var list = lib('chains').deriveChains(S.data, { showInferred: S.showInferred })[key];
    if (!list.length) {
      add(pane, el('div', 'message', key === 'simple' ? 'No simple chains found.' : 'No complex chains found.'));
      return;
    }
    list.forEach(function (c, i) {
      var title = key === 'simple' ? c.nodes.map(function (id) { return names[id] || id; }).join(' → ')
        : 'Chain ' + (i + 1) + ' · ' + c.nodes.length + ' nodes: ' + c.nodes.map(function (id) { return names[id] || id; }).join(', ');
      var ul = el('ul', 'steps');
      c.steps.forEach(function (s) {
        add(ul, add(el('li', s.inferred ? 'step inferred' : 'step'),
          el('span', 'hop', (names[s.from] || s.from) + ' → ' + (names[s.to] || s.to)), ' ',
          badge(s.type, 'etype e-' + s.type), ' ', provenance(s)));
      });
      pane.appendChild(card(title, ul, 'chain'));
    });
  }

  // ---------- ADLC Phase Map ----------
  function renderAdlc(S) {
    var pane = el('div', 'pane');
    S.content.appendChild(pane);
    if (!S.phases.length) { add(pane, el('div', 'message', NO_PHASES)); return; }
    var board = el('div', 'phase-board');
    var ids = {};
    S.phases.forEach(function (p) { ids[p.id] = true; });
    var flat = Object.keys(S.byId).map(function (id) { return S.byId[id]; })
      .sort(function (a, b) { return a.displayNo - b.displayNo; });
    var cols = S.phases.map(function (p) {
      return { name: p.name || p.id, desc: p.description, items: flat.filter(function (it) { return it.phase === p.id; }) };
    });
    cols.push({ name: 'Unmapped', desc: 'No phase set, or an unknown phase', items: flat.filter(function (it) { return !ids[it.phase]; }) });
    cols.forEach(function (c) {
      var col = add(el('div', 'phase-col'), el('h3', null, c.name + ' (' + c.items.length + ')'),
        stated(c.desc) ? el('div', 'phase-desc', c.desc) : null);
      c.items.forEach(function (it) {
        var pc = add(el('div', 'pcard'), add(el('div', 'pname'), el('span', 'n', it.displayNo), it.name),
          el('div', stated(it.sdlcRole) ? 'prole' : 'prole not-stated', stated(it.sdlcRole) ? it.sdlcRole : NOT_STATED));
        pc.addEventListener('click', function () { selectItem(S, it.id); });
        col.appendChild(pc);
      });
      board.appendChild(col);
    });
    pane.appendChild(board);
  }

  // ---------- Not classified ----------
  function renderUnclassified(S) {
    var pane = el('div', 'pane');
    S.content.appendChild(pane);
    if (!S.unclassified.length) { add(pane, el('div', 'message', 'Nothing was left unclassified.')); return; }
    var t = el('table', 'uncl');
    add(t, add(el('thead'), add(el('tr'), el('th', null, 'Path'), el('th', null, 'Reason'))));
    var tb = el('tbody');
    S.unclassified.forEach(function (u) {
      add(tb, add(el('tr'), el('td', 'path', u.path), el('td', null, u.reason)));
    });
    pane.appendChild(add(t, tb));
  }

  // ---------- boot ----------
  if (typeof document !== 'undefined' && document.addEventListener) {
    var boot = function () {
      var app = document.getElementById('app');
      if (app) render(app, root.AI_SDLC_DATA_MISSING ? undefined : root.AI_SDLC_DATA);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  return { render: render, _segmentHitsCircle: segmentHitsCircle };
});

(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AISV = root.AISV || {}; root.AISV.graph = api; }
})(typeof self !== 'undefined' ? self : this, function (root) {
  // buildGraphElements(data, {showInferred}) -> {nodes, edges}
  // Edges also carry evidence/reason (null when absent) so chains can reuse them.
  function buildGraphElements(data, opts) {
    var showInferred = !opts || opts.showInferred !== false;
    var items = (data && data.items) || [];
    var links = (data && data.links) || [];
    var nodes = [];
    var edges = [];
    var known = {};
    var n = 0;

    items.forEach(function (it) {
      known[it.id] = true;
      nodes.push({
        id: it.id,
        label: it.name || it.id,
        kind: it.kind,
        ecosystem: it.ecosystem,
        isTrigger: false
      });
    });

    var seenTrigger = {};
    items.forEach(function (it) {
      (it.triggers || []).forEach(function (t) {
        if (!t || t.type === 'user-command') return;
        // Event triggers with identical detail share one entry node. An "other" trigger is free
        // text ("loaded for *.ts files"): the same words on two items don't show a shared cause,
        // so each item gets its own node and no chain joins unrelated items through it.
        var tid = 'trigger:' + t.type + ':' + (t.type === 'other' ? it.id + ':' : '') + t.detail;
        if (!seenTrigger[tid]) {
          seenTrigger[tid] = true;
          nodes.push({ id: tid, label: t.detail, kind: t.type, ecosystem: it.ecosystem, isTrigger: true });
        }
        edges.push({
          id: 'e' + (n++), source: tid, target: it.id, type: 'triggers', inferred: false,
          evidence: t.evidence || null, reason: null
        });
      });
    });

    links.forEach(function (l) {
      if (!l || !known[l.from] || !known[l.to]) return;
      if (l.inferred && !showInferred) return;
      edges.push({
        id: 'e' + (n++), source: l.from, target: l.to, type: l.type, inferred: !!l.inferred,
        evidence: l.evidence || null, reason: l.reason || null
      });
    });

    return { nodes: nodes, edges: edges };
  }

  return { buildGraphElements: buildGraphElements };
});

(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AISV = root.AISV || {}; root.AISV.chains = api; }
})(typeof self !== 'undefined' ? self : this, function (root) {
  var graph = (root.AISV && root.AISV.graph) || require('./graph.js');

  function toStep(e) {
    return {
      from: e.source, to: e.target, type: e.type, inferred: e.inferred,
      evidence: e.evidence || null, reason: e.reason || null
    };
  }

  // Iterative DFS (white/grey/black) over the component's directed edges.
  function hasCycle(ids, out) {
    var state = {};
    for (var s = 0; s < ids.length; s++) {
      if (state[ids[s]]) continue;
      var stack = [{ id: ids[s], i: 0 }];
      state[ids[s]] = 1;
      while (stack.length) {
        var top = stack[stack.length - 1];
        var next = out[top.id];
        if (top.i < next.length) {
          var t = next[top.i++];
          if (state[t] === 1) return true;
          if (!state[t]) { state[t] = 1; stack.push({ id: t, i: 0 }); }
        } else {
          state[top.id] = 2;
          stack.pop();
        }
      }
    }
    return false;
  }

  function deriveChains(data, opts) {
    var g = graph.buildGraphElements(data, opts);
    var out = {}, inn = {}, parent = {};
    var ids = [];
    function find(x) {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }
    function touch(id) {
      if (parent[id] === undefined) { parent[id] = id; out[id] = []; inn[id] = 0; ids.push(id); }
    }
    g.edges.forEach(function (e) {
      touch(e.source); touch(e.target);
      out[e.source].push(e.target);
      inn[e.target]++;
      var a = find(e.source), b = find(e.target);
      if (a !== b) parent[a] = b;
    });

    var comps = {};
    ids.forEach(function (id) { (comps[find(id)] = comps[find(id)] || { nodes: [], edges: [] }).nodes.push(id); });
    g.edges.forEach(function (e) { comps[find(e.source)].edges.push(e); });

    var list = Object.keys(comps).map(function (k) {
      comps[k].nodes.sort();
      return comps[k];
    }).sort(function (a, b) { return a.nodes[0] < b.nodes[0] ? -1 : a.nodes[0] > b.nodes[0] ? 1 : 0; });

    var result = { simple: [], complex: [] };
    list.forEach(function (c) {
      var degOk = c.nodes.every(function (id) { return inn[id] <= 1 && out[id].length <= 1; });
      var roots = c.nodes.filter(function (id) { return inn[id] === 0; });
      if (degOk && c.nodes.length <= 4 && !hasCycle(c.nodes, out)) {
        var order = [roots[0]];
        var byFrom = {};
        c.edges.forEach(function (e) { byFrom[e.source] = e; });
        var steps = [];
        var cur = roots[0];
        while (byFrom[cur]) { steps.push(toStep(byFrom[cur])); cur = byFrom[cur].target; order.push(cur); }
        result.simple.push({ nodes: order, steps: steps });
        return;
      }
      var starts = roots.length ? roots : [c.nodes[0]];
      var seen = {}, bfs = [], q = starts.slice();
      starts.forEach(function (s) { seen[s] = true; });
      while (q.length) {
        var id = q.shift();
        bfs.push(id);
        out[id].forEach(function (t) { if (!seen[t]) { seen[t] = true; q.push(t); } });
      }
      // nodes unreachable from the starts (cycle fed from elsewhere) still belong to the component
      c.nodes.forEach(function (id) { if (!seen[id]) bfs.push(id); });
      result.complex.push({ nodes: bfs, steps: c.edges.map(toStep) });
    });
    return result;
  }

  return { deriveChains: deriveChains };
});

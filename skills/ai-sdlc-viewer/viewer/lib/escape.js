(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AISV = root.AISV || {}; root.AISV.escape = api; }
})(typeof self !== 'undefined' ? self : this, function (root) {
  var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) { return MAP[c]; });
  }
  return { escapeHtml: escapeHtml };
});

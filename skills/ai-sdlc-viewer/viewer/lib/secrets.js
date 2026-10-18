(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AISV = root.AISV || {}; root.AISV.secrets = api; }
})(typeof self !== 'undefined' ? self : this, function (root) {
  var PATTERNS = [
    { name: 'github-token', re: /ghp_[A-Za-z0-9]{36}/g },
    { name: 'sk-key', re: /sk-[A-Za-z0-9]{20,}/g },
    { name: 'aws-access-key', re: /AKIA[A-Z0-9]{16}/g },
    { name: 'slack-token', re: /xox[bpoa]-[A-Za-z0-9-]+/g },
    { name: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
    // The value is skipped when it is already [redacted], or when the whole value is a
    // variable/placeholder reference: $NAME, ${NAME}, ${{ ... }}, %NAME% (a <placeholder>
    // never matches because the value may not contain < or >).
    { name: 'key-value', re: /(?:password|passwd|secret|token|api[_-]?key)["']?\s*[:=]\s*["']?(?!\[redacted\])(?!\$\{\{)(?!(?:\$[A-Za-z_][A-Za-z0-9_]*|\$\{[A-Za-z_][A-Za-z0-9_.]*\}|%[A-Za-z_][A-Za-z0-9_]*%)(?:[\s"'<>,;]|$))[^\s"'<>,;]{6,}/gi },
    { name: 'url-credentials', re: /[a-z][a-z0-9+.-]*:\/\/[^\s:\/@]+:(?!\[redacted\])[^\s\/@]+@/gi }
  ];

  function findSecrets(text) {
    var out = [];
    if (typeof text !== 'string' || !text) return out;
    PATTERNS.forEach(function (p) {
      var re = new RegExp(p.re.source, p.re.flags);
      var m;
      while ((m = re.exec(text)) !== null) {
        out.push({ pattern: p.name, match: m[0] });
        if (m[0].length === 0) re.lastIndex++;
      }
    });
    return out;
  }
  return { findSecrets: findSecrets, PATTERNS: PATTERNS };
});

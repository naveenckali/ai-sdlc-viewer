const fs = require('node:fs');
const vm = require('node:vm');

function loadDataFile(file) {
  const code = fs.readFileSync(file, 'utf8');
  const window = {};
  vm.runInNewContext(code, { window }, { filename: file });
  if (window.AI_SDLC_DATA === undefined) throw new Error('AI_SDLC_DATA not defined');
  return window.AI_SDLC_DATA;
}

module.exports = { loadDataFile };

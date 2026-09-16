/* The shipping add-on catalogue, read out of addons.js itself so pricing analysis can
   never drift from the real list. addons.js is a classic browser script, so it is
   evaluated in a bare context rather than required. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const context = { console, Math };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'addons.js'), 'utf8'), context);
module.exports = vm.runInContext('ADDONS.map(a=>a.id)', context);

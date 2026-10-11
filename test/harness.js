// Loads the Apps Script source files into a Node sandbox so the pure
// functions can be tested without Google. Apps Script shares one global
// scope across files, and a vm context behaves the same way.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');

function listJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listJs(p);
    return e.name.endsWith('.js') ? [p] : [];
  }).sort();
}

function load(extraGlobals) {
  const context = vm.createContext(Object.assign({
    console,
    Utilities: {
      formatDate(date, tz, pattern) {
        const opts = { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' };
        const parts = Object.fromEntries(
          new Intl.DateTimeFormat('en-US', opts).formatToParts(date).map((p) => [p.type, p.value]));
        if (pattern === 'EEE, MMM d') return `${parts.weekday}, ${parts.month} ${parts.day}`;
        return date.toISOString();
      },
      sleep() {},
    },
  }, extraGlobals || {}));
  for (const file of listJs(SRC)) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  // Top-level const and let live in the context's script scope, so expose
  // what the tests need through a small evaluated getter.
  // `__run` evaluates a line of code in the sandbox, for example to reset
  // the per-execution settings cache between simulated trigger runs.
  return new Proxy({}, {
    get(_, name) {
      if (name === '__run') return (code) => vm.runInContext(code, context);
      return vm.runInContext(String(name), context);
    },
  });
}

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
}

module.exports = { load, fixture };

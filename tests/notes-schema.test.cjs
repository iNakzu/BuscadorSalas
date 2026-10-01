const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const stored = new Map([['mi_notas_v1', JSON.stringify({
  'me|Ecuaciones Diferenciales': {
    items: [{ id: 171, name: 'Solemne 1', weight: 30, grade: 5.8 }],
    examGrade: null,
    examWeight: 30,
    eximGrade: 5.0
  }
})]]);
const context = {
  document: { addEventListener() {} },
  window: {},
  localStorage: {
    getItem(key) { return stored.get(key) || null; },
    setItem(key, value) { stored.set(key, String(value)); }
  },
  console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/notas.js', 'utf8'), context);
context.initNotas();

const migrated = JSON.parse(stored.get('mi_notas_v1'))['me|Ecuaciones Diferenciales'];
assert.deepStrictEqual(migrated.items, [{ name: 'Solemne 1', weight: 30, grade: 5.8 }]);
assert.strictEqual(Object.prototype.hasOwnProperty.call(migrated, 'eximGrade'), false);

const defaults = JSON.parse(JSON.stringify(vm.runInContext('emptyPublicNotasData()', context)));
assert.strictEqual(Object.prototype.hasOwnProperty.call(defaults, 'eximGrade'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(defaults.items[0], 'id'), false);
console.log('notes-schema: legacy note ids and fixed exemption grade are removed');

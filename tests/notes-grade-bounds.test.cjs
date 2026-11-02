const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const stored = new Map([['mi_notas_v1', JSON.stringify({
  'me|Cálculo': {
    items: [
      { name: 'Solemne 1', weight: 40, grade: 20 },
      { name: 'Solemne 2', weight: 60, grade: 0.9 },
      { name: 'Control', weight: 0, grade: 'no es nota' }
    ],
    examGrade: 0.9,
    examWeight: 30
  }
})]]);
const context = {
  document: { addEventListener() {} },
  window: {},
  localStorage: {
    getItem(key) { return stored.get(key) || null; },
    setItem(key, value) { stored.set(key, String(value)); }
  },
  escapeHtml(value) { return String(value); },
  console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(process.env.NOTAS_JS_PATH || 'static/js/notas.js', 'utf8'), context);
context.initNotas();

let data = JSON.parse(stored.get('mi_notas_v1'))['me|Cálculo'];
assert.deepStrictEqual(data.items.map(item => item.grade), [7, 1, null], 'existing values are normalized when notes load');
assert.strictEqual(data.examGrade, 1, 'existing exam grade is normalized when notes load');

context.renderNotasBuilder = () => {};
vm.runInContext("NOTAS_DATA['me|Cálculo'] = {items: [{name: 'Prueba', weight: 100, grade: null}], examGrade: null};", context);
context.updateNotaItem('me|Cálculo', 0, 'grade', '20');
context.window.updateGlobalNota('me|Cálculo', 'examGrade', '0.9');
data = JSON.parse(stored.get('mi_notas_v1'))['me|Cálculo'];
assert.strictEqual(data.items[0].grade, 7, 'entering 20 stores 7 without prompting');
assert.strictEqual(data.examGrade, 1, 'entering 0.9 stores 1 without prompting');
context.window.updateGlobalNota('me|Cálculo', 'examGrade', '');
assert.strictEqual(JSON.parse(stored.get('mi_notas_v1'))['me|Cálculo'].examGrade, null, 'empty grades remain empty');

const source = fs.readFileSync(process.env.NOTAS_JS_PATH || 'static/js/notas.js', 'utf8');
assert.match(source, /step="0\.1" min="1\.0" max="7\.0" class="notas-input-grade"/);
console.log('notes-grade-bounds: manual and exam grades stay within 1.0–7.0 without alerts');

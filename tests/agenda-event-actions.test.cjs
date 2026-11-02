const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const values = new Map([
  ['agenda-id', { value: '' }],
  ['agenda-ramo', { value: '' }],
  ['agenda-tipo', { value: 'Solemne' }],
  ['agenda-fecha-base', { value: '2026-10-04' }],
  ['agenda-has-time', { value: 'false' }],
  ['agenda-hora', { value: '' }],
  ['agenda-notas', { value: '' }],
  ['agenda-ramo-error', { hidden: true }],
  ['agenda-trigger', { setAttribute() {}, focus() { this.focused = true; } }],
  ['dd-agenda-ramo', { querySelector() { return values.get('agenda-trigger'); } }]
]);
let saved = 0;
let rendered = 0;
const context = {
  document: {
    readyState: 'loading',
    addEventListener() {},
    getElementById(id) { return values.get(id) || null; },
    querySelector() { return null; }
  },
  window: { addEventListener() {} },
  localStorage: { setItem() { saved += 1; }, getItem() { return null; } },
  renderAgenda() { rendered += 1; },
  renderCalendar() { rendered += 1; },
  console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/agenda.js', 'utf8'), context);
context.renderAgenda = () => { rendered += 1; };
context.renderCalendar = () => { rendered += 1; };
context.selectDropdownItem = (_id, value, label) => {
  values.get('agenda-ramo').value = value;
  values.get('agenda-trigger').textContent = label;
};

context.guardarEventoAgenda({ preventDefault() {} });
assert.strictEqual(vm.runInContext('AGENDA_DATA.length', context), 0, 'must not save an event without an assignment');
assert.strictEqual(values.get('agenda-ramo-error').hidden, false, 'missing assignment should show inline guidance');
assert.strictEqual(values.get('agenda-trigger').focused, true, 'invalid submission should focus the assignment selector');
assert.strictEqual(saved, 0, 'invalid submission must not persist');

context.seleccionarRamoAgenda('Otro', 'Otro...');
context.guardarEventoAgenda({ preventDefault() {} });
assert.strictEqual(vm.runInContext('AGENDA_DATA[0].ramo', context), 'Otro', 'the explicit Other option is valid');
assert.strictEqual(values.get('agenda-ramo-error').hidden, true, 'selecting Other clears inline guidance');
assert.strictEqual(saved, 1);

context.confirmarWeb = () => { throw new Error('agenda deletion must not show a confirmation popup'); };
context.eliminarEventoAgenda(vm.runInContext('AGENDA_DATA[0].id', context));
assert.strictEqual(vm.runInContext('AGENDA_DATA.length', context), 0, 'delete action should remove the event immediately');
assert.strictEqual(saved, 2);
assert.strictEqual(rendered, 4, 'successful save and delete refresh agenda and calendar');

console.log('agenda-event-actions: assignment is required without a popup and delete is immediate');

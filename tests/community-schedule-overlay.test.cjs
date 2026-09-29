const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const container = { innerHTML: '', scrollIntoView() {} };
const context = {
  window: {},
  document: { getElementById: id => id === 'mihorario-display-container' ? container : null, addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {} },
  MI_HORARIO_DEFAULT_DATA: { escuela: 'EIT', clases: [] },
  state: { miHorarioRol: 'ALL', miHorarioSearch: '' },
  setTimeout() { return 1; },
  setInterval() { return 1; },
  normStr: value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
  escapeHtml: value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]),
  Date, Intl, JSON, String, Number, Array, console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/horario.js', 'utf8'), context);
vm.runInContext(`
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [{ id: 'mine', dia: 1, bloqueNum: 7, bloqueLabel: 'Etiqueta anterior', curso: 'Mi clase', tipo: 'Cátedra', sala: 'E101', profesor: 'Yo', rol: 'student' }] };
  renderMiHorario();
`, context);
const originalSchedule = vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases)', context);
context.window.mostrarHorarioAmigoEnMiHorario({ nombre: 'Ana García', clases: [
  { dia: 1, horaInicio: '17:30', horaFin: '18:50', curso: 'Clase amiga', tipo: 'Laboratorio', sala: 'E202', profesor: 'Ana' }
] });
assert.match(container.innerHTML, /Comparando horarios/);
assert.match(container.innerHTML, /17:30 - 18:50/);
assert.match(container.innerHTML, /Mi clase/);
assert.match(container.innerHTML, /Clase amiga/);
assert.match(container.innerHTML, /Ana García/);
assert.doesNotMatch(container.innerHTML, /my-btn-delete|abrirModalAgregarClase|Agregar ramo/);
assert.strictEqual(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases)', context), originalSchedule);
context.window.cerrarComparacionHorario();
assert.doesNotMatch(container.innerHTML, /Clase amiga|Comparando horarios/);
assert.match(container.innerHTML, /my-btn-delete/);
assert.match(container.innerHTML, /17:30 - 18:50/);
assert.strictEqual(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases)', context), originalSchedule);
console.log('community_schedule_overlay: comparison is read-only and preserves the personal schedule');

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const elements = new Map();
for (const id of ['schedule-import-file', 'schedule-import-button', 'schedule-import-preview', 'schedule-import-summary', 'schedule-import-list', 'schedule-import-apply', 'schedule-import-status']) {
  elements.set(id, {
    hidden: id === 'schedule-import-preview',
    disabled: false,
    textContent: '',
    innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} },
    scrollIntoView() {},
    replaceChildren() { this.innerHTML = ''; }
  });
}
const local = new Map();
const context = {
  window: {},
  localStorage: {
    getItem(key) { return local.has(key) ? local.get(key) : null; },
    setItem(key, value) { local.set(key, String(value)); }
  },
  document: {
    getElementById(id) { return elements.get(id) || null; },
    addEventListener() {},
    createElement() { return { classList: { add() {}, remove() {} }, appendChild() {} }; }
  },
  MI_HORARIO_DEFAULT_DATA: { escuela: 'EIT', clases: [] },
  setTimeout() { return 1; },
  setInterval() { return 1; },
  console,
  Date,
  Intl,
  JSON,
  String,
  Number,
  Array
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/horario.js', 'utf8'), context);

vm.runInContext(`
  actualizarContadoresFiltrosMiHorario = function () {};
  renderMiHorario = function () {};
  actualizarHeroMiHorario = function () {};
  mostrarToast = function (message) { globalThis.toastMessage = message; };
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [{ id: 'old-class', curso: 'Horario previo' }] };
  horarioImportadoPendiente = [
    { dia: 1, diaNombre: 'Lunes', horaInicio: '10:00', horaFin: '11:20', curso: 'Programación', tipo: 'Laboratorio', seccion: 'Sección A', sala: 'E310', profesor: 'Juan Soto', confianza: 0.9 },
    { dia: 1, diaNombre: 'Lunes', horaInicio: '08:30', horaFin: '09:50', curso: 'Cálculo I', tipo: 'Cátedra', seccion: '2', sala: 'E441.2.S201', profesor: 'María Pérez', confianza: 0.99 }
  ];
  confirmarImportacionHorario();
  globalThis.savedSchedule = JSON.parse(localStorage.getItem('mi_horario_custom_v1'));
`, context);

const schedule = context.savedSchedule;
assert.strictEqual(schedule.clases.length, 2);
assert.strictEqual(schedule.clases[0].id.startsWith('import-'), true);
assert.strictEqual(schedule.clases[0].curso, 'Cálculo I');
assert.strictEqual(schedule.clases[0].bloqueNum, 1);
assert.strictEqual(schedule.clases[0].profesor, 'María Pérez');
assert.strictEqual(schedule.clases[0].seccion, '2');
assert.strictEqual(schedule.clases[0].sala, 'E441.2.S201');
assert.strictEqual(schedule.clases[1].curso, 'Programación');
assert.strictEqual(schedule.clases[1].bloqueNum, 2);
assert.strictEqual(context.toastMessage, 'Horario cargado: 2 clases.');
console.log('schedule-import-ui: detected classes replace and persist with all details in time order');

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const elements = new Map();
for (const id of ['schedule-import-file', 'schedule-import-button', 'schedule-import-status']) {
  const classes = new Set();
  elements.set(id, {
    hidden: false,
    disabled: false,
    textContent: '',
    innerHTML: '',
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
      toggle(name, force) { if (force === undefined ? !classes.has(name) : force) classes.add(name); else classes.delete(name); }
    },
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

local.set('mi_horario_custom_v1', JSON.stringify({ escuela: 'EIT', clases: [
  { dia: 1, curso: 'Horario antiguo', bloqueNum: 6, bloqueLabel: '16:00 - 17:20', horaInicio: '16:00', horaFin: '17:20' }
]}));
vm.runInContext('MI_HORARIO_DATA = cargarMiHorarioDesdeStorage()', context);
const migratedLegacySchedule = JSON.parse(local.get('mi_horario_custom_v1'));
assert.strictEqual(Object.prototype.hasOwnProperty.call(migratedLegacySchedule.clases[0], 'bloqueLabel'), false);

vm.runInContext(`
  actualizarContadoresFiltrosMiHorario = function () {};
  renderMiHorario = function () {};
  actualizarHeroMiHorario = function () {};
  mostrarToast = function (message) { globalThis.toastMessage = message; };
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [{ id: 'old-class', curso: 'Horario previo' }] };
  cargarHorarioImportado([
    { dia: 1, diaNombre: 'Lunes', horaInicio: '16:00', horaFin: '17:20', curso: 'Redes', tipo: 'Cátedra', sala: 'E420', profesor: 'Lucía Rojas' },
    { dia: 1, diaNombre: 'Lunes', horaInicio: '10:00', horaFin: '11:20', curso: 'Programación', tipo: 'Laboratorio', seccion: 'Sección A', sala: 'E310', profesor: 'Juan Soto' },
    { dia: 1, diaNombre: 'Lunes', horaInicio: '08:30', horaFin: '09:50', curso: 'Cálculo I', tipo: 'Cátedra', seccion: '2', sala: 'E441.2.S201', profesor: 'María Pérez' },
    { dia: 1, diaNombre: 'Lunes', horaInicio: '14:30', horaFin: '15:50', curso: 'Álgebra', tipo: 'Cátedra', sala: 'E302', profesor: 'Mario Díaz' },
    { dia: 1, diaNombre: 'Lunes', horaInicio: '13:00', horaFin: '14:20', curso: 'Física', tipo: 'Cátedra', sala: 'E304', profesor: 'Ana Soto' },
    { dia: 1, diaNombre: 'Lunes', horaInicio: '11:30', horaFin: '12:50', curso: 'Cálculo II', tipo: 'Cátedra', sala: 'E306', profesor: 'Pedro Rojas' }
  ]);
  globalThis.savedSchedule = JSON.parse(localStorage.getItem('mi_horario_custom_v1'));
`, context);

const schedule = context.savedSchedule;
assert.strictEqual(schedule.clases.length, 6);
assert.strictEqual(schedule.clases[0].id.startsWith('import-'), true);
assert.strictEqual(schedule.clases[0].curso, 'Cálculo I');
assert.strictEqual(schedule.clases[0].bloqueNum, 1);
assert.strictEqual(schedule.clases[0].profesor, 'María Pérez');
assert.strictEqual(schedule.clases[0].seccion, '2');
assert.strictEqual(schedule.clases[0].sala, 'E441.2.S201');
assert.strictEqual(schedule.clases[1].curso, 'Programación');
assert.strictEqual(schedule.clases[1].bloqueNum, 2);
assert.strictEqual(schedule.clases[2].curso, 'Cálculo II');
assert.strictEqual(schedule.clases[2].bloqueNum, 3);
assert.strictEqual(schedule.clases[3].curso, 'Física');
assert.strictEqual(schedule.clases[3].bloqueNum, 4);
assert.strictEqual(schedule.clases[4].curso, 'Álgebra');
assert.strictEqual(schedule.clases[4].bloqueNum, 5);
assert.strictEqual(schedule.clases[5].curso, 'Redes');
assert.strictEqual(schedule.clases[5].bloqueNum, 6);
assert.strictEqual(Object.prototype.hasOwnProperty.call(schedule.clases[5], 'bloqueLabel'), false);
assert.strictEqual(context.toastMessage, 'Horario cargado: 6 clases.');

vm.runInContext(`
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [{ id: 'preserved', curso: 'Horario actual' }] };
  guardarMiHorarioEnStorage();
  globalThis.sameCourseResult = cargarHorarioImportado([
    { dia: 1, horaInicio: '11:30', horaFin: '12:50', curso: 'Cálculo', tipo: 'Cátedra', seccion: '1', sala: 'E101', profesor: 'Ana' },
    { dia: 1, horaInicio: '13:00', horaFin: '14:20', curso: 'Cálculo', tipo: 'Cátedra', seccion: '1', sala: 'E101', profesor: 'Ana' }
  ]);
  globalThis.sameCourseSchedule = JSON.parse(localStorage.getItem('mi_horario_custom_v1'));
  globalThis.longClassResult = cargarHorarioImportado([
    { dia: 1, horaInicio: '11:30', horaFin: '14:20', curso: 'Estadística', tipo: 'Cátedra', seccion: '1', sala: 'E102', profesor: 'Luis' }
  ]);
  globalThis.longClassSchedule = JSON.parse(localStorage.getItem('mi_horario_custom_v1'));
`, context);
assert.strictEqual(context.sameCourseResult, true);
assert.deepStrictEqual(context.sameCourseSchedule.clases.map(item => item.bloqueNum), [3, 4]);
assert.deepStrictEqual(context.sameCourseSchedule.clases.map(item => item.curso), ['Cálculo', 'Cálculo']);
assert.strictEqual(context.longClassResult, true);
assert.deepStrictEqual(context.longClassSchedule.clases.map(item => item.bloqueNum), [3, 4]);

vm.runInContext(`
  globalThis.duplicateResult = cargarHorarioImportado([
    { dia: 1, horaInicio: '11:30', horaFin: '12:50', curso: 'Química', tipo: 'Cátedra', seccion: '1', sala: 'E103', profesor: 'Eva' },
    { dia: 1, horaInicio: '11:30', horaFin: '12:50', curso: 'Química', tipo: 'Cátedra', seccion: '1', sala: 'E103', profesor: 'Eva' }
  ]);
  globalThis.duplicateSchedule = JSON.parse(localStorage.getItem('mi_horario_custom_v1'));
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [{ id: 'preserved', curso: 'Horario actual' }] };
  guardarMiHorarioEnStorage();
  globalThis.conflictResult = cargarHorarioImportado([
    { dia: 1, horaInicio: '11:30', horaFin: '12:50', curso: 'Química', tipo: 'Cátedra', sala: 'E103' },
    { dia: 1, horaInicio: '11:30', horaFin: '12:50', curso: 'Física', tipo: 'Cátedra', sala: 'E104' }
  ]);
  globalThis.conflictSchedule = JSON.parse(localStorage.getItem('mi_horario_custom_v1'));
`, context);
assert.strictEqual(context.duplicateResult, true);
assert.strictEqual(context.duplicateSchedule.clases.length, 1);
assert.strictEqual(context.conflictResult, false);
assert.strictEqual(context.conflictSchedule.clases[0].id, 'preserved');
assert.strictEqual(elements.get('schedule-import-status').classList.contains('is-block-warning'), true);
assert.match(elements.get('schedule-import-status').textContent, /Solo se permite una clase por bloque horario/);
assert.doesNotMatch(elements.get('schedule-import-status').textContent, /Química|Física|11:30/);

(async () => {
  const file = { type: 'image/jpeg', size: 100, name: 'horario.jpg' };
  const input = { files: [file], value: '' };
  context.window.PortalAuth = {
    client: { auth: { getSession: async () => ({ data: { session: { access_token: 'session-token' } }, error: null }) } }
  };
  context.FormData = class { append() {} };
  context.fetch = async url => {
    assert.strictEqual(url, '/api/import_schedule');
    return { ok: true, json: async () => ({ clases: [
      { dia: 2, diaNombre: 'Martes', horaInicio: '11:30', horaFin: '12:50', curso: 'Estructuras', tipo: 'Cátedra' }
    ] }) };
  };
  await context.importarHorarioDesdeFoto({ target: input });
  const directlyLoaded = JSON.parse(local.get('mi_horario_custom_v1'));
  assert.strictEqual(directlyLoaded.clases.length, 1);
  assert.strictEqual(directlyLoaded.clases[0].bloqueNum, 3);
  assert.strictEqual(directlyLoaded.clases[0].curso, 'Estructuras');
  assert.strictEqual(input.value, '');
  console.log('schedule-import-ui: photo upload loads detected classes directly into matching timetable blocks');
})().catch(error => { console.error(error); process.exit(1); });

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const elements = new Map();
const documentListeners = new Map();
for (const id of ['schedule-import-file', 'schedule-import-button', 'schedule-import-status']) {
  elements.set(id, {
    hidden: false,
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
    addEventListener(name, callback) { documentListeners.set(name, callback); },
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
const pushSchedule = JSON.parse(JSON.stringify(context.window.portalGetSchedulePushData()));
assert.deepStrictEqual(pushSchedule[0], { day: 1, time: '08:30', finish: '09:50', course: 'Cálculo I' });
assert.strictEqual(elements.get('schedule-import-status').textContent, '', 'successful import should clear progress without showing a success notification');
assert(!/Horario cargado:/.test(fs.readFileSync('static/js/horario.js', 'utf8')), 'successful Gemini import must not create a toast notification');

(async () => {
  const file = { type: 'image/jpeg', size: 100, name: 'horario.jpg' };
  const input = { files: [file], value: '' };
  context.window.PortalAuth = {
    client: { auth: { getSession: async () => ({ data: { session: { access_token: 'session-token' } }, error: null }) } }
  };
  context.FormData = class { append() {} };
  let syncPayload = null;
  let syncCalls = 0;
  context.fetch = async (url, options = {}) => {
    if (url === '/api/import_schedule') {
      return { ok: true, json: async () => ({ clases: [
        { dia: 2, diaNombre: 'Martes', horaInicio: '11:30', horaFin: '12:50', curso: 'Estructuras', tipo: 'Cátedra', seccion: '2' }
      ] }) };
    }
    assert.strictEqual(url, '/api/sync_horario');
    syncCalls += 1;
    syncPayload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => syncPayload.clases.map(clase => ({ ...clase, sala: 'E441.2.S201' }))
    };
  };
  await context.importarHorarioDesdeFoto({ target: input });
  await new Promise(resolve => setImmediate(resolve));
  const directlyLoaded = JSON.parse(local.get('mi_horario_custom_v1'));
  assert.strictEqual(directlyLoaded.clases.length, 1);
  assert.strictEqual(directlyLoaded.clases[0].bloqueNum, 3);
  assert.strictEqual(directlyLoaded.clases[0].curso, 'Estructuras');
  assert.strictEqual(syncPayload.clases[0].seccion, '2');
  assert.strictEqual(directlyLoaded.clases[0].sala, 'E441.2.S201');
  let persistedSchedule = null;
  context.window.PortalStore = { save(module, payload) { assert.strictEqual(module, 'schedule'); persistedSchedule = payload; } };
  await documentListeners.get('portal:section-entered')({ detail: { panelId: 'tab-mihorario' } });
  assert.strictEqual(syncCalls, 2, 'an unresolved or stale schedule can be synchronized again without editing it');
  assert.strictEqual(persistedSchedule.clases[0].sala, 'E441.2.S201');
  assert.strictEqual(input.value, '');
  console.log('schedule-import-ui: photo upload loads classes and immediately syncs their room data');
})().catch(error => { console.error(error); process.exit(1); });

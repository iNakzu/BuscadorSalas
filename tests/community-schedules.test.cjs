const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('static/js/community_schedules.js', 'utf8');
assert.match(source, /config\.module === 'agenda'\)\s*\{\s*toolbar\.innerHTML = `<label>/);
assert.doesNotMatch(source, /config\.module === 'agenda'\)[\s\S]{0,140}<span>Información de<\/span>/);
const elements = new Map();
const sharedSchedules = [{ user_id: 'friend', display_name: 'Ana García López', modules: {
  schedule: { clases: [{ dia: 1, horaInicio: '08:30', horaFin: '09:50', curso: 'Cálculo', sala: 'E101' }] },
  grades: { 'me|Cálculo': { items: [{ name: 'Solemne 1', weight: 30, grade: 6.1 }] } },
  agenda: [{ fecha: '2026-10-02', ramo: 'Cálculo', tipo: 'Solemne' }],
  curriculum: { 1: 2 }
} }];
const client = { rpc: async name => ({ data: (assert.strictEqual(name, 'get_shared_information'), sharedSchedules), error: null }) };
const selectors = [];
const publicContents = [
  { dataset: { module: 'grades' }, hidden: true, innerHTML: '' },
  { dataset: { module: 'agenda' }, hidden: true, innerHTML: '' }
];
const context = {
  window: {
    PortalAuth: { user: { id: 'self' }, client },
    mostrarHorarioPerfilEnMiHorario: value => { context.sharedSchedule = value; },
    cerrarHorarioPerfilEnMiHorario: () => { context.sharedSchedule = null; },
    renderNotasPublicas: (container, payload) => { context.publicGrades = payload; container.innerHTML = 'personal notes component'; },
    renderAgendaPublica: (container, payload) => { context.publicAgenda = payload; container.innerHTML = 'personal agenda component'; }
  },
  document: {
    getElementById: id => elements.get(id),
    querySelector: () => null,
    querySelectorAll: selector => selector === '.public-profile-select' ? selectors : selector === '.public-profile-content' ? publicContents : [],
    addEventListener() {}
  }, console
};
vm.createContext(context);
vm.runInContext(source, context);

(async () => {
  await context.window.cargarHorariosComunidad();
  context.window.PortalCommunity.select('friend');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.sharedSchedule)), [
    { dia: 1, horaInicio: '08:30', horaFin: '09:50', curso: 'Cálculo', sala: 'E101' }
  ]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.window.PortalCommunity.getSelected().modules.agenda)), [
    { fecha: '2026-10-02', ramo: 'Cálculo', tipo: 'Solemne' }
  ]);
  assert.strictEqual(publicContents[0].innerHTML, 'personal notes component');
  assert.strictEqual(publicContents[1].innerHTML, 'personal agenda component');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.publicGrades['me|Cálculo'].items)), [
    { name: 'Solemne 1', weight: 30, grade: 6.1 }
  ]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.publicAgenda)), [
    { fecha: '2026-10-02', ramo: 'Cálculo', tipo: 'Solemne' }
  ]);
  context.window.PortalCommunity.select('');
  assert.strictEqual(context.sharedSchedule, null);
  console.log('community_schedules: common profile selection still loads shared modules without a directory');
})().catch(error => { console.error(error); process.exit(1); });

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('static/js/community_schedules.js', 'utf8');
const elements = new Map([
  ['community-schedules-status', { hidden: false, textContent: '' }],
  ['community-schedules-list', { hidden: false, innerHTML: '' }],
  ['community-schedules-search', { value: '' }]
]);
const sharedSchedules = [{ user_id: 'friend', display_name: 'Ana García López', modules: {
  schedule: { clases: [{ dia: 1, horaInicio: '08:30', horaFin: '09:50', curso: 'Cálculo', sala: 'E101' }] },
  grades: { 'me|Cálculo': { items: [{ name: 'Solemne 1', weight: 30, grade: 6.1 }] } },
  agenda: [{ fecha: '2026-10-02', ramo: 'Cálculo', tipo: 'Solemne' }],
  curriculum: { 1: 2 }
} }];
const client = { rpc: async name => ({ data: (assert.strictEqual(name, 'get_shared_information'), sharedSchedules), error: null }) };
const listButtons = [];
const publicContents = [
  { dataset: { module: 'grades' }, hidden: true, innerHTML: '' },
  { dataset: { module: 'agenda' }, hidden: true, innerHTML: '' }
];
const context = {
  window: { PortalAuth: { user: { id: 'self' }, client }, mostrarHorarioAmigoEnMiHorario: value => { context.comparison = value; } },
  document: {
    getElementById: id => elements.get(id),
    querySelectorAll: selector => selector === '.community-view-schedule' ? listButtons : selector === '.public-profile-content' ? publicContents : [],
    addEventListener() {}
  }, console
};
vm.createContext(context);
vm.runInContext(source, context);

(async () => {
  await context.window.cargarHorariosComunidad();
  const html = elements.get('community-schedules-list').innerHTML;
  assert.match(html, /Ana García López/);
  assert.match(html, /community-name-first">Ana López/);
  assert.match(html, /Ver información/);
  assert.doesNotMatch(html, /community-week|community-class|Ventanas:/);
  assert.match(html, /class="community-user-header"/);
  const attributes = {};
  const label = { textContent: 'Ver horario' };
  const card = { dataset: { userId: 'friend' }, querySelector: () => ({ textContent: 'Ana García López' }) };
  const button = { closest: () => card, querySelector: () => label, setAttribute: (key, value) => { attributes[key] = value; } };
  listButtons.push(button);
  context.window.verHorarioAmigo(button);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.comparison)), {
    nombre: 'Ana García López',
    clases: [{ dia: 1, horaInicio: '08:30', horaFin: '09:50', curso: 'Cálculo', sala: 'E101' }]
  });
  assert.strictEqual(attributes['aria-expanded'], 'true');
  assert.strictEqual(label.textContent, 'Viendo información');
  assert.match(elements.get('community-schedules-status').textContent, /1 usuario comparte su información/);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.window.PortalCommunity.getSelected().modules.agenda)), [
    { fecha: '2026-10-02', ramo: 'Cálculo', tipo: 'Solemne' }
  ]);
  assert.match(publicContents[0].innerHTML, /Solemne 1/);
  assert.match(publicContents[0].innerHTML, /6\.1/);
  assert.match(publicContents[1].innerHTML, /2026-10-02/);
  console.log('community_schedules: public information selection includes all shared modules');
})().catch(error => { console.error(error); process.exit(1); });

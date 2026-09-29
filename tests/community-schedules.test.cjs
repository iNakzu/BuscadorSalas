const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('static/js/community_schedules.js', 'utf8');
const elements = new Map([
  ['community-schedules-status', { hidden: false, textContent: '' }],
  ['community-schedules-list', { hidden: false, innerHTML: '' }],
  ['community-schedules-search', { value: '' }]
]);
const sharedSchedules = [{ user_id: 'friend', display_name: 'Ana García López', payload: { clases: [
  { dia: 1, horaInicio: '08:30', horaFin: '09:50', curso: 'Cálculo', sala: 'E101' }
] } }];
const client = { rpc: async name => ({ data: (assert.strictEqual(name, 'get_shared_schedules'), sharedSchedules), error: null }) };
const listButtons = [];
const context = {
  window: { PortalAuth: { user: { id: 'self' }, client }, mostrarHorarioAmigoEnMiHorario: value => { context.comparison = value; } },
  document: {
    getElementById: id => elements.get(id),
    querySelectorAll: selector => selector === '.community-view-schedule' ? listButtons : [],
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
  assert.match(html, /Ver horario/);
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
  assert.strictEqual(label.textContent, 'Viendo horario');
  assert.match(elements.get('community-schedules-status').textContent, /1 usuario comparte su horario/);
  console.log('community_schedules: cards launch read-only timetable comparison and show full mobile name');
})().catch(error => { console.error(error); process.exit(1); });

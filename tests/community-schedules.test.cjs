const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('static/js/community_schedules.js', 'utf8');
const elements = new Map([
  ['community-schedules-status', { hidden: false, textContent: '' }],
  ['community-schedules-list', { hidden: false, innerHTML: '' }],
  ['community-schedules-search', { value: '' }]
]);
const sharedSchedules = [{
  user_id: 'friend',
  display_name: 'Ana García',
  payload: { clases: [
    { dia: 1, horaInicio: '08:30', horaFin: '09:50', curso: '<img src=x>', sala: 'E101' },
    { dia: 1, horaInicio: '10:30', horaFin: '11:50', curso: 'Cálculo', sala: 'E202' }
  ] }
}];
const client = {
  rpc(name) {
    assert.strictEqual(name, 'get_shared_schedules');
    return Promise.resolve({ data: sharedSchedules, error: null });
  }
};
const listeners = {};
const context = {
  window: { PortalAuth: { user: { id: 'self' }, client } },
  document: {
    getElementById: id => elements.get(id),
    querySelectorAll: () => [],
    addEventListener: (name, callback) => { listeners[name] = callback; }
  },
  console
};
vm.createContext(context);
vm.runInContext(source, context);

(async () => {
  await context.window.cargarHorariosComunidad();
  const html = elements.get('community-schedules-list').innerHTML;
  assert.match(html, /Ana García/);
  assert.doesNotMatch(html, /Mi cuenta/);
  assert.match(html, /Ver horario/);
  assert.match(html, /class="community-week" hidden/);
  assert.match(html, /community-user-identity/);
  const schedule = { hidden: true };
  const attributes = {};
  const button = {
    textContent: 'Ver horario',
    closest: () => ({ querySelector: () => schedule }),
    setAttribute: (name, value) => { attributes[name] = value; }
  };
  context.window.verHorarioAmigo(button);
  assert.strictEqual(schedule.hidden, false);
  assert.strictEqual(attributes['aria-expanded'], 'true');
  assert.strictEqual(button.textContent, 'Ocultar horario');
  context.window.verHorarioAmigo(button);
  assert.strictEqual(schedule.hidden, true);
  assert.strictEqual(attributes['aria-expanded'], 'false');
  assert.match(html, /08:30–09:50/);
  assert.match(html, /Ventanas:<\/span> 09:50–10:30/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.match(elements.get('community-schedules-status').textContent, /1 usuario comparte su horario/);
  console.log('community_schedules: shared profiles, room schedule, windows, and escaping passed');
})().catch(error => { console.error(error); process.exit(1); });

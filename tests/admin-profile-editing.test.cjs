const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('static/js/community_schedules.js', 'utf8');
const calls = [];
const contentModules = ['schedule', 'grades', 'agenda', 'curriculum'].map(module => ({
  dataset: { module },
  hidden: true,
  innerHTML: '',
  addEventListener() {}
}));
const client = { rpc: async (name, args) => {
  calls.push(name);
  if (name === 'admin_search_profiles') return { data: [{ user_id: 'target', display_name: 'Perfil objetivo' }], error: null };
  if (name === 'admin_get_profile_information') return { data: {
    schedule: { clases: [{ curso: 'Álgebra', dia: 1, bloqueNum: 1, horaInicio: '08:30', horaFin: '09:50' }] },
    grades: { 'me|Álgebra': { items: [], examGrade: null, examWeight: 30 } },
    agenda: [{ ramo: 'Álgebra', fecha: '2026-10-05', tipo: 'Control' }],
    curriculum: { __careerId: 'ingenieria-civil-en-informatica-y-telecomunicaciones' }
  }, error: null };
  throw new Error(`Unexpected RPC: ${name}`);
} };
const sections = new Map(['tab-mihorario', 'tab-solemnes', 'tab-notas', 'tab-agenda', 'tab-progreso'].map(id => [id, { classList: { toggle() {} } }]));
const document = {
  getElementById: id => sections.get(id) || null,
  querySelector: () => null,
  querySelectorAll: selector => selector === '.public-profile-content' ? contentModules : [],
  addEventListener() {},
  dispatchEvent() {}
};
const context = {
  window: { PortalAuth: { user: { id: 'admin', app_metadata: { portal_role: 'admin' } }, client } },
  document,
  CustomEvent: class CustomEvent {},
  console
};
vm.createContext(context);
vm.runInContext(source, context);

(async () => {
  await context.window.cargarHorariosComunidad();
  await context.window.PortalCommunity.select('target');
  assert.ok(calls.includes('admin_search_profiles'));
  assert.ok(calls.includes('admin_get_profile_information'));
  assert.ok(!calls.includes('search_shared_profiles'));
  assert.ok(contentModules.every(content => content.innerHTML.includes('admin-profile-editor')));
  assert.equal(context.window.PortalCommunity.getSelected().modules.schedule.clases[0].curso, 'Álgebra');
  console.log('admin-profile-editing: selected profiles load editable content through admin RPCs');
})().catch(error => { console.error(error); process.exit(1); });

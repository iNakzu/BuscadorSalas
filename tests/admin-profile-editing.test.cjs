const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('static/js/community_schedules.js', 'utf8');
const calls = [];
const publicRenderCalls = [];
const scheduleSyncRequests = [];
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
    schedule: { clases: [{ id: 'algebra-source', curso: 'Álgebra', dia: 1, bloqueNum: 1, horaInicio: '08:30', horaFin: '09:50', seccion: 'Sección 7' }] },
    grades: { 'me|Álgebra': { items: [], examGrade: null, examWeight: 30 } },
    agenda: [{ ramo: 'Álgebra', fecha: '2026-10-05', tipo: 'Control' }],
    curriculum: { __careerId: 'ingenieria-civil-en-informatica-y-telecomunicaciones' }
  }, error: null };
  if (name === 'admin_update_profile_module') return { data: true, error: null };
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
  window: {
    PortalAuth: { user: { id: 'admin', app_metadata: { portal_role: 'admin' } }, client },
    renderNotasPublicas: (element, payload, options) => { publicRenderCalls.push(['grades', options]); element.innerHTML = 'shared-grades-view'; },
    renderAgendaPublica: (element, payload, options) => { publicRenderCalls.push(['agenda', options]); element.innerHTML = 'shared-agenda-view'; },
    renderMallaPublica: (element, payload, options) => { publicRenderCalls.push(['curriculum', options]); element.innerHTML = 'shared-curriculum-view'; },
    mostrarHorarioPerfilEnMiHorario: classes => { contentModules[0].innerHTML = `shared-schedule-view:${classes.length}`; },
    renderSolemnes() {}
  },
  document,
  CustomEvent: class CustomEvent {},
  fetch: async (url, options = {}) => {
    if (url === '/api/sync_horario') {
      const body = JSON.parse(options.body);
      scheduleSyncRequests.push(body);
      return { ok: true, json: async () => body.clases.map(item => item.id === 'teacher-only'
        ? { ...item, sala: 'E441.3.S302', seccion: 'Sección 4', profesor: 'FAIVOVICH EDUARDO JAIME' }
        : item) };
    }
    return { ok: true, json: async () => ({ semestres: [] }) };
  },
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
  assert.equal(contentModules[0].innerHTML, 'shared-schedule-view:1');
  assert.equal(contentModules[1].innerHTML, 'shared-grades-view');
  assert.equal(contentModules[2].innerHTML, 'shared-agenda-view');
  assert.equal(contentModules[3].innerHTML, 'shared-curriculum-view');
  assert.deepEqual(publicRenderCalls.map(([module]) => module), ['grades', 'agenda', 'curriculum']);
  assert.ok(publicRenderCalls.every(([, options]) => options && options.editable === true));
  assert.ok(contentModules.every(content => !content.innerHTML.includes('admin-profile-editor')));
  assert.equal(context.window.PortalCommunity.getSelected().modules.schedule.clases[0].curso, 'Álgebra');
  await context.window.PortalCommunity.updateSelectedSchedule(classes => { classes[0].curso = 'Álgebra corregida'; });
  await context.window.PortalCommunity.updateSelectedSchedule(classes => {
    classes[0].curso = 'Álgebra';
    classes.push({ id: 'same-course', curso: 'Algebra', dia: 1, bloqueNum: 2, horaInicio: '10:00', horaFin: '11:20', seccion: '', sala: '', profesor: '' });
    classes.push({ id: 'teacher-only', curso: 'Evaluación de Proyectos TIC', dia: 1, bloqueNum: 6, horaInicio: '16:00', horaFin: '17:20', seccion: '', sala: '', profesor: 'FAIVOVICH EDUARDO JAIME' });
  });
  await context.window.PortalCommunity.updateSelectedGradeCourse('me|Álgebra', 'examGrade', 6.2);
  await context.window.PortalCommunity.updateSelectedAgenda(events => { events[0].notas = 'Revisar'; });
  context.window.PortalCommunity.toggleCurriculum('1');
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(calls.includes('admin_update_profile_module'));
  assert.ok(scheduleSyncRequests.length >= 2, 'admin schedule edits must run the official JSON enrichment');
  const selected = context.window.PortalCommunity.getSelected().modules;
  assert.equal(selected.schedule.clases[0].curso, 'Álgebra');
  assert.equal(selected.schedule.clases.find(item => item.id === 'same-course').seccion, 'Sección 7', 'same-course classes inherit the profile section');
  assert.equal(selected.schedule.clases.find(item => item.id === 'teacher-only').sala, 'E441.3.S302', 'a unique teacher/day/time JSON match fills the room');
  assert.equal(selected.schedule.clases.find(item => item.id === 'teacher-only').seccion, 'Sección 4');
  assert.equal(selected.grades['me|Álgebra'].examGrade, 6.2);
  assert.equal(selected.agenda[0].notas, 'Revisar');
  assert.equal(selected.curriculum['ingenieria-civil-en-informatica-y-telecomunicaciones:1'], 1);
  console.log('admin-profile-editing: shared views stay in place and changes persist through admin RPCs');
})().catch(error => { console.error(error); process.exit(1); });

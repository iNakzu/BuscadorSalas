const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const curriculumUrl = '/api/malla/progreso/ingenieria-civil-en-ciencia-de-datos-e-inteligencia-artificial';
const container = { innerHTML: '', querySelector: () => null };
const listeners = {};
let failNextCurriculum = false;
let curriculumFetches = 0;
const context = {
  window: { PortalAuth: { user: { user_metadata: { career: 'Ingeniería Civil en Ciencia de Datos e Inteligencia Artificial' } } },
    PortalProfile: { getCareerId: () => 'ingenieria-civil-en-ciencia-de-datos-e-inteligencia-artificial' } },
  document: {
    getElementById: id => id === 'progreso-container' ? container : null,
    addEventListener: (name, callback) => { listeners[name] = callback; }
  },
  localStorage: { getItem: () => null, setItem() {} },
  fetch: async url => {
    assert.match(url, /^\/api\/malla\/progreso\//);
    curriculumFetches += 1;
    if (failNextCurriculum) {
      failNextCurriculum = false;
      return { ok: false, status: 503, json: async () => ({}) };
    }
    const semestres = url.endsWith('retry-career')
      ? [{ numero: 1, cursos: [{ id: 'course-1', nombre: 'Álgebra' }] }]
      : [];
    return { ok: true, json: async () => ({ semestres }) };
  },
  console
};

vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/progreso.js', 'utf8'), context);

(async () => {
  const unassignedLegacy = vm.runInContext("migrateProgressState({'1': 2}, '')", context);
  assert.strictEqual(unassignedLegacy.__careerId, undefined, 'legacy progress must not be assigned to a guessed career');
  const assignedLegacy = vm.runInContext("migrateProgressState({'1': 2}, 'career-a')", context);
  assert.strictEqual(assignedLegacy['career-a:1'], 2, 'legacy progress migrates only after a career is known');

  await vm.runInContext('renderProgreso()', context);
  assert.match(container.innerHTML, /Esta malla todavía no está disponible/);
  assert.match(container.innerHTML, /Ingeniería Civil en Ciencia de Datos e Inteligencia Artificial/);

  context.window.PortalAuth.user = null;
  await vm.runInContext('renderProgreso()', context);
  assert.match(container.innerHTML, /Inicia sesión para ver tu malla/);

  context.window.PortalAuth.user = { user_metadata: {} };
  context.window.PortalProfile.getCareerId = () => null;
  await vm.runInContext('renderProgreso()', context);
  assert.match(container.innerHTML, /Configura tu carrera/);

  failNextCurriculum = true;
  const failedLoad = await vm.runInContext("loadCurriculum('retry-career')", context);
  assert.deepStrictEqual(Array.from(failedLoad), [], 'temporary failures should render the unavailable state');
  const retriedLoad = await vm.runInContext("loadCurriculum('retry-career')", context);
  assert.strictEqual(retriedLoad.length, 1, 'a later request should load the curriculum after recovery');
  assert.strictEqual(curriculumFetches, 3, 'the failed response must not remain cached');

  console.log('progreso-career-gates: access gates and curriculum retry scenarios passed');
})().catch(error => { console.error(error); process.exit(1); });

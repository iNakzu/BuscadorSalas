const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const curriculumUrl = '/api/malla/progreso/ingenieria-civil-en-ciencia-de-datos-e-inteligencia-artificial';
const container = { innerHTML: '' };
const listeners = {};
const context = {
  window: { PortalAuth: { user: { user_metadata: { career: 'Ingeniería Civil en Ciencia de Datos e Inteligencia Artificial' } } },
    PortalProfile: { getCareerId: () => 'ingenieria-civil-en-ciencia-de-datos-e-inteligencia-artificial' } },
  document: {
    getElementById: id => id === 'progreso-container' ? container : null,
    addEventListener: (name, callback) => { listeners[name] = callback; }
  },
  localStorage: { getItem: () => null, setItem() {} },
  fetch: async url => {
    assert.strictEqual(url, curriculumUrl);
    return { ok: true, json: async () => ({ semestres: [] }) };
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

  console.log('progreso-career-gates: login, career and unavailable-curriculum states are explicit');
})().catch(error => { console.error(error); process.exit(1); });

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = {
  window: { innerWidth: 1200, addEventListener() {}, removeEventListener() {} },
  document: {
    getElementById() { return null; },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    visibilityState: 'visible'
  },
  localStorage: { getItem() { return null; }, setItem() {} },
  MI_HORARIO_DEFAULT_DATA: { escuela: 'EIT', clases: [] },
  setTimeout() { return 1; },
  clearTimeout() {},
  setInterval() { return 1; },
  console, Date, Intl, JSON, String, Number, Array, Map,
  CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options && options.detail; }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/horario.js', 'utf8'), context);
vm.runInContext(`
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [
    { curso: 'Señales y Sistemas', tipo: 'Cátedra', profesor: 'LARA ROBERTO CARLOS', seccion: 'Sección 3' },
    { curso: 'Señales y Sistemas', tipo: 'Ayudantía', profesor: '', seccion: 'Sección 4' },
    { curso: 'Señales y Sistemas', tipo: 'Laboratorio', profesor: '', seccion: '-' },
    { curso: 'Señales y Sistemas', tipo: 'Ayudantía', profesor: '', seccion: '' },
    { curso: 'Señales y Sistemas de Control', tipo: 'Cátedra', profesor: '', seccion: 'Sección 4' }
  ] };
  let saves = 0;
  guardarMiHorarioEnStorage = () => { saves += 1; };
`, context);

context.renderMiHorario();
assert.strictEqual(vm.runInContext('MI_HORARIO_DATA.clases[1].seccion', context), 'Sección 3', 'a professor-backed lecture section should replace a conflicting section read from the image');
assert.strictEqual(vm.runInContext('MI_HORARIO_DATA.clases[2].seccion', context), 'Sección 3', 'a blank same-course laboratory section should be filled');
assert.strictEqual(vm.runInContext('MI_HORARIO_DATA.clases[3].seccion', context), 'Sección 3', 'all same-course classes should share the chosen section');
assert.strictEqual(vm.runInContext('MI_HORARIO_DATA.clases[4].seccion', context), 'Sección 4', 'a differently named course must keep its own section');
assert.strictEqual(vm.runInContext('saves', context), 1, 'the migrated schedule should be persisted automatically');
console.log('schedule-existing-section-migration: passed');

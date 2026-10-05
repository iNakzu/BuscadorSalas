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
    { curso: 'Arquitectura y Organización de Computadores', tipo: 'Cátedra', seccion: 'Sección 3' },
    { curso: 'ARQUITECTURA Y ORGANIZACION DE COMPUTADORES.', tipo: 'Laboratorio', seccion: '-' },
    { curso: '', cursoDisplay: 'Arquitectura y Organización de Computadores', tipo: 'Ayudantía', seccion: '' }
  ] };
  let saves = 0;
  guardarMiHorarioEnStorage = () => { saves += 1; };
`, context);

context.renderMiHorario();
assert.strictEqual(vm.runInContext('MI_HORARIO_DATA.clases[1].seccion', context), '3', 'existing laboratory should inherit the lecture section on render');
assert.strictEqual(vm.runInContext('MI_HORARIO_DATA.clases[2].seccion', context), '3', 'existing tutorial should inherit the lecture section on render');
assert.strictEqual(vm.runInContext('saves', context), 1, 'the migrated schedule should be persisted automatically');
console.log('schedule-existing-section-migration: passed');

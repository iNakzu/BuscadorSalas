const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const fields = new Map();
const fieldIds = [
  'modal-add-id', 'modal-add-dia', 'modal-add-bloque', 'modal-add-hora-inicio',
  'modal-add-curso', 'modal-add-tipo', 'modal-add-sala', 'modal-add-seccion',
  'modal-add-profesor', 'modal-titulo-bloque', 'modal-bloque-badge',
  'modal-save-class', 'modal-delete-class', 'modal-add-rol', 'label-modal-rol',
  'label-modal-tipo', 'dd-modal-rol', 'dd-modal-tipo', 'label-modal-curso',
  'label-modal-sala', 'label-modal-profesor', 'dd-modal-sala', 'dd-modal-profesor',
  'modal-profesor-search', 'modal-agregar-ramo'
];
for (const id of fieldIds) fields.set(id, {
  value: '', textContent: '', hidden: false, style: {}, attributes: {},
  classList: { add() {}, remove() {}, toggle() {} },
  setAttribute(name, value) { this.attributes[name] = value; },
  removeAttribute() {}, querySelectorAll() { return []; }, focus() {},
  querySelector() { return { style: {} }; }
});

const bodyClasses = new Set();
const context = {
  window: { scrollY: 0, innerWidth: 1200, scrollTo() {}, addEventListener() {}, removeEventListener() {} },
  document: {
    getElementById: id => fields.get(id) || null,
    querySelector: () => ({ getBoundingClientRect: () => ({ left: 200, right: 1200, width: 1000 }) }),
    addEventListener() {}, querySelectorAll: () => [],
    body: { style: {}, classList: { add: name => bodyClasses.add(name), remove: name => bodyClasses.delete(name) } }
  },
  localStorage: { getItem: () => null, setItem() {} },
  MI_HORARIO_DEFAULT_DATA: { escuela: 'EIT', clases: [] },
  setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; },
  console, Date, Intl, JSON, String, Number, Array
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/horario.js', 'utf8'), context);
vm.runInContext(`
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [{
    id: 'existing', dia: 1, bloqueNum: 1, horaInicio: '08:30', horaFin: '09:50',
    curso: 'Álgebra', tipo: 'Cátedra', seccion: 'Sección 12', sala: '', profesor: '', rol: 'student'
  }] };
  guardarMiHorarioEnStorage = function () {};
  renderMiHorario = function () {};
  actualizarHeroMiHorario = function () {};
  actualizarContadoresFiltrosMiHorario = function () {};
`, context);

context.abrirModalEditarClase('existing', { stopPropagation() {} });
assert.strictEqual(fields.get('modal-add-seccion').value, '12', 'editing should show the existing section number');
fields.get('modal-add-seccion').value = '';
context.guardarNuevaClaseModal({ preventDefault() {} });
const saved = JSON.parse(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases[0])', context));
assert.strictEqual(saved.seccion, 'Sección -', 'clearing an existing section must save an explicit empty-section marker');

const sameCourseClasses = [
  { curso: 'Álgebra', tipo: 'Cátedra', seccion: 'Sección 7' },
  { curso: 'Álgebra', tipo: 'Ayudantía', seccion: 'Sección -' }
];
context.rellenarSeccionesMismoRamo(sameCourseClasses);
assert.strictEqual(sameCourseClasses[1].seccion, 'Sección -', 'same-course propagation must keep an explicitly cleared section empty');
console.log('schedule-section-clear: cleared existing sections persist as Sección -');

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const fields = new Map();
const fieldIds = [
  'modal-add-id', 'modal-add-dia', 'modal-add-bloque', 'modal-add-hora-inicio',
  'modal-add-curso', 'modal-add-tipo', 'modal-add-sala', 'modal-add-seccion',
  'modal-add-profesor', 'modal-input-real-search', 'modal-titulo-bloque',
  'modal-bloque-badge', 'modal-save-class', 'modal-delete-class',
  'btn-modal-rol-student', 'btn-modal-rol-assistant', 'modal-tipo-pills',
  'modal-salas-dropdown', 'modal-agregar-ramo'
];
for (const id of fieldIds) {
  fields.set(id, {
    value: '', textContent: '', hidden: false, required: false, style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    querySelectorAll() { return []; }, focus() {}
  });
}
const context = {
  window: {},
  document: {
    getElementById(id) { return fields.get(id) || null; },
    addEventListener() {},
    querySelectorAll() { return []; }
  },
  localStorage: { getItem: () => null, setItem() {} },
  MI_HORARIO_DEFAULT_DATA: { escuela: 'EIT', clases: [] },
  setTimeout() { return 1; },
  setInterval() { return 1; },
  console, Date, Intl, JSON, String, Number, Array
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/horario.js', 'utf8'), context);
vm.runInContext(`
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [{
    id: 'edit-me', dia: 1, diaNombre: 'Lunes', bloqueNum: 6,
    horaInicio: '16:00', horaFin: '17:20', curso: 'Ecuaciones Diferenciales',
    tipo: 'Cátedra', seccion: '12', sala: '', profesor: 'Rivero', rol: 'student'
  }] };
  cargarClasesRealesBloque = function () {};
  guardarMiHorarioEnStorage = function () {};
  cerrarModalAgregarClase = function () {};
  renderMiHorario = function () {};
  actualizarHeroMiHorario = function () {};
  mostrarToast = function () {};
  mostrarAlertaWeb = function (message, title, type) { globalThis.alertResult = { message, title, type }; };
  actualizarContadoresFiltrosMiHorario = function () {};
  modalRolSeleccionado = 'assistant';
`, context);

context.abrirModalEditarClase('edit-me', { stopPropagation() {} });
assert.strictEqual(fields.get('modal-titulo-bloque').textContent, 'Editar Asignatura');
assert.strictEqual(fields.get('modal-add-id').value, 'edit-me');
assert.strictEqual(fields.get('modal-add-curso').value, 'Ecuaciones Diferenciales');
assert.strictEqual(fields.get('modal-add-sala').required, false);
assert.strictEqual(fields.get('modal-delete-class').hidden, false);

fields.get('modal-add-profesor').value = 'Rivero Rosa Elvira';
context.setModalRol('assistant');
context.guardarNuevaClaseModal({ preventDefault() {} });
let savedClass = JSON.parse(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases[0])', context));
assert.strictEqual(savedClass.id, 'edit-me');
assert.strictEqual(savedClass.rol, 'assistant');
assert.strictEqual(savedClass.profesor, 'Rivero Rosa Elvira');
assert.strictEqual(savedClass.sala, '');

vm.runInContext(`MI_HORARIO_DATA.clases.push({ id: 'occupied', dia: 1, bloqueNum: 2, curso: 'Otra clase' });`, context);
context.abrirModalEditarClase('edit-me', { stopPropagation() {} });
fields.get('modal-add-bloque').value = '2';
fields.get('modal-add-curso').value = 'Ecuaciones Diferenciales';
context.guardarNuevaClaseModal({ preventDefault() {} });
assert.strictEqual(context.alertResult.title, 'Bloque ocupado');
assert.match(context.alertResult.message, /Solo puede haber una clase por bloque horario/);
assert.strictEqual(vm.runInContext(`MI_HORARIO_DATA.clases.find(c => c.id === 'edit-me').bloqueNum`, context), 6);
assert.strictEqual(vm.runInContext(`MI_HORARIO_DATA.clases.find(c => c.id === 'occupied').curso`, context), 'Otra clase');

context.confirmarWeb = (_message, callback) => callback();
fields.get('modal-add-id').value = 'edit-me';
context.eliminarClaseDesdeEditor({ preventDefault() {}, stopPropagation() {} });
assert.strictEqual(vm.runInContext('MI_HORARIO_DATA.clases.length', context), 1);
console.log('schedule-class-edit: edits role and details, preserves empty room, and deletes from editor');

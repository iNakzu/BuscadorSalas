const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const scheduleCss = fs.readFileSync('static/css/horario.css', 'utf8');
assert.match(scheduleCss, /\.my-empty-slot\.is-readonly:hover \.my-empty-text\s*\{\s*display:\s*inline;/);
assert.match(scheduleCss, /@media \(max-width: 900px\)\s*\{\s*\.my-week-grid\s*\{[^}]*width:\s*100vw;[^}]*margin-left:\s*calc\(-50vw \+ 50%\);/s);

const container = { innerHTML: '', scrollIntoView() {} };
const hero = { innerHTML: '' };
const context = {
  window: {},
  document: { getElementById: id => id === 'mihorario-display-container' ? container : id === 'my-schedule-hero' ? hero : null, addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {} },
  MI_HORARIO_DEFAULT_DATA: { escuela: 'EIT', clases: [] },
  state: { miHorarioRol: 'ALL', miHorarioSearch: '' },
  setTimeout() { return 1; },
  setInterval() { return 1; },
  normStr: value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
  escapeHtml: value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]),
  Date, Intl, JSON, String, Number, Array, console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/horario.js', 'utf8'), context);
vm.runInContext(`
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [{ id: 'mine', dia: 1, bloqueNum: 7, bloqueLabel: 'Etiqueta anterior', curso: 'Mi clase', tipo: 'Cátedra', sala: 'E101', profesor: 'Yo', rol: 'student' }] };
  getChileTime = () => ({ dayOfWeek: 1, hours: 9, minutes: 0, totalMinutes: 540 });
  renderMiHorario();
`, context);
const originalSchedule = vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases)', context);
context.window.mostrarHorarioPerfilEnMiHorario([
  { dia: 1, horaInicio: '08:30', horaFin: '09:50', curso: 'Clase amiga', tipo: 'Laboratorio', sala: 'E202', profesor: 'Ana' },
  { dia: 1, horaInicio: '11:30', horaFin: '12:50', curso: 'Segunda clase', tipo: 'Cátedra', sala: 'E203', profesor: 'Ana' },
  { dia: 1, horaInicio: '17:30', horaFin: '18:50', curso: 'Tercera clase', tipo: 'Taller', sala: 'E204', profesor: 'Ana' }
]);
assert.doesNotMatch(container.innerHTML, /Horario de Ana García|Ana García/);
assert.match(container.innerHTML, /17:25 - 18:45/);
assert.doesNotMatch(container.innerHTML, /Mi clase/);
assert.match(container.innerHTML, /Clase amiga/i);
assert.doesNotMatch(container.innerHTML, /my-btn-delete|abrirModalAgregarClase|Agregar ramo/);
assert.doesNotMatch(container.innerHTML, /my-btn-edit|abrirModalEditarClase/);
assert.match(container.innerHTML, /my-empty-slot is-readonly/);
assert.strictEqual((container.innerHTML.match(/class="my-class-card/g) || []).length, 3);
assert.strictEqual((container.innerHTML.match(/class="my-empty-slot(?: is-readonly)?"/g) || []).length, 32);
assert.match(hero.innerHTML, /En laboratorio/);
assert.doesNotMatch(hero.innerHTML, /Ana García|Horario de/);
vm.runInContext(`getChileTime = () => ({ dayOfWeek: 1, hours: 10, minutes: 30, totalMinutes: 630 }); actualizarHeroMiHorario();`, context);
assert.match(hero.innerHTML, /Tienes clase de/);
assert.doesNotMatch(hero.innerHTML, /Ana García/);
assert.strictEqual(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases)', context), originalSchedule);
context.window.cerrarHorarioPerfilEnMiHorario();
assert.match(container.innerHTML, /my-btn-edit/);
assert.match(container.innerHTML, /17:25 - 18:45/);
assert.match(hero.innerHTML, /Mi clase/i);
assert.strictEqual(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases)', context), originalSchedule);

vm.runInContext(`
  horarioPerfilSeleccionado = null;
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [
    { id: 'first-today', dia: 1, horaInicio: '08:30', horaFin: '09:50', bloqueNum: 1, curso: 'Clase 1', tipo: 'Cátedra', rol: 'student' },
    { id: 'later-today', dia: 1, horaInicio: '11:30', horaFin: '12:50', bloqueNum: 3, curso: 'Clase 2', tipo: 'Laboratorio', rol: 'student' }
  ] };
  getChileTime = () => ({ dayOfWeek: 1, hours: 8, minutes: 0, totalMinutes: 480 });
  actualizarHeroMiHorario();
`, context);
assert.match(hero.innerHTML, /Tienes clase de/);
assert.doesNotMatch(hero.innerHTML, /En ventana/);
vm.runInContext(`getChileTime = () => ({ dayOfWeek: 1, hours: 10, minutes: 30, totalMinutes: 630 }); actualizarHeroMiHorario();`, context);
assert.match(hero.innerHTML, /En ventana/);
vm.runInContext(`getChileTime = () => ({ dayOfWeek: 1, hours: 13, minutes: 0, totalMinutes: 780 }); actualizarHeroMiHorario();`, context);
assert.match(hero.innerHTML, /Fuera de jornada/);
assert.match(hero.innerHTML, /No tienes más clases hoy/);
vm.runInContext(`MI_HORARIO_DATA = { escuela: 'EIT', clases: [] }; actualizarHeroMiHorario();`, context);
assert.match(hero.innerHTML, /Sin clases/);
assert.match(hero.innerHTML, /No hay clases cargadas/);
vm.runInContext(`
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [{ id: 'monday', dia: 1, horaInicio: '08:30', horaFin: '09:50', bloqueNum: 1, curso: 'Clase futura', tipo: 'Cátedra', rol: 'student' }] };
  getChileTime = () => ({ dayOfWeek: 0, hours: 12, minutes: 0, totalMinutes: 720 });
  actualizarHeroMiHorario();
`, context);
assert.match(hero.innerHTML, /Fin de semana/);
assert.match(hero.innerHTML, /Hoy toca descansar/);
vm.runInContext(`
  getChileTime = () => ({ dayOfWeek: 2, hours: 12, minutes: 0, totalMinutes: 720 });
  actualizarHeroMiHorario();
`, context);
assert.match(hero.innerHTML, /Sin clases hoy/);
assert.match(hero.innerHTML, /Hoy toca descansar/);

vm.runInContext(`
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [
    { id: 'legacy-one', dia: 1, bloqueNum: 3, curso: 'Clase A', tipo: 'Cátedra', sala: 'E101' },
    { id: 'legacy-two', dia: 1, bloqueNum: 3, curso: 'Clase B', tipo: 'Laboratorio', sala: 'E102' }
  ] };
  renderMiHorario();
`, context);
assert.doesNotMatch(container.innerHTML, /my-class-slot-conflict|my-slot-conflict|Conflicto en este bloque|Revisar [12]/);
assert.match(container.innerHTML, /Clase A/);
assert.match(container.innerHTML, /Clase B/);
console.log('community_schedule_overlay: selected schedule uses the personal view and remains read-only');

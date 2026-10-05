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
assert.match(container.innerHTML, /Clase Amiga/);
assert.doesNotMatch(container.innerHTML, /my-btn-delete|abrirModalAgregarClase|Agregar ramo/);
assert.doesNotMatch(container.innerHTML, /my-btn-edit|abrirModalEditarClase/);
assert.match(container.innerHTML, /my-empty-slot is-readonly/);
assert.strictEqual((container.innerHTML.match(/class="my-class-card/g) || []).length, 3);
assert.strictEqual((container.innerHTML.match(/class="my-empty-slot(?: is-readonly)?"/g) || []).length, 32);
assert.match(hero.innerHTML, /En laboratorio/);
assert.doesNotMatch(hero.innerHTML, /Ana García|Horario de/);
vm.runInContext(`getChileTime = () => ({ dayOfWeek: 1, hours: 10, minutes: 30, totalMinutes: 630 }); actualizarHeroMiHorario();`, context);
assert.match(hero.innerHTML, /Tienes 1h libres/);
assert.doesNotMatch(hero.innerHTML, /Ana García/);
assert.strictEqual(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases)', context), originalSchedule);
const targetProfile = { user_id: 'friend', modules: { schedule: { clases: [
  { id: 'friend-class', dia: 1, diaNombre: 'Lunes', bloqueNum: 1, curso: 'Horario compartido', tipo: 'Cátedra', sala: 'E201' }
] } } };
context.window.PortalCommunity = { isAdminSelected: () => true, getSelected: () => targetProfile };
context.window.mostrarHorarioPerfilEnMiHorario(targetProfile.modules.schedule.clases);
assert.match(container.innerHTML, /abrirModalEditarPerfilClase\(0, event\)/);
assert.match(container.innerHTML, /abrirModalAgregarPerfilClase\(1, 2\)/);
assert.doesNotMatch(container.innerHTML, /my-empty-slot is-readonly/);
assert.strictEqual(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases)', context), originalSchedule);
context.window.PortalCommunity = null;
context.window.cerrarHorarioPerfilEnMiHorario();
assert.match(container.innerHTML, /my-btn-edit/);
assert.match(container.innerHTML, /17:25 - 18:45/);
assert.match(hero.innerHTML, /Mi Clase/);
assert.strictEqual(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases)', context), originalSchedule);

vm.runInContext(`
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [{ id: 'tue', dia: 2, diaNombre: 'Martes', horaInicio: '10:00', horaFin: '11:20', curso: 'Clase del martes', tipo: 'Cátedra', sala: 'E101' }] };
  getChileTime = () => ({ dayOfWeek: 1, hours: 9, minutes: 0, totalMinutes: 540 });
  actualizarHeroMiHorario();
`, context);
assert.match(hero.innerHTML, /Sin clases/);
assert.match(hero.innerHTML, /Hoy toca descansar/);
assert.match(hero.innerHTML, /Clase del Martes/);
assert.match(hero.innerHTML, /Martes 10:00/);
assert.doesNotMatch(hero.innerHTML, /Descanso de fin de semana|Fin de semana/);

vm.runInContext(`getChileTime = () => ({ dayOfWeek: 6, hours: 9, minutes: 0, totalMinutes: 540 }); actualizarHeroMiHorario();`, context);
assert.match(hero.innerHTML, /Fin de semana/);
assert.match(hero.innerHTML, /Hoy toca descansar/);

vm.runInContext(`
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [
    { id: 'conflict-one', dia: 1, bloqueNum: 3, curso: 'Clase A', tipo: 'Cátedra', sala: 'E101' },
    { id: 'conflict-two', dia: 1, bloqueNum: 3, curso: 'Clase B', tipo: 'Laboratorio', sala: 'E102' }
  ] };
  state = { miHorarioRol: 'ALL', miHorarioSearch: '' };
  getChileTime = () => ({ dayOfWeek: 1, hours: 9, minutes: 0, totalMinutes: 540 });
  renderMiHorario();
`, context);
assert.doesNotMatch(container.innerHTML, /my-class-slot-conflict|my-slot-conflict-button|Conflicto en este bloque|Revisar [12]/);
assert.match(container.innerHTML, /Clase A/);
assert.match(container.innerHTML, /Clase B/);
console.log('community_schedule_overlay: shared schedules are read-only for users and editable for admins');

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
assert.match(container.innerHTML, /17:30 - 18:50/);
assert.doesNotMatch(container.innerHTML, /Mi clase/);
assert.match(container.innerHTML, /Clase amiga/);
assert.doesNotMatch(container.innerHTML, /my-btn-delete|abrirModalAgregarClase|Agregar ramo/);
assert.doesNotMatch(container.innerHTML, /my-btn-edit|abrirModalEditarClase/);
assert.match(container.innerHTML, /my-empty-slot is-readonly/);
assert.strictEqual((container.innerHTML.match(/class="my-class-card/g) || []).length, 3);
assert.strictEqual((container.innerHTML.match(/class="my-empty-slot(?: is-readonly)?"/g) || []).length, 32);
assert.match(hero.innerHTML, /En laboratorio/);
assert.doesNotMatch(hero.innerHTML, /Ana García|Horario de/);
vm.runInContext(`getChileTime = () => ({ dayOfWeek: 1, hours: 10, minutes: 30, totalMinutes: 630 }); actualizarHeroMiHorario();`, context);
assert.match(hero.innerHTML, /Próxima clase/);
assert.doesNotMatch(hero.innerHTML, /Ana García/);
assert.strictEqual(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases)', context), originalSchedule);
context.window.cerrarHorarioPerfilEnMiHorario();
assert.match(container.innerHTML, /my-btn-edit/);
assert.match(container.innerHTML, /17:30 - 18:50/);
assert.match(hero.innerHTML, /Mi clase/);
assert.strictEqual(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases)', context), originalSchedule);
console.log('community_schedule_overlay: selected schedule uses the personal view and remains read-only');

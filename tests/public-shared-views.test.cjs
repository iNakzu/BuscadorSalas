const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function makeContext(extra = {}) {
  const document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById() { return null; }
  };
  const window = { innerWidth: 1280, addEventListener() {}, ...extra.window };
  const context = { document, window, console, localStorage: { getItem: () => null, setItem() {} }, ...extra };
  vm.createContext(context);
  return context;
}

const notesRoot = { innerHTML: '' };
const notesSelect = { value: '' };
const privateNotesBuilder = { innerHTML: '' };
const notesLabel = { textContent: '' };
const notesMenu = { innerHTML: '', querySelectorAll() { return []; } };
const notesDropdown = { classList: { remove() {} } };
const notesProfile = { user_id: 'friend', modules: { schedule: { clases: [{ curso: 'Cálculo' }, { curso: 'Física' }] } } };
const notesListeners = {};
let currentNotesProfile = notesProfile;
const notesContext = makeContext({
  escapeHtml: value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
  normStr: value => String(value || '').trim().toLocaleLowerCase(),
  MI_HORARIO_DATA: { clases: [{ curso: 'Mi ramo' }] },
  document: {
    readyState: 'loading',
    addEventListener(name, callback) { notesListeners[name] = callback; },
    getElementById(id) {
      return ({ 'notas-curso-select': notesSelect, 'label-notas-curso': notesLabel, 'dd-notas-curso': notesDropdown, 'notas-builder-container': privateNotesBuilder })[id] || null;
    },
    querySelector(selector) {
      return ({ '#tab-notas .public-profile-content[data-module="grades"]': notesRoot, '#dd-notas-curso .dropdown-menu': notesMenu })[selector] || null;
    },
    querySelectorAll() { return []; }
  },
  window: { PortalCommunity: { getSelected: () => currentNotesProfile } }
});
vm.runInContext(fs.readFileSync('static/js/notas.js', 'utf8'), notesContext);
notesContext.renderNotasBuilder();
assert.match(privateNotesBuilder.innerHTML, /Selecciona una asignatura arriba para configurar o ver tus notas/);
notesContext.window.renderNotasPublicas(notesRoot, {
  'me|Cálculo <I>': { items: [{ id: 1, name: 'Solemne 1', weight: 100, grade: 6.2 }], examGrade: null, examWeight: 30 }
});
assert.match(notesMenu.innerHTML, /data-val="Cálculo"/);
assert.match(notesMenu.innerHTML, /data-val="Física"/);
assert.strictEqual(notesRoot.innerHTML, privateNotesBuilder.innerHTML);
notesContext.window.selectNotasPerfilCourse('Física');
assert.match(notesRoot.innerHTML, /class="notas-card [^\"]*notas-readonly/);
assert.match(notesRoot.innerHTML, /Nota Presentación<\/div>\s*<div class="notas-summary-value"[^>]*>-<\/div>/);
assert.match(notesRoot.innerHTML, /value="" disabled placeholder="Nota"/);
assert.match(notesRoot.innerHTML, /Solemne 1/);
assert.match(notesRoot.innerHTML, /Solemne 2/);
assert.match(notesRoot.innerHTML, /Controles/);
assert.match(notesRoot.innerHTML, /Tareas/);
notesContext.window.selectNotasPerfilCourse('');
assert.strictEqual(notesRoot.innerHTML, privateNotesBuilder.innerHTML);
notesContext.window.selectNotasPerfilCourse('Cálculo <I>');
assert.match(notesRoot.innerHTML, /class="notas-card/);
assert.match(notesRoot.innerHTML, /class="notas-summary"/);
assert.match(notesRoot.innerHTML, />6\.20</);
assert.match(notesRoot.innerHTML, /notas-survival-box/);
assert.match(notesRoot.innerHTML, /disabled/);
assert.doesNotMatch(notesRoot.innerHTML, /updateNotaItem|updateGlobalNota|deleteNotaItem|addNotaItem/);
assert.strictEqual(notesLabel.textContent, 'Cálculo <I>');
assert.deepStrictEqual(JSON.parse(JSON.stringify(vm.runInContext('Object.keys(NOTAS_DATA)', notesContext))), []);
currentNotesProfile = null;
notesListeners['portal:public-profile-changed']({ detail: { profile: null } });
assert.match(notesMenu.innerHTML, /data-val="Mi ramo"/);
assert.doesNotMatch(notesMenu.innerHTML, /data-val="Física"|data-val="Cálculo/);
notesSelect.value = 'Mi ramo';
notesContext.renderNotasBuilder();
assert.doesNotMatch(privateNotesBuilder.innerHTML, /notas-btn-del|deleteNotaItem|El examen final no se puede eliminar|<path d="M7 11V7a5/);

const agendaContext = makeContext();
vm.runInContext(fs.readFileSync('static/js/agenda.js', 'utf8'), agendaContext);
const currentDate = new Date();
const currentDateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
const listeners = {};
const search = { value: '', addEventListener: (name, cb) => { listeners[`search:${name}`] = cb; } };
const days = { innerHTML: '' };
const title = { textContent: '' };
const list = { innerHTML: '' };
const monthButtons = [-1, 1].map(step => ({ dataset: { monthStep: String(step) }, addEventListener: (name, cb) => { listeners[`month:${step}`] = cb; } }));
const agendaRoot = {
  innerHTML: '',
  querySelector(selector) {
    return ({ '.public-agenda-search': search, '.public-agenda-days': days, '.public-agenda-month': title, '.public-agenda-events': list })[selector] || null;
  },
  querySelectorAll: () => monthButtons
};
agendaContext.window.renderAgendaPublica(agendaRoot, [{
  id: 'event-1', ramo: '<img src=x onerror=alert(1)>', tipo: 'Solemne', fecha: `${currentDateString}T10:00:00`, hasTime: true, notas: 'Traer apuntes', completado: false
}]);
assert.match(agendaRoot.innerHTML, /public-agenda-calendar/);
assert.match(agendaRoot.innerHTML, /public-agenda-search/);
assert.match(days.innerHTML, /cal-dots-container/);
assert.match(list.innerHTML, /horizontal-timeline-wrapper/);
assert.match(list.innerHTML, /agenda-card-readonly/);
assert.match(list.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(list.innerHTML, /abrirModalAgenda|eliminarEventoAgenda|toggleCompletado/);
assert.doesNotMatch(days.innerHTML, /abrirModalAgenda/);
assert.deepStrictEqual(JSON.parse(JSON.stringify(vm.runInContext('AGENDA_DATA.slice()', agendaContext))), []);
console.log('public-shared-views: shared renderers preserve personal UI and remain read-only');

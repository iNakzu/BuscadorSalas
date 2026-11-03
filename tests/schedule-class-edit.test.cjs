const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const fields = new Map();
const timers = [];
const alerts = [];
const modalDialogStyle = {};
const mainContent = { getBoundingClientRect() { return { left: 340, right: 1374, width: 1034 }; } };
const fieldIds = [
  'modal-add-id', 'modal-add-dia', 'modal-add-bloque', 'modal-add-hora-inicio',
  'modal-add-curso', 'modal-add-tipo', 'modal-add-sala', 'modal-add-seccion',
  'modal-add-profesor', 'modal-titulo-bloque',
  'modal-bloque-badge', 'modal-save-class', 'modal-delete-class',
  'modal-add-rol', 'label-modal-rol', 'label-modal-tipo', 'modal-label-tipo', 'modal-tipo-lock', 'dd-modal-rol', 'dd-modal-tipo',
  'modal-profesores-dropdown', 'modal-profesores-options', 'modal-salas-dropdown',
  'modal-salas-options', 'modal-profesor-search',
  'label-modal-sala', 'label-modal-profesor', 'dd-modal-sala', 'dd-modal-profesor',
  'modal-agregar-ramo'
];
for (const id of fieldIds) {
  fields.set(id, {
    value: '', textContent: '', hidden: false, required: false, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    attributes: {}, setAttribute(name, value) { this.attributes[name] = value; },
    querySelectorAll() { return []; }, focus() {}
  });
}
const context = {
  window: {
    scrollY: 327, innerWidth: 1440,
    scrollTo(x, y) { this.restoredScrollY = y; },
    addEventListener(name, callback) { this.resizeHandler = callback; },
    removeEventListener(name, callback) { if (this.resizeHandler === callback) this.resizeHandler = null; }
  },
  document: {
    getElementById(id) { return fields.get(id) || null; },
    querySelector() { return mainContent; },
    addEventListener() {},
    querySelectorAll() { return []; },
    body: {
      style: {},
      classes: new Set(),
      classList: {
        add(name) { this.owner.classes.add(name); },
        remove(name) { this.owner.classes.delete(name); }
      }
    }
  },
  localStorage: { getItem: () => null, setItem() {} },
  MI_HORARIO_DEFAULT_DATA: { escuela: 'EIT', clases: [] },
  setTimeout(callback) { timers.push(callback); return timers.length; },
  clearTimeout() {},
  setInterval() { return 1; },
  console, Date, Intl, JSON, String, Number, Array
};
context.mostrarAlertaWeb = (...args) => alerts.push(args);
fields.get('modal-agregar-ramo').querySelector = () => ({ style: modalDialogStyle });
context.document.body.classList.owner = context.document.body;
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/horario.js', 'utf8'), context);
vm.runInContext(`
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [{
    id: 'edit-me', dia: 1, diaNombre: 'Lunes', bloqueNum: 6,
    horaInicio: '16:00', horaFin: '17:20', curso: 'ECUACIONES DIFERENCIALES',
    cursoDisplay: 'ECUACIONES DIFERENCIALES',
    tipo: 'Cátedra', seccion: '12', sala: '', profesor: 'Rivero', rol: 'student'
  }, {
    id: 'same-course-tutorial', dia: 2, diaNombre: 'Martes', bloqueNum: 2,
    horaInicio: '10:00', horaFin: '11:20', curso: 'ECUACIONES DIFERENCIALES',
    tipo: 'Ayudantía', seccion: '3', sala: '', profesor: '', rol: 'student'
  }, {
    id: 'same-course-lab', dia: 3, diaNombre: 'Miércoles', bloqueNum: 3,
    horaInicio: '11:30', horaFin: '12:50', curso: 'Ecuaciones Diferenciales',
    tipo: 'Laboratorio', seccion: '4', sala: '', profesor: '', rol: 'student'
  }, {
    id: 'different-course', dia: 4, diaNombre: 'Jueves', bloqueNum: 1,
    horaInicio: '08:30', horaFin: '09:50', curso: 'Mecánica',
    tipo: 'Cátedra', seccion: '7', sala: '', profesor: '', rol: 'student'
  }] };
  let classLookup = 0;
  cargarClasesRealesBloque = function () { classLookup += 1; };
  guardarMiHorarioEnStorage = function () {};
  renderMiHorario = function () {};
  actualizarHeroMiHorario = function () {};
  actualizarContadoresFiltrosMiHorario = function () {};
  modalRolSeleccionado = 'assistant';
`, context);

fields.set('card-edit-me', {
  querySelector(selector) {
    assert.strictEqual(selector, '.my-card-title');
    return { textContent: 'Ecuaciones Diferenciales' };
  }
});
context.abrirModalEditarClase('edit-me', { stopPropagation() {} });
assert.strictEqual(fields.get('modal-titulo-bloque').textContent, 'Editar Asignatura');
assert(context.document.body.classes.has('schedule-modal-open'), 'opening the editor must lock background scrolling');
assert.strictEqual(context.document.body.style.top, '-327px');
assert.strictEqual(modalDialogStyle.left, '137px', 'desktop editor should align with the main content center');
assert.strictEqual(modalDialogStyle.width, '980px', 'desktop editor width should follow the content width');
context.window.innerWidth = 390;
context.window.resizeHandler();
assert.strictEqual(modalDialogStyle.left, '', 'mobile editor should return to the viewport center');
assert.strictEqual(modalDialogStyle.width, '', 'mobile editor should use the mobile stylesheet width');
context.window.innerWidth = 1440;
context.window.resizeHandler();
assert.strictEqual(vm.runInContext('classLookup', context), 0, 'opening the editor should not query the course JSON');
assert.strictEqual(fields.get('modal-add-id').value, 'edit-me');
assert.strictEqual(fields.get('modal-add-curso').value, 'Ecuaciones Diferenciales', 'editing should reuse the exact title visible on the schedule card, not a legacy uppercase value');
assert.strictEqual(fields.get('modal-add-seccion').value, '12', 'the section field should show only its numeric value when editing');
assert.strictEqual(fields.get('modal-add-sala').required, false);
assert.strictEqual(fields.get('modal-delete-class').hidden, false);
assert.strictEqual(fields.get('modal-save-class').attributes['aria-label'], 'Guardar cambios');
assert.strictEqual(fields.get('modal-save-class').textContent, '', 'opening edit must preserve the save icon instead of replacing it with visible text');

fields.get('modal-add-profesor').value = 'Rivero Rosa Elvira';
context.setModalRol('assistant');
context.guardarNuevaClaseModal({ preventDefault() {} });
let savedClass = JSON.parse(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases[0])', context));
assert.strictEqual(savedClass.id, 'edit-me');
assert.strictEqual(savedClass.cursoDisplay, 'Ecuaciones Diferenciales');
assert.strictEqual(savedClass.rol, 'assistant');
assert.strictEqual(savedClass.profesor, 'Rivero Rosa Elvira');
assert.strictEqual(savedClass.sala, '');
assert.strictEqual(savedClass.seccion, '12', 'the saved section should contain only the number');
const propagatedSections = JSON.parse(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases)', context));
assert.strictEqual(propagatedSections.find(item => item.id === 'same-course-tutorial').seccion, '12', 'same course section should propagate to its tutorial');
assert.strictEqual(propagatedSections.find(item => item.id === 'same-course-lab').seccion, '12', 'same course section should propagate to its laboratory');
assert.strictEqual(propagatedSections.find(item => item.id === 'different-course').seccion, '7', 'other courses must keep their section');

fields.get('modal-add-id').value = '';
fields.get('modal-add-dia').value = '2';
fields.get('modal-add-bloque').value = '2';
fields.get('modal-add-curso').value = 'Ramo sin sala';
fields.get('modal-add-sala').value = '';
fields.get('modal-add-seccion').value = '';
fields.get('modal-add-profesor').value = '';
context.guardarNuevaClaseModal({ preventDefault() {} });
const classWithoutExtraDetails = JSON.parse(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases.find(item => item.curso === "Ramo sin sala"))', context));
assert(classWithoutExtraDetails, 'a class with only its course name should be saved');
assert.strictEqual(classWithoutExtraDetails.sala, '');
assert.strictEqual(classWithoutExtraDetails.seccion, '');
assert.strictEqual(classWithoutExtraDetails.profesor, '');
assert.deepStrictEqual(alerts, [], 'saving should not show validation popups');

assert.strictEqual(context.normalizarNumeroSeccion('Sección 4'), '4');
assert.strictEqual(context.normalizarNumeroSeccion('S4'), '4');
assert.strictEqual(context.normalizarNumeroSeccion(''), '');
const existingCourseSections = JSON.parse(vm.runInContext(`JSON.stringify((() => {
  const classes = [
    { curso: 'Álgebra Lineal', tipo: 'Cátedra', seccion: 'Sección 4' },
    { curso: 'ALGEBRA LINEAL', tipo: 'Laboratorio', seccion: '' },
    { curso: 'Álgebra Lineal', tipo: 'Ayudantía', seccion: '' },
    { curso: 'Mecánica', tipo: 'Cátedra', seccion: '' },
    { curso: 'Otra Asignatura', tipo: 'Cátedra', seccion: '2' },
    { curso: 'Otra Asignatura', tipo: 'Laboratorio', seccion: '3' }
  ];
  const changed = rellenarSeccionesMismoRamo(classes);
  return { changed, classes };
})())`, context));
assert.strictEqual(existingCourseSections.changed, true, 'existing schedule sections should be filled automatically on load');
assert.strictEqual(existingCourseSections.classes[1].seccion, '4', 'a matching course laboratory should inherit its unique section');
assert.strictEqual(existingCourseSections.classes[2].seccion, '4', 'a matching course tutorial should inherit its unique section');
assert.strictEqual(existingCourseSections.classes[3].seccion, '', 'a different course should not receive the section');
assert.strictEqual(existingCourseSections.classes[5].seccion, '3', 'conflicting sections should not be guessed or overwritten');
const syncMerge = context.mergeEnrichedSchedule(
  [{ id: 'keep-details', curso: 'Mecánica', sala: 'E441.4.S401', seccion: 'Sección 13', profesor: 'DOCENTE GUARDADO' }],
  [{ id: 'keep-details', curso: '', sala: '-', seccion: '', profesor: '' }]
);
assert.deepStrictEqual(JSON.parse(JSON.stringify(syncMerge[0])), {
  id: 'keep-details', curso: 'Mecánica', sala: 'E441.4.S401', seccion: 'Sección 13', profesor: 'DOCENTE GUARDADO'
}, 'JSON sync must never erase saved class details with blank values');
const syncFill = context.mergeEnrichedSchedule(
  [{ id: 'fill-details', curso: 'Introduccion al Algebra', sala: '', seccion: '', profesor: '' }],
  [{ id: 'fill-details', curso: 'Introduccion al Algebra', sala: 'E306.1.S101', seccion: 'Sección 3', profesor: '' }]
);
assert.strictEqual(syncFill[0].sala, 'E306.1.S101', 'a real match should still fill missing room data');
assert.strictEqual(syncFill[0].seccion, 'Sección 3', 'a real match should still fill missing section data');

context.setModalRol('student');
context.setModalTipo('Laboratorio');
context.setModalRol('assistant');
assert.strictEqual(fields.get('modal-add-tipo').value, 'Laboratorio');
assert.strictEqual(fields.get('label-modal-tipo').textContent, '', 'assistant role should hide the original class type in the editor');
assert.strictEqual(fields.get('modal-label-tipo').disabled, true, 'assistant role should lock the class type selector');
assert.strictEqual(fields.get('modal-tipo-lock').hidden, false, 'assistant role should show a lock beside the empty selector');
assert.strictEqual(fields.get('modal-add-rol').value, 'assistant');
assert.strictEqual(fields.get('label-modal-rol').textContent, 'Ayudante');
context.setModalTipo('Ayudantía');
assert.strictEqual(fields.get('modal-add-tipo').value, 'Laboratorio', 'locked class type must not be changed as assistant');
context.setModalRol('student');
assert.strictEqual(fields.get('label-modal-tipo').textContent, 'Laboratorio', 'switching back to student should reveal the preserved class type');
context.setModalTipo('Estudio');
assert.strictEqual(fields.get('modal-add-tipo').value, 'Cátedra', 'legacy Estudio values should fall back to Cátedra');

const modalTemplate = fs.readFileSync('templates/components/schedule_modal.html', 'utf8');
const modalStyles = fs.readFileSync('static/css/horario.css', 'utf8');
assert(!/data-val="Taller"/.test(modalTemplate), 'Taller must not be an available class type');
assert(!/data-val="Estudio"/.test(modalTemplate), 'Estudio must not be an available class type');
assert(modalTemplate.includes('Sala asignada (opcional)'), 'room should be labeled as optional');
assert(/id="modal-add-seccion"[^>]*inputmode="numeric"[^>]*min="1"[^>]*placeholder="Ej\. 1"[^>]*step="1"[^>]*type="number"/.test(modalTemplate), 'section field should request a number only');
assert(/data-val="Laboratorio"[^>]*>Laboratorio</.test(modalTemplate), 'Laboratorio must be shown in full');
assert(modalTemplate.includes('id="modal-tipo-lock"'), 'class type selector should include its lock icon');
assert(/#dd-modal-tipo\.is-locked[\s\S]*?background: rgba\(15, 23, 42, 0\.85\);[\s\S]*?border-color: var\(--border\);[\s\S]*?box-shadow: none;/.test(modalStyles), 'locking the type selector must preserve its normal capsule colors');
assert(/\.my-class-card\.tipo-laboratorio\.is-assistant\s*\{[^}]*--class-accent: #fbbf24/.test(modalStyles), 'laboratory assistant cards must use the assistant gold accent');
assert(modalStyles.includes('.my-hero-status-pill.now.assistant { --hero-status-rgb: 251, 191, 36; --hero-status-color: #fde68a; }'), 'active assistant status capsule and its dot must use the assistant gold');
assert(modalStyles.includes('.my-hero-status-pill.next .pulse-dot {\n    background-color: #ffffff;'), 'the today status capsule and its dot should be white');
assert(modalStyles.includes('--class-accent: #22d3ee;'), 'lecture schedule cards should be cyan');
assert(modalStyles.includes('.my-hero-status-pill.now.catedra {\n    --hero-status-rgb: 34, 211, 238;'), 'active lecture capsule and dot should be cyan');
assert(modalStyles.includes('.my-hero-status-pill.now.laboratorio { --hero-status-rgb: 192, 132, 252; --hero-status-color: #d8b4fe; }'), 'active laboratory status capsule and its dot must use purple');
assert(modalStyles.includes('.my-hero-status-pill .pulse-dot {\n    background-color: currentColor;'), 'status dots must inherit their capsule color');
assert.strictEqual((modalTemplate.match(/dropdown-trigger notas-course-trigger/g) || []).length, 4, 'all remaining selectors must use the Notes selector appearance');
assert(/\.my-modal-select \.dropdown-item\.active\s*\{[^}]*background: linear-gradient/.test(modalStyles), 'selected type and role options must stay highlighted');
assert(!/\.my-course-display[\s\S]*?text-transform:\s*uppercase/.test(modalStyles), 'course capitalization should come from the display-name formatter');
const scheduleSource = fs.readFileSync('static/js/horario.js', 'utf8');
assert(scheduleSource.includes("const tipoVisible = c.rol === 'assistant' ? 'Ayudante' : tipoClase"), 'assistant schedule cards should label every class type as Ayudante');
assert(scheduleSource.includes('const sectionLabel = sectionValue ? `Sección ${sectionValue}` : \'Sección -\''), 'schedule cards should always make the section label explicit');
assert(scheduleSource.includes('mergeEnrichedSchedule(MI_HORARIO_DATA.clases, nuevasClases)'), 'sync responses must be merged without erasing saved details');
assert(/\.my-card-title\s*\{[^}]*width: fit-content[^}]*max-width: min\(220px, 100%\)[^}]*align-self: flex-start/.test(modalStyles), 'long course titles should have the approved 220px maximum width');
assert(/\.my-card-title\s*\{[^}]*font-size: 14\.5px/.test(modalStyles), 'course titles should use the approved 14.5px size');
assert(scheduleSource.includes('my-room-pill is-unassigned-room') && scheduleSource.includes('<span>-</span>'), 'classes without an assigned room should show the house icon and a dash');
assert(/\.my-card-title\s*\{[^}]*line-height: 1\.3;[\s\S]*?height: 40px;[\s\S]*?max-height: 40px;/.test(modalStyles), 'two-line course titles need enough height to show descenders on their second line');
assert(!/\.my-day-col\.is-today-col(?:\s|\.)/.test(modalStyles), 'today column should not have a separate border or title highlight');
assert(fs.readFileSync('static/js/horario.js', 'utf8').includes('function formatCourseTitle(value)'), 'course labels should have a title-case fallback formatter');
assert(fs.readFileSync('static/js/horario.js', 'utf8').includes('<span>Tienes clase de <strong class=\"my-course-display\">'), 'upcoming class card should label the course name');
assert.strictEqual(context.formatCourseTitle('CÁLCULO DIFERENCIAL E INTEGRAL'), 'Cálculo Diferencial e Integral');
assert.strictEqual(context.formatCourseTitle('EVALUACIÓN DE PROYECTOS TIC'), 'Evaluación de Proyectos TIC');
assert(/\.my-today-chip\s*\{[^}]*background: rgba\(255, 255, 255, 0\.13\)[^}]*color: #ffffff/.test(modalStyles), 'today chip should use neutral white');
assert(/oninput="buscarProfesoresModal\(this\.value\)"/.test(modalTemplate), 'teacher field must use JSON autocomplete');
assert(/<input[^>]*id="modal-add-curso"[^>]*required[^>]*type="text"/.test(modalTemplate), 'course name should be entered in a plain required text field');
assert(!/dd-modal-curso|modal-curso-search|buscarCursosModal|modal-input-real-search|Rellena automáticamente/.test(modalTemplate + scheduleSource), 'the editor should have no JSON course picker or automatic search panel');
assert(!modalTemplate.includes('O completa / edita'), 'obsolete modal divider copy should stay removed');
assert(!/modal-real-badge|clases en bloque|cursos disponibles/.test(fs.readFileSync('static/js/horario.js', 'utf8')), 'real class search should not update a count badge');
assert(/aria-label="Eliminar clase"[^>]*>[\s\S]*?<svg/.test(modalTemplate), 'delete action should have an accessible remove icon');
assert(/aria-label="Cancelar"[^>]*>[\s\S]*?<svg/.test(modalTemplate), 'cancel action should use an accessible close icon');
assert(/aria-label="Guardar en tu horario"[^>]*>[\s\S]*?<svg/.test(modalTemplate), 'save action should use an accessible icon');
assert(/\.my-modal-actions \.my-btn-icon\s*\{[^}]*width: 44px[^}]*height: 36px[^}]*border-radius: 18px/.test(modalStyles), 'icon actions should have visible capsule backgrounds');
assert(/\.my-modal-actions \.my-btn-primary\.my-btn-icon\s*\{[^}]*background: linear-gradient/.test(modalStyles), 'save action should remain visually primary');
assert(/\.my-modal-actions \.my-btn-danger\.my-btn-icon\s*\{[^}]*margin-right: 0/.test(modalStyles), 'actions should stay together instead of splitting delete to the opposite side');
assert(/aria-label="Eliminar clase"[^>]*>[\s\S]*?<path d="M3 6h18M19 6v14/.test(modalTemplate), 'delete should use a trash can symbol');
assert(/aria-label="Guardar en tu horario"[^>]*>[\s\S]*?<path d="M5 3h12l4 4v14H3V5/.test(modalTemplate), 'save should use a recognizable save icon');
assert(!/saveButton\.textContent\s*=/.test(fs.readFileSync('static/js/horario.js', 'utf8')), 'schedule save button must never replace its icon with visible text');
assert(!/\bmostrarToast\s*\(|my-toast/.test(fs.readFileSync('static/js/horario.js', 'utf8') + modalStyles), 'schedule actions should not show toast notifications');
assert(!modalTemplate.includes('modal-sala-search'), 'room selector must not show a search input');
assert(/#modal-agregar-ramo \.my-modal-dialog\s*\{[^}]*width: min\(96%, 1000px\)/.test(modalStyles), 'editor width should have a responsive fallback');
assert(/#modal-agregar-ramo \.my-modal-dialog\s*\{[^}]*min-height: 0/.test(modalStyles), 'desktop editor should size itself to its remaining content');
assert(/#modal-agregar-ramo \.my-modal-dialog::-webkit-scrollbar-track\s*\{[^}]*margin-block: 20px/.test(modalStyles), 'schedule scrollbar track should stay inset from the rounded top and bottom edges');
assert(/#modal-agregar-ramo \.my-modal-dialog::-webkit-scrollbar-thumb\s*\{[^}]*border-radius: 999px/.test(modalStyles), 'schedule scrollbar thumb should have rounded ends');
assert(/@media \(max-width: 640px\)[\s\S]*?#modal-agregar-ramo \.my-modal-dialog\s*\{[^}]*scrollbar-width: none/.test(modalStyles), 'mobile should hide the native scrollbar indicator while preserving touch scrolling');
assert(/#modal-agregar-ramo \.my-modal-dialog::-webkit-scrollbar\s*\{[^}]*display: none/.test(modalStyles), 'mobile WebKit scrollbar indicator should not overlap rounded edges');
assert(/getBoundingClientRect\(\)/.test(fs.readFileSync('static/js/horario.js', 'utf8')), 'desktop position should follow the content bounds');
assert(/#dd-modal-profesor\.open \.my-modal-search-menu\s*\{[^}]*display: flex/.test(modalStyles), 'teacher search stays outside its results scroller');
assert(/#dd-modal-profesor \.my-modal-search-menu\s*\{[^}]*top:\s*auto[^}]*bottom:\s*calc\(100% \+ 6px\)/.test(modalStyles), 'teacher dropdown should open above its trigger');
assert(/#modal-profesores-options\s*\{[^}]*overflow-y: auto/.test(modalStyles), 'teacher results should scroll independently from the fixed search input');
assert(/@media \(max-width: 640px\)[\s\S]*?#modal-agregar-ramo \.my-modal-dialog\s*\{[^}]*width: min\(calc\(90vw \+ 12px\), calc\(100vw - 20px\), 572px\)[^}]*height: auto[^}]*min-height: 0[^}]*max-height: calc\(100dvh - 20px\)/.test(modalStyles), 'mobile editor should use its content height while respecting the dynamic viewport');
assert(modalStyles.includes('@media (max-height: 620px)') && modalStyles.includes('#modal-agregar-ramo .my-modal-dialog {\n        min-height: 0;'), 'short screens should not force a tall editor');

context.confirmarWeb = () => { throw new Error('class deletion must not show a confirmation popup'); };
fields.get('modal-add-id').value = 'edit-me';
context.eliminarClaseDesdeEditor({ preventDefault() {}, stopPropagation() {} });
assert.strictEqual(vm.runInContext('MI_HORARIO_DATA.clases.length', context), 3, 'deleting one class should preserve its same-course siblings and unrelated classes');
assert(!context.document.body.classes.has('schedule-modal-open'), 'closing the editor must unlock background scrolling');
assert.strictEqual(context.window.restoredScrollY, 327, 'closing must restore the previous page position');
assert.strictEqual(context.window.resizeHandler, null, 'closing must remove the resize listener');

async function testTeacherAutocomplete() {
  context.autoSyncHorario = function () {};
  context.fetch = async url => {
    assert(url.includes('/api/search?q=Ri'));
    return {
      ok: true,
      json: async () => ({ profesores: [
        { profe: 'Rivero Rosa Elvira' },
        { profe: 'Rivero Rosa Elvira' },
        { profe: 'Rivas Ana' }
      ] })
    };
  };
  context.buscarProfesoresModal('Ri');
  const debounce = timers.pop();
  await debounce();
  const suggestions = fields.get('modal-profesores-options').innerHTML;
  assert(suggestions.includes('Rivero Rosa Elvira'));
  assert(suggestions.includes('Rivas Ana'));
  assert(!suggestions.includes('Usar «'), 'the search text must never be accepted as a manual professor name');
  assert.strictEqual((suggestions.match(/data-val="Rivero Rosa Elvira"/g) || []).length, 1, 'duplicate names should be removed');
  context.seleccionarProfesorModal('Rivero Rosa Elvira');
  assert.strictEqual(fields.get('modal-add-profesor').value, 'Rivero Rosa Elvira');
  const reconciled = JSON.parse(vm.runInContext(`JSON.stringify(mergeEnrichedSchedule(
    [{ id: 'known', profesor: 'karina arancibia' }, { id: 'unknown', profesor: 'docente inventado' }],
    [{ id: 'known', profesor: 'ARANCIBIA KARINA ANDREA' }, { id: 'unknown', profesor: '' }]
  ))`, context));
  assert.strictEqual(reconciled[0].profesor, 'ARANCIBIA KARINA ANDREA');
  assert.strictEqual(reconciled[1].profesor, '', 'unmatched old lowercase names must be cleared by JSON sync');
  context.abrirProfesoresDropdown();
  assert.strictEqual(fields.get('modal-profesor-search').value, '', 'reopening professor selector should clear its search');
  assert.strictEqual(fields.get('modal-add-profesor').value, 'Rivero Rosa Elvira', 'clearing the search must preserve the selected professor');
  fields.get('modal-add-id').value = '';
  fields.get('modal-add-dia').value = '3';
  fields.get('modal-add-bloque').value = '3';
  fields.get('modal-add-curso').value = 'Tecnologias inAlambricas';
  context.guardarNuevaClaseModal({ preventDefault() {} });
  const manuallyNamed = JSON.parse(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases.find(item => item.curso === "Tecnologias inAlambricas"))', context));
  assert(manuallyNamed, 'the user-entered course name should be saved verbatim');
  assert.strictEqual(manuallyNamed.cursoDisplay, 'Tecnologias inAlambricas');
  assert.strictEqual(fields.get('label-modal-profesor').textContent, 'Rivero Rosa Elvira');
  assert.strictEqual(fields.get('modal-add-profesor').value, 'Rivero Rosa Elvira');
  context.TODAS_LAS_SALAS = ['E999.1.S101', 'V432.2.S201', 'E441.2.S201', 'E441.1.S101', 'V432.1.S101'];
  context.abrirSalasDropdown();
  const roomOptions = fields.get('modal-salas-options').innerHTML;
  assert(roomOptions.indexOf('>-</button>') >= 0 && roomOptions.indexOf('>-</button>') < roomOptions.indexOf('E441.1.S101'), 'no-room option should show a dash and appear first');
  assert(roomOptions.indexOf('E441.2.S201') < roomOptions.indexOf('V432.1.S101'), 'E441 rooms should come before V432');
  assert(roomOptions.indexOf('E441.1.S101') < roomOptions.indexOf('E441.2.S201'), 'rooms should be naturally sorted');
  assert(!roomOptions.includes('my-modal-select-group-label'), 'room buildings must not have separate headings');
  assert(roomOptions.includes('E441.1.S101') && roomOptions.includes('V432.2.S201'));
  assert(!roomOptions.includes('E999.1.S101'), 'rooms outside the two chosen buildings must be excluded');
  context.seleccionarSalaModal('E441.1.S101');
  assert.strictEqual(fields.get('modal-add-sala').value, 'E441.1.S101');
  assert.strictEqual(fields.get('label-modal-sala').textContent, 'E441.1.S101');
  console.log('schedule-class-edit: edits role and details, loads edit suggestions, and autocompletes teachers');
}

testTeacherAutocomplete().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

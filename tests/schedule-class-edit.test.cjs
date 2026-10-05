const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const fields = new Map();
const timers = [];
const modalDialogStyle = {};
const mainContent = { getBoundingClientRect() { return { left: 340, right: 1374, width: 1034 }; } };
const fieldIds = [
  'modal-add-id', 'modal-add-dia', 'modal-add-bloque', 'modal-add-hora-inicio',
  'modal-add-curso', 'modal-add-tipo', 'modal-add-sala', 'modal-add-seccion',
  'modal-add-profesor', 'modal-input-real-search', 'modal-titulo-bloque',
  'modal-bloque-badge', 'modal-save-class', 'modal-delete-class',
  'modal-add-rol', 'label-modal-rol', 'label-modal-tipo', 'dd-modal-rol', 'dd-modal-tipo',
  'label-modal-curso', 'dd-modal-curso', 'modal-curso-search', 'modal-cursos-dropdown', 'modal-cursos-options',
  'modal-profesores-dropdown', 'modal-profesores-options', 'modal-salas-dropdown',
  'modal-salas-options', 'modal-profesor-search',
  'label-modal-sala', 'label-modal-profesor', 'dd-modal-sala', 'dd-modal-profesor',
  'modal-agregar-ramo', 'modal-real-classes-list'
];
for (const id of fieldIds) {
  fields.set(id, {
    value: '', textContent: '', hidden: false, required: false, style: {},
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
fields.get('modal-agregar-ramo').querySelector = () => ({ style: modalDialogStyle });
context.document.body.classList.owner = context.document.body;
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/horario.js', 'utf8'), context);
vm.runInContext(`
  MI_HORARIO_DATA = { escuela: 'EIT', clases: [{
    id: 'edit-me', dia: 1, diaNombre: 'Lunes', bloqueNum: 6,
    horaInicio: '16:00', horaFin: '17:20', curso: 'Ecuaciones Diferenciales',
    tipo: 'Cátedra', seccion: '12', sala: '', profesor: 'Rivero', rol: 'student'
  }] };
  let classLookup = null;
  cargarClasesRealesBloque = function (day, start) { classLookup = { day, start }; };
  guardarMiHorarioEnStorage = function () {};
  renderMiHorario = function () {};
  actualizarHeroMiHorario = function () {};
  actualizarContadoresFiltrosMiHorario = function () {};
  modalRolSeleccionado = 'assistant';
`, context);

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
assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify(classLookup)', context)), { day: 1, start: '16:00' });
assert.strictEqual(fields.get('modal-add-id').value, 'edit-me');
assert.strictEqual(fields.get('modal-add-curso').value, 'Ecuaciones Diferenciales');
assert.strictEqual(fields.get('modal-add-sala').required, false);
assert.strictEqual(fields.get('modal-delete-class').hidden, false);
assert.strictEqual(fields.get('modal-save-class').attributes['aria-label'], 'Guardar cambios');
assert.strictEqual(fields.get('modal-save-class').textContent, '', 'opening edit must preserve the save icon instead of replacing it with visible text');

fields.get('modal-add-profesor').value = 'Rivero Rosa Elvira';
context.setModalRol('assistant');
context.guardarNuevaClaseModal({ preventDefault() {} });
let savedClass = JSON.parse(vm.runInContext('JSON.stringify(MI_HORARIO_DATA.clases[0])', context));
assert.strictEqual(savedClass.id, 'edit-me');
assert.strictEqual(savedClass.rol, 'assistant');
assert.strictEqual(savedClass.profesor, 'Rivero Rosa Elvira');
assert.strictEqual(savedClass.sala, '');

context.setModalTipo('Laboratorio');
context.setModalRol('assistant');
assert.strictEqual(fields.get('modal-add-tipo').value, 'Laboratorio');
assert.strictEqual(fields.get('label-modal-tipo').textContent, 'Laboratorio');
assert.strictEqual(fields.get('modal-add-rol').value, 'assistant');
assert.strictEqual(fields.get('label-modal-rol').textContent, 'Ayudante');

const modalTemplate = fs.readFileSync('templates/components/schedule_modal.html', 'utf8');
const modalStyles = fs.readFileSync('static/css/horario.css', 'utf8');
assert(!/data-val="Taller"/.test(modalTemplate), 'Taller must not be an available class type');
assert(/data-val="Laboratorio"[^>]*>Laboratorio</.test(modalTemplate), 'Laboratorio must be shown in full');
assert.strictEqual((modalTemplate.match(/dropdown-trigger notas-course-trigger/g) || []).length, 5, 'all five selectors must use the Notes selector appearance');
assert(/\.my-modal-select \.dropdown-item\.active\s*\{[^}]*background: linear-gradient/.test(modalStyles), 'selected type and role options must stay highlighted');
assert(/oninput="buscarProfesoresModal\(this\.value\)"/.test(modalTemplate), 'teacher field must use JSON autocomplete');
assert(/oninput="buscarCursosModal\(this\.value\)"/.test(modalTemplate), 'manual course field must search JSON courses');
assert(!modalTemplate.includes('Buscar clase real') && !modalTemplate.includes('modal-real-badge'), 'real class search should not show its title or count capsule');
assert(modalTemplate.includes('<span>Rellena manualmente</span>') && !modalTemplate.includes('O completa / edita'), 'manual form divider should use the shorter centered copy');
assert(!/modal-real-badge|clases en bloque|cursos disponibles/.test(fs.readFileSync('static/js/horario.js', 'utf8')), 'real class search should not update a count badge');
assert(/\.my-search-real-container > \.search-field\s*\{[^}]*max-width: none/.test(modalStyles), 'real course search capsule should span the same content width as its results');
assert(/\.my-search-real-container > \.search-field\s*\{[^}]*width: calc\(100% - 10px\)/.test(modalStyles), 'real course search capsule should leave room for the results scrollbar');
assert(!/my-real-item-chip[^\n]*\$\{codigo\}/.test(fs.readFileSync('static/js/horario.js', 'utf8')), 'real course results should not display course codes');
context.renderListaClasesRealesModal([{
  curso: 'Arquitecturas Emergentes', sala: 'E441.2.S201', seccion: '2', profe: 'Rivero Rosa Elvira'
}], false);
const realClassResults = fields.get('modal-real-classes-list').innerHTML;
assert(realClassResults.includes('Arquitecturas Emergentes') && realClassResults.includes('E441.2.S201') && realClassResults.includes('Sección 2'));
const visibleRealClassMetadata = (realClassResults.match(/<div class="my-real-item-meta">([\s\S]*?)<\/div>/) || [])[1] || '';
assert(!visibleRealClassMetadata.includes('Rivero Rosa Elvira'), 'block match rows should not show the professor');
assert(realClassResults.includes('class="my-real-item-separator" aria-hidden="true"></span>') && !realClassResults.includes('my-real-item-chip') && !realClassResults.includes('my-real-select-btn'), 'block matches should render as clean rows with CSS metadata dots');
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
assert(/#modal-agregar-ramo \.my-modal-dialog::-webkit-scrollbar-track\s*\{[^}]*margin-block: 20px/.test(modalStyles), 'schedule scrollbar track should stay inset from the rounded top and bottom edges');
assert(/#modal-agregar-ramo \.my-modal-dialog::-webkit-scrollbar-thumb\s*\{[^}]*border-radius: 999px/.test(modalStyles), 'schedule scrollbar thumb should have rounded ends');
assert(/@media \(max-width: 640px\)[\s\S]*?#modal-agregar-ramo \.my-modal-dialog\s*\{[^}]*scrollbar-width: none/.test(modalStyles), 'mobile should hide the native scrollbar indicator while preserving touch scrolling');
assert(/#modal-agregar-ramo \.my-modal-dialog::-webkit-scrollbar\s*\{[^}]*display: none/.test(modalStyles), 'mobile WebKit scrollbar indicator should not overlap rounded edges');
assert(/\.my-real-class-item\s*\{[^}]*border-bottom: 1px solid/.test(modalStyles), 'real classes should be divided by subtle row rules instead of colored cards');
assert(/\.my-divider-with-text\s*\{[^}]*justify-content: center[^}]*margin: 3px 0 11px/.test(modalStyles), 'manual form divider should be centered and sit closer to the search results');
assert(/\.my-real-item-separator\s*\{[^}]*border-radius: 50%/.test(modalStyles), 'inline metadata separator should be a round CSS dot, not a font glyph');
assert(/getBoundingClientRect\(\)/.test(fs.readFileSync('static/js/horario.js', 'utf8')), 'desktop position should follow the content bounds');
assert(/#dd-modal-profesor\.open \.my-modal-search-menu,\s*#dd-modal-curso\.open \.my-modal-search-menu\s*\{[^}]*display: flex/.test(modalStyles), 'course and teacher searches stay outside the results scroller');
assert(/#modal-profesores-options,\s*#modal-cursos-options\s*\{[^}]*overflow-y: auto/.test(modalStyles), 'search results should scroll independently from their fixed inputs');
assert(/@media \(max-width: 640px\)[\s\S]*?#modal-agregar-ramo \.my-modal-dialog\s*\{[^}]*width: min\(calc\(90vw \+ 12px\), calc\(100vw - 20px\), 572px\)[^}]*height: auto[^}]*min-height: min\(calc\(90dvh \+ 12px\), 772px\)[^}]*max-height: calc\(100dvh - 20px\)/.test(modalStyles), 'mobile editor should grow 12px in each dimension while respecting the dynamic viewport');
assert(modalStyles.includes('@media (max-height: 620px)') && modalStyles.includes('#modal-agregar-ramo .my-modal-dialog {\n        min-height: 0;'), 'short screens should not force a tall editor');

context.confirmarWeb = (_message, callback) => callback();
fields.get('modal-add-id').value = 'edit-me';
context.eliminarClaseDesdeEditor({ preventDefault() {}, stopPropagation() {} });
assert.strictEqual(vm.runInContext('MI_HORARIO_DATA.clases.length', context), 0);
assert(!context.document.body.classes.has('schedule-modal-open'), 'closing the editor must unlock background scrolling');
assert.strictEqual(context.window.restoredScrollY, 327, 'closing must restore the previous page position');
assert.strictEqual(context.window.resizeHandler, null, 'closing must remove the resize listener');

async function testTeacherAutocomplete() {
  context.fetch = async url => {
    assert(url.includes('/api/search?q=Ri') || url.includes('/api/search?q=Cal') || url.includes('/api/search?q=Xy'));
    const isCourseQuery = url.includes('/api/search?q=Cal');
    return {
      ok: true,
      json: async () => ({ profesores: [
        { profe: 'Rivero Rosa Elvira' },
        { profe: 'Rivero Rosa Elvira' },
        { profe: 'Rivas Ana' }
      ], cursos: isCourseQuery ? [
        { curso: 'CALCULO I' },
        { curso: 'CALCULO I' },
        { curso: 'CALCULO AVANZADO' }
      ] : [] })
    };
  };
  context.buscarProfesoresModal('Ri');
  const debounce = timers.pop();
  await debounce();
  const suggestions = fields.get('modal-profesores-options').innerHTML;
  assert(suggestions.includes('Rivero Rosa Elvira'));
  assert(suggestions.includes('Rivas Ana'));
  assert.strictEqual((suggestions.match(/data-val="Rivero Rosa Elvira"/g) || []).length, 1, 'duplicate names should be removed');
  context.seleccionarProfesorModal('Rivero Rosa Elvira');
  assert.strictEqual(fields.get('modal-add-profesor').value, 'Rivero Rosa Elvira');
  context.abrirProfesoresDropdown();
  assert.strictEqual(fields.get('modal-profesor-search').value, '', 'reopening professor selector should clear its search');
  assert.strictEqual(fields.get('modal-add-profesor').value, 'Rivero Rosa Elvira', 'clearing the search must preserve the selected professor');
  context.buscarCursosModal('Cal');
  const courseSearch = timers.pop();
  await courseSearch();
  const courseOptions = fields.get('modal-cursos-options').innerHTML;
  assert(courseOptions.includes('CALCULO I') && courseOptions.includes('CALCULO AVANZADO'));
  assert(!courseOptions.includes('Usar «Cal»'), 'partial queries with catalog matches should not appear as custom courses');
  assert.strictEqual((courseOptions.match(/data-val="CALCULO I"/g) || []).length, 1, 'duplicate courses should be removed');
  context.seleccionarCursoModal('CALCULO I');
  assert.strictEqual(fields.get('modal-add-curso').value, 'CALCULO I');
  assert.strictEqual(fields.get('label-modal-curso').textContent, 'CALCULO I');
  context.abrirCursosDropdown();
  assert.strictEqual(fields.get('modal-curso-search').value, '', 'reopening course selector should clear its search');
  assert.strictEqual(fields.get('modal-add-curso').value, 'CALCULO I', 'clearing the search must preserve the selected course');
  context.buscarCursosModal('Xy');
  const customCourseSearch = timers.pop();
  await customCourseSearch();
  assert(fields.get('modal-cursos-options').innerHTML.includes('Usar «Xy»'), 'manual custom course names should remain available when no JSON match exists');
  assert.strictEqual(fields.get('label-modal-profesor').textContent, 'Rivero Rosa Elvira');
  assert.strictEqual(fields.get('modal-add-profesor').value, 'Rivero Rosa Elvira');
  context.TODAS_LAS_SALAS = ['E999.1.S101', 'V432.2.S201', 'E441.2.S201', 'E441.1.S101', 'V432.1.S101'];
  context.abrirSalasDropdown();
  const roomOptions = fields.get('modal-salas-options').innerHTML;
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

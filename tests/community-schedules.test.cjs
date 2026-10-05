const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('static/js/community_schedules.js', 'utf8');
const appSource = fs.readFileSync('static/js/app.js', 'utf8');
const styles = fs.readFileSync('static/css/community.css', 'utf8');
assert.match(source, /class="public-profile-search-input"/);
assert.match(source, /matches\.slice\(pageStart, pageStart \+ MAX_VISIBLE_PROFILES\)/);
assert.match(source, /const MAX_VISIBLE_PROFILES = 40/);
assert.match(source, /class="public-profile-pagination"/);
assert.match(source, /search_shared_profiles/);
assert.match(source, /get_shared_profile_information/);
assert.doesNotMatch(source, /<select class="public-profile-select"/);
assert.match(source, /document\.createElement\('dialog'\)/);
assert.match(source, /dialog\.showModal\(\)/);
assert.match(source, /aria-haspopup="dialog"/);
assert.match(source, /toolbar\.classList\.add\('public-profile-toolbar--unified'\)/);
assert.match(source, /toolbar\.innerHTML = pickerMarkup\(\)/);
assert.match(source, /section\.insertBefore\(content, builder \? builder\.nextSibling : toolbar\.nextSibling\)/);
assert.match(source, /document\.addEventListener\('portal:section-entered',[\s\S]*?sections\.some\(section => section\.id === event\.detail\.panelId\)[\s\S]*?applySelection\(''\)/);
assert.match(appSource, /new CustomEvent\('portal:section-entered', \{ detail: \{ panelId \} \}\)/);
for (const sectionId of ['tab-mihorario', 'tab-solemnes', 'tab-notas', 'tab-agenda', 'tab-progreso']) {
  assert.match(source, new RegExp(`id: '${sectionId}'`));
}
assert.match(source, /public-profile-trigger-copy small'\)\.textContent = 'Mi perfil'/);
assert.match(styles, /\.public-profile-toolbar--unified \.public-profile-picker \{ width: 100%; \}/);
assert.match(styles.split('@media (max-width: 600px) {').pop(), /\.public-profile-toolbar--unified \{ padding: 0; \}/);
assert.doesNotMatch(styles, /\.public-profile-trigger-chevron \{[^}]*border(?:\s|:)/);
assert.match(styles, /\.public-profile-dialog-close \{[^}]*border: 0;[^}]*background: transparent;/);
assert.match(styles, /#tab-progreso \{ overflow: visible !important; \}/);
assert.match(styles, /#tab-notas\.public-profile-active > :not\(\.public-profile-toolbar\):not\(\.public-profile-content\):not\(\.notas-controls-shell\)/);
assert.match(styles, /#tab-notas\.public-profile-active #notas-builder-container \{ display: none !important; \}/);
assert.match(fs.readFileSync('static/css/main.css', 'utf8'), /\.malla-scroll-wrapper \{\s*overflow-x: auto;/);
const mainStyles = fs.readFileSync('static/css/main.css', 'utf8');
assert.match(mainStyles, /@media \(max-width: 1023px\) \{\s*\.malla-scroll-wrapper \{\s*padding-left: 32px;/);
assert.match(mainStyles, /\.malla-scroll-wrapper \{\s*overflow-x: auto;[\s\S]*?padding-right: max\(20px,/);
const scheduleStyles = fs.readFileSync('static/css/horario.css', 'utf8');
assert.match(scheduleStyles, /@media \(max-width: 900px\) \{\s*\.my-week-grid \{\s*width: 100vw;\s*max-width: none;\s*margin-left: calc\(-50vw \+ 50%\);\s*padding-left: max\(32px,/);
assert.match(scheduleStyles, /@media \(max-width: 900px\) \{\s*\.my-week-grid \{[\s\S]*?padding-right: max\(20px,/);
assert.match(source, /type="text" inputmode="search"/);
assert.doesNotMatch(source, /type="search"/);
assert.doesNotMatch(source, /public-profile-menu|renderProfileMenu|aria-expanded/);
assert.doesNotMatch(styles, /public-profile-menu/);
assert.match(styles, /\.public-profile-dialog\[open\]\s*\{\s*display:\s*flex/);
assert.match(styles, /\.public-profile-dialog\s*\{[^}]*max-height:/s);
assert.match(styles, /height:\s*min\(88dvh, 720px\)/);
assert.match(styles, /max-height:\s*calc\(100dvh - 48px\)/);
assert.match(styles, /\.public-profile-dialog\s*\{\s*position:\s*fixed;\s*inset:\s*0;/);
assert.match(styles, /\.public-profile-dialog \.public-profile-dialog-header \{ position: static;[^}]*pointer-events: auto;/);
assert.match(source, /const compactViewport = window\.matchMedia/);
assert.doesNotMatch(source, /Mi información/);
const elements = new Map();
const sharedSchedules = [{ user_id: 'friend', display_name: 'Ana García López', modules: {
  schedule: { clases: [{ dia: 1, horaInicio: '08:30', horaFin: '09:50', curso: 'Cálculo', sala: 'E101' }] },
  grades: { 'me|Cálculo': { items: [{ name: 'Solemne 1', weight: 30, grade: 6.1 }] } },
  agenda: [{ fecha: '2026-10-02', ramo: 'Cálculo', tipo: 'Solemne' }],
  curriculum: { 1: 2 }
} }];
const client = { rpc: async (name, args) => {
  if (name === 'search_shared_profiles') {
    assert.deepStrictEqual(JSON.parse(JSON.stringify(args)), { p_query: '', p_limit: 41, p_offset: 0 });
    return { data: sharedSchedules.map(({ user_id, display_name }) => ({ user_id, display_name })), error: null };
  }
  if (name === 'get_shared_profile_information') {
    assert.deepStrictEqual(JSON.parse(JSON.stringify(args)), { p_user_id: 'friend' });
    return { data: sharedSchedules[0].modules, error: null };
  }
  throw new Error(`Unexpected RPC ${name}`);
} };
const selectors = [];
const documentListeners = {};
const publicContents = [
  { dataset: { module: 'grades' }, hidden: true, innerHTML: '' },
  { dataset: { module: 'agenda' }, hidden: true, innerHTML: '' }
];
const context = {
  window: {
    PortalAuth: { user: { id: 'self' }, client },
    mostrarHorarioPerfilEnMiHorario: value => { context.sharedSchedule = value; },
    cerrarHorarioPerfilEnMiHorario: () => { context.sharedSchedule = null; },
    renderNotasPublicas: (container, payload) => { context.publicGrades = payload; container.innerHTML = 'personal notes component'; },
    renderAgendaPublica: (container, payload) => { context.publicAgenda = payload; container.innerHTML = 'personal agenda component'; }
  },
  document: {
    getElementById: id => elements.get(id),
    querySelector: () => null,
    querySelectorAll: selector => selector === '.public-profile-picker' ? selectors : selector === '.public-profile-content' ? publicContents : [],
    addEventListener(name, callback) { documentListeners[name] = callback; }
  }, console
};
vm.createContext(context);
vm.runInContext(source, context);

(async () => {
  await context.window.cargarHorariosComunidad();
  await context.window.PortalCommunity.select('friend');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.sharedSchedule)), [
    { dia: 1, horaInicio: '08:30', horaFin: '09:50', curso: 'Cálculo', sala: 'E101' }
  ]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.window.PortalCommunity.getSelected().modules.agenda)), [
    { fecha: '2026-10-02', ramo: 'Cálculo', tipo: 'Solemne' }
  ]);
  assert.strictEqual(publicContents[0].innerHTML, 'personal notes component');
  assert.strictEqual(publicContents[1].innerHTML, 'personal agenda component');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.publicGrades['me|Cálculo'].items)), [
    { name: 'Solemne 1', weight: 30, grade: 6.1 }
  ]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.publicAgenda)), [
    { fecha: '2026-10-02', ramo: 'Cálculo', tipo: 'Solemne' }
  ]);
  for (const panelId of ['tab-mihorario', 'tab-solemnes', 'tab-notas', 'tab-agenda', 'tab-progreso']) {
    await context.window.PortalCommunity.select('friend');
    assert.strictEqual(context.window.PortalCommunity.getSelected().user_id, 'friend');
    documentListeners['portal:section-entered']({ detail: { panelId } });
    assert.strictEqual(context.window.PortalCommunity.getSelected(), null, `${panelId} returns to my profile`);
    assert.strictEqual(context.sharedSchedule, null, `${panelId} clears the shared schedule overlay`);
    assert.strictEqual(publicContents[0].hidden, true, `${panelId} hides shared notes`);
  }
  context.window.PortalAuth.client.rpc = async name => {
    if (name === 'search_shared_profiles') return { data: null, error: { message: 'Migration not installed' } };
    if (name === 'get_shared_information') return { data: sharedSchedules, error: null };
    throw new Error(`Unexpected fallback RPC ${name}`);
  };
  await context.window.cargarHorariosComunidad();
  await context.window.PortalCommunity.select('friend');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.sharedSchedule)), [
    { dia: 1, horaInicio: '08:30', horaFin: '09:50', curso: 'Cálculo', sala: 'E101' }
  ]);
  console.log('community_schedules: searchable directory loads data on demand and supports older RPC deployments');
})().catch(error => { console.error(error); process.exit(1); });

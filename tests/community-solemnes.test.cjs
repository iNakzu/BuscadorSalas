const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const container = { innerHTML: '' };
const search = { value: '' };
const toggle = { checked: false, addEventListener() {} };
const status = { textContent: '', hidden: false };
const context = {
  window: {
    PortalCommunity: { getSelected: () => ({
      display_name: 'Ana García',
      careerId: 'informatics',
      modules: { schedule: { clases: [{ curso: 'Probabilidades y Estadística' }, { curso: 'Cálculo II' }] } }
    }) },
    PortalProfile: { getCareerId: () => 'informatics', getSchoolForCareer: () => 'EIT' }
  },
  document: {
    getElementById: id => ({
      'solemnes-container': container,
      'solemnes-search': search,
      'solemnes-highlight-toggle': toggle,
      'solemnes-highlight-status': status
    })[id] || null,
    addEventListener() {}
  },
  localStorage: { getItem: () => null, setItem() {} },
  SOLEMNES_DATA: [
    { dia: 1, horario: '8:30 a 10:30', ramos: [
      { nombre: 'Probabilidades y Estadística (EIT)' },
      { nombre: 'Probabilidades y Estadística (EII EOC)' },
      { nombre: 'Química' }
    ] },
    { dia: 2, horario: '10:45 a 12:45', ramos: [{ nombre: 'Cálculo Dif. E Integral/Cálculo II' }] }
  ],
  getChileTime: () => ({ totalMinutes: 0 }),
  timeToMinutes: () => 0,
  setInterval: () => 1,
  clearInterval() {},
  console
};
const source = fs.readFileSync('static/js/solemnes.js', 'utf8');
assert.match(source, /#tab-solemnes \{[\s\S]*?overflow: visible !important;/);
assert.match(source, /\.solemnes-scroll-wrapper \{[\s\S]*?overflow-x: auto;/);
assert.match(source, /@media \(max-width: 1023px\) \{\s*\.solemnes-scroll-wrapper \{\s*width: 100vw;\s*max-width: none;\s*margin-left: calc\(-50vw \+ 50%\);\s*padding-left: 32px;/);
assert.match(source, /\.solemnes-scroll-wrapper \{[\s\S]*?padding: 0 16px 20px 16px;/);
assert.match(fs.readFileSync('templates/views/solemnes.html', 'utf8'), /id="solemnes-highlight-toggle" type="checkbox"/);
assert.match(fs.readFileSync('static/css/community.css', 'utf8'), /#tab-solemnes\.public-profile-active > \.search-field \{ display: none !important; \}/);
vm.createContext(context);
vm.runInContext(source, context);

// Personalized highlight starts disabled and therefore keeps every exam in its normal style.
vm.runInContext('renderSolemnes()', context);
assert.doesNotMatch(container.innerHTML, /Se resaltan las solemnes.*Ana García/);
assert.doesNotMatch(container.innerHTML, /sol-ramo-pill dimmed/);
assert.match(container.innerHTML, /solemnes-scroll-wrapper/);

// Once enabled, school tags are checked before names: EIT matches and EII/EOC does not.
toggle.checked = true;
vm.runInContext('renderSolemnes()', context);
const eit = container.innerHTML.match(/<div class="sol-ramo-pill matched"[^>]*>[\s\S]*?Probabilidades y Estadística \(EIT\)/);
const eiiEoc = container.innerHTML.match(/<div class="sol-ramo-pill dimmed"[^>]*>[\s\S]*?Probabilidades y Estadística \(EII EOC\)/);
assert(eit, 'the matching EIT exam should be highlighted');
assert(eiiEoc, 'the EII/EOC duplicate should remain dimmed for an EIT profile');
assert.doesNotMatch(container.innerHTML, /Resaltando las evaluaciones|Se resaltan las solemnes/);
assert.strictEqual(status.textContent, '');
assert.strictEqual(status.hidden, true);

// Missing career metadata never guesses a school-specific exam.
context.window.PortalCommunity.getSelected = () => ({
  display_name: 'Perfil sin carrera',
  modules: { schedule: { clases: [{ curso: 'Probabilidades y Estadística' }] } }
});
context.window.PortalProfile.getSchoolForCareer = () => null;
vm.runInContext('renderSolemnes()', context);
assert.match(container.innerHTML, /sol-ramo-pill dimmed[^>]*>[\s\S]*?Probabilidades y Estadística \(EIT\)/);
assert.match(container.innerHTML, /sol-ramo-pill dimmed/);
assert.match(status.textContent, /No se pudo identificar la carrera/);

context.SOLEMNES_DATA = null;
context.console = { error() {} };
vm.runInContext('renderSolemnes()', context);
assert.match(container.innerHTML, /No se pudieron cargar las solemnes/);
assert.doesNotMatch(container.innerHTML, /TypeError|at renderSolemnes|stack/i);
console.log('community_solemnes: default-off highlight, school-aware matching and missing-career safety');

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const container = { innerHTML: '' };
const search = { value: '' };
const toggle = { checked: false };
const status = { textContent: '', hidden: false };
const context = {
  window: { PortalProfile: { getCareerId: () => 'eit', getSchoolForCareer: () => 'EIT' }, PortalCommunity: { getSelected: () => ({
    display_name: 'Ana García',
    careerId: 'eit',
    modules: { schedule: { clases: [{ curso: 'Bases de Datos' }, { curso: 'Probabilidades y Estadística' }, { curso: 'Cálculo II' }] } }
  }) } },
  document: {
    getElementById: id => id === 'solemnes-container' ? container : id === 'solemnes-search' ? search : id === 'solemnes-highlight-toggle' ? toggle : id === 'solemnes-highlight-status' ? status : null,
    querySelector: () => null,
    addEventListener() {}
  },
  SOLEMNES_DATA: [
    { dia: 1, horario: '8:30 a 10:30', ramos: [
      { nombre: 'Bases de Datos (EIT)' },
      { nombre: 'Probabilidades y Estadística (EIT)' },
      { nombre: 'Probabilidades y Estadística (EII EOC)' },
      { nombre: 'Química' }
    ] },
    { dia: 2, horario: '10:45 a 12:45', ramos: [{ nombre: 'Cálculo Dif. E Integral/Cálculo II' }] }
  ],
  localStorage: { getItem: () => null, setItem() {} },
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
assert.doesNotMatch(fs.readFileSync('static/css/community.css', 'utf8'), /#tab-solemnes\.public-profile-active > \.search-field \{ display: none !important; \}/);
vm.createContext(context);
vm.runInContext(source, context);
vm.runInContext('renderSolemnes()', context);

assert.match(container.innerHTML, /<div class="sol-ramo-pill matched" style="[^"]*border-left-color: [^;]+;/);
assert.doesNotMatch(container.innerHTML, /<div class="solemnes-profile-note"/);
assert.match(container.innerHTML, /Bases de Datos \(EIT\)/);
toggle.checked = true;
container.innerHTML = '';
vm.runInContext('renderSolemnes()', context);
assert.doesNotMatch(container.innerHTML, /Resaltando las evaluaciones|Se resaltan las solemnes/);
assert.strictEqual(status.textContent, '');
assert.strictEqual(status.hidden, true);
assert.match(container.innerHTML, /class="sol-ramo-pill matched" style="background: rgba\(255, 255, 255, 0\.15\); border-color: rgba\(255, 255, 255, 0\.7\); border-left-color: #ffffff;"[^>]*>\s*Bases de Datos \(EIT\)/);
assert.match(container.innerHTML, /class="sol-ramo-pill matched" style="background: rgba\(255, 255, 255, 0\.15\); border-color: rgba\(255, 255, 255, 0\.7\); border-left-color: #ffffff;"[^>]*>\s*Probabilidades y Estadística \(EIT\)/);
assert.match(container.innerHTML, /class="sol-ramo-pill dimmed"[^>]*>\s*Probabilidades y Estadística \(EII EOC\)/);
assert.match(container.innerHTML, /Cálculo Dif\. E Integral\/Cálculo II/);
assert.match(container.innerHTML, /sol-ramo-pill matched/);
assert.match(container.innerHTML, /sol-ramo-pill dimmed/);
assert.match(container.innerHTML, /solemnes-scroll-wrapper/);
container.innerHTML = '';
context.SOLEMNES_DATA = null;
context.console = { error() {} };
vm.runInContext('renderSolemnes()', context);
assert.match(container.innerHTML, /No se pudieron cargar las solemnes/);
assert.doesNotMatch(container.innerHTML, /TypeError|at renderSolemnes|stack/i);
console.log('community_solemnes: highlight defaults off and filters by selected career and schedule when enabled');

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const container = { innerHTML: '' };
const search = { value: '' };
const context = {
  window: { PortalCommunity: { getSelected: () => ({
    display_name: 'Ana García',
    modules: { schedule: { clases: [{ curso: 'Bases de Datos' }, { curso: 'Cálculo II' }] } }
  }) } },
  document: {
    getElementById: id => id === 'solemnes-container' ? container : id === 'solemnes-search' ? search : null,
    addEventListener() {}
  },
  SOLEMNES_DATA: [
    { dia: 1, horario: '8:30 a 10:30', ramos: [{ nombre: 'Bases de Datos (EIT)' }, { nombre: 'Química' }] },
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
assert.match(source, /@media \(max-width: 1023px\) \{\s*\.solemnes-scroll-wrapper \{\s*width: 100vw;\s*max-width: none;\s*margin-left: calc\(-50vw \+ 50%\);/);
assert.match(fs.readFileSync('static/css/community.css', 'utf8'), /#tab-solemnes\.public-profile-active > \.search-field \{ display: none !important; \}/);
vm.createContext(context);
vm.runInContext(source, context);
vm.runInContext('renderSolemnes()', context);

assert.match(container.innerHTML, /Ana García/);
assert.match(container.innerHTML, /Bases de Datos \(EIT\)/);
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
console.log('community_solemnes: highlights exams matching the selected public schedule');

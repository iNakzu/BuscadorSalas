const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

let selectedDay = 1;
let mobile = true;
const positions = [];
const grid = {
  clientWidth: 390,
  scrollWidth: 1500,
  scrollLeft: 0,
  getBoundingClientRect() { return { left: 0 }; },
  querySelector(selector) {
    const day = Number(selector.match(/my-day-col-(\d+)/)[1]);
    return { getBoundingClientRect: () => ({ left: 20 + (day - 1) * 296 - grid.scrollLeft, width: 280 }) };
  },
  scrollTo({ left, behavior }) {
    grid.scrollLeft = left;
    positions.push({ day: selectedDay, left, behavior });
  }
};
const container = { querySelector: () => grid };
const context = {
  window: { matchMedia: () => ({ matches: mobile }) },
  document: { getElementById: id => id === 'mihorario-display-container' ? container : null, addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {} },
  MI_HORARIO_DEFAULT_DATA: { escuela: 'EIT', clases: [] },
  requestAnimationFrame: callback => callback(),
  setTimeout() { return 1; },
  setInterval() { return 1; },
  console, Date, Intl, JSON, String, Number, Array
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/horario.js', 'utf8'), context);
vm.runInContext(`
  actualizarContadoresFiltrosMiHorario = function () {};
  renderMiHorario = function () {};
  actualizarHeroMiHorario = function () {};
`, context);

for (const day of [1, 2, 3, 4, 5, 6, 0]) {
  selectedDay = day;
  context.getChileTime = () => ({ dayOfWeek: selectedDay });
  context.inicializarMiHorario();
  assert.strictEqual(positions[positions.length - 1].day, day);
  assert.strictEqual(positions[positions.length - 1].left, day >= 1 && day <= 5 ? Math.min(1500 - 390, Math.max(0, 20 + (day - 1) * 296 - (390 - 280) / 2)) : 0);
  assert.strictEqual(positions[positions.length - 1].behavior, 'smooth');
}

mobile = false;
const countBeforeDesktopEntry = positions.length;
context.inicializarMiHorario();
assert.strictEqual(positions.length, countBeforeDesktopEntry);
console.log('schedule_mobile_day_focus: opens on the current weekday; weekends open on Monday; desktop does not scroll');

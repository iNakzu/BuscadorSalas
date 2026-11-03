const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

let grid;
const container = {
  querySelector(selector) {
    assert.strictEqual(selector, '.my-week-grid');
    return grid;
  },
  set innerHTML(_markup) {
    grid = { scrollLeft: 0, style: { scrollBehavior: 'smooth' } };
  }
};
const context = {
  window: {},
  document: { getElementById: () => null, addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {} },
  MI_HORARIO_DEFAULT_DATA: { escuela: 'EIT', clases: [] },
  setTimeout() { return 1; },
  setInterval() { return 1; },
  console, Date, Intl, JSON, String, Number, Array
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/horario.js', 'utf8'), context);

grid = { scrollLeft: 1120, style: { scrollBehavior: 'smooth' } };
context.reemplazarGridHorarioConScroll(container, '<div class="my-week-grid"></div>');
assert.strictEqual(grid.scrollLeft, 1120, 'rerendering the week keeps the manually selected day');
assert.strictEqual(grid.style.scrollBehavior, 'smooth', 'normal smooth scrolling remains enabled');

grid = null;
context.reemplazarGridHorarioConScroll(container, '<div class="my-week-grid"></div>');
assert.strictEqual(grid.scrollLeft, 0, 'the first render does not jump to the current weekday');
console.log('schedule-mobile-day-focus: keeps the chosen weekday when the schedule rerenders');

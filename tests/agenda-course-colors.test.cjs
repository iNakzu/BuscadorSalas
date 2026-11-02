const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = {
  document: { readyState: 'loading', addEventListener() {} },
  window: { innerWidth: 390, addEventListener() {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/agenda.js', 'utf8'), context);

const palette = JSON.parse(vm.runInContext('JSON.stringify(AGENDA_COURSE_PALETTE)', context));
for (const color of palette) {
  const channels = color.split(',').map(Number);
  assert.ok(Math.max(...channels) >= 220, `${color} should have a bright channel`);
  assert.ok(Math.max(...channels) - Math.min(...channels) >= 140, `${color} should look vivid`);
}

const colors = vm.runInContext(`crearMapaColoresRamosAgenda([
  { ramo: 'Cálculo', tipo: 'Solemne' }, { ramo: 'CALCULO', tipo: 'Control' },
  { ramo: 'Física', tipo: 'Solemne' }, { ramo: 'Álgebra', tipo: 'Control' },
  { ramo: 'Química', tipo: 'Trabajo' }, { ramo: 'Programación', tipo: 'Control' },
  { ramo: 'Biología', tipo: 'Presentacion' }, { ramo: 'Historia', tipo: 'Solemne' }
])`, context);
const values = JSON.parse(JSON.stringify(Array.from(colors.entries())));
assert.strictEqual(values.length, 7, 'course names are normalized before assigning colors');
assert.strictEqual(new Set(values.map(([, color]) => color)).size, 7, 'each course receives a distinct color');
assert.ok(vm.runInContext('colorHslAgenda(41)', context).split(',').map(Number).every(Number.isFinite), 'fallback colors remain valid RGB values');

const date = new Date();
const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const events = [
  { id: 'a', ramo: 'Cálculo', tipo: 'Solemne', fecha: `${dateStr}T09:00:00`, hasTime: true },
  { id: 'b', ramo: 'CALCULO', tipo: 'Control', fecha: `${dateStr}T10:00:00`, hasTime: true },
  { id: 'c', ramo: 'Física', tipo: 'Trabajo', fecha: `${dateStr}T11:00:00`, hasTime: true },
  { id: 'd', ramo: 'Álgebra', tipo: 'Presentacion', fecha: `${dateStr}T12:00:00`, hasTime: true },
  { id: 'e', ramo: 'Química', tipo: 'Solemne', fecha: `${dateStr}T13:00:00`, hasTime: true },
  { id: 'f', ramo: 'Programación', tipo: 'Control', fecha: `${dateStr}T14:00:00`, hasTime: true }
];
const days = { innerHTML: '' };
const title = { textContent: '' };
vm.runInContext('renderCalendar', context)({ daysContainer: days, titleEl: title, events, year: date.getFullYear(), month: date.getMonth(), query: '', readOnly: true });
const calendarColors = Array.from(days.innerHTML.matchAll(/class="cal-dot" style="--dot-rgb: ([^"]+)"/g), match => match[1]);
assert.strictEqual(new Set(calendarColors).size, 5, 'calendar dots use course colors even when event types differ');

const cards = { innerHTML: '' };
vm.runInContext('renderAgenda', context)({ container: cards, events, query: '', readOnly: true });
assert.match(cards.innerHTML, /class="cal-dot" style="--dot-rgb:/);
assert.doesNotMatch(cards.innerHTML, /cal-dot solemne|cal-dot control|cal-dot trabajo|cal-dot presentacion/);
const styles = fs.readFileSync('static/css/agenda.css', 'utf8');
assert.match(styles, /@media \(max-width: 600px\)[\s\S]*?\.cal-dots-container \.cal-dot\s*\{[^}]*width: 5px[^}]*height: 5px/);
assert.match(styles, /@media \(min-width: 600px\)[\s\S]*?\.cal-dot, \.cal-dot-multi\s*\{[^}]*width: 8px[^}]*height: 8px/);
assert.match(styles, /@media \(min-width: 900px\)[\s\S]*?\.cal-dot, \.cal-dot-multi \{ width: 12px !important; height: 12px !important; \}/);
console.log('agenda-course-colors: course color is consistent, distinct across courses, and independent of event type');

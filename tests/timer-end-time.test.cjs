const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const container = { innerHTML: '' };
const context = {
  document: {
    addEventListener() {},
    getElementById(id) { return id === 'timer-container' ? container : null; },
    querySelectorAll() { return []; },
    body: { classList: { remove() {} } }
  },
  console,
  setInterval,
  clearInterval,
  Date
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/timer.js', 'utf8'), context);

context.renderTimer();
assert.match(container.innerHTML, /tiempo-wheel-picker/);
assert.match(container.innerHTML, /timer-time-trigger/);
assert.match(container.innerHTML, /timer-time-picker/);
assert.match(container.innerHTML, /timer-clock-face/);
assert.match(container.innerHTML, /timer-clock-tick/);
assert.doesNotMatch(container.innerHTML, /undefined/);
assert.doesNotMatch(container.innerHTML, /type="time"/);
assert.doesNotMatch(container.innerHTML, /tiempo-presets/);
const minuteClockMarkup = vm.runInContext("timerClockMode = 'minute'; getTimerClockPickerMarkup()", context);
assert.match(minuteClockMarkup, /Selecciona los minutos/);
assert.match(minuteClockMarkup, /data-value="55"/);

const now = new Date(2026, 9, 2, 18, 20, 30);
const todayTarget = context.getTimerTargetDate('19:00', now);
assert.equal(todayTarget.getHours(), 19);
assert.equal(todayTarget.getMinutes(), 0);
assert.equal(context.getSecondsUntilTimerTarget('19:00', now), 2370);
assert.match(context.getTimerEndLabel(todayTarget), /Termina a las/);
assert.equal(context.getTimerTargetDate('25:00', now), null);
assert.equal(context.getSecondsUntilTimerTarget('19:00', new Date(2026, 9, 2, 19, 1)), 86340);
assert.match(context.getTimerEndLabel(context.getTimerTargetDate('07:00', now)), /^Mañana · Termina a las/);
assert.match(context.getTimerEndLabel(new Date(2026, 9, 4, 7, 0), now), /^En 2 días · Termina a las/);
assert.equal(context.getClockSelectionFromAngle(0, 'hour'), 12);
assert.equal(context.getClockSelectionFromAngle(90, 'hour'), 3);
assert.equal(context.getClockSelectionFromAngle(354, 'minute'), 59);
vm.runInContext("timerClockDraftTime = '12:15'", context);
for (const mode of ['hour', 'minute']) {
  const hand = context.getClockHandPosition(mode);
  assert.ok(Math.abs(Math.hypot(hand.x - 130, hand.y - 130) - 96) < 0.001);
}
vm.runInContext("timerTargetTime = '07:59'; timerClockDraftTime = '07:59'; timerClockMode = 'hour'; timerPickerOpen = true", context);
const previousDuration = vm.runInContext('timerRemaining', context);
context.chooseTimerClockValue('hour', 8);
assert.equal(vm.runInContext('timerTargetTime', context), '07:59');
assert.equal(vm.runInContext('timerClockDraftTime', context), '08:59');
context.chooseTimerClockValue('minute', 25);
assert.equal(vm.runInContext('timerClockDraftTime', context), '08:25');
context.setTimerPeriod('PM');
assert.equal(vm.runInContext('timerClockDraftTime', context), '20:25');
context.setTimerPeriod('AM');
assert.equal(vm.runInContext('timerClockDraftTime', context), '08:25');
assert.equal(vm.runInContext('timerRemaining', context), previousDuration);
context.confirmTimerClockTime();
assert.equal(vm.runInContext('timerTargetTime', context), '08:25');
console.log('timer end-time tests passed');

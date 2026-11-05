const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const listeners = {};
const toast = { hidden: true, dataset: {} };
const message = { textContent: '' };
const timers = new Map();
let nextTimer = 0;
const document = {
  getElementById(id) {
    return id === 'personal-sync-status' ? toast
      : id === 'personal-sync-message' ? message : null;
  },
  addEventListener(name, callback) { listeners[name] = callback; }
};
const window = {
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
  clearTimeout(id) { timers.delete(id); }
};
const context = { document, window };
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/personal_sync_status.js', 'utf8'), context);

function send(state, module) {
  listeners['portal:personal-sync-status']({ detail: { state, module } });
}

send('syncing', 'schedule');
assert.strictEqual(toast.hidden, true, 'schedule sync must not create an emerging notification');
assert.strictEqual(message.textContent, '');
assert.strictEqual(timers.size, 0);

send('syncing', 'grades');
assert.strictEqual(toast.hidden, false);
assert.strictEqual(message.textContent, 'Sincronizando tus notas…');
assert.strictEqual(toast.dataset.state, 'syncing');
assert.strictEqual(timers.size, 0, 'the in-progress state should remain visible until it resolves');

send('device', 'grades');
assert.strictEqual(message.textContent, 'Notas guardadas en este dispositivo; se sincronizarán al volver la conexión.');
assert.strictEqual(timers.size, 1);
assert.strictEqual(Array.from(timers.values())[0].delay, 8000);

send('synced', 'agenda');
assert.strictEqual(message.textContent, 'Agenda sincronizada.');
assert.strictEqual(timers.size, 1, 'a new state replaces the previous hide timer');
assert.strictEqual(Array.from(timers.values())[0].delay, 2800);
const hideId = Array.from(timers.keys())[0];
const hideCallback = timers.get(hideId).callback;
timers.delete(hideId);
hideCallback();
const fadeId = Array.from(timers.keys())[0];
send('syncing', 'agenda');
const fadeCallback = timers.get(fadeId).callback;
timers.delete(fadeId);
fadeCallback();
assert.strictEqual(toast.hidden, false, 'an older hide animation must not dismiss a newer sync state');
console.log('personal-sync-status: visible local, pending, and synced states passed');

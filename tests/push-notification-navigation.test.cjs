const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

(async () => {
  const listeners = new Map();
  const order = [];
  let opened = false;
  let openedUrl = '';
  let shownNotification;
  const openedClient = { async focus() { order.push('focus-opened'); } };
  const client = {
    url: 'https://horarios.dev/?tab=tab-salas',
    async navigate(url) { order.push('navigate'); this.url = url; return this; },
    async focus() { order.push('focus'); }
  };
  const self = {
    location: { origin: 'https://horarios.dev' },
    navigator: { userAgent: 'Desktop Chrome' },
    registration: {
      async showNotification(title, options) { shownNotification = { title, options }; }
    },
    clients: {
      async matchAll() { return [client]; },
      async openWindow(url) { opened = true; openedUrl = url; order.push('openWindow'); return openedClient; }
    },
    addEventListener(type, callback) { listeners.set(type, callback); }
  };
  const context = { self, URL, caches: {}, fetch() {}, Request: function () {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(process.env.SW_PATH || 'static/sw.js', 'utf8'), context);

  let pushPending;
  listeners.get('push')({
    data: { json: () => ({ title: 'Tu próxima clase', body: 'Comienza pronto.', url: '/?tab=tab-mihorario' }) },
    waitUntil(value) { pushPending = value; }
  });
  await pushPending;
  assert.strictEqual(shownNotification.title, 'Tu próxima clase');
  assert.strictEqual(shownNotification.options.icon, '/static/notification-empty-icon.png');
  assert.strictEqual(shownNotification.options.badge, '/static/notification-status-badge-v2.png');
  assert.strictEqual(shownNotification.options.silent, false);
  assert.strictEqual(shownNotification.options.requireInteraction, true);
  assert.deepStrictEqual(Array.from(shownNotification.options.vibrate), [160, 80, 160]);
  assert.strictEqual(shownNotification.options.data.path, '/?tab=tab-mihorario');

  let pending;
  listeners.get('notificationclick')({
    notification: { data: { path: '/?tab=tab-agenda' }, close() {} },
    waitUntil(value) { pending = value; }
  });
  await pending;
  assert.strictEqual(client.url, 'https://horarios.dev/?tab=tab-agenda');
  assert.deepStrictEqual(order, ['navigate', 'focus']);
  assert.strictEqual(opened, false);

  self.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 16; SM-S928B) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36';
  listeners.get('notificationclick')({
    notification: { data: { path: '/?tab=tab-mihorario' }, close() {} },
    waitUntil(value) { pending = value; }
  });
  await pending;
  assert.strictEqual(opened, true);
  assert.strictEqual(openedUrl, 'https://horarios.dev/?tab=tab-mihorario');
  assert.deepStrictEqual(order.slice(-2), ['openWindow', 'focus-opened']);
  console.log('push-notification-navigation: destination navigation completes before focusing the app window');
})().catch(error => { console.error(error); process.exitCode = 1; });

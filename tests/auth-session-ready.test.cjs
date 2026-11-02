const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

(async () => {
  const listeners = new Map();
  const elements = new Map();
  for (const id of ['auth-status', 'auth-profile', 'auth-avatar', 'auth-name', 'auth-email', 'auth-login', 'auth-gate']) {
    elements.set(id, { hidden: false, textContent: '', disabled: false });
  }
  let completeSessionRead;
  const sessionRead = new Promise(resolve => { completeSessionRead = resolve; });
  const client = { auth: {
    async getSession() { return sessionRead; },
    onAuthStateChange() {},
    async signOut() {}
  } };
  const document = {
    addEventListener(type, callback) { listeners.set(type, callback); },
    getElementById(id) { return elements.get(id) || null; },
    dispatchEvent() {}
  };
  const window = {
    PORTAL_CONFIG: { supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'public' },
    supabase: { createClient() { return client; } },
    localStorage: {},
    location: { reload() {} }
  };
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options && options.detail; } }
  const context = { window, document, localStorage: window.localStorage, CustomEvent, console, location: window.location };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('static/js/auth.js', 'utf8'), context);

  let restoredUser;
  window.PortalAuth.ready.then(user => { restoredUser = user; });
  const sessionInitialization = listeners.get('DOMContentLoaded')();
  await Promise.resolve();
  assert.strictEqual(restoredUser, undefined, 'private deep links must wait while auth reads persisted session');

  const user = { id: 'student-1', email: 'student@example.edu', user_metadata: { full_name: 'Estudiante' } };
  completeSessionRead({ data: { session: { user } } });
  await sessionInitialization;
  await window.PortalAuth.ready;
  assert.strictEqual(restoredUser.id, 'student-1');
  assert.strictEqual(elements.get('auth-gate').hidden, true);
  console.log('auth-session-ready: stored user is published and auth gate hidden before private deep-link routing');
})().catch(error => { console.error(error); process.exitCode = 1; });

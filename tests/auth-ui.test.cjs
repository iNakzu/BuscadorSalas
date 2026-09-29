const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('static/js/auth.js', 'utf8');

function boot(session, signInError = null) {
  const elements = new Map();
  for (const id of ['auth-status', 'auth-profile', 'auth-avatar', 'auth-name', 'auth-email', 'auth-login', 'auth-logout', 'btn-clear-cache']) {
    elements.set(id, { hidden: false, disabled: false, textContent: '' });
  }
  const listeners = {};
  const client = {
    auth: {
      async getSession() { return { data: { session } }; },
      onAuthStateChange() {},
      async signInWithOAuth() { return { error: signInError }; },
      async signOut() {}
    }
  };
  const context = {
    window: { PORTAL_CONFIG: { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'public-key' }, supabase: { createClient: () => client } },
    document: {
      getElementById: id => elements.get(id),
      addEventListener: (name, fn) => { listeners[name] = fn; },
      dispatchEvent() {}
    },
    CustomEvent: class {},
    location: { origin: 'https://portal.example' },
    console
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, elements, listeners };
}

(async () => {
  const signedIn = boot({ user: {
    email: 'ana.garcia@mail.udp.cl',
    user_metadata: { given_name: 'Ana', family_name: 'García', picture: 'https://example.invalid/photo.jpg' }
  } });
  await signedIn.listeners.DOMContentLoaded();
  assert.strictEqual(signedIn.elements.get('auth-name').textContent, 'Ana García');
  assert.strictEqual(signedIn.elements.get('auth-avatar').textContent, 'AG');
  assert.strictEqual(signedIn.elements.get('auth-profile').hidden, false);
  assert.strictEqual(signedIn.elements.get('auth-status').hidden, true);
  assert.strictEqual(signedIn.elements.get('btn-clear-cache').hidden, false);

  const failedLogin = boot(null, { message: 'provider disabled' });
  await failedLogin.listeners.DOMContentLoaded();
  assert.strictEqual(failedLogin.elements.get('btn-clear-cache').hidden, true);
  await failedLogin.context.window.PortalAuth.signIn();
  assert.match(failedLogin.elements.get('auth-status').textContent, /No se pudo iniciar sesión con Google/);
  console.log('auth-ui: initials profile and OAuth error scenarios passed');
})().catch(error => { console.error(error); process.exit(1); });

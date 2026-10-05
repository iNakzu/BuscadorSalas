const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('static/js/auth.js', 'utf8');

function boot(session, signInError = null, publicOrigin = 'https://horarios.dev') {
  const elements = new Map();
  for (const id of ['auth-status', 'auth-profile', 'auth-avatar', 'auth-name', 'auth-email', 'auth-login', 'auth-logout']) {
    elements.set(id, { hidden: false, disabled: false, textContent: '' });
  }
  const listeners = {};
  const calls = {};
  let authStateCallback = null;
  const client = {
    auth: {
      async getSession() { return { data: { session } }; },
      onAuthStateChange(callback) { authStateCallback = callback; },
      async signInWithOAuth(options) { calls.oauth = options; return { error: signInError }; },
      async signOut() {}
    }
  };
  const context = {
    window: {
      PORTAL_CONFIG: { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'public-key', publicOrigin },
      localStorage: {},
      location: { reload() { calls.reload = (calls.reload || 0) + 1; } },
      supabase: { createClient: (_url, _key, options) => { calls.clientOptions = options; return client; } }
    },
    document: {
      getElementById: id => elements.get(id),
      addEventListener: (name, fn) => { listeners[name] = fn; },
      dispatchEvent() {}
    },
    CustomEvent: class {},
    location: { origin: 'https://portal.example', reload() { calls.reload = (calls.reload || 0) + 1; } },
    console
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, elements, listeners, calls, authStateCallback: () => authStateCallback };
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
  signedIn.authStateCallback()('SIGNED_OUT', null);
  assert.strictEqual(signedIn.calls.reload, 1, 'signed-out users should return to the public page');

  const failedLogin = boot(null, { message: 'provider disabled' });
  await failedLogin.listeners.DOMContentLoaded();
  await failedLogin.context.window.PortalAuth.signIn();
  assert.strictEqual(failedLogin.calls.oauth.options.redirectTo, 'https://horarios.dev/');
  assert.strictEqual(failedLogin.calls.clientOptions.auth.flowType, 'pkce');
  assert.strictEqual(failedLogin.calls.clientOptions.auth.persistSession, true);
  assert.strictEqual(failedLogin.calls.clientOptions.auth.detectSessionInUrl, true);
  assert.match(failedLogin.elements.get('auth-status').textContent, /No se pudo iniciar sesión con Google/);
  console.log('auth-ui: initials profile and OAuth error scenarios passed');
})().catch(error => { console.error(error); process.exit(1); });

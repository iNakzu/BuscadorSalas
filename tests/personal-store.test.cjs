const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('static/js/personal_store.js', 'utf8');

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => Array.from(values.keys())[index] || null,
    get length() { return values.size; },
    values
  };
}

function environment({ initial = {}, user = null, remote = null, resetAt = null, resetFailure = false,
  resetResult = { reset_at: '2026-10-03T13:00:00.000Z' }, holdSync = false, resetGeneration = null }) {
  const localStorage = storage(initial);
  const events = [];
  const upserts = [];
  const rpcCalls = [];
  const listeners = {};
  let releaseSync;
  const syncGate = new Promise(resolve => { releaseSync = () => resolve({ data: null, error: null }); });
  const moduleQuery = {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: remote, error: null }; },
    delete() { return this; },
    async in() { return { error: null }; },
    async upsert(row) { upserts.push(row); return { error: null }; }
  };
  const profileQuery = {
    select() { return this; }, eq() { return this; },
    maybeSingle() {
      if (holdSync) return syncGate;
      return Promise.resolve({ data: resetAt ? { data_reset_at: resetAt } : null, error: null });
    }
  };
  const client = {
    from(table) { return table === 'profiles' ? profileQuery : moduleQuery; },
    async rpc(name) {
      rpcCalls.push(name);
      return resetFailure ? { data: null, error: { code: 'PGRST002' } } : { data: resetResult, error: null };
    }
  };
  const context = {
    window: {
      PortalAuth: user ? { user: { id: user }, client } : null,
      PORTAL_CONFIG: resetGeneration ? { personalDataResetGeneration: resetGeneration } : {}
    },
    localStorage,
    document: {
      addEventListener(name, callback) { listeners[name] = callback; },
      dispatchEvent(event) { events.push(event); }
    },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    console,
    Date,
    JSON,
    Map,
    setTimeout
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, localStorage, events, upserts, rpcCalls, listeners, releaseSync };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

(async () => {
  const offline = environment({});
  offline.context.window.PortalStore.register('agenda', 'mi_agenda_v1', []);
  await offline.context.window.PortalStore.save('agenda', [{ id: 1 }]);
  assert.deepStrictEqual(JSON.parse(offline.localStorage.getItem('mi_agenda_v1')), [{ id: 1 }]);

  const newerLocal = environment({
    user: 'user-1',
    initial: {
      'mi_agenda_v1': '[{"id":"local"}]',
      'portal:user-1:agenda': '[{"id":"local"}]',
      'portal:user-1:agenda:updated-at': '2026-09-29T01:00:00.000Z'
    },
    remote: { payload: [{ id: 'remote' }], client_updated_at: '2026-09-29T00:00:00.000Z' }
  });
  newerLocal.context.window.PortalStore.register('agenda', 'mi_agenda_v1', []);
  await settle();
  assert.strictEqual(newerLocal.upserts.length, 1);
  assert.strictEqual(newerLocal.upserts[0].payload[0].id, 'local');
  assert.strictEqual(newerLocal.upserts[0].schema_version, 2);
  assert.strictEqual(newerLocal.upserts[0].reset_marker, '1970-01-01T00:00:00.000Z');

  const secondUser = environment({
    user: 'user-2',
    initial: {
      'mi_agenda_v1': '[{"id":"first-user"}]',
      'portal:legacy-owner': 'user-1'
    },
    remote: null
  });
  secondUser.context.window.PortalStore.register('agenda', 'mi_agenda_v1', []);
  await settle();
  assert.strictEqual(secondUser.upserts.length, 0, 'an empty local module needs no redundant remote write');
  assert.deepStrictEqual(JSON.parse(secondUser.localStorage.getItem('mi_agenda_v1')), []);
  assert.strictEqual(secondUser.events.some(event => event.type === 'portal:remote-state'
    && event.detail.module === 'agenda' && Array.isArray(event.detail.payload)
    && event.detail.payload.length === 0), true);
  console.log('personal_store: 3 scenarios passed');
})().catch(error => { console.error(error); process.exit(1); });

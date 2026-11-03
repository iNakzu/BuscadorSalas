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
  assert.strictEqual(secondUser.upserts.length, 0, 'an empty module should not create a remote row');
  assert.deepStrictEqual(JSON.parse(secondUser.localStorage.getItem('mi_agenda_v1')), []);
  assert.strictEqual(secondUser.events.some(event => event.type === 'portal:remote-state'
    && event.detail.module === 'agenda' && Array.isArray(event.detail.payload)
    && event.detail.payload.length === 0), true);

  const reset = environment({
    user: 'user-3',
    resetAt: '2026-10-03T12:00:00.000Z',
    initial: {
      'mi_horario_custom_v1': '{"clases":[{"curso":"Antiguo"}]}',
      'portal:user-3:schedule': '{"clases":[{"curso":"Antiguo"}]}',
      'portal:user-3:schedule:updated-at': '2026-10-02T10:00:00.000Z',
      'mi_notas_v1': '{"CALCULO":[]}',
      'portal:user-3:grades': '{"CALCULO":[]}'
    },
    remote: null
  });
  reset.context.window.PortalStore.register('schedule', 'mi_horario_custom_v1', { clases: [] });
  reset.context.window.PortalStore.register('grades', 'mi_notas_v1', {});
  await settle();
  assert.strictEqual(reset.upserts.length, 0, 'a reset must not restore stale local payloads');
  assert.deepStrictEqual(JSON.parse(reset.localStorage.getItem('mi_horario_custom_v1')), { clases: [] });
  assert.deepStrictEqual(JSON.parse(reset.localStorage.getItem('mi_notas_v1')), {});
  assert.strictEqual(reset.localStorage.getItem('portal:user-3:data-reset-at:schedule'), '2026-10-03T12:00:00.000Z');

  const buttonReset = environment({
    user: 'user-4',
    initial: {
      'mi_horario_custom_v1': '{"clases":[{"curso":"Persistente"}]}',
      'portal:user-4:schedule': '{"clases":[{"curso":"Persistente"}]}',
      'portal:user-4:schedule:updated-at': '2026-10-03T12:00:00.000Z',
      'mi_notas_v1': '{"ALGEBRA":{}}'
    }
  });
  buttonReset.context.window.PortalStore.register('schedule', 'mi_horario_custom_v1', { clases: [] });
  buttonReset.context.window.PortalStore.register('grades', 'mi_notas_v1', {});
  await settle();
  await buttonReset.context.window.PortalStore.resetAll();
  assert.deepStrictEqual(buttonReset.rpcCalls, ['reset_my_personal_data']);
  assert.strictEqual(buttonReset.localStorage.getItem('mi_horario_custom_v1'), null);
  assert.strictEqual(buttonReset.localStorage.getItem('portal:user-4:schedule'), null);
  assert.strictEqual(buttonReset.localStorage.getItem('mi_notas_v1'), null);
  assert.strictEqual(buttonReset.localStorage.getItem('portal:user-4:data-reset-at:grades'), '2026-10-03T13:00:00.000Z');

  const offlineReset = environment({
    user: 'user-5', resetFailure: true,
    initial: {
      'mi_horario_custom_v1': '{"clases":[{"curso":"Persistente"}]}',
      'portal:user-5:schedule': '{"clases":[{"curso":"Persistente"}]}',
      'mi_notas_v1': '{"CALCULO":{}}'
    }
  });
  offlineReset.context.window.PortalStore.register('schedule', 'mi_horario_custom_v1', { clases: [] });
  offlineReset.context.window.PortalStore.register('grades', 'mi_notas_v1', {});
  await settle();
  await assert.rejects(offlineReset.context.window.PortalStore.resetAll(), error => {
    assert.strictEqual(error.code, 'PGRST002');
    return true;
  });
  assert.deepStrictEqual(JSON.parse(offlineReset.localStorage.getItem('portal:user-5:schedule')),
    { clases: [{ curso: 'Persistente' }] }, 'keep the local copy when Supabase did not confirm deletion');
  assert.deepStrictEqual(JSON.parse(offlineReset.localStorage.getItem('mi_horario_custom_v1')),
    { clases: [{ curso: 'Persistente' }] });
  assert.deepStrictEqual(JSON.parse(offlineReset.localStorage.getItem('mi_notas_v1')), { CALCULO: {} });
  assert.strictEqual(offlineReset.events.some(event => event.type === 'portal:remote-state'
    && event.detail.module === 'schedule' && event.detail.payload.clases.length === 0), false);

  const stalledSync = environment({
    user: 'user-6', holdSync: true,
    initial: {
      'mi_horario_custom_v1': '{"clases":[{"curso":"Bloqueado por sync"}]}',
      'portal:user-6:schedule': '{"clases":[{"curso":"Bloqueado por sync"}]}'
    }
  });
  stalledSync.context.window.PortalStore.register('schedule', 'mi_horario_custom_v1', { clases: [] });
  const stalledResetPromise = stalledSync.context.window.PortalStore.resetAll();
  assert.notStrictEqual(stalledSync.localStorage.getItem('mi_horario_custom_v1'), null,
    'local schedule stays intact until Supabase confirms the reset');
  stalledSync.releaseSync();
  await stalledResetPromise;
  assert.strictEqual(stalledSync.localStorage.getItem('mi_horario_custom_v1'), null,
    'local schedule is cleared after Supabase confirms the reset');

  const generation = 'reset-generation-test';
  const migrated = environment({
    resetGeneration: generation,
    initial: {
      'mi_horario_custom_v1': '{"clases":[{"curso":"Antiguo"}]}',
      'mi_notas_v1': '{"CALCULO":{}}',
      'mi_agenda_v1': '[{"titulo":"Antiguo"}]',
      'mi_progreso_v1': '{"ramo":true}',
      'portal:user-7:schedule': '{"clases":[{"curso":"Antiguo"}]}',
      'portal:user-7:grades:updated-at': '2026-10-02T10:00:00.000Z',
      'portal:user-7:data-reset-at:curriculum': '2026-10-02T10:00:00.000Z',
      'tema': 'oscuro'
    }
  });
  assert.strictEqual(migrated.localStorage.getItem('mi_horario_custom_v1'), null);
  assert.strictEqual(migrated.localStorage.getItem('mi_notas_v1'), null);
  assert.strictEqual(migrated.localStorage.getItem('mi_agenda_v1'), null);
  assert.strictEqual(migrated.localStorage.getItem('mi_progreso_v1'), null);
  assert.strictEqual(migrated.localStorage.getItem('portal:user-7:schedule'), null);
  assert.strictEqual(migrated.localStorage.getItem('tema'), 'oscuro', 'unrelated preferences are preserved');
  assert.strictEqual(migrated.localStorage.getItem('portal:personal-data-reset-generation'), generation);

  const afterGeneration = environment({
    resetGeneration: generation,
    initial: Object.fromEntries(migrated.localStorage.values)
  });
  afterGeneration.localStorage.setItem('mi_horario_custom_v1', '{"clases":[{"curso":"Nuevo"}]}');
  const sameGeneration = environment({
    resetGeneration: generation,
    initial: Object.fromEntries(afterGeneration.localStorage.values)
  });
  assert.match(sameGeneration.localStorage.getItem('mi_horario_custom_v1'), /Nuevo/,
    'the one-time reset must preserve data entered after the reset generation');
  console.log('personal_store: 8 scenarios passed');
})().catch(error => { console.error(error); process.exit(1); });

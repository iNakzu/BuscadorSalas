const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('static/js/personal_store.js', 'utf8');

function makeEnvironment(rpcResult) {
  const values = new Map([
    ['mi_horario_custom_v1', '[{"curso":"Álgebra"}]'],
    ['portal:user-1:horario', '[{"curso":"Álgebra"}]'],
    ['portal:user-1:horario:updated-at', '2026-10-15T12:00:00.000Z']
  ]);
  const localStorage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: null, error: null }; },
    async upsert() { return { error: null }; }
  };
  const client = {
    from() { return query; },
    async rpc() { return rpcResult; }
  };
  const context = {
    window: { PortalAuth: { user: { id: 'user-1' }, client } },
    localStorage,
    document: { addEventListener() {}, dispatchEvent() {} },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    console,
    Date,
    JSON,
    Map,
    setTimeout
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.window.PortalStore.register('horario', 'mi_horario_custom_v1', { clases: [] });
  return { context, localStorage };
}

(async () => {
  const failed = makeEnvironment({ data: null, error: { code: 'PGRST002', message: 'service unavailable' } });
  await new Promise(resolve => setTimeout(resolve, 20));
  await assert.rejects(failed.context.window.PortalStore.resetAll(), error => error.message === 'service unavailable');
  assert.ok(failed.localStorage.getItem('mi_horario_custom_v1'), 'a failed remote reset must preserve the local schedule');

  const succeeded = makeEnvironment({ data: { reset_at: '2026-10-16T12:00:00.000Z' }, error: null });
  await new Promise(resolve => setTimeout(resolve, 20));
  await succeeded.context.window.PortalStore.resetAll();
  assert.strictEqual(succeeded.localStorage.getItem('mi_horario_custom_v1'), null, 'a confirmed remote reset clears local data');
  console.log('personal-store-reset: failed and successful remote reset scenarios passed');
})().catch(error => { console.error(error); process.exit(1); });

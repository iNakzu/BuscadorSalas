(function () {
    const modules = new Map();
    let syncing = false;

    function scopedKey(module, userId) { return `portal:${userId}:${module}`; }
    function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

    async function syncAll() {
        const auth = window.PortalAuth;
        if (syncing || !auth && auth.client || !auth.user) return;
        syncing = true;
        try {
            for (const [module, registration] of modules) {
                const legacyRaw = localStorage.getItem(registration.legacyKey);
                const scoped = scopedKey(module, auth.user.id);
                let localRaw = localStorage.getItem(scoped);
                if (!localRaw && legacyRaw) {
                    localRaw = legacyRaw;
                    localStorage.setItem(scoped, legacyRaw);
                }
                const localPayload = localRaw ? JSON.parse(localRaw) : registration.empty;
                const { data, error } = await auth.client.from('user_module_state')
                    .select('payload,client_updated_at').eq('user_id', auth.user.id).eq('module_key', module).maybeSingle();
                if (error) throw error;
                if (data) {
                    if (!equal(data.payload, localPayload)) {
                        const raw = JSON.stringify(data.payload);
                        localStorage.setItem(scoped, raw);
                        localStorage.setItem(registration.legacyKey, raw);
                        document.dispatchEvent(new CustomEvent('portal:remote-state', { detail: { module, payload: data.payload } }));
                    }
                } else if (localPayload != null) {
                    await save(module, localPayload);
                }
            }
        } catch (error) {
            console.error('No se pudo sincronizar el espacio personal', error);
        } finally { syncing = false; }
    }

    async function save(module, payload) {
        const auth = window.PortalAuth;
        const registration = modules.get(module);
        if (!registration) return;
        if (auth && auth.user) localStorage.setItem(scopedKey(module, auth.user.id), JSON.stringify(payload));
        if (!auth && auth.client || !auth.user) return;
        const now = new Date().toISOString();
        const { error } = await auth.client.from('user_module_state').upsert({
            user_id: auth.user.id, module_key: module, schema_version: 1,
            payload, client_updated_at: now
        }, { onConflict: 'user_id,module_key' });
        if (error) console.error(`No se pudo guardar ${module}`, error);
    }

    window.PortalStore = {
        register(module, legacyKey, empty = {}) { modules.set(module, { legacyKey, empty }); syncAll(); },
        save
    };
    document.addEventListener('portal:auth-changed', syncAll);
})();

(function () {
    const modules = new Map();
    let syncing = false;
    let pendingSync = false;

    function scopedKey(module, userId) { return `portal:${userId}:${module}`; }
    function updatedKey(module, userId) { return `${scopedKey(module, userId)}:updated-at`; }
    function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
    function parse(raw, fallback) {
        if (!raw) return fallback;
        try { return JSON.parse(raw); } catch (_error) { return fallback; }
    }
    function isNewer(localTime, remoteTime) {
        return Boolean(localTime && (!remoteTime || Date.parse(localTime) > Date.parse(remoteTime)));
    }
    function emit(module, payload) {
        document.dispatchEvent(new CustomEvent('portal:remote-state', { detail: { module, payload } }));
    }

    async function upsert(client, userId, module, payload, clientUpdatedAt) {
        const { error } = await client.from('user_module_state').upsert({
            user_id: userId,
            module_key: module,
            schema_version: 1,
            payload,
            client_updated_at: clientUpdatedAt
        }, { onConflict: 'user_id,module_key' });
        if (error) throw error;
    }

    function showPayload(module, registration, userId, payload, updatedAt, previousDisplayed) {
        const raw = JSON.stringify(payload);
        localStorage.setItem(scopedKey(module, userId), raw);
        localStorage.setItem(registration.legacyKey, raw);
        if (updatedAt) localStorage.setItem(updatedKey(module, userId), updatedAt);
        if (!equal(payload, previousDisplayed)) emit(module, payload);
    }

    async function syncAll() {
        const auth = window.PortalAuth;
        if (!auth || !auth.client || !auth.user) return;
        if (syncing) { pendingSync = true; return; }
        syncing = true;
        try {
            const currentUserId = auth.user.id;
            const ownerKey = 'portal:legacy-owner';
            const legacyOwner = localStorage.getItem(ownerKey);
            if (legacyOwner && legacyOwner !== currentUserId) {
                // Replace any previous account's legacy display before awaiting Supabase.
                for (const [module, registration] of modules) {
                    const previous = parse(localStorage.getItem(registration.legacyKey), registration.empty);
                    const scoped = parse(localStorage.getItem(scopedKey(module, currentUserId)), registration.empty);
                    showPayload(module, registration, currentUserId, scoped,
                        localStorage.getItem(updatedKey(module, currentUserId)), previous);
                }
                localStorage.setItem(ownerKey, currentUserId);
            }
            for (const [module, registration] of modules) {
                const userId = auth.user.id;
                const legacyRaw = localStorage.getItem(registration.legacyKey);
                const previousDisplayed = parse(legacyRaw, registration.empty);
                const scoped = scopedKey(module, userId);
                const modified = updatedKey(module, userId);
                let localRaw = localStorage.getItem(scoped);
                let localUpdatedAt = localStorage.getItem(modified);
                const ownerKey = 'portal:legacy-owner';
                const legacyOwner = localStorage.getItem(ownerKey);

                if (!localRaw && legacyRaw && (!legacyOwner || legacyOwner === userId)) {
                    localRaw = legacyRaw;
                    localUpdatedAt = localUpdatedAt || new Date().toISOString();
                    localStorage.setItem(scoped, localRaw);
                    localStorage.setItem(modified, localUpdatedAt);
                    localStorage.setItem(ownerKey, userId);
                }

                const localPayload = parse(localRaw, registration.empty);
                const { data, error } = await auth.client.from('user_module_state')
                    .select('payload,client_updated_at')
                    .eq('user_id', userId)
                    .eq('module_key', module)
                    .maybeSingle();
                if (error) throw error;

                if (!data) {
                    const timestamp = localUpdatedAt || new Date().toISOString();
                    await upsert(auth.client, userId, module, localPayload, timestamp);
                    showPayload(module, registration, userId, localPayload, timestamp, previousDisplayed);
                } else if (isNewer(localUpdatedAt, data.client_updated_at) && !equal(localPayload, data.payload)) {
                    await upsert(auth.client, userId, module, localPayload, localUpdatedAt);
                    showPayload(module, registration, userId, localPayload, localUpdatedAt, previousDisplayed);
                } else {
                    showPayload(module, registration, userId, data.payload, data.client_updated_at, previousDisplayed);
                }
            }
        } catch (error) {
            console.error('No se pudo sincronizar el espacio personal', error);
        } finally {
            syncing = false;
            document.dispatchEvent(new CustomEvent('portal:personal-store-ready'));
            if (pendingSync) { pendingSync = false; syncAll(); }
        }
    }

    async function save(module, payload) {
        const registration = modules.get(module);
        if (!registration) return;
        localStorage.setItem(registration.legacyKey, JSON.stringify(payload));

        const auth = window.PortalAuth;
        if (!auth || !auth.client || !auth.user) return;
        const now = new Date().toISOString();
        localStorage.setItem(scopedKey(module, auth.user.id), JSON.stringify(payload));
        localStorage.setItem(updatedKey(module, auth.user.id), now);
        try {
            await upsert(auth.client, auth.user.id, module, payload, now);
        } catch (error) {
            console.error(`No se pudo guardar ${module}`, error);
        }
    }

    window.PortalStore = {
        register(module, legacyKey, empty = {}) {
            modules.set(module, { legacyKey, empty });
            syncAll();
        },
        save
    };
    document.addEventListener('portal:auth-changed', syncAll);
})();

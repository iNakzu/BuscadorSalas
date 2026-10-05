(function () {
    const modules = new Map();
    let syncing = false;
    let pendingSync = false;
    let resetting = false;
    let activeSaves = 0;
    const resetMarkers = new Map();
    const epochMarker = '1970-01-01T00:00:00.000Z';
    const localResetGeneration = window.PORTAL_CONFIG && window.PORTAL_CONFIG.personalDataResetGeneration;

    function clearLocalDataForResetGeneration() {
        if (!localResetGeneration) return;
        const generationKey = 'portal:personal-data-reset-generation';
        try {
            if (localStorage.getItem(generationKey) === localResetGeneration) return;
            for (const key of ['mi_horario_custom_v1', 'mi_notas_v1', 'mi_agenda_v1', 'mi_progreso_v1', 'portal:legacy-owner']) {
                localStorage.removeItem(key);
            }
            for (let index = localStorage.length - 1; index >= 0; index -= 1) {
                const key = localStorage.key(index);
                if (key && (/^portal:[^:]+:(schedule|grades|agenda|curriculum)(:updated-at)?$/.test(key)
                    || /^portal:[^:]+:data-reset-at:(schedule|grades|agenda|curriculum)$/.test(key))) {
                    localStorage.removeItem(key);
                }
            }
            localStorage.setItem(generationKey, localResetGeneration);
        } catch (error) {
            console.error('No se pudieron limpiar los datos personales locales', error);
        }
    }

    clearLocalDataForResetGeneration();

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

    async function upsert(client, userId, module, payload, clientUpdatedAt, resetMarker) {
        const { error } = await client.from('user_module_state').upsert({
            user_id: userId,
            module_key: module,
            schema_version: 2,
            reset_marker: resetMarker || epochMarker,
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
        if (resetting) return;
        if (syncing) { pendingSync = true; return; }
        syncing = true;
        try {
            const currentUserId = auth.user.id;
            const ownerKey = 'portal:legacy-owner';
            let legacyOwner = localStorage.getItem(ownerKey);
            const { data: profile, error: profileError } = await auth.client.from('profiles')
                .select('data_reset_at')
                .eq('id', currentUserId)
                .maybeSingle();
            if (resetting) return;
            if (profileError) throw profileError;

            const resetAt = profile && profile.data_reset_at;
            resetMarkers.set(currentUserId, resetAt || epochMarker);
            if (resetAt && Date.parse(resetAt) > 0) {
                for (const [module, registration] of modules) {
                    const seenKey = `portal:${currentUserId}:data-reset-at:${module}`;
                    if (localStorage.getItem(seenKey) === resetAt) continue;
                    const previous = parse(localStorage.getItem(registration.legacyKey), registration.empty);
                    localStorage.removeItem(scopedKey(module, currentUserId));
                    localStorage.removeItem(updatedKey(module, currentUserId));
                    if (!legacyOwner || legacyOwner === currentUserId) {
                        localStorage.removeItem(registration.legacyKey);
                    }
                    localStorage.setItem(seenKey, resetAt);
                    if ((!legacyOwner || legacyOwner === currentUserId)
                        && !equal(previous, registration.empty)) emit(module, registration.empty);
                }
                if (!legacyOwner || legacyOwner === currentUserId) {
                    localStorage.setItem(ownerKey, currentUserId);
                    legacyOwner = currentUserId;
                }
            }

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
                let { data, error } = await auth.client.from('user_module_state')
                    .select('payload,client_updated_at')
                    .eq('user_id', userId)
                    .eq('module_key', module)
                    .maybeSingle();
                if (resetting) return;
                if (error) throw error;

                if (data && Date.parse(resetAt || epochMarker) > 0
                    && Date.parse(data.client_updated_at) <= Date.parse(resetAt)) {
                    const { error: staleDeleteError } = await auth.client.from('user_module_state')
                        .delete()
                        .eq('user_id', userId)
                        .eq('module_key', module);
                    if (staleDeleteError) throw staleDeleteError;
                    data = null;
                }

                if (!data) {
                    if (equal(localPayload, registration.empty)) {
                        showPayload(module, registration, userId, registration.empty, null, previousDisplayed);
                        continue;
                    }
                    const timestamp = localUpdatedAt || new Date().toISOString();
                    await upsert(auth.client, userId, module, localPayload, timestamp, resetAt || epochMarker);
                    showPayload(module, registration, userId, localPayload, timestamp, previousDisplayed);
                } else if (isNewer(localUpdatedAt, data.client_updated_at) && !equal(localPayload, data.payload)) {
                    await upsert(auth.client, userId, module, localPayload, localUpdatedAt, resetAt || epochMarker);
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
            if (pendingSync) {
                pendingSync = false;
                if (!resetting) syncAll();
            }
        }
    }

    async function save(module, payload) {
        const registration = modules.get(module);
        if (!registration || resetting) return;
        const auth = window.PortalAuth;
        if (!auth || !auth.client || !auth.user) {
            localStorage.setItem(registration.legacyKey, JSON.stringify(payload));
            return;
        }
        while (syncing && !resetting) await new Promise(resolve => setTimeout(resolve, 10));
        if (resetting) return;
        const userId = auth.user.id;
        const seenKey = `portal:${userId}:data-reset-at:${module}`;
        let resetMarker;
        try {
            resetMarker = resetMarkers.get(userId) || await fetchResetMarker(auth);
        } catch (error) {
            console.error('No se pudo validar el reinicio de datos personales', error);
            localStorage.setItem(registration.legacyKey, JSON.stringify(payload));
            return;
        }
        if (Date.parse(resetMarker) > 0 && localStorage.getItem(seenKey) !== resetMarker) {
            localStorage.removeItem(scopedKey(module, userId));
            localStorage.removeItem(updatedKey(module, userId));
            localStorage.removeItem(registration.legacyKey);
            localStorage.setItem(seenKey, resetMarker);
            resetMarkers.set(userId, resetMarker);
            emit(module, registration.empty);
            window.location.reload();
            return;
        }
        localStorage.setItem(registration.legacyKey, JSON.stringify(payload));
        const now = new Date().toISOString();
        localStorage.setItem(scopedKey(module, userId), JSON.stringify(payload));
        localStorage.setItem(updatedKey(module, userId), now);
        activeSaves += 1;
        try {
            await upsert(auth.client, userId, module, payload, now, resetMarker);
        } catch (error) {
            console.error(`No se pudo guardar ${module}`, error);
        } finally {
            activeSaves -= 1;
        }
    }

    async function fetchResetMarker(auth) {
        const { data, error } = await auth.client.from('profiles')
            .select('data_reset_at')
            .eq('id', auth.user.id)
            .maybeSingle();
        if (error) throw error;
        const marker = data && data.data_reset_at || epochMarker;
        resetMarkers.set(auth.user.id, marker);
        return marker;
    }

    function clearLocalData(userId, resetAt) {
        for (const [module, registration] of modules) {
            localStorage.removeItem(scopedKey(module, userId));
            localStorage.removeItem(updatedKey(module, userId));
            localStorage.removeItem(registration.legacyKey);
            localStorage.setItem(`portal:${userId}:data-reset-at:${module}`, resetAt);
            emit(module, registration.empty);
        }
        localStorage.setItem('portal:legacy-owner', userId);
    }

    async function resetAll() {
        const auth = window.PortalAuth;
        if (!auth || !auth.client || !auth.user) throw new Error('Se requiere una sesión activa.');
        if (resetting) throw new Error('El reinicio ya está en curso.');
        resetting = true;
        let localDataCleared = false;
        try {
            const resetAt = new Date().toISOString();
            // Clear first, without waiting for a possibly stalled Supabase sync.
            clearLocalData(auth.user.id, resetAt);
            localDataCleared = true;
            while (syncing || activeSaves > 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            const { data, error } = await auth.client.rpc('reset_my_personal_data');
            if (error) throw error;
            const resetResult = Array.isArray(data) ? data[0] : data;
            let confirmedResetAt = resetResult && typeof resetResult === 'object'
                ? resetResult.reset_at || (resetResult.reset_my_personal_data && resetResult.reset_my_personal_data.reset_at)
                : resetResult;
            if (typeof confirmedResetAt !== 'string' || !Number.isFinite(Date.parse(confirmedResetAt))) {
                try {
                    confirmedResetAt = await fetchResetMarker(auth);
                } catch (markerError) {
                    console.warn('El borrado remoto se confirmó; no se pudo leer su marca de reinicio.', markerError);
                    confirmedResetAt = resetAt;
                }
            }
            if (typeof confirmedResetAt !== 'string' || !Number.isFinite(Date.parse(confirmedResetAt))) {
                throw new Error('Supabase no confirmó el reinicio.');
            }
            if (confirmedResetAt !== resetAt) clearLocalData(auth.user.id, confirmedResetAt);
            resetMarkers.set(auth.user.id, confirmedResetAt);
            return confirmedResetAt;
        } catch (error) {
            if (localDataCleared) {
                const resetError = new Error(error && error.message || 'No se pudo contactar a Supabase.');
                if (error && error.code) resetError.code = error.code;
                resetError.localDataCleared = true;
                throw resetError;
            }
            throw error;
        } finally {
            pendingSync = false;
            resetting = false;
        }
    }

    window.PortalStore = {
        register(module, legacyKey, empty = {}) {
            modules.set(module, { legacyKey, empty });
            syncAll();
        },
        save,
        resetAll
    };
    document.addEventListener('portal:auth-changed', syncAll);
    if (window.addEventListener) {
        window.addEventListener('storage', event => {
            const auth = window.PortalAuth;
            const prefix = auth && auth.user ? `portal:${auth.user.id}:data-reset-at:` : '';
            if (prefix && event.key && event.key.startsWith(prefix)
                && resetMarkers.get(auth.user.id) !== event.newValue) window.location.reload();
        });
    }
})();

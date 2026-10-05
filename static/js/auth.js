(function () {
    const config = window.PORTAL_CONFIG || {};
    const available = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
    const client = available ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
            flowType: 'pkce',
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage
        }
    }) : null;

    const api = window.PortalAuth = { client, user: null, available };
    let resolveInitialSession;
    api.ready = new Promise(resolve => { resolveInitialSession = resolve; });

    function displayName(user) {
        const metadata = user && user.user_metadata || {};
        const given = String(metadata.given_name || '').trim();
        const family = String(metadata.family_name || '').trim();
        return [given, family].filter(Boolean).join(' ')
            || String(metadata.full_name || metadata.name || '').trim()
            || (user && user.email ? user.email.split('@')[0] : 'Estudiante');
    }

    function initials(name) {
        const words = String(name).trim().split(/\s+/).filter(Boolean);
        if (!words.length) return 'ES';
        if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toLocaleUpperCase('es');
        const firstSurname = words.length >= 3 ? words[words.length - 2] : words[1];
        return `${Array.from(words[0])[0]}${Array.from(firstSurname)[0]}`.toLocaleUpperCase('es');
    }

    function render() {
        const status = document.getElementById('auth-status');
        const profile = document.getElementById('auth-profile');
        const avatar = document.getElementById('auth-avatar');
        const name = document.getElementById('auth-name');
        const email = document.getElementById('auth-email');
        const login = document.getElementById('auth-login');
        if (!status || !profile || !avatar || !name || !email || !login) return;
        if (!available) {
            status.textContent = 'El acceso personal estará disponible al conectar Supabase.';
            login.disabled = true;
            profile.hidden = true;
        } else if (api.user) {
            const gate = document.getElementById('auth-gate');
            if (gate) gate.hidden = true;
            const fullName = displayName(api.user);
            status.hidden = true;
            profile.hidden = false;
            avatar.textContent = initials(fullName);
            name.textContent = fullName;
            email.textContent = api.user.email || '';
            login.hidden = true;
        } else {
            status.hidden = false;
            status.textContent = 'Inicia sesión para sincronizar tus datos personales.';
            profile.hidden = true;
            login.hidden = false;
            login.disabled = false;
        }
    }

    function publish(session, wasSignedOut = false) {
        const hadAuthenticatedUser = Boolean(api.user);
        api.user = session && session.user || null;
        render();
        if (resolveInitialSession) {
            resolveInitialSession(api.user);
            resolveInitialSession = null;
        }
        document.dispatchEvent(new CustomEvent('portal:auth-changed', { detail: { user: api.user } }));
        if (wasSignedOut && hadAuthenticatedUser && !api.user) window.location.reload();
    }

    api.signIn = async function () {
        if (!client) return;
        try {
            const { error } = await client.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${config.publicOrigin || 'https://horarios.dev'}/` }
            });
            if (error) throw error;
        } catch (error) {
            console.error('No se pudo iniciar el acceso con Google', error);
            const status = document.getElementById('auth-status');
            if (status) {
                status.hidden = false;
                status.textContent = 'No se pudo conectar con el servicio de inicio de sesión. Inténtalo de nuevo en unos minutos.';
            }
        }
    };

    api.signOut = async function () {
        if (window.PortalPush && typeof window.PortalPush.detachCurrentDevice === 'function') {
            try { await window.PortalPush.detachCurrentDevice(); }
            catch (error) { console.warn('No se pudo quitar el registro push de este dispositivo antes de cerrar sesión.'); }
        }
        if (client) await client.auth.signOut();
        location.reload();
    };

    api.updateUserMetadata = async function (attributes) {
        if (!client || !api.user) throw new Error('Inicia sesión para editar tu perfil.');
        const { data, error } = await client.auth.updateUser({ data: attributes });
        if (error) throw error;
        if (data && data.user) {
            api.user = data.user;
            render();
            document.dispatchEvent(new CustomEvent('portal:auth-changed', { detail: { user: api.user } }));
        }
        return data && data.user;
    };

    api.resetPersonalData = async function () {
        const button = document.getElementById('auth-reset-data');
        const status = document.getElementById('profile-feedback') || document.getElementById('auth-status');
        if (!client || !api.user || !window.PortalStore || !button) return;
        button.disabled = true;
        try {
            await window.PortalStore.resetAll();
            window.location.reload();
        } catch (error) {
            console.error('No se pudieron reiniciar los datos personales', error);
            if (status) {
                status.hidden = false;
                if (error && error.localDataCleared) {
                    status.textContent = 'Datos locales borrados. Actualizando…';
                    window.location.reload();
                    return;
                }
                const errorCode = error && error.code ? ` (${error.code})` : '';
                status.textContent = `No se pudieron reiniciar los datos${errorCode || ' (error de conexión)'}. Inténtalo de nuevo.`;
            }
            button.disabled = false;
        }
    };

    document.addEventListener('DOMContentLoaded', async () => {
        render();
        if (!client) {
            publish(null);
            return;
        }
        try {
            const { data } = await client.auth.getSession();
            publish(data && data.session);
            client.auth.onAuthStateChange((event, session) => publish(session, event === 'SIGNED_OUT'));
        } catch (error) {
            console.error('No se pudo restaurar la sesión guardada', error);
            publish(null);
        }
    });
})();

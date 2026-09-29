(function () {
    const config = window.PORTAL_CONFIG || {};
    const available = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
    const client = available ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

    const api = window.PortalAuth = { client, user: null, available };

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
        return `${Array.from(words[0])[0]}${Array.from(words[words.length - 1])[0]}`.toLocaleUpperCase('es');
    }

    function render() {
        const status = document.getElementById('auth-status');
        const profile = document.getElementById('auth-profile');
        const avatar = document.getElementById('auth-avatar');
        const name = document.getElementById('auth-name');
        const email = document.getElementById('auth-email');
        const login = document.getElementById('auth-login');
        const logout = document.getElementById('auth-logout');
        if (!status || !profile || !avatar || !name || !email || !login || !logout) return;
        if (!available) {
            status.textContent = 'El acceso personal estará disponible al conectar Supabase.';
            login.disabled = true;
            profile.hidden = true;
        } else if (api.user) {
            const fullName = displayName(api.user);
            status.hidden = true;
            profile.hidden = false;
            avatar.textContent = initials(fullName);
            name.textContent = fullName;
            email.textContent = api.user.email || '';
            login.hidden = true;
            logout.hidden = false;
        } else {
            status.hidden = false;
            status.textContent = 'Inicia sesión para sincronizar tus datos personales.';
            profile.hidden = true;
            login.hidden = false;
            login.disabled = false;
            logout.hidden = true;
        }
    }

    function publish(session) {
        api.user = session && session.user || null;
        render();
        document.dispatchEvent(new CustomEvent('portal:auth-changed', { detail: { user: api.user } }));
    }

    api.signIn = async function () {
        if (!client) return;
        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${location.origin}/` }
        });
        if (error) {
            const status = document.getElementById('auth-status');
            if (status) {
                status.hidden = false;
                status.textContent = 'No se pudo iniciar sesión con Google. Revisa la configuración de Supabase.';
            }
        }
    };

    api.signOut = async function () {
        if (client) await client.auth.signOut();
        location.reload();
    };

    document.addEventListener('DOMContentLoaded', async () => {
        render();
        if (!client) return;
        const { data } = await client.auth.getSession();
        publish(data.session);
        client.auth.onAuthStateChange((_event, session) => publish(session));
    });
})();

(function () {
    const config = window.PORTAL_CONFIG || {};
    const available = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
    const client = available ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

    const api = window.PortalAuth = { client, user: null, available };

    function render() {
        const status = document.getElementById('auth-status');
        const login = document.getElementById('auth-login');
        const logout = document.getElementById('auth-logout');
        if (!status || !login || !logout) return;
        if (!available) {
            status.textContent = 'El acceso personal estará disponible al conectar Supabase.';
            login.disabled = true;
        } else if (api.user) {
            status.textContent = api.user.email;
            login.hidden = true;
            logout.hidden = false;
        } else {
            status.textContent = 'Inicia sesión para sincronizar tus datos personales.';
            login.hidden = false;
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
        await client.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${location.origin}/` }
        });
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

(function () {
    const panel = document.getElementById('push-settings-inline');
    if (!panel) return;
    const enableButton = document.getElementById('push-enable-button');
    const status = document.getElementById('push-dialog-status');
    let supported = false;
    let subscribed = false;
    let changing = false;
    function setStatus(message, error = false) {
        status.textContent = message || '';
        status.style.color = error ? '#fca5a5' : '';
    }

    function authClient() {
        return window.PortalAuth && window.PortalAuth.client;
    }

    async function headers() {
        const client = authClient();
        if (!client) throw new Error('Inicia sesión para guardar tus recordatorios.');
        const result = await client.auth.getSession();
        const token = result && result.data && result.data.session && result.data.session.access_token;
        if (!token) throw new Error('Tu sesión venció. Inicia sesión de nuevo.');
        return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    }

    async function api(path, options = {}) {
        const authHeaders = await headers();
        const response = await fetch(`/api/push${path}`, {
            ...options,
            headers: { ...authHeaders, ...(options.headers || {}) },
            cache: 'no-store',
            credentials: 'same-origin'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'No se pudo guardar la configuración.');
        return result;
    }

    function updateButtonState() {
        enableButton.hidden = false;
        enableButton.textContent = subscribed ? 'Desactivar notificaciones' : 'Activar notificaciones';
        enableButton.setAttribute('aria-pressed', String(subscribed));
    }

    async function syncReminders() {
        if (!subscribed) return;
        const classes = typeof window.portalGetSchedulePushData === 'function' ? window.portalGetSchedulePushData() : [];
        const agenda = typeof window.portalGetAgendaPushData === 'function' ? window.portalGetAgendaPushData() : [];
        await api('/schedule', { method: 'PUT', body: JSON.stringify({ classes, agenda }) });
    }

    async function loadSettings() {
        if (!window.PortalAuth || !window.PortalAuth.user) return;
        try {
            const config = await fetch('/api/push/config', { cache: 'no-store' }).then(response => response.json());
            supported = Boolean(config.supported && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
            if (!supported) {
                setStatus('Las notificaciones push no están disponibles en este navegador o aún no están configuradas.', true);
                enableButton.disabled = true;
                return;
            }
            enableButton.disabled = false;
            const prefs = await api('/subscribe');
            subscribed = prefs.subscribed;
            updateButtonState();
            if (subscribed) {
                await api('/settings', { method: 'PATCH', body: JSON.stringify({ classes: true, agenda: true }) });
                await syncReminders();
            }
            if (Notification.permission === 'denied' && !subscribed) {
                setStatus('Las notificaciones están bloqueadas en el navegador. Actívalas en la configuración del sitio.', true);
            } else if (subscribed) {
                setStatus('Este dispositivo está listo para recibir tus avisos.');
            } else {
                setStatus('Activa los avisos de clases y agenda en este dispositivo.');
            }
        } catch (error) {
            setStatus(error.message, true);
        }
    }

    async function activate() {
        if (!supported || changing) return;
        changing = true;
        enableButton.disabled = true;
        setStatus('');
        try {
            // Ask permission directly from the user gesture, before network work.
            const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
            if (permission !== 'granted') throw new Error('Permite las notificaciones para recibir avisos en este dispositivo.');
            const config = await fetch('/api/push/config', { cache: 'no-store' }).then(response => response.json());
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                const encodedKey = config.publicKey.replace(/-/g, '+').replace(/_/g, '/');
                const key = Uint8Array.from(atob(encodedKey + '='.repeat((4 - encodedKey.length % 4) % 4)), char => char.charCodeAt(0));
                subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
            }
            await api('/subscribe', { method: 'POST', body: JSON.stringify({ subscription: subscription.toJSON() }) });
            localStorage.setItem('portal:push-endpoint', subscription.endpoint);
            subscribed = true;
            await api('/settings', { method: 'PATCH', body: JSON.stringify({ classes: true, agenda: true }) });
            await syncReminders();
            updateButtonState();
            setStatus('Listo. Recibirás recordatorios 10 minutos antes.');
        } catch (error) {
            setStatus(error.message || 'No se pudieron activar las notificaciones.', true);
            await loadSettings();
        } finally {
            changing = false;
            enableButton.disabled = false;
        }
    }

    async function deactivate() {
        if (changing) return;
        changing = true;
        enableButton.disabled = true;
        try {
            await detachCurrentDevice();
            subscribed = false;
            updateButtonState();
            setStatus('Notificaciones desactivadas en este dispositivo.');
        } catch (error) {
            setStatus(error.message, true);
        } finally {
            changing = false;
            enableButton.disabled = false;
        }
    }

    async function detachCurrentDevice() {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        const endpoint = subscription && subscription.endpoint || localStorage.getItem('portal:push-endpoint');
        let removalError = null;
        if (endpoint && window.PortalAuth && window.PortalAuth.user) {
            try { await api('/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }); }
            catch (error) { removalError = error; }
        }
        if (subscription) await subscription.unsubscribe();
        localStorage.removeItem('portal:push-endpoint');
        if (removalError) throw removalError;
    }

    enableButton.addEventListener('click', () => subscribed ? deactivate() : activate());
    document.addEventListener('portal:auth-changed', () => {
        const signedIn = Boolean(window.PortalAuth && window.PortalAuth.user);
        panel.hidden = !signedIn;
        subscribed = false;
        if (signedIn) loadSettings();
        updateButtonState();
    });
    document.addEventListener('portal:schedule-updated', () => syncReminders().catch(() => {}));
    document.addEventListener('portal:agenda-updated', () => syncReminders().catch(() => {}));
    document.addEventListener('portal:remote-state', () => setTimeout(() => syncReminders().catch(() => {}), 0));
    document.addEventListener('portal:personal-store-ready', () => syncReminders().catch(() => {}));
    document.addEventListener('DOMContentLoaded', () => {
        if (window.PortalAuth && window.PortalAuth.user) {
            panel.hidden = false;
            loadSettings();
        } else {
            panel.hidden = true;
        }
    });
    window.PortalPush = { detachCurrentDevice };
})();

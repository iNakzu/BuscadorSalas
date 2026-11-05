(function () {
    const toast = document.getElementById('personal-sync-status');
    const message = document.getElementById('personal-sync-message');
    if (!toast || !message) return;

    const moduleNames = {
        schedule: { label: 'tu horario', synced: 'Horario sincronizado', saved: 'Horario guardado', pronoun: 'se sincronizará' },
        grades: { label: 'tus notas', synced: 'Notas sincronizadas', saved: 'Notas guardadas', pronoun: 'se sincronizarán' },
        agenda: { label: 'tu agenda', synced: 'Agenda sincronizada', saved: 'Agenda guardada', pronoun: 'se sincronizará' },
        curriculum: { label: 'tu malla', synced: 'Malla sincronizada', saved: 'Malla guardada', pronoun: 'se sincronizará' }
    };
    let hideTimer = null;
    let stateRevision = 0;

    function hide() {
        const revision = ++stateRevision;
        toast.dataset.visible = 'false';
        window.setTimeout(() => {
            if (revision === stateRevision) toast.hidden = true;
        }, 200);
    }

    document.addEventListener('portal:personal-sync-status', event => {
        const detail = event.detail || {};
        const subject = moduleNames[detail.module] || {
            label: 'tus datos', synced: 'Datos sincronizados', saved: 'Datos guardados', pronoun: 'se sincronizarán'
        };
        const messages = {
            syncing: `Sincronizando ${subject.label}…`,
            synced: `${subject.synced}.`,
            device: `${subject.saved} en este dispositivo; ${subject.pronoun} al volver la conexión.`,
            local: `${subject.saved} solo en este dispositivo.`
        };
        if (!messages[detail.state]) return;
        const revision = ++stateRevision;
        if (hideTimer !== null) window.clearTimeout(hideTimer);
        hideTimer = null;
        message.textContent = messages[detail.state];
        toast.dataset.state = detail.state;
        toast.hidden = false;
        window.requestAnimationFrame(() => {
            if (revision === stateRevision) toast.dataset.visible = 'true';
        });
        if (detail.state !== 'syncing') {
            hideTimer = window.setTimeout(hide, detail.state === 'device' ? 8000 : 2800);
        }
    });
})();

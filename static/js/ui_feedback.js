function escapeUiFeedback(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;').replace(/\n/g, '<br>');
}

function getUiFeedbackModal() {
    let modal = document.getElementById('ui-feedback-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ui-feedback-modal';
        modal.className = 'ui-feedback-modal';
        document.body.appendChild(modal);
    }
    return modal;
}

function cerrarUiFeedback() {
    const modal = document.getElementById('ui-feedback-modal');
    if (modal) modal.style.display = 'none';
}

function mostrarAlertaWeb(message, title = 'Aviso', tone = 'info') {
    const modal = getUiFeedbackModal();
    const accent = tone === 'error' ? 'danger' : tone;
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="ui-feedback-card modern-alert">
            <div class="ui-feedback-content">
                <h2>${escapeUiFeedback(title)}</h2>
                <p>${escapeUiFeedback(message)}</p>
            </div>
            <div class="ui-feedback-actions">
                <button class="ui-feedback-primary full-width" type="button" onclick="cerrarUiFeedback()">Entendido</button>
            </div>
        </div>`;
}

function confirmarWeb(message, onConfirm, title = 'Confirmar acción') {
    const modal = getUiFeedbackModal();
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="ui-feedback-card modern-alert">
            <div class="ui-feedback-content">
                <h2>${escapeUiFeedback(title)}</h2>
                <p>${escapeUiFeedback(message)}</p>
            </div>
            <div class="ui-feedback-actions">
                <button class="ui-feedback-secondary" type="button" onclick="cerrarUiFeedback()">Cancelar</button>
                <button class="ui-feedback-danger" type="button" id="ui-feedback-confirm">Confirmar</button>
            </div>
        </div>`;
    document.getElementById('ui-feedback-confirm').onclick = () => {
        cerrarUiFeedback();
        onConfirm();
    };
}

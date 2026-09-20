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
        <div class="ui-feedback-card">
            <div class="ui-feedback-icon ${accent}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    ${tone === 'error' ? '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v5"></path><path d="M12 16h.01"></path>' : '<path d="M12 5v14"></path><path d="M5 12h14"></path>'}
                </svg>
            </div>
            <div class="ui-feedback-content"><span class="section-kicker">${escapeUiFeedback(tone === 'error' ? 'Revisa esto' : 'BuscadorSalas')}</span><h2>${escapeUiFeedback(title)}</h2><p>${escapeUiFeedback(message)}</p></div>
            <button class="ui-feedback-close" type="button" onclick="cerrarUiFeedback()">×</button>
            <div class="ui-feedback-actions"><button class="ui-feedback-primary" type="button" onclick="cerrarUiFeedback()">Entendido</button></div>
        </div>`;
}

function confirmarWeb(message, onConfirm, title = 'Confirmar acción') {
    const modal = getUiFeedbackModal();
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="ui-feedback-card">
            <div class="ui-feedback-icon warning"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3 2.5 20h19L12 3Z"></path><path d="M12 9v5"></path><path d="M12 17h.01"></path></svg></div>
            <div class="ui-feedback-content"><span class="section-kicker">Confirmación</span><h2>${escapeUiFeedback(title)}</h2><p>${escapeUiFeedback(message)}</p></div>
            <button class="ui-feedback-close" type="button" onclick="cerrarUiFeedback()">×</button>
            <div class="ui-feedback-actions"><button class="ui-feedback-secondary" type="button" onclick="cerrarUiFeedback()">Cancelar</button><button class="ui-feedback-danger" type="button" id="ui-feedback-confirm">Confirmar</button></div>
        </div>`;
    document.getElementById('ui-feedback-confirm').onclick = () => {
        cerrarUiFeedback();
        onConfirm();
    };
}

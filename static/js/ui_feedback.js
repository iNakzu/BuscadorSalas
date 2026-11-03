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
    if (modal) {
        modal.style.display = 'none';
        modal.innerHTML = '';
    }
}

function renderUiFeedbackCard({ message = '', title = 'Aviso', tone = 'info', items = [], actions = '' } = {}) {
    const modal = getUiFeedbackModal();
    const normalizedTone = ['info', 'success', 'warning', 'error'].includes(tone) ? tone : 'info';
    const icon = normalizedTone === 'error'
        ? '<path d="M12 9v4"></path><path d="M12 17h.01"></path><circle cx="12" cy="12" r="9"></circle>'
        : normalizedTone === 'warning'
            ? '<path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z"></path>'
            : normalizedTone === 'success'
                ? '<path d="m5 12 4 4L19 6"></path><circle cx="12" cy="12" r="9"></circle>'
                : '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path>';
    const itemMarkup = items.length
        ? `<ul class="ui-feedback-items">${items.map(item => `<li>${escapeUiFeedback(item)}</li>`).join('')}</ul>`
        : '';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <section class="ui-feedback-card modern-alert tone-${normalizedTone}" role="dialog" aria-modal="true" aria-labelledby="ui-feedback-title">
            <span class="ui-feedback-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></span>
            <div class="ui-feedback-content">
                <h2 id="ui-feedback-title">${escapeUiFeedback(title)}</h2>
                <p>${escapeUiFeedback(message)}</p>
                ${itemMarkup}
            </div>
            ${actions || '<div class="ui-feedback-actions"><button class="ui-feedback-primary full-width" type="button" onclick="cerrarUiFeedback()">Entendido</button></div>'}
        </section>`;
}

function mostrarUiFeedback(options = {}) {
    renderUiFeedbackCard(options);
}

function mostrarAlertaWeb(message, title = 'Aviso', tone = 'info') {
    renderUiFeedbackCard({ message, title, tone });
}

function confirmarWeb(message, onConfirm, title = 'Confirmar acción') {
    renderUiFeedbackCard({
        message,
        title,
        tone: 'warning',
        actions: '<div class="ui-feedback-actions"><button class="ui-feedback-secondary" type="button" onclick="cerrarUiFeedback()">Cancelar</button><button class="ui-feedback-danger" type="button" id="ui-feedback-confirm">Confirmar</button></div>'
    });
    document.getElementById('ui-feedback-confirm').onclick = () => {
        cerrarUiFeedback();
        onConfirm();
    };
}

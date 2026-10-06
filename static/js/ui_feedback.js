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
        modal.onclick = null;
        modal.onkeydown = null;
        const previousFocus = modal.__previousFocus;
        modal.__previousFocus = null;
        if (previousFocus && document.contains && document.contains(previousFocus)) previousFocus.focus();
    }
}

function renderUiFeedbackCard({ message = '', title = 'Aviso', tone = 'info', items = [], primaryLabel = 'Entendido', onPrimary = null, primaryVariant = 'primary', secondaryLabel = '', onSecondary = null, icon = 'info', closeOnBackdrop = false } = {}) {
    const modal = getUiFeedbackModal();
    const normalizedTone = ['info', 'success', 'warning', 'error'].includes(tone) ? tone : 'info';
    const iconMarkup = icon === 'lock'
        ? '<rect x="4" y="10" width="16" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path>'
        : icon === 'user'
            ? '<circle cx="12" cy="8" r="4"></circle><path d="M5 21a7 7 0 0 1 14 0"></path>'
            : normalizedTone === 'error'
        ? '<path d="M12 9v4"></path><path d="M12 17h.01"></path><circle cx="12" cy="12" r="9"></circle>'
        : normalizedTone === 'warning'
            ? '<path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z"></path>'
            : normalizedTone === 'success'
                ? '<path d="m5 12 4 4L19 6"></path><circle cx="12" cy="12" r="9"></circle>'
                : '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path>';
    const itemMarkup = items.length
        ? `<ul class="ui-feedback-items">${items.map(item => `<li>${escapeUiFeedback(item)}</li>`).join('')}</ul>`
        : '';
    const primaryClass = primaryVariant === 'danger' ? 'ui-feedback-danger' : 'ui-feedback-primary';
    const actionMarkup = `<div class="ui-feedback-actions">${secondaryLabel ? '<button class="ui-feedback-secondary" type="button" id="ui-feedback-secondary-action"></button>' : ''}<button class="${primaryClass}" type="button" id="ui-feedback-primary-action"></button></div>`;
    if (modal.style.display !== 'flex') modal.__previousFocus = document.activeElement;
    modal.style.display = 'flex';
    modal.innerHTML = `
        <section class="ui-feedback-card modern-alert tone-${normalizedTone}" role="dialog" aria-modal="true" aria-labelledby="ui-feedback-title">
            <span class="ui-feedback-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconMarkup}</svg></span>
            <div class="ui-feedback-content">
                <h2 id="ui-feedback-title">${escapeUiFeedback(title)}</h2>
                <p>${escapeUiFeedback(message)}</p>
                ${itemMarkup}
            </div>
            ${actionMarkup}
        </section>`;
    const primary = document.getElementById('ui-feedback-primary-action');
    const secondary = document.getElementById('ui-feedback-secondary-action');
    primary.textContent = primaryLabel;
    primary.onclick = () => onPrimary ? onPrimary() : cerrarUiFeedback();
    if (secondary) {
        secondary.textContent = secondaryLabel;
        secondary.onclick = () => onSecondary ? onSecondary() : cerrarUiFeedback();
    }
    modal.onclick = closeOnBackdrop ? event => { if (event.target === modal) cerrarUiFeedback(); } : null;
    modal.onkeydown = event => { if (event.key === 'Escape') cerrarUiFeedback(); };
    primary.focus();
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
        secondaryLabel: 'Cancelar',
        primaryLabel: 'Confirmar',
        primaryVariant: 'danger',
        onPrimary: () => { cerrarUiFeedback(); onConfirm(); }
    });
}

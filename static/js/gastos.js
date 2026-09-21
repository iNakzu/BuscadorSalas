let misGastos = JSON.parse(localStorage.getItem('mis_gastos')) || [];

function initGastos() {
    misGastos = misGastos.map(normalizeGasto);
    renderGastos();
}

function saveGastos() {
    localStorage.setItem('mis_gastos', JSON.stringify(misGastos));
}

const GASTO_CATEGORIES = {
    comida: 'Comida',
    transporte: 'Transporte',
    estudio: 'Estudio',
    ocio: 'Ocio',
    hogar: 'Hogar',
    salud: 'Salud',
    otro: 'Otro'
};

const GASTO_PAYMENTS = {
    efectivo: 'Efectivo',
    debito: 'Débito',
    credito: 'Crédito',
    transferencia: 'Transferencia'
};

function normalizeGasto(gasto) {
    return {
        ...gasto,
        monto: Number(gasto.monto || 0),
        category: gasto.category || 'otro',
        payment: gasto.payment || 'efectivo',
        note: gasto.note || '',
        timestamp: Number(gasto.timestamp || Date.now())
    };
}

function renderGastos() {
    const list = document.getElementById('gastos-list');
    const totalEl = document.getElementById('gastos-total');
    const monthEl = document.getElementById('gastos-mes');
    const averageEl = document.getElementById('gastos-promedio');
    const countEl = document.getElementById('gastos-cantidad');
    const latestEl = document.getElementById('gastos-ultimo');
    const listCountEl = document.getElementById('gastos-list-count');
    const categorySummary = document.getElementById('gastos-category-summary');
    if (!list || !totalEl) return;

    const allGastos = misGastos.map(normalizeGasto);
    const searchInput = document.getElementById('gastos-search');
    const categoryInput = document.getElementById('gastos-filter-category');
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const categoryFilter = categoryInput ? categoryInput.value : 'all';
    const sorted = [...allGastos].sort((a, b) => b.timestamp - a.timestamp);
    const filtered = sorted.filter(g => {
        const matchesQuery = !query || `${g.desc} ${g.note} ${GASTO_CATEGORIES[g.category]}`.toLowerCase().includes(query);
        return matchesQuery && (categoryFilter === 'all' || g.category === categoryFilter);
    });

    const total = allGastos.reduce((sum, g) => sum + g.monto, 0);
    const now = new Date();
    const monthTotal = allGastos
        .filter(g => {
            const date = new Date(g.timestamp);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        })
        .reduce((sum, g) => sum + g.monto, 0);
    const formatMoney = value => `$${Number(value).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
    const formatDate = timestamp => new Date(timestamp).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

    totalEl.innerText = Number(total).toLocaleString('es-CL');
    if (monthEl) monthEl.innerText = formatMoney(monthTotal);
    if (averageEl) averageEl.innerText = formatMoney(allGastos.length ? total / allGastos.length : 0);
    if (countEl) countEl.innerText = allGastos.length;
    if (latestEl) latestEl.innerText = allGastos.length ? new Date(sorted[0].timestamp).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—';
    if (listCountEl) listCountEl.innerText = `${filtered.length} de ${allGastos.length} ${allGastos.length === 1 ? 'registro' : 'registros'}`;

    if (categorySummary) {
        const categoryTotals = allGastos.reduce((acc, gasto) => {
            acc[gasto.category] = (acc[gasto.category] || 0) + gasto.monto;
            return acc;
        }, {});
        categorySummary.innerHTML = Object.entries(categoryTotals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 4)
            .map(([category, amount]) => `<span class="gastos-category-chip"><b>${GASTO_CATEGORIES[category] || 'Otro'}</b><strong>${formatMoney(amount)}</strong></span>`)
            .join('');
    }

    if (allGastos.length === 0) {
        list.innerHTML = `<div class="gastos-empty"><strong>Aún no hay movimientos</strong><span>Agrega tu primer gasto para comenzar a ver tu resumen.</span></div>`;
        return;
    }
    
    let html = '';
    if (!filtered.length) {
        list.innerHTML = `<div class="gastos-empty"><strong>No hay coincidencias</strong><span>Prueba con otra búsqueda o categoría.</span></div>`;
        return;
    }
    filtered.forEach(g => {
        html += `
            <div class="gasto-item">
                <div class="gasto-item-main">
                    <span class="gasto-item-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 10h18"></path><path d="M7 15h3"></path></svg>
                    </span>
                    <div class="gasto-item-copy">
                        <strong>${escapeHtml(g.desc)}</strong>
                        <span>${formatDate(g.timestamp)} · ${GASTO_CATEGORIES[g.category] || 'Otro'} · ${GASTO_PAYMENTS[g.payment] || 'Efectivo'}${g.note ? ` · ${escapeHtml(g.note)}` : ''}</span>
                    </div>
                </div>
                <div class="gasto-item-side">
                    <span class="gasto-item-amount">${formatMoney(g.monto)}</span>
                    <button onclick="borrarGasto('${g.id}')" class="gasto-delete-btn" title="Eliminar gasto">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 13h10l1-13"></path><path d="M9 7V4h6v3"></path></svg>
                    </button>
                </div>
            </div>
        `;
    });
    
    list.innerHTML = html;
}

function abrirModalNuevoGasto() {
    let modal = document.getElementById('gasto-form-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gasto-form-modal';
        modal.className = 'gastos-modal';
        document.body.appendChild(modal);
    }
    const today = new Date().toISOString().slice(0, 10);
    modal.style.display = 'flex';
    modal.innerHTML = `
        <form class="gastos-modal-card" onsubmit="guardarGastoDesdeModal(event)">
            <div class="gastos-modal-header">
                <div><span class="gastos-section-kicker">Nuevo movimiento</span><h2>Registrar gasto</h2><p>Completa los datos para mantener tu historial ordenado.</p></div>
                <button type="button" class="gastos-modal-close" onclick="cerrarModalGasto()" title="Cerrar">×</button>
            </div>
            <div class="gastos-form-grid">
                <label class="gastos-modal-field gastos-form-wide">Descripción<input name="desc" required maxlength="80" placeholder="Ej. Almuerzo en el casino" autocomplete="off"></label>
                <label class="gastos-modal-field">Monto<input name="monto" type="number" min="1" step="1" required placeholder="0" inputmode="numeric"></label>
                <label class="gastos-modal-field">Fecha<input name="date" type="date" value="${today}" required></label>
                <label class="gastos-modal-field">Categoría<select name="category" required>${Object.entries(GASTO_CATEGORIES).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
                <label class="gastos-modal-field">Método de pago<select name="payment" required>${Object.entries(GASTO_PAYMENTS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
                <label class="gastos-modal-field gastos-form-wide">Nota opcional<textarea name="note" rows="3" maxlength="180" placeholder="Agrega contexto, lugar o recordatorio..."></textarea></label>
            </div>
            <div class="gastos-modal-actions"><button type="button" class="gastos-modal-secondary" onclick="cerrarModalGasto()">Cancelar</button><button class="gastos-modal-primary" type="submit">Guardar gasto</button></div>
        </form>`;
    modal.querySelector('input[name="desc"]').focus();
}

function cerrarModalGasto() {
    const modal = document.getElementById('gasto-form-modal');
    if (modal) modal.style.display = 'none';
}

function guardarGastoDesdeModal(event) {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const desc = data.get('desc').trim();
    const monto = parseInt(data.get('monto'), 10);
    const date = data.get('date');

    if (!desc) {
        mostrarAlertaWeb("Ingresa una descripción para el gasto.", 'Falta la descripción', 'error');
        return;
    }
    if (isNaN(monto) || monto <= 0) {
        mostrarAlertaWeb("Ingresa un monto válido mayor a 0.", 'Monto inválido', 'error');
        return;
    }
    if (!date) {
        mostrarAlertaWeb("Selecciona una fecha para el gasto.", 'Falta la fecha', 'error');
        return;
    }
    
    misGastos.push({
        id: 'gasto_' + Date.now(),
        desc: desc,
        monto: monto,
        category: data.get('category') || 'otro',
        payment: data.get('payment') || 'efectivo',
        note: (data.get('note') || '').trim(),
        timestamp: new Date(`${date}T12:00:00`).getTime()
    });
    saveGastos();
    cerrarModalGasto();
    renderGastos();
}

function borrarGasto(id) {
    confirmarWeb("¿Eliminar este gasto?", () => {
        misGastos = misGastos.filter(g => g.id !== id);
        saveGastos();
        renderGastos();
    }, 'Eliminar gasto');
}

document.addEventListener('DOMContentLoaded', initGastos);

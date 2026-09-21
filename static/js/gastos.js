let misGastos = JSON.parse(localStorage.getItem('mis_gastos')) || [];

function initGastos() {
    renderGastos();
}

function saveGastos() {
    localStorage.setItem('mis_gastos', JSON.stringify(misGastos));
}

function renderGastos() {
    const list = document.getElementById('gastos-list');
    const totalEl = document.getElementById('gastos-total');
    const monthEl = document.getElementById('gastos-mes');
    const averageEl = document.getElementById('gastos-promedio');
    const countEl = document.getElementById('gastos-cantidad');
    const latestEl = document.getElementById('gastos-ultimo');
    const listCountEl = document.getElementById('gastos-list-count');
    if (!list || !totalEl) return;

    if (misGastos.length === 0) {
        list.innerHTML = `<div class="gastos-empty"><strong>Aún no hay movimientos</strong><span>Agrega tu primer gasto para comenzar a ver tu resumen.</span></div>`;
        totalEl.innerText = '0';
        if (monthEl) monthEl.innerText = '$0';
        if (averageEl) averageEl.innerText = '$0';
        if (countEl) countEl.innerText = '0';
        if (latestEl) latestEl.innerText = '—';
        if (listCountEl) listCountEl.innerText = '0 registros';
        return;
    }

    const sorted = [...misGastos].sort((a, b) => b.timestamp - a.timestamp);
    const total = misGastos.reduce((sum, g) => sum + Number(g.monto || 0), 0);
    const now = new Date();
    const monthTotal = misGastos
        .filter(g => {
            const date = new Date(g.timestamp);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        })
        .reduce((sum, g) => sum + Number(g.monto || 0), 0);
    const formatMoney = value => `$${Number(value).toLocaleString('es-CL')}`;
    const formatDate = timestamp => new Date(timestamp).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

    totalEl.innerText = Number(total).toLocaleString('es-CL');
    if (monthEl) monthEl.innerText = formatMoney(monthTotal);
    if (averageEl) averageEl.innerText = formatMoney(total / misGastos.length);
    if (countEl) countEl.innerText = misGastos.length;
    if (latestEl) latestEl.innerText = new Date(sorted[0].timestamp).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
    if (listCountEl) listCountEl.innerText = `${misGastos.length} ${misGastos.length === 1 ? 'registro' : 'registros'}`;
    
    let html = '';
    sorted.forEach(g => {
        html += `
            <div class="gasto-item">
                <div class="gasto-item-main">
                    <span class="gasto-item-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 10h18"></path><path d="M7 15h3"></path></svg>
                    </span>
                    <div class="gasto-item-copy">
                        <strong>${escapeHtml(g.desc)}</strong>
                        <span>${formatDate(g.timestamp)}</span>
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

function agregarGasto() {
    const descInput = document.getElementById('gasto-desc');
    const montoInput = document.getElementById('gasto-monto');
    
    const desc = descInput.value.trim();
    const monto = parseInt(montoInput.value, 10);
    
    if (!desc) {
        mostrarAlertaWeb("Ingresa una descripción para el gasto.", 'Falta la descripción', 'error');
        return;
    }
    if (isNaN(monto) || monto <= 0) {
        mostrarAlertaWeb("Ingresa un monto válido mayor a 0.", 'Monto inválido', 'error');
        return;
    }
    
    misGastos.push({
        id: 'gasto_' + Date.now(),
        desc: desc,
        monto: monto,
        timestamp: Date.now()
    });
    
    descInput.value = '';
    montoInput.value = '';
    
    saveGastos();
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

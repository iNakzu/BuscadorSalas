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
    if (!list || !totalEl) return;

    let total = 0;
    
    if (misGastos.length === 0) {
        list.innerHTML = `<div class="empty-state" style="padding: 20px 0;">No tienes gastos registrados.</div>`;
        totalEl.innerText = '0';
        return;
    }

    let html = '';
    
    // Sort by newest first
    const sorted = [...misGastos].sort((a, b) => b.timestamp - a.timestamp);
    
    sorted.forEach(g => {
        total += g.monto;
        
        const dateObj = new Date(g.timestamp);
        const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        
        html += `
            <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 14px; font-weight: 600; color: #f1f5f9;">${escapeHtml(g.desc)}</span>
                    <span style="font-size: 11px; color: #94a3b8;">${dateStr}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="color: #10b981; font-weight: 700;">$${g.monto.toLocaleString('es-CL')}</span>
                    <button onclick="borrarGasto('${g.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;" title="Eliminar">🗑️</button>
                </div>
            </div>
        `;
    });
    
    list.innerHTML = html;
    totalEl.innerText = total.toLocaleString('es-CL');
}

function agregarGasto() {
    const descInput = document.getElementById('gasto-desc');
    const montoInput = document.getElementById('gasto-monto');
    
    const desc = descInput.value.trim();
    const monto = parseInt(montoInput.value, 10);
    
    if (!desc) {
        alert("Ingresa una descripción para el gasto.");
        return;
    }
    if (isNaN(monto) || monto <= 0) {
        alert("Ingresa un monto válido mayor a 0.");
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
    if(confirm("¿Eliminar este gasto?")) {
        misGastos = misGastos.filter(g => g.id !== id);
        saveGastos();
        renderGastos();
    }
}

document.addEventListener('DOMContentLoaded', initGastos);

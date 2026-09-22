const COMPRAS_STORAGE_KEY = 'lista_compras';
const COMPRA_CATEGORIES = {
    hogar: 'Hogar',
    comida: 'Comida',
    estudio: 'Estudio',
    salud: 'Salud',
    ropa: 'Ropa',
    otro: 'Otro'
};
const COMPRA_PRIORITIES = { alta: 'Alta', normal: 'Normal', baja: 'Baja' };
let compras = JSON.parse(localStorage.getItem(COMPRAS_STORAGE_KEY) || '[]').map(normalizeCompra);

function normalizeCompra(item) {
    return {
        id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: String(item.name || '').trim(),
        quantity: Math.max(1, Number(item.quantity || 1)),
        category: COMPRA_CATEGORIES[item.category] ? item.category : 'otro',
        priority: COMPRA_PRIORITIES[item.priority] ? item.priority : 'normal',
        note: String(item.note || ''),
        createdAt: Number(item.createdAt || Date.now()),
        completedAt: item.completedAt ? Number(item.completedAt) : null,
        done: Boolean(item.done)
    };
}

function initCompras() {
    saveCompras();
    renderCompras();
}

function saveCompras() {
    localStorage.setItem(COMPRAS_STORAGE_KEY, JSON.stringify(compras));
}

function agregarCompra(event) {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    if (!name) return;
    compras.unshift(normalizeCompra({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        quantity: Number(data.get('quantity') || 1),
        category: data.get('category'),
        priority: data.get('priority'),
        note: String(data.get('note') || '').trim(),
        createdAt: Date.now()
    }));
    saveCompras();
    form.reset();
    document.getElementById('compra-cantidad').value = '1';
    renderCompras();
    document.getElementById('compra-nombre').focus();
}

function renderCompras() {
    const list = document.getElementById('compras-list');
    if (!list) return;
    const searchElement = document.getElementById('compras-search');
    const statusElement = document.getElementById('compras-status');
    const sortElement = document.getElementById('compras-sort');
    const query = (searchElement ? searchElement.value : '').trim().toLowerCase();
    const status = statusElement ? statusElement.value : 'pending';
    const sort = sortElement ? sortElement.value : 'recent';
    const visible = compras.filter(item => {
        const matchesQuery = !query || `${item.name} ${item.note} ${COMPRA_CATEGORIES[item.category]}`.toLowerCase().includes(query);
        const matchesStatus = status === 'all' || (status === 'done' ? item.done : !item.done);
        return matchesQuery && matchesStatus;
    }).sort((a, b) => {
        if (sort === 'oldest') return a.createdAt - b.createdAt;
        if (sort === 'priority') return ({ alta: 0, normal: 1, baja: 2 }[a.priority] - { alta: 0, normal: 1, baja: 2 }[b.priority]) || b.createdAt - a.createdAt;
        return b.createdAt - a.createdAt;
    });

    const pending = compras.filter(item => !item.done).length;
    const completed = compras.filter(item => item.done).length;
    const progress = compras.length ? Math.round((completed / compras.length) * 100) : 0;
    document.getElementById('compras-count').textContent = `${pending} ${pending === 1 ? 'pendiente' : 'pendientes'}`;
    document.getElementById('compras-progress-value').textContent = `${progress}%`;
    document.getElementById('compras-progress-bar').style.width = `${progress}%`;
    document.getElementById('compras-summary').innerHTML = `<span>${pending} pendientes</span><span>${completed} comprados</span><span>${compras.length} total</span>`;

    if (!visible.length) {
        list.innerHTML = `<div class="compras-empty"><strong>${compras.length ? 'No hay coincidencias' : 'Tu lista está vacía'}</strong><span>${compras.length ? 'Prueba con otro filtro o búsqueda.' : 'Agrega algo que necesites comprar y aparecerá aquí.'}</span></div>`;
        return;
    }
    list.innerHTML = visible.map(compra => {
        const age = formatCompraAge(compra.createdAt);
        return `
            <article class="compra-item ${compra.done ? 'is-done' : ''}">
                <button class="compra-check" onclick="alternarCompra('${compra.id}')" aria-label="${compra.done ? 'Marcar pendiente' : 'Marcar comprado'}">${compra.done ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}</button>
                <div class="compra-main">
                    <div class="compra-heading"><strong>${escapeCompra(compra.name)}</strong><span class="compra-quantity">×${compra.quantity}</span></div>
                    <div class="compra-meta"><span>${COMPRA_CATEGORIES[compra.category]}</span><span class="compra-priority ${compra.priority}">${COMPRA_PRIORITIES[compra.priority]}</span><span>Esperando ${age}</span></div>
                    ${compra.note ? `<div class="compra-note">${escapeCompra(compra.note)}</div>` : ''}
                </div>
                <div class="compra-actions">
                    <button onclick="editarCompra('${compra.id}')" title="Editar" aria-label="Editar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg></button>
                    <button onclick="eliminarCompra('${compra.id}')" title="Eliminar" aria-label="Eliminar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 13h10l1-13"></path></svg></button>
                </div>
            </article>`;
    }).join('');
}

function formatCompraAge(timestamp) {
    const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
    if (days === 0) return 'desde hoy';
    if (days === 1) return 'desde ayer';
    return `desde hace ${days} días`;
}

function alternarCompra(id) {
    const item = compras.find(compra => compra.id === id);
    if (!item) return;
    item.done = !item.done;
    item.completedAt = item.done ? Date.now() : null;
    saveCompras();
    renderCompras();
}

function editarCompra(id) {
    const item = compras.find(compra => compra.id === id);
    if (!item) return;
    const name = prompt('Nombre del elemento:', item.name);
    if (name === null || !name.trim()) return;
    item.name = name.trim();
    saveCompras();
    renderCompras();
}

function eliminarCompra(id) {
    compras = compras.filter(item => item.id !== id);
    saveCompras();
    renderCompras();
}

function limpiarComprasCompletadas() {
    compras = compras.filter(item => !item.done);
    saveCompras();
    renderCompras();
}

function escapeCompra(value) {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

document.addEventListener('DOMContentLoaded', initCompras);

// Lógica para la pestaña de Agenda de Evaluaciones

let AGENDA_DATA = [];

// Iconos por tipo
const ICONS = {
    'Solemne': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>',
    'Control': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
    'Trabajo': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
    'Presentacion': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>'
};

function initAgenda() {
    if (typeof localStorage !== 'undefined') {
        try {
            const stored = localStorage.getItem('mi_agenda_v1');
            if (stored) {
                AGENDA_DATA = JSON.parse(stored);
                if (!Array.isArray(AGENDA_DATA)) AGENDA_DATA = [];
            }
        } catch (e) {
            console.error("Error cargando agenda", e);
            AGENDA_DATA = [];
        }
    }
    renderAgenda();
}

function saveAgenda() {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mi_agenda_v1', JSON.stringify(AGENDA_DATA));
    }
}

function abrirModalAgenda(id = null) {
    const modal = document.getElementById('modal-agenda');
    const select = document.getElementById('agenda-ramo');
    
    // Poblar ramos desde el horario (MI_HORARIO_DATA defaults to Nakzu)
    let scheduleObj = null;
    if (typeof MI_HORARIO_DATA !== 'undefined') {
        scheduleObj = MI_HORARIO_DATA;
    } else if (typeof HORARIOS_GUARDADOS !== 'undefined' && HORARIOS_GUARDADOS['nakzu']) {
        scheduleObj = HORARIOS_GUARDADOS['nakzu'];
    }
    
    let ramos = [];
    if (scheduleObj && scheduleObj.clases) {
        const valid = scheduleObj.clases.filter(c => c.rol !== 'assistant');
        // normStr es de main.js o notas.js, asumiendo que es accesible. Si no, normalizamos básico
        ramos = [...new Set(valid.map(c => c.curso))].filter(Boolean).sort();
    }
    
    let htmlMenu = `<div class="dropdown-item active" data-val="" onclick="selectDropdownItem('dd-agenda-ramo', '', 'Selecciona un Ramo...')">Selecciona un Ramo...</div>`;
    ramos.forEach(r => {
        htmlMenu += `<div class="dropdown-item" data-val="${r}" onclick="selectDropdownItem('dd-agenda-ramo', '${r.replace(/'/g, "\'")}', '${r.replace(/'/g, "\'")}')">${r}</div>`;
    });
    htmlMenu += `<div class="dropdown-item" data-val="Otro" onclick="selectDropdownItem('dd-agenda-ramo', 'Otro', 'Otro...')">Otro...</div>`;
    
    const menuEl = document.querySelector('#dd-agenda-ramo .dropdown-menu');
    if (menuEl) menuEl.innerHTML = htmlMenu;
    
    const labelEl = document.getElementById('label-agenda-ramo');
    if (labelEl) labelEl.textContent = 'Selecciona un Ramo...';
    select.value = '';
    
    // Para agenda-tipo, reiniciarlo
    const tipoLabel = document.getElementById('label-agenda-tipo');
    if (tipoLabel) tipoLabel.textContent = 'Solemne / Prueba';
    document.getElementById('agenda-tipo').value = 'Solemne';

    if (id) {
        const ev = AGENDA_DATA.find(e => e.id === id);
        if (ev) {
            document.getElementById('agenda-id').value = ev.id;
            
            // Si el ramo no está en la lista, agregarlo temporalmente al menú
            if (ev.ramo && !ramos.includes(ev.ramo) && ev.ramo !== 'Otro') {
                htmlMenu += `<div class="dropdown-item" data-val="${ev.ramo}" onclick="selectDropdownItem('dd-agenda-ramo', '${ev.ramo.replace(/'/g, "\'")}', '${ev.ramo.replace(/'/g, "\'")}')">${ev.ramo}</div>`;
                if (menuEl) menuEl.innerHTML = htmlMenu;
            }
            
            selectDropdownItem('dd-agenda-ramo', ev.ramo, ev.ramo);
            
            const tipoMap = {
                'Solemne': 'Solemne / Prueba',
                'Control': 'Control / Quiz',
                'Trabajo': 'Entrega de Trabajo / Informe',
                'Presentacion': 'Presentación / Disertación'
            };
            selectDropdownItem('dd-agenda-tipo', ev.tipo, tipoMap[ev.tipo] || ev.tipo);
            
            if (agendaDatePicker) {
                agendaDatePicker.setDate(ev.fecha);
            } else {
                document.getElementById('agenda-fecha').value = ev.fecha;
            }
            document.getElementById('agenda-notas').value = ev.notas || '';
            document.getElementById('agenda-modal-title').textContent = 'Editar Evaluación';
        }
    } else {
        document.getElementById('form-agenda').reset();
        if (agendaDatePicker) {
            agendaDatePicker.clear();
        }
        document.getElementById('agenda-id').value = '';
        document.getElementById('agenda-modal-title').textContent = 'Añadir Evaluación';
        selectDropdownItem('dd-agenda-ramo', '', 'Selecciona un Ramo...');
        selectDropdownItem('dd-agenda-tipo', 'Solemne', 'Solemne / Prueba');
    }
    
    modal.style.display = 'flex';
}

function cerrarModalAgenda() {
    document.getElementById('modal-agenda').style.display = 'none';
}

function guardarEventoAgenda(e) {
    e.preventDefault();
    const id = document.getElementById('agenda-id').value;
    const ramo = document.getElementById('agenda-ramo').value;
    const tipo = document.getElementById('agenda-tipo').value;
    const fecha = document.getElementById('agenda-fecha').value;
    const notas = document.getElementById('agenda-notas').value;
    
    if (id) {
        const ev = AGENDA_DATA.find(x => x.id === id);
        if (ev) {
            ev.ramo = ramo;
            ev.tipo = tipo;
            ev.fecha = fecha;
            ev.notas = notas;
        }
    } else {
        AGENDA_DATA.push({
            id: 'ag-' + Date.now(),
            ramo: ramo,
            tipo: tipo,
            fecha: fecha,
            notas: notas,
            completado: false
        });
    }
    
    saveAgenda();
    cerrarModalAgenda();
    renderAgenda();
}

function toggleCompletado(id) {
    const ev = AGENDA_DATA.find(x => x.id === id);
    if (ev) {
        ev.completado = !ev.completado;
        saveAgenda();
        renderAgenda();
    }
}

function eliminarEventoAgenda(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este evento?')) {
        AGENDA_DATA = AGENDA_DATA.filter(x => x.id !== id);
        saveAgenda();
        renderAgenda();
    }
}

function formatearFecha(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleString('es-CL', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function renderAgenda() {
    const container = document.getElementById('agenda-container');
    if (!container) return;
    
    if (AGENDA_DATA.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #64748b;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.5;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <div style="font-size: 16px; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">No tienes evaluaciones próximas</div>
                <div style="font-size: 14px;">¡Disfruta tu tiempo libre! Añade un evento arriba cuando lo necesites.</div>
            </div>
        `;
        return;
    }
    
    // Sort: Pendientes primero (fechas cercanas), luego completados
    let list = [...AGENDA_DATA].sort((a, b) => {
        if (a.completado !== b.completado) return a.completado ? 1 : -1;
        return new Date(a.fecha) - new Date(b.fecha);
    });
    
    const now = new Date();
    
    let html = '';
    list.forEach(ev => {
        const evDate = new Date(ev.fecha);
        const diffTime = evDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let statusClass = 'status-safe';
        let statusText = '';
        
        if (ev.completado) {
            statusText = 'COMPLETADO';
            statusClass = '';
        } else {
            if (diffTime < 0) {
                statusClass = 'status-overdue';
                statusText = `ATRASADO (${Math.abs(diffDays)} DÍAS)`;
            } else if (diffDays === 0) {
                statusClass = 'status-urgent';
                statusText = '¡HOY!';
            } else if (diffDays === 1) {
                statusClass = 'status-urgent';
                statusText = 'MAÑANA';
            } else if (diffDays <= 3) {
                statusClass = 'status-urgent';
                statusText = `EN ${diffDays} DÍAS`;
            } else if (diffDays <= 7) {
                statusClass = 'status-warning';
                statusText = `EN ${diffDays} DÍAS`;
            } else {
                statusClass = 'status-safe';
                statusText = `EN ${diffDays} DÍAS`;
            }
        }
        
        html += `
            <div class="agenda-card ${ev.completado ? 'is-completed' : ''}">
                <button class="agenda-checkbox-btn" onclick="toggleCompletado('${ev.id}')" title="Marcar como completado">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                
                <div class="agenda-content">
                    <div class="agenda-title">
                        ${ICONS[ev.tipo] || ''}
                        ${ev.ramo} - ${ev.tipo}
                    </div>
                    <div class="agenda-meta">
                        <span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            ${formatearFecha(ev.fecha)}
                        </span>
                        ${ev.notas ? `
                        <span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            ${ev.notas}
                        </span>` : ''}
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    <div class="agenda-status-pill ${statusClass}" style="${ev.completado ? 'background:rgba(255,255,255,0.1); color:#94a3b8; border:1px solid rgba(255,255,255,0.1)' : ''}">
                        ${statusText}
                    </div>
                    <div class="agenda-actions">
                        <button class="agenda-btn-icon" onclick="abrirModalAgenda('${ev.id}')" title="Editar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="agenda-btn-icon delete" onclick="eliminarEventoAgenda('${ev.id}')" title="Eliminar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}


let agendaDatePicker = null;

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    initAgenda();
    initFlatpickr();
});
// Para casos donde ya se cargó la página
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initAgenda();
    setTimeout(initFlatpickr, 100);
}

function initFlatpickr() {
    if (typeof flatpickr !== 'undefined' && !agendaDatePicker) {
        agendaDatePicker = flatpickr("#agenda-fecha", {
            enableTime: true,
            dateFormat: "Y-m-d\TH:i",
            time_24hr: true,
            locale: "es",
            minuteIncrement: 5,
            disableMobile: "true", // Fuerza a usar la UI custom en móviles (desactiva el feo nativo)
            altInput: true,
            altFormat: "j F Y, H:i",
            altInputClass: "my-form-input", // Ej: 15 Octubre 2026, 14:30
        });
    }
}


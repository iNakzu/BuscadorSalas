let AGENDA_DATA = [];
let currentAgendaProfile = 'nakzu';
let currentAgendaSearch = '';

window.triggerAgendaProfileChange = function() {
    currentAgendaProfile = document.getElementById('agenda-friend-select').value;
    renderCalendar();
    renderAgenda();
};

window.triggerAgendaSearch = function() {
    const input = document.getElementById('input-agenda-search');
    const clearBtn = document.getElementById('clear-agenda-btn');
    currentAgendaSearch = input.value.toLowerCase().trim();
    
    if (currentAgendaSearch.length > 0) {
        clearBtn.style.display = 'block';
    } else {
        clearBtn.style.display = 'none';
    }
    
    renderCalendar();
    renderAgenda();
};

window.limpiarAgendaSearch = function() {
    const input = document.getElementById('input-agenda-search');
    input.value = '';
    triggerAgendaSearch();
};

function getFilteredAgenda() {
    return AGENDA_DATA.filter(ev => {
        const evProfile = ev.perfil || 'nakzu';
        if (evProfile !== currentAgendaProfile) return false;
        
        if (currentAgendaSearch) {
            const ramoMatch = (ev.ramo || '').toLowerCase().includes(currentAgendaSearch);
            const tipoMatch = (ev.tipo || '').toLowerCase().includes(currentAgendaSearch);
            const notasMatch = (ev.notas || '').toLowerCase().includes(currentAgendaSearch);
            if (!ramoMatch && !tipoMatch && !notasMatch) return false;
        }
        return true;
    });
}

const AGENDA_STORAGE_KEY = 'mi_agenda_v1';

const ICONS = {
    'Solemne': '<span style="color:#ef4444;">🔴</span>',
    'Control': '<span style="color:#f59e0b;">🟡</span>',
    'Trabajo': '<span style="color:#8b5cf6;">🟣</span>',
    'Presentacion': '<span style="color:#3b82f6;">🔵</span>'
};

let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth(); // 0-11

function initAgenda() {
    try {
        const stored = localStorage.getItem(AGENDA_STORAGE_KEY);
        if (stored) {
            AGENDA_DATA = JSON.parse(stored);
        }
    } catch(e) { console.error(e); }
    
    renderCalendar();
    renderAgenda();
}

function saveAgenda() {
    try {
        localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(AGENDA_DATA));
    } catch(e) { console.error(e); }
}

function renderCalendar() {
    const container = document.getElementById('calendar-days-container');
    const titleEl = document.getElementById('calendar-month-title');
    if (!container || !titleEl) return;
    
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    titleEl.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;
    
    // Calcular días
    const firstDay = new Date(currentCalYear, currentCalMonth, 1);
    const lastDay = new Date(currentCalYear, currentCalMonth + 1, 0);
    
    let startDayOfWeek = firstDay.getDay(); // 0 = Domingo, 1 = Lunes
    if (startDayOfWeek === 0) startDayOfWeek = 7; // Convertir domingo a 7
    
    const prevMonthLastDay = new Date(currentCalYear, currentCalMonth, 0).getDate();
    
    let html = '';
    const today = new Date();
    
    // Días del mes anterior (vacíos o deshabilitados)
    for (let i = 1; i < startDayOfWeek; i++) {
        html += `<div class="cal-day empty"></div>`;
    }
    
    // Días del mes actual
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const dateStr = `${currentCalYear}-${String(currentCalMonth+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        let isToday = (i === today.getDate() && currentCalMonth === today.getMonth() && currentCalYear === today.getFullYear());
        
        // Buscar eventos para este día
        const filteredData = getFilteredAgenda();
        const dayEvents = filteredData.filter(ev => ev.fecha.startsWith(dateStr));
        
        let dotsHtml = '';
        if (dayEvents.length > 0) {
            let desktopDots = '';
            if (dayEvents.length <= 5) {
                desktopDots = dayEvents.map(ev => `<div class="cal-dot ${ev.tipo.toLowerCase()}"></div>`).join('');
            } else {
                desktopDots = `<div class="cal-dot-multi">${dayEvents.length}</div>`;
            }
            
            let mobileDots = '';
            if (dayEvents.length === 1) {
                mobileDots = `<div class="cal-dot ${dayEvents[0].tipo.toLowerCase()}"></div>`;
            } else {
                mobileDots = `<div class="cal-dot-multi">${dayEvents.length}</div>`;
            }
            
            dotsHtml = `<div class="cal-dots-container">
                            <div class="desktop-dots">${desktopDots}</div>
                            <div class="mobile-dots">${mobileDots}</div>
                        </div>`;
        }
        
        html += `
            <div class="cal-day ${isToday ? 'today' : ''}" onclick="abrirModalAgenda(null, '${dateStr}')">
                ${i}
                ${dotsHtml}
            </div>
        `;
    }
    
    // Rellenar final de la grilla (opcional, para mantener altura)
    const totalCells = (startDayOfWeek - 1) + lastDay.getDate();
    const remainingCells = (Math.ceil(totalCells / 7) * 7) - totalCells;
    for (let i = 0; i < remainingCells; i++) {
        html += `<div class="cal-day empty"></div>`;
    }
    
    container.innerHTML = html;
}

function changeCalendarMonth(delta) {
    currentCalMonth += delta;
    if (currentCalMonth < 0) {
        currentCalMonth = 11;
        currentCalYear--;
    } else if (currentCalMonth > 11) {
        currentCalMonth = 0;
        currentCalYear++;
    }
    renderCalendar();
}

function toggleHoraOpcional(forzarEstado = null) {
    const inputHasTime = document.getElementById('agenda-has-time');
    const checkboxIcon = document.getElementById('hora-check-icon');
    const checkboxBox = document.getElementById('hora-checkbox');
    const grupoHora = document.getElementById('grupo-hora');
    
    let isChecked = inputHasTime.value === 'true';
    if (forzarEstado !== null) {
        isChecked = !forzarEstado;
    }
    
    if (isChecked) {
        inputHasTime.value = 'false';
        checkboxIcon.style.display = 'none';
        checkboxBox.style.background = 'rgba(15, 23, 42, 0.5)';
        checkboxBox.style.borderColor = 'rgba(56, 189, 248, 0.5)';
        grupoHora.style.display = 'none';
        document.getElementById('agenda-hora').removeAttribute('required');
    } else {
        inputHasTime.value = 'true';
        checkboxIcon.style.display = 'block';
        checkboxBox.style.background = 'rgba(56, 189, 248, 0.15)';
        checkboxBox.style.borderColor = '#38bdf8';
        grupoHora.style.display = 'block';
        document.getElementById('agenda-hora').setAttribute('required', 'true');
    }
}

function formatearTituloFecha(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const d = new Date(year, parseInt(month)-1, day);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${parseInt(day)} de ${monthNames[parseInt(month)-1]} de ${year}`;
}

function abrirModalAgenda(id = null, clickedDate = null) {
    const modal = document.getElementById('modal-agenda');
    const select = document.getElementById('agenda-ramo');
    
    let scheduleObj = typeof MI_HORARIO_DATA !== 'undefined' ? MI_HORARIO_DATA : null;
    let myRamos = [];
    if (scheduleObj && scheduleObj.clases) {
        const validClasses = scheduleObj.clases.filter(c => c.rol !== 'assistant');
        myRamos = [...new Set(validClasses.map(c => c.curso))].filter(Boolean).sort();
    }
    
    let htmlMenu = `<div class="dropdown-item active" data-val="" onclick="selectDropdownItem('dd-agenda-ramo', '', 'Selecciona un Ramo...')">Selecciona un Ramo...</div>`;
    myRamos.forEach(r => {
        htmlMenu += `<div class="dropdown-item" data-val="${r}" onclick="selectDropdownItem('dd-agenda-ramo', '${r.replace(/'/g, "\'")}', '${r.replace(/'/g, "\'")}')">${r}</div>`;
    });
    htmlMenu += `<div class="dropdown-item" data-val="Otro" onclick="selectDropdownItem('dd-agenda-ramo', 'Otro', 'Otro...')">Otro...</div>`;
    
    const menuEl = document.querySelector('#dd-agenda-ramo .dropdown-menu');
    if (menuEl) menuEl.innerHTML = htmlMenu;
    
    if (id) {
        const ev = AGENDA_DATA.find(e => e.id === id);
        if (ev) {
            document.getElementById('agenda-id').value = ev.id;
            
            if (ev.ramo && !myRamos.includes(ev.ramo) && ev.ramo !== 'Otro') {
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
            
            const [datePart, timePart] = ev.fecha.split('T');
            document.getElementById('agenda-fecha-base').value = datePart;
            document.getElementById('agenda-modal-subtitle').textContent = formatearTituloFecha(datePart);
            
            if (ev.hasTime && timePart) {
                toggleHoraOpcional(true);
                document.getElementById('agenda-hora').value = timePart.substring(0, 5);
            } else {
                toggleHoraOpcional(false);
                document.getElementById('agenda-hora').value = '';
            }
            
            document.getElementById('agenda-notas').value = ev.notas || '';
            document.getElementById('agenda-modal-title').textContent = 'Editar Evaluación';
        }
    } else {
        document.getElementById('form-agenda').reset();
        document.getElementById('agenda-id').value = '';
        document.getElementById('agenda-modal-title').textContent = 'Añadir Evaluación';
        
        let targetDate = clickedDate;
        if (!targetDate) {
            const now = new Date();
            targetDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }
        document.getElementById('agenda-fecha-base').value = targetDate;
        document.getElementById('agenda-modal-subtitle').textContent = formatearTituloFecha(targetDate);
        
        selectDropdownItem('dd-agenda-ramo', '', 'Selecciona un Ramo...');
        selectDropdownItem('dd-agenda-tipo', 'Solemne', 'Solemne / Prueba');
        toggleHoraOpcional(false);
    }
    
    if (modal) modal.style.display = 'flex';
}

function cerrarModalAgenda() {
    const modal = document.getElementById('modal-agenda');
    if (modal) modal.style.display = 'none';
}

function guardarEventoAgenda(e) {
    e.preventDefault();
    const id = document.getElementById('agenda-id').value;
    const ramo = document.getElementById('agenda-ramo').value;
    const tipo = document.getElementById('agenda-tipo').value;
    const fechaBase = document.getElementById('agenda-fecha-base').value;
    const hasTime = document.getElementById('agenda-has-time').value === 'true';
    const hora = document.getElementById('agenda-hora').value;
    const notas = document.getElementById('agenda-notas').value;
    
    let fechaFinal = fechaBase;
    if (hasTime && hora) {
        fechaFinal += `T${hora}:00`;
    } else {
        fechaFinal += `T23:59:59`; // Final del día por defecto si no hay hora
    }
    
    if (id) {
        const ev = AGENDA_DATA.find(x => x.id === id);
        if (ev) {
            ev.ramo = ramo;
            ev.tipo = tipo;
            ev.fecha = fechaFinal;
            ev.hasTime = hasTime;
            ev.notas = notas;
        }
    } else {
        AGENDA_DATA.push({
            id: 'ag-' + Date.now(),
            perfil: currentAgendaProfile,
            ramo: ramo,
            tipo: tipo,
            fecha: fechaFinal,
            hasTime: hasTime,
            notas: notas,
            completado: false
        });
    }
    
    saveAgenda();
    cerrarModalAgenda();
    renderAgenda();
    renderCalendar(); // Refrescar los puntitos
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
        renderCalendar();
    }
}

function formatearFecha(isoStr, hasTime) {
    const [datePart, timePart] = isoStr.split('T');
    const [year, month, day] = datePart.split('-');
    const d = new Date(year, parseInt(month)-1, day);
    
    const dateFormatted = d.toLocaleString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' });
    if (hasTime && timePart) {
        const t = timePart.substring(0, 5);
        return `${dateFormatted}, ${t}`;
    }
    return dateFormatted;
}

function renderAgenda() {
    const container = document.getElementById('agenda-container');
    if (!container) return;
    
    if (getFilteredAgenda().length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #64748b;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.5;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <div style="font-size: 16px; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">No tienes evaluaciones próximas</div>
                <div style="font-size: 14px;">Toca un día en el calendario de arriba para añadir un evento.</div>
            </div>
        `;
        return;
    }
    
    let list = getFilteredAgenda().sort((a, b) => {
        if (a.completado !== b.completado) return a.completado ? 1 : -1;
        return new Date(a.fecha) - new Date(b.fecha);
    });
    
    const now = new Date();
    
    let html = '';
    list.forEach(ev => {
        const evDate = new Date(ev.fecha);
        const diffTime = evDate - now;
        
        const todayAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const evDateAtMidnight = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
        const diffCalendarDays = Math.round((evDateAtMidnight - todayAtMidnight) / (1000 * 60 * 60 * 24));
        
        let statusClass = 'status-safe';
        let statusText = '';
        
        if (ev.completado) {
            statusText = 'LISTO';
            statusClass = '';
        } else {
            if (diffTime < 0) {
                statusClass = 'status-overdue';
                statusText = `ATRASADO`;
            } else if (diffCalendarDays === 0) {
                statusClass = 'status-today';
                statusText = '¡HOY!';
            } else if (diffCalendarDays === 1) {
                statusClass = 'status-urgent';
                statusText = 'MAÑANA';
            } else if (diffCalendarDays <= 3) {
                statusClass = 'status-urgent';
                statusText = `EN ${diffCalendarDays} DÍAS`;
            } else if (diffCalendarDays <= 7) {
                statusClass = 'status-warning';
                statusText = `EN ${diffCalendarDays} DÍAS`;
            } else {
                statusClass = 'status-safe';
                statusText = `EN ${diffCalendarDays} DÍAS`;
            }
        }
        
        let iconHtml = '';
        if (ev.tipo === 'Solemne') iconHtml = '<div class="cal-dot solemne"></div>';
        if (ev.tipo === 'Control') iconHtml = '<div class="cal-dot control"></div>';
        if (ev.tipo === 'Trabajo') iconHtml = '<div class="cal-dot trabajo"></div>';
        if (ev.tipo === 'Presentacion') iconHtml = '<div class="cal-dot presentacion"></div>';
        
        html += `
            <div class="agenda-card ${ev.completado ? 'is-completed' : ''}">
                <div class="agenda-check-wrapper" style="display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 2px;">
                    <button class="agenda-checkbox-btn" onclick="toggleCompletado('${ev.id}')" title="Marcar como completado" style="margin: 0;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </button>
                    <div class="mobile-agenda-dot">${iconHtml}</div>
                </div>
                
                <div class="agenda-content">
                    <div class="agenda-title" style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                        
                        <div style="display: flex; flex-direction: column; min-width: 0; width: 100%;">
                            <div style="font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f8fafc;">${ev.ramo}</div>
                            <div style="font-size: 13px; color: #94a3b8; font-weight: 500; margin-top: 2px;">${ev.tipo}</div>
                        </div>
                    </div>
                    <div class="agenda-meta">
                        <span class="desktop-agenda-date" style="white-space: nowrap;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            ${formatearFecha(ev.fecha, ev.hasTime)}
                        </span>
                        ${ev.notas ? `
                        <span style="width: 100%; min-width: 0; display: flex; align-items: center; overflow: hidden;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; margin-right: 4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            <span style="display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1; max-width: 100%;">${ev.notas}</span>
                        </span>` : ''}
                    </div>
                </div>
                
                <div class="agenda-card-right" style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    <div class="agenda-status-pill ${statusClass}" style="white-space: nowrap; ${ev.completado ? 'background:rgba(255,255,255,0.1); color:#94a3b8; border:1px solid rgba(255,255,255,0.1)' : ''}">
                        ${statusText}
                    </div>
                    <span class="mobile-agenda-date" style="display: none; color: #94a3b8; font-size: 13px; align-items: center; gap: 4px; white-space: nowrap;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        ${formatearFecha(ev.fecha, ev.hasTime)}
                    </span>
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

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    initAgenda();
});
// Para casos donde ya se cargó la página
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initAgenda();
}

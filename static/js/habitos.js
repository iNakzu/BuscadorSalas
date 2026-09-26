// ==========================================================================
// HABIT TRACKER - DAILY HABITS & STREAKS (LOCALSTORAGE ENGINE)
// ==========================================================================

let habitosData = [];
let activeHabitoFilter = 'all';

const DEFAULT_HABITOS = [
    {
        id: 'hab_1',
        title: 'Estudiar',
        created_at: new Date().toISOString(),
        history: {}
    },
    {
        id: 'hab_2',
        title: 'Lavarme los dientes (mañana y noche)',
        created_at: new Date().toISOString(),
        history: {}
    },
    {
        id: 'hab_3',
        title: 'Practicar guitarra eléctrica',
        created_at: new Date().toISOString(),
        history: {}
    },
];

function getHoyDateStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function initHabitos() {
    try {
        const stored = localStorage.getItem('mis_habitos');
        if (stored) {
            habitosData = JSON.parse(stored);
            const habitosAntes = habitosData.length;
            habitosData = habitosData.filter(habito => (
                habito.id !== 'hab_4' &&
                habito.id !== 'hab_5' &&
                !/polaco|gatos/i.test(habito.title || '')
            ));
            let nombresActualizados = false;
            habitosData.forEach(habito => {
                if (habito.id === 'hab_1' && habito.title !== 'Estudiar') {
                    habito.title = 'Estudiar';
                    nombresActualizados = true;
                }
                if (habito.id === 'hab_3' && habito.title !== 'Practicar guitarra eléctrica') {
                    habito.title = 'Practicar guitarra eléctrica';
                    nombresActualizados = true;
                }
            });
            if (habitosData.length !== habitosAntes || nombresActualizados) saveHabitos();
        } else {
            habitosData = DEFAULT_HABITOS;
            saveHabitos();
        }
    } catch(e) {
        habitosData = DEFAULT_HABITOS;
    }
    renderHabitos();
}

function saveHabitos() {
    localStorage.setItem('mis_habitos', JSON.stringify(habitosData));
}

function calcularRacha(history) {
    let racha = 0;
    const d = new Date();
    const hoyStr = getHoyDateStr();

    // Check if completed today or yesterday
    let curr = new Date(d);
    if (!history[hoyStr]) {
        curr.setDate(curr.getDate() - 1);
    }

    while (true) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const day = String(curr.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${day}`;
        if (history[key]) {
            racha++;
            curr.setDate(curr.getDate() - 1);
        } else {
            break;
        }
    }
    return racha;
}

function renderHabitos() {
    const listEl = document.getElementById('habitos-list');
    const totalEl = document.getElementById('habitos-metric-total');
    const hoyEl = document.getElementById('habitos-metric-hoy');
    const pctEl = document.getElementById('habitos-metric-pct');
    const rachaEl = document.getElementById('habitos-metric-racha');
    const progressPctEl = document.getElementById('habitos-progress-pct');
    const progressBarEl = document.getElementById('habitos-progress-bar');
    const progressCopyEl = document.getElementById('habitos-progress-copy');
    if (!listEl) return;

    const hoyStr = getHoyDateStr();
    let completadosHoy = 0;
    let maxRacha = 0;

    habitosData.forEach(h => {
        if (!h.history) h.history = {};
        if (h.history[hoyStr]) completadosHoy++;
        const r = calcularRacha(h.history);
        if (r > maxRacha) maxRacha = r;
    });

    const total = habitosData.length;
    const pct = total > 0 ? Math.round((completadosHoy / total) * 100) : 0;

    if (totalEl) totalEl.innerText = total;
    if (hoyEl) hoyEl.innerText = `${completadosHoy}/${total}`;
    if (pctEl) pctEl.innerText = `${pct}%`;
    if (rachaEl) rachaEl.innerText = `${maxRacha} d`;
    if (progressPctEl) progressPctEl.innerText = `${pct}%`;
    if (progressBarEl) progressBarEl.style.width = `${pct}%`;
    if (progressCopyEl) {
        progressCopyEl.innerText = total === 0 ? 'Agrega tu primera rutina' : pct === 100 ? 'Día completado' : `${total - completadosHoy} por completar`;
    }

    const past7Days = [];
    const dayNames = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    for (let i = 6; i >= 0; i--) {
        const dt = new Date();
        dt.setDate(dt.getDate() - i);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        past7Days.push({
            key: `${y}-${m}-${day}`,
            letter: dayNames[dt.getDay()],
            date: `${day}/${m}`,
            isToday: i === 0
        });
    }

    if (habitosData.length === 0) {
        listEl.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                <div style="font-size: 15px; font-weight: 600; color: #94a3b8; margin-bottom: 6px;">No tienes hábitos registrados</div>
                <div style="font-size: 13px;">Agrega tus hábitos diarios arriba para empezar a construir tu racha.</div>
            </div>
        `;
        return;
    }

    let html = '';
    const visibleHabitos = habitosData.filter(h => {
        const done = !!(h.history && h.history[hoyStr]);
        return activeHabitoFilter === 'all' || (activeHabitoFilter === 'done' ? done : !done);
    });

    if (visibleHabitos.length === 0) {
        listEl.innerHTML = `
            <div class="habit-empty-state">
                <strong>${habitosData.length ? 'No hay hábitos en este filtro' : 'No tienes hábitos registrados'}</strong>
                <span>${habitosData.length ? 'Cambia el filtro para ver tus otras rutinas.' : 'Agrega un hábito arriba para empezar a construir tu racha.'}</span>
            </div>
        `;
        return;
    }

    visibleHabitos.forEach(h => {
        const isDoneHoy = !!(h.history && h.history[hoyStr]);
        const racha = calcularRacha(h.history || {});
        const weeklyDone = past7Days.filter(d => h.history && h.history[d.key]).length;
        html += `
            <div class="habit-item-card ${isDoneHoy ? 'completed' : ''}" id="habit-card-${h.id}">
                <button class="habit-check-btn" onclick="toggleHabitoHoy('${h.id}')" title="${isDoneHoy ? 'Marcar como pendiente' : 'Marcar como completado'}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </button>

                <div class="habit-info">
                    <div class="habit-title-row">
                        <div class="habit-title-block">
                            <span class="habit-title">${escapeHtmlHabitos(h.title)}</span>
                        </div>
                        <div class="habit-card-metrics">
                            <span class="habit-week-badge" title="Completado ${weeklyDone} de 7 días esta semana">
                                <span class="habit-metric-label">Semana</span>${weeklyDone}/7
                            </span>
                            <span class="habit-streak-badge" title="Racha consecutiva">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3c2.5 3 5 5.4 5 9a5 5 0 1 1-10 0c0-1.6.7-3.1 2-4.5"></path><path d="M12 11c.9 1 1.5 2 1.5 3.2a1.5 1.5 0 0 1-3 0c0-.8.4-1.6 1.5-3.2Z"></path></svg>
                                ${racha}d
                            </span>
                        </div>
                    </div>

                    <div class="habit-days-row" aria-label="Historial de los últimos siete días">
                        ${past7Days.map(d => {
                            const isDone = !!(h.history && h.history[d.key]);
                            return `
                                <div class="habit-day-cell ${isDone ? 'done' : ''} ${d.isToday ? 'today' : ''}" title="${d.key}: ${isDone ? 'Completado' : 'Pendiente'}">
                                    <span>${d.letter}</span><i class="habit-day-dot"></i>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 4px;">
                    <button class="habit-action-btn" onclick="eliminarHabito('${h.id}')" title="Eliminar hábito">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

function filtrarHabitos(filter, button) {
    activeHabitoFilter = filter;
    document.querySelectorAll('[data-habit-filter]').forEach(el => el.classList.toggle('active', el === button));
    renderHabitos();
}

function toggleHabitoHoy(id) {
    const h = habitosData.find(item => item.id === id);
    if (!h) return;
    if (!h.history) h.history = {};

    const hoyStr = getHoyDateStr();
    if (h.history[hoyStr]) {
        delete h.history[hoyStr];
    } else {
        h.history[hoyStr] = true;
    }
    saveHabitos();
    renderHabitos();
}

function renderHabitoDropdownItem(dropdownId, value, label, inputId, labelId) {
    const escapedValue = value.replace(/'/g, "\\'");
    const escapedLabel = label.replace(/'/g, "\\'");
    return `
        <div class="dropdown-item ${value === 'Diario' ? 'active' : ''}" data-val="${escapeHtmlHabitos(value)}"
             onclick="selectHabitoFrequency('${dropdownId}', '${escapedValue}', '${escapedLabel}', '${inputId}', '${labelId}')">
            ${escapeHtmlHabitos(label)}
            <span class="habit-dropdown-check">✓</span>
        </div>
    `;
}

function selectHabitoFrequency(dropdownId, value, label, inputId, labelId) {
    const dropdown = document.getElementById(dropdownId);
    const input = document.getElementById(inputId);
    const labelElement = document.getElementById(labelId);

    if (dropdown) dropdown.classList.remove('open');
    if (input) input.value = value;
    if (labelElement) labelElement.textContent = label;

    document.querySelectorAll(`#${dropdownId} .dropdown-item`).forEach(item => {
        item.classList.toggle('active', item.dataset.val === value);
    });
}

function agregarHabitoModal() {
    let modal = document.getElementById('habito-form-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'habito-form-modal';
        modal.className = 'riff-web-modal';
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.innerHTML = `
        <form class="riff-modal-card habit-modal-card" onsubmit="guardarHabitoDesdeModal(event)">
            <div class="riff-modal-header"><div><span class="section-kicker">Ritmo personal</span><h2>Crear nuevo hábito</h2><p class="habit-modal-subtitle">Diseña una rutina clara, pequeña y fácil de mantener.</p></div><button type="button" class="riff-modal-close" onclick="cerrarHabitoModal()">×</button></div>
            <label>Nombre del hábito<input name="title" required maxlength="80" placeholder="Ej. Leer 20 minutos antes de dormir" autocomplete="off"></label>
            <div class="riff-form-grid">
                <label>Frecuencia
                    <input type="hidden" name="frequency" id="habito-frequency-value" value="Diario">
                    <div class="custom-dropdown habit-custom-dropdown" id="habito-frequency-dropdown">
                        <button type="button" class="dropdown-trigger" onclick="toggleDropdown('habito-frequency-dropdown')">
                            <span id="habito-frequency-label">Todos los días</span>
                            <svg class="dropdown-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <div class="dropdown-menu">
                            ${renderHabitoDropdownItem('habito-frequency-dropdown', 'Diario', 'Todos los días', 'habito-frequency-value', 'habito-frequency-label')}
                            ${renderHabitoDropdownItem('habito-frequency-dropdown', 'Lunes a viernes', 'Lunes a viernes', 'habito-frequency-value', 'habito-frequency-label')}
                            ${renderHabitoDropdownItem('habito-frequency-dropdown', 'Flexible', 'Flexible', 'habito-frequency-value', 'habito-frequency-label')}
                        </div>
                    </div>
                </label>
            </div>
            <label>Intención <span class="habit-label-hint">Opcional</span><textarea name="description" rows="3" maxlength="180" placeholder="¿Qué quieres conseguir con esta rutina?"></textarea></label>
            <div class="habit-modal-tip"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path></svg><span>Empieza con una acción concreta. La constancia importa más que hacerlo perfecto.</span></div>
            <div class="riff-modal-actions"><button type="button" class="riff-modal-secondary" onclick="cerrarHabitoModal()">Cancelar</button><button class="riff-modal-primary" type="submit">Guardar hábito</button></div>
        </form>`;
    modal.querySelector('input[name="title"]').focus();
}

function eliminarHabito(id) {
    habitosData = habitosData.filter(h => h.id !== id);
    saveHabitos();
    renderHabitos();
}

function resetHabitosHoy() {
    confirmarWeb("¿Deseas reiniciar los estados de todos los hábitos marcados para hoy?", () => {
        const hoyStr = getHoyDateStr();
        habitosData.forEach(h => {
            if (h.history && h.history[hoyStr]) {
                delete h.history[hoyStr];
            }
        });
        saveHabitos();
        renderHabitos();
    }, 'Reiniciar progreso de hoy');
}

function guardarHabitoDesdeModal(event) {
    event.preventDefault();
    const data = new FormData(event.target);
    const title = data.get('title').trim();
    if (!title) {
        mostrarAlertaWeb('Escribe un nombre para identificar tu rutina.', 'Falta el nombre', 'error');
        return;
    }
    habitosData.unshift({
        id: 'hab_' + Date.now(),
        title,
        frequency: data.get('frequency') || 'Diario',
        description: data.get('description').trim(),
        created_at: new Date().toISOString(),
        history: {}
    });
    saveHabitos();
    cerrarHabitoModal();
    renderHabitos();
}

function cerrarHabitoModal() {
    const modal = document.getElementById('habito-form-modal');
    if (modal) modal.style.display = 'none';
}

function escapeHtmlHabitos(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', () => {
    initHabitos();
});

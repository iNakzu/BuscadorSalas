// ==========================================================================
// HABIT TRACKER - DAILY HABITS & STREAKS (LOCALSTORAGE ENGINE)
// ==========================================================================

let habitosData = [];

const DEFAULT_HABITOS = [
    {
        id: 'hab_1',
        title: 'Estudiar / Repasar ramos UDP',
        category: 'Estudio',
        created_at: new Date().toISOString(),
        history: {}
    },
    {
        id: 'hab_2',
        title: 'Lavarme los dientes (mañana y noche)',
        category: 'Salud',
        created_at: new Date().toISOString(),
        history: {}
    },
    {
        id: 'hab_3',
        title: 'Practicar guitarra eléctrica (Riffs / Metrónomo)',
        category: 'Música',
        created_at: new Date().toISOString(),
        history: {}
    },
    {
        id: 'hab_4',
        title: 'Aprender vocabulario en Polaco',
        category: 'Polonia',
        created_at: new Date().toISOString(),
        history: {}
    },
    {
        id: 'hab_5',
        title: 'Cuidar / mimar a mis gatos',
        category: 'Gatos',
        created_at: new Date().toISOString(),
        history: {}
    }
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

    if (habitosData.length === 0) {
        listEl.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                <div style="font-size: 15px; font-weight: 600; color: #94a3b8; margin-bottom: 6px;">No tienes hábitos registrados</div>
                <div style="font-size: 13px;">Agrega tus hábitos diarios arriba para empezar a construir tu racha.</div>
            </div>
        `;
        return;
    }

    // Past 7 days keys
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
            isToday: i === 0
        });
    }

    let html = '';
    habitosData.forEach(h => {
        const isDoneHoy = !!(h.history && h.history[hoyStr]);
        const racha = calcularRacha(h.history || {});
        const category = h.category || 'General';

        html += `
            <div class="habit-item-card ${isDoneHoy ? 'completed' : ''}" id="habit-card-${h.id}">
                <button class="habit-check-btn" onclick="toggleHabitoHoy('${h.id}')" title="${isDoneHoy ? 'Marcar como pendiente' : 'Marcar como completado'}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </button>

                <div class="habit-info">
                    <div class="habit-title-row">
                        <span class="habit-title">${escapeHtmlHabitos(h.title)}</span>
                        <span class="habit-category-pill">${escapeHtmlHabitos(category)}</span>
                        <span class="habit-streak-badge" title="Racha consecutiva">
                            ✦ ${racha}d
                        </span>
                    </div>

                    <!-- 7-Day History Mini Matrix -->
                    <div class="habit-days-row">
                        ${past7Days.map(d => {
                            const isDone = !!(h.history && h.history[d.key]);
                            return `
                                <div class="habit-day-dot ${isDone ? 'done' : ''}" title="${d.key}: ${isDone ? 'Completado' : 'Pendiente'}" style="${d.isToday ? 'border-color: #38bdf8;' : ''}">
                                    ${d.letter}
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

function agregarHabitoModal() {
    const input = document.getElementById('nuevo-habito-input');
    const catSelect = document.getElementById('nuevo-habito-categoria');
    if (!input) return;

    const title = input.value.trim();
    const category = catSelect ? catSelect.value : 'General';

    if (!title) {
        alert("Por favor ingresa un nombre para el hábito.");
        return;
    }

    const nuevo = {
        id: 'hab_' + Date.now(),
        title: title,
        category: category,
        created_at: new Date().toISOString(),
        history: {}
    };

    habitosData.unshift(nuevo);
    saveHabitos();
    input.value = '';
    renderHabitos();
}

function eliminarHabito(id) {
    if (confirm("¿Estás seguro de que deseas eliminar este hábito?")) {
        habitosData = habitosData.filter(h => h.id !== id);
        saveHabitos();
        renderHabitos();
    }
}

function resetHabitosHoy() {
    if (confirm("¿Deseas reiniciar los estados de todos los hábitos marcados para hoy?")) {
        const hoyStr = getHoyDateStr();
        habitosData.forEach(h => {
            if (h.history && h.history[hoyStr]) {
                delete h.history[hoyStr];
            }
        });
        saveHabitos();
        renderHabitos();
    }
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
    const input = document.getElementById('nuevo-habito-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                agregarHabitoModal();
            }
        });
    }
});

const RAMO_COLORS = {
    "Álgebra y Geometría": "203, 213, 225",
    "Álgebra Lineal": "203, 213, 225",
    "Ecuaciones Diferenciales": "203, 213, 225",
    "Cálculo I": "203, 213, 225",
    "Cálculo II": "203, 213, 225",
    "Cálculo III": "203, 213, 225",
    "Química": "203, 213, 225",
    "Mecánica": "203, 213, 225",
    "Calor y Ondas": "203, 213, 225",
    "Electrónica y Electrotecnia": "203, 213, 225",
    "Electricidad y Magnetismo": "203, 213, 225",
    "Programación": "134, 239, 172",
    "Programación Avanzada": "134, 239, 172",
    "Probabilidades y Estadísticas": "134, 239, 172",
    "Optimización": "134, 239, 172",
    "Contabilidad y Costos": "134, 239, 172",
    "Gestión Organizacional": "134, 239, 172",
    "Introducción a la Economía": "134, 239, 172",
    "Estructura de Datos y Algoritmos": "125, 211, 252",
    "Estructuras de Datos y Algoritmos": "125, 211, 252",
    "Bases de Datos": "125, 211, 252",
    "Bases de Datos Avanzadas": "125, 211, 252",
    "Sistemas Operativos": "125, 211, 252",
    "Ingeniería de Software": "125, 211, 252",
    "Inteligencia Artificial": "125, 211, 252",
    "Arquitectura de Software": "125, 211, 252",
    "Desarrollo Web y Móvil": "125, 211, 252",
    "Proyecto en TICs I": "125, 211, 252",
    "Sistemas Distribuidos": "125, 211, 252",
    "Electivo Profesional": "125, 211, 252",
    "Redes de Datos": "56, 189, 248",
    "Taller de Redes y Servicios": "56, 189, 248",
    "Arquitectura y Organización de Computadores": "56, 189, 248",
    "Señales y Sistemas": "56, 189, 248",
    "Comunicaciones Digitales": "56, 189, 248",
    "Criptografía y Seguridad en Redes": "56, 189, 248",
    "Criptografía y Seguridad de Redes": "56, 189, 248",
    "Tecnologías Inalámbricas": "56, 189, 248",
    "Arquitecturas Emergentes": "56, 189, 248",
    "Evaluación de Proyectos TIC": "56, 189, 248",
    "Data Science": "56, 189, 248",
    "Proyecto en TICs II": "56, 189, 248",
    "Comunicación para la Ingeniería": "248, 250, 252",
    "Curso de Formación General": "248, 250, 252",
    "Inglés I": "248, 250, 252",
    "Inglés II": "248, 250, 252",
    "Inglés III": "248, 250, 252",
    "Práctica Profesional I": "248, 250, 252",
    "Práctica Profesional II": "248, 250, 252",
    "Actividad de Titulación": "248, 250, 252",
    "Opción Magíster": "248, 250, 252",
};

let MALLA_MOCK = [];

let progresoState = {};
const CURRICULUM_CACHE = new Map();
let loadedCurriculumId = '';

function getProgressCareerId(progress = progresoState, preferProfile = false) {
    const configured = preferProfile && window.PortalProfile && window.PortalProfile.getCareerId();
    return configured || (progress && typeof progress.__careerId === 'string' ? progress.__careerId : '');
}

function progressKey(careerId, courseId) { return `${careerId}:${courseId}`; }

function migrateProgressState(value, fallbackCareerId = '') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result = { ...value };
    const careerId = typeof result.__careerId === 'string' ? result.__careerId : fallbackCareerId;
    for (const [key, status] of Object.entries(value)) {
        if (key === '__careerId' || key.includes(':')) continue;
        if (/^\d+$/.test(key) && careerId) {
            result[progressKey(careerId, key)] = status;
            delete result[key];
        }
    }
    if (careerId) result.__careerId = careerId;
    else delete result.__careerId;
    return result;
}

async function loadCurriculum(careerId) {
    if (CURRICULUM_CACHE.has(careerId)) return CURRICULUM_CACHE.get(careerId);
    const promise = fetch(`/api/malla/progreso/${encodeURIComponent(careerId)}`, { credentials: 'same-origin' })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
            const semesters = data && Array.isArray(data.semestres) ? data.semestres : [];
            return semesters.map(semester => ({
                sem: semester.numero,
                cursos: (semester.cursos || []).map(course => ({
                    id: String(course.id),
                    name: course.nombre,
                    cred: course.creditos || '',
                    code: course.codigo || '',
                    color: course.color || '',
                    border: course.border || '',
                    idVisible: course.idVisible !== false,
                    reqs: Array.isArray(course.requisitos) ? course.requisitos.map(String) : []
                }))
            }));
        })
        .catch(() => []);
    CURRICULUM_CACHE.set(careerId, promise);
    return promise;
}

function initProgreso() {
    const configuredCareerId = window.PortalProfile && window.PortalProfile.getCareerId
        ? window.PortalProfile.getCareerId() : '';
    const saved = localStorage.getItem('mi_progreso_v1');
    if (saved) {
        try {
            const storedProgress = JSON.parse(saved);
            if (configuredCareerId && storedProgress && typeof storedProgress === 'object') {
                storedProgress.__careerId = configuredCareerId;
            }
            progresoState = migrateProgressState(storedProgress, configuredCareerId || '');
        } catch(e) { progresoState = {}; }
    }
    if (configuredCareerId) progresoState.__careerId = configuredCareerId;
    else if (!progresoState.__careerId) delete progresoState.__careerId;
    renderProgreso();
}

function revertDependents(id, careerId) {
    for (let s of MALLA_MOCK) {
        for (let c of s.cursos) {
            const key = progressKey(careerId, c.id);
            if (progresoState[key] && c.reqs.includes(id)) {
                delete progresoState[key];
                revertDependents(c.id, careerId);
            }
        }
    }
}

function toggleRamoEstado(id) {
    const careerId = getProgressCareerId(progresoState, true);
    if (!careerId) return;
    let course = null;
    for (let s of MALLA_MOCK) {
        for (let c of s.cursos) {
            if (c.id === id) { course = c; break; }
        }
        if (course) break;
    }
    if (!course) return;

    let reqsMet = true;
    let missingReqs = [];
    for (let reqId of course.reqs) {
        if (reqId === "SC" || reqId === "4S" || reqId === "8S") continue;
        if (progresoState[progressKey(careerId, reqId)] !== 2) {
            reqsMet = false;
            missingReqs.push(reqId);
        }
    }
    
    const stateKey = progressKey(careerId, id);
    let estado = progresoState[stateKey] || 0;
    
    if (estado === 0 && !reqsMet) {
        // Find names of missing reqs for alert
        let missingNames = [];
        for (let rId of missingReqs) {
            for (let s of MALLA_MOCK) {
                for (let c of s.cursos) {
                    if (c.id === rId) missingNames.push(c.name);
                }
            }
        }
        if ('vibrate' in navigator) navigator.vibrate(200);
        mostrarAlertaWeb(`Requisitos pendientes:\nNo puedes tomar este ramo porque no has aprobado:\n- ${missingNames.join('\n- ')}`, 'Requisitos pendientes', 'error');
        return;
    }
    
    estado = (estado + 1) % 3;
    if (estado === 0) {
        delete progresoState[stateKey];
        revertDependents(id, careerId);
    } else {
        progresoState[stateKey] = estado;
    }
    progresoState.__careerId = careerId;
    localStorage.setItem('mi_progreso_v1', JSON.stringify(progresoState));
    if (window.PortalStore) window.PortalStore.save('curriculum', progresoState);
    renderProgreso();
}

function buildProgresoHtml(progress, readOnly = false, curriculum = MALLA_MOCK, adminEditable = false) {
    let totalRamos = 0;
    let aprobados = 0;
    let cursando = 0;

    let gridHtml = '<div class="malla-scroll-wrapper"><div class="malla-grid">';
    
    const careerId = getProgressCareerId(progress);
    curriculum.forEach(s => {
        gridHtml += `<div class="malla-columna"><div class="malla-sem-title">Semestre ${s.sem}</div>`;
        
        s.cursos.forEach((c) => {
            totalRamos++;
            
            const stateKey = progressKey(careerId, c.id);
            const est = Number(progress[stateKey]) || 0;
            if (est === 2) aprobados++;
            if (est === 1) cursando++;
            
            let statusClass = 'estado-pendiente';
            let icon = '';
            
            const cleanName = c.name.replace(/\s\([IVX]+\)$/, '');
            const rgb = c.color || RAMO_COLORS[cleanName] || "200, 200, 200";

            if (est === 1) { 
                statusClass = 'estado-cursando'; 
                icon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'; 
            }
            if (est === 2) { 
                statusClass = 'estado-aprobado'; 
                icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: rgba(${rgb}, 1);" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`; 
            }

            let reqStr = c.reqs.join(',');
            if (!reqStr) reqStr = '-';
            const safeName = escapeProgresoHtml(cleanName);
            const safeId = escapeProgresoHtml(c.id);
            const upperLabel = careerId === 'ingenieria-civil-industrial'
                ? c.cred
                : c.code || c.cred || '';
            const border = c.border ? ` --ramo-outline-color: rgba(${c.border}, .95);` : '';

            gridHtml += `
                <div class="malla-ramo-card ${statusClass}${readOnly && !adminEditable ? ' malla-ramo-readonly' : ''}"${readOnly && !adminEditable ? '' : ` onclick="${adminEditable ? `window.PortalCommunity.toggleCurriculum('${safeId}')` : `toggleRamoEstado('${safeId}')`}"`} style="--ramo-color: ${rgb};${border}">
                    <div class="ramo-top-right">${escapeProgresoHtml(upperLabel)}</div>
                    <span class="malla-ramo-name">${safeName}</span>
                    ${c.idVisible === false ? '' : `<div class="ramo-bottom-left">${safeId}</div>`}
                    <div class="ramo-bottom-right">${escapeProgresoHtml(reqStr)}</div>
                    ${icon ? `<span class="malla-ramo-icon">${icon}</span>` : ''}
                </div>
            `;
        });
        gridHtml += `</div>`;
    });
    gridHtml += '</div></div>';

    const pAprobado = Math.round((aprobados / totalRamos) * 100) || 0;

    return `
        <div class="progreso-header">
            
            
            <div class="progreso-stats">
                <div class="stat-box">
                    <div class="stat-value">${pAprobado}%</div>
                    <div class="stat-label">Avance Carrera</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${aprobados}</div>
                    <div class="stat-label">Ramos Aprobados</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${cursando}</div>
                    <div class="stat-label">Ramos Cursando</div>
                </div>
            </div>
            
            <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width: ${pAprobado}%"></div>
            </div>
        </div>
        ${gridHtml}
    `;
}

function escapeProgresoHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

async function renderProgreso() {
    const container = document.getElementById('progreso-container');
    if (!container) return;

    const authUser = window.PortalAuth && window.PortalAuth.user;
    if (!authUser) {
        container.innerHTML = '<div class="curriculum-unavailable-card"><span class="curriculum-unavailable-icon" aria-hidden="true">⌑</span><h3>Inicia sesión para ver tu malla</h3><p>La malla y tu avance académico están disponibles al iniciar sesión.</p></div>';
        return;
    }
    const careerId = window.PortalProfile && window.PortalProfile.getCareerId();
    if (!careerId) {
        container.innerHTML = '<div class="curriculum-unavailable-card"><span class="curriculum-unavailable-icon" aria-hidden="true">⌑</span><h3>Configura tu carrera</h3><p>Elige y guarda tu carrera en Mi perfil para mostrar la malla que te corresponde.</p></div>';
        return;
    }
    const requestCareerId = careerId;
    if (loadedCurriculumId !== careerId) {
        container.innerHTML = '<div class="empty-state">Cargando malla curricular…</div>';
        const curriculum = await loadCurriculum(careerId);
        if (!window.PortalProfile || window.PortalProfile.getCareerId() !== requestCareerId) return;
        if (!curriculum.length) {
            const careerName = (authUser.user_metadata || {}).career || 'esta carrera';
            container.innerHTML = `<div class="curriculum-unavailable-card"><span class="curriculum-unavailable-icon" aria-hidden="true">✦</span><h3>Esta malla todavía no está disponible</h3><p>La malla de ${escapeProgresoHtml(careerName)} aún no está incorporada. Cuando esté lista, aparecerá aquí.</p></div>`;
            return;
        }
        MALLA_MOCK = curriculum;
        loadedCurriculumId = careerId;
    }

    // Save scroll position
    const scrollWrapper = container.querySelector('.malla-scroll-wrapper');
    const scrollLeft = scrollWrapper ? scrollWrapper.scrollLeft : 0;
    const scrollTop = scrollWrapper ? scrollWrapper.scrollTop : 0;

    const html = buildProgresoHtml(progresoState);
    container.innerHTML = html;

    // Restore scroll position
    const newScrollWrapper = container.querySelector('.malla-scroll-wrapper');
    if (newScrollWrapper) {
        newScrollWrapper.scrollLeft = scrollLeft;
        newScrollWrapper.scrollTop = scrollTop;
    }
}

window.renderMallaPublica = async function (container, progress, options = {}) {
    if (!container) return;
    const safeProgress = migrateProgressState(progress, '');
    const careerId = getProgressCareerId(safeProgress);
    if (!careerId) {
        container.innerHTML = '<div class="curriculum-unavailable-card"><span class="curriculum-unavailable-icon" aria-hidden="true">⌑</span><h3>Esta persona no tiene una carrera configurada</h3><p>No se mostrará una malla de otra carrera por suposición.</p></div>';
        return;
    }
    const curriculum = await loadCurriculum(careerId);
    if (!curriculum.length) {
        container.innerHTML = '<div class="empty-state">Esta persona todavía no tiene una malla curricular disponible.</div>';
        return;
    }
    container.innerHTML = buildProgresoHtml(safeProgress, true, curriculum, Boolean(options.editable));
};

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    initProgreso();
    if (window.PortalStore) window.PortalStore.register('curriculum', 'mi_progreso_v1', {});
});
document.addEventListener('portal:remote-state', event => {
    if (event.detail.module !== 'curriculum') return;
    const activeCareerId = getProgressCareerId(progresoState, true);
    progresoState = migrateProgressState(event.detail.payload, activeCareerId || '');
    if (activeCareerId) progresoState.__careerId = activeCareerId;
    renderProgreso();
});
document.addEventListener('portal:career-changed', event => {
    const careerId = event.detail && event.detail.careerId;
    if (!careerId) return;
    progresoState = migrateProgressState(progresoState, careerId);
    progresoState.__careerId = careerId;
    localStorage.setItem('mi_progreso_v1', JSON.stringify(progresoState));
    if (window.PortalStore) window.PortalStore.save('curriculum', progresoState);
    loadedCurriculumId = '';
    renderProgreso();
});
document.addEventListener('portal:auth-changed', () => {
    const careerId = window.PortalProfile && window.PortalProfile.getCareerId();
    if (careerId) progresoState.__careerId = careerId;
    loadedCurriculumId = '';
    renderProgreso();
});

function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i-1) === a.charAt(j-1)) {
                matrix[i][j] = matrix[i-1][j-1];
            } else {
                matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

function isFuzzyMatch(str1, str2) {
    if (str1 === str2) return true;
    if (str1.length < 5 || str2.length < 5) return false;
    const dist = levenshtein(str1, str2);
    const maxLen = Math.max(str1.length, str2.length);
    return dist <= 2;
}

const SOLEMNES_COLORS = {
    "Mecánica de Fluidos (EII)": "Celeste",
    "Tecnologías Inalámbricas": "Verde",
    "Comunicaciones Digitales": "Verde",
    "Hidrología": "Naranjo",
    "Topografía": "Naranjo",
    "Electivo EII: \"Fintech\"": "Morado",
    "Electivo EII: \"Aplicación del Derecho Laboral\"": "Morado",
    "Señales y Sistemas": "Verde",
    "Edificación": "Naranjo",
    "Seminario Cs Ingeniería": "Naranjo",
    "Electivo EII: \"Evaluación Social de Proyectos\"": "Morado",
    "Electivo EII: \"Energía Solar\"": "Morado",
    "Ecuaciones Diferenciales": "Amarillo",
    "Logística": "Celeste",
    "Electivo Profesional (EIT)": "Verde",
    "Hidráulica Urbana": "Naranjo",
    "Introducción al Álgebra / Álgebra y Geometría": "Amarillo",
    "Termodinámica": "Celeste",
    "Proyectos Energéticos": "Celeste",
    "BIM": "Naranjo",
    "Álgebra Lineal": "Amarillo",
    "Electivo Profesional Diseño en Obras Hidráulicas": "Naranjo",
    "Electivo EII: \"Organización Industrial\"": "Morado",
    "Electivo EII: \"Análisis Estadístico Avanzado de Datos\"": "Morado",
    "Probabilidades y Estadística (EII EOC)": "Amarillo",
    "Data Science (EII)": "Celeste",
    "Inferencia Estadística": "Celeste",
    "Arquitectura y Organización de Computadores": "Verde",
    "Electivo Profesional Análisis de escenarios": "Naranjo",
    "Programación Avanzada": "Verde",
    "Bases de datos Avanzadas": "Verde",
    "Data Science (EIT)": "Verde",
    "Bases de Datos (EIT)": "Verde",
    "Electivo EII: \"Introducción a la Teoría de Juegos\"": "Morado",
    "Electivo EII: \"Nexo Agua-Energía\"": "Morado",
    "Electivo EII: \"Tópicos en Invest. Operativa\"": "Morado",
    "Programación": "Celeste",
    "Bases de Datos (EII)": "Celeste",
    "Ingeniería de Software": "Naranjo",
    "Tecnología del Hormigón": "Naranjo",
    "Electivo EII: \"Análisis de la Información Empresarial\"": "Morado",
    "Electivo EII: \"Métodos Estadísticos de Aprendizaje Automático\"": "Morado",
    "Marketing": "Celeste",
    "Estruct. De Datos y Algoritmos": "Verde",
    "Inteligencia Artificial": "Verde",
    "Electivo Profesional Hidrodinámica Ambiental": "Naranjo",
    "Diseño en Acero": "Naranjo",
    "Electivo EII: \"Gestión Cadena Abastecimiento & Operaciones\"": "Morado",
    "Química": "Amarillo",
    "Simulación": "Celeste",
    "Criptografía y seguridad en Redes": "Verde",
    "Ingeniería de Materiales": "Naranjo",
    "Planificación de Proyectos": "Naranjo",
    "Estática (EII)": "Celeste",
    "Redes de Datos": "Verde",
    "Administración de Proyectos Civiles": "Naranjo",
    "Electivo Profesional Análisis Sísmico de Estanques": "Naranjo",
    "Electivo EII: \"Transformación digital\"": "Morado",
    "Electivo EII: \"Gestión de procesos\"": "Morado",
    "Electivo EII: \"Strategic Communication\"": "Morado",
    "Herramientas de prog. en ing ind.": "Celeste",
    "Finanzas": "Celeste",
    "Probabilidades y Estadística (EIT)": "Verde",
    "Sistemas Distribuidos": "Verde",
    "Ingeniería Ambiental": "Naranjo",
    "Ingeniería Económica": "Celeste",
    "Análisis Estructural": "Naranjo",
    "Estática (EOC)": "Naranjo",
    "Electivo Profesional Contención de Taludes": "Naranjo",
    "Contabilidad y Costos": "Blanco / Sin color",
    "Mecánica de Fluidos (EOC)": "Naranjo",
    "Electivo EII: \"Tópicos en Finanzas\"": "Morado",
    "Liderazgo y Emprendimiento": "Celeste",
    "Evaluación de Proyectos": "Celeste",
    "Electrónica y Electrotecnia": "Verde",
    "Arquitecturas Emergentes": "Verde",
    "Mecánica de Sólidos": "Naranjo",
    "Fundaciones": "Naranjo",
    "Econometría": "Celeste",
    "Gestión Organizacional": "Verde",
    "Mecánica de Suelos": "Naranjo",
    "Cálculo III": "Amarillo",
    "Optimización": "Blanco / Sin color",
    "Microeconomía": "Celeste",
    "Ingeniería de Costos": "Naranjo",
    "Introducción al Cálculo/Cálculo I": "Amarillo",
    "Introducción a la Economía": "Blanco / Sin color",
    "Electivo Profesional Herramientas de Investigación": "Naranjo",
    "Electivo EII: \"Fundamentos de la Inteligencia Artificial\"": "Morado",
    "Cálculo Dif. E Integral/Cálculo II": "Verde",
    "Diseño de Caminos": "Naranjo",
    "Electivo EII: \"Importancia de la Última Milla en el Nivel de Servicio\"": "Morado",
    "Gestión Estratégica": "Celeste",
    "Teoría Organizacional": "Celeste",
    "Proyecto en TICS II": "Verde",
    "Taller de Proyectos": "Naranjo",
    "Modelos Estocásticos": "Celeste",
    "Sistemas Operativos": "Verde",
    "Taller de Redes y Servicios": "Verde",
    "Hidráulica": "Naranjo",
    "Electivo EII: \"Economía y Econometría Espacial\"": "Morado",
    "Electivo EII: \"Pensamiento Gerencial\"": "Morado",
    "Calor y Ondas": "Amarillo",
    "Producción": "Celeste",
    "Arquitectura de software": "Verde",
    "Ingeniería Sísmica": "Naranjo",
    "Electricidad y Magnetismo": "Amarillo",
    "Evaluación de proyectos TIC": "Verde",
    "Electivo EII: \"Inteligencia Artificial y Cambio Climático\"": "Morado",
    "Mecánica": "Amarillo",
    "Taller de Ing. Industrial": "Celeste",
    "Diseño Estructural": "Naranjo",
    "Diseño en Hormigón": "Naranjo"
};

function normStr(str) {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const customStyles = `
<style>
    #tab-solemnes {
        padding: 0 !important;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        overflow: visible !important;
    }
    #solemnes-container {
        width: 100%;
        min-width: 0;
        max-width: 100%;
    }
    .solemnes-scroll-wrapper {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-inline: contain;
        padding: 0 16px 20px 16px;
    }
    @media (max-width: 1023px) {
        .solemnes-scroll-wrapper {
            width: 100vw;
            max-width: none;
            margin-left: calc(-50vw + 50%);
            padding-left: 32px;
        }
    }
    .solemnes-grid {
        display: grid;
        grid-template-columns: 100px repeat(5, minmax(220px, 1fr));
        gap: 12px;
        min-width: 1200px; /* Force wide layout for horizontal scroll */
        margin-top: 20px;
    }
    .solemnes-highlight-control { margin: 10px 0 0; }
    .solemnes-highlight-control .profile-switch-copy small { max-width: 680px; }
    
    .sol-header-cell {
        background: rgba(30, 41, 59, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
    }
    .sol-header-title {
        color: #e2e8f0;
        font-size: 15px;
        font-weight: 600;
    }
    .sol-header-sub {
        color: #94a3b8;
        font-size: 12px;
        margin-top: 4px;
    }

    .sol-time-cell {
        position: relative;
        background: rgba(30, 41, 59, 0.6);
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .sol-time-num {
        color: #e2e8f0;
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 4px;
        letter-spacing: 0.5px;
    }
    .sol-time-range {
        color: #38bdf8;
        font-size: 14px;
        font-weight: 600;
    }

    .sol-day-cell {
        background: rgba(15, 23, 42, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        transition: opacity 0.3s ease;
    }

    .sol-ramo-pill {
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 12.5px;
        line-height: 1.3;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        transition: all 0.2s;
    }
    .sol-ramo-pill.matched {
        background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(6, 182, 212, 0.15));
        border: 1px solid rgba(56, 189, 248, 0.4);
        border-left: 3px solid #38bdf8;
        color: #ffffff;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .sol-ramo-pill.dimmed {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid transparent;
        color: #64748b;
        font-weight: 400;
    }

    /* Custom scrollbar */
    .solemnes-scroll-wrapper::-webkit-scrollbar {
        height: 8px;
    }
    .solemnes-scroll-wrapper::-webkit-scrollbar-track {
        background: rgba(0,0,0,0.2);
        border-radius: 4px;
        margin: 0 16px;
    }
    .solemnes-scroll-wrapper::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.2);
        border-radius: 4px;
    }
    
    .sol-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #475569;
        font-size: 13px;
        font-weight: 500;
        font-style: italic;
    }
</style>
`;


function renderSolemnes() {
    const container = document.getElementById('solemnes-container');
    if (!container) return;
    try {


    const searchInput = document.getElementById('solemnes-search');
    const query = searchInput ? normStr(searchInput.value) : '';
    const publicProfile = window.PortalCommunity && typeof window.PortalCommunity.getSelected === 'function'
        ? window.PortalCommunity.getSelected() : null;
    const publicModules = publicProfile && publicProfile.modules || {};
    const publicSchedule = publicModules.schedule && publicModules.schedule.clases;
    const isPublicProfile = Boolean(publicProfile);
    const highlightToggle = document.getElementById('solemnes-highlight-toggle');
    const highlightCopy = document.querySelector('.solemnes-highlight-control .profile-switch-copy');
    if (highlightCopy) {
        const title = highlightCopy.querySelector('strong');
        const description = highlightCopy.querySelector('small');
        if (title) title.textContent = isPublicProfile ? 'Destacar las solemnes de este perfil' : 'Destacar mis solemnes';
        if (description) description.textContent = isPublicProfile
            ? 'Compara el horario y la carrera del perfil seleccionado.'
            : 'Usa tu horario y la escuela de tu carrera para resaltar las evaluaciones que te corresponden.';
    }
    const highlightEnabled = highlightToggle
        ? Boolean(highlightToggle.checked)
        : (typeof localStorage !== 'undefined' && localStorage.getItem('solemnes-highlight-enabled') === 'true');
    const profileApi = window.PortalProfile;
    const selectedCareerId = isPublicProfile
        ? (typeof publicProfile.careerId === 'string' ? publicProfile.careerId : '')
        : (profileApi && profileApi.getCareerId ? profileApi.getCareerId() : '');
    const careerId = isPublicProfile && profileApi && profileApi.resolveCareerId
        ? (profileApi.resolveCareerId(selectedCareerId) || '') : selectedCareerId;
    const shouldHighlight = highlightEnabled && Boolean(careerId);
    const school = profileApi && profileApi.getSchoolForCareer && careerId
        ? profileApi.getSchoolForCareer(careerId) : null;
    const personalSchedule = isPublicProfile
        ? publicSchedule
        : (typeof MI_HORARIO_DATA !== 'undefined' && MI_HORARIO_DATA && MI_HORARIO_DATA.clases);
    const personalCourses = Array.isArray(personalSchedule)
        ? [...new Set(personalSchedule.map(item => String(item && item.curso || '').trim()).filter(Boolean))]
        : [];

    function comparableNames(value) {
        return normStr(value)
            .replace(/\((?:[^)]*\b(?:EIT|EII|EOC)\b[^)]*)\)/gi, '')
            .split('/')
            .map(item => item.replace(/[^a-z0-9]+/g, ' ').trim())
            .filter(Boolean);
    }

    function schoolsInExamName(examName) {
        const found = new Set();
        for (const group of String(examName || '').matchAll(/\(([^)]*)\)/g)) {
            for (const token of group[1].toUpperCase().match(/\b(?:EIT|EII|EOC)\b/g) || []) found.add(token);
        }
        return found;
    }

    function matchingPersonalCourses(examName) {
        if (!careerId || !personalCourses.length) return [];
        const examSchools = schoolsInExamName(examName);
        if (examSchools.size && (!school || !examSchools.has(school))) return [];
        const examNames = comparableNames(examName);
        const candidates = (Array.isArray(personalSchedule) ? personalSchedule : []).filter(course => {
            const courseNames = comparableNames(course && course.curso);
            return courseNames.some(courseName => examNames.some(exam =>
                courseName === exam ||
                (Math.min(courseName.length, exam.length) >= 8 && (courseName.includes(exam) || exam.includes(courseName))) ||
                isFuzzyMatch(courseName, exam)
            ));
        });
        if (!candidates.length || examSchools.size) return candidates;

        const allVariants = (Array.isArray(SOLEMNES_DATA) ? SOLEMNES_DATA : [])
            .flatMap(day => Array.isArray(day.ramos) ? day.ramos : [])
            .filter(item => comparableNames(item.nombre).some(exam => examNames.includes(exam)));
        const schoolsAcrossVariants = new Set(allVariants.flatMap(item => [...schoolsInExamName(item.nombre)]));
        return schoolsAcrossVariants.size <= 1 ? candidates : [];
    }

    function matchesPersonalCourse(examName) {
        return matchingPersonalCourses(examName).length > 0;
    }

    const status = document.getElementById('solemnes-highlight-status');
    if (status) {
        status.textContent = '';
        status.hidden = true;
        if (highlightEnabled) {
            if (!careerId) status.textContent = 'Este perfil no tiene una carrera configurada; el calendario se muestra sin resaltados.';
            else if (isPublicProfile && !personalCourses.length) status.textContent = 'Este perfil no tiene un horario compartido para comparar sus ramos.';
            else if (!personalCourses.length) status.textContent = 'Agrega tu horario para comparar tus ramos.';
            else if (!school) status.textContent = 'No se pudo determinar la escuela de esta carrera; solo se resaltarán coincidencias sin ambigüedad.';
            if (status.textContent) status.hidden = false;
        }
    }

    const mapDias = {
        1: { title: "Día 1", sub: "Jueves 24 Sept" },
        2: { title: "Día 2", sub: "Viernes 25 Sept" },
        3: { title: "Día 3", sub: "Lunes 28 Sept" },
        4: { title: "Día 4", sub: "Martes 29 Sept" },
        5: { title: "Día 5", sub: "Miérc 30 Sept" }
    };

    const bloques = [
        { num: 1, label: "8:30 - 10:30", raw: "8:30 a 10:30" },
        { num: 2, label: "10:45 - 12:45", raw: "10:45 a 12:45" },
        { num: 3, label: "13:00 - 15:00", raw: "13:00 a 15:00" },
        { num: 4, label: "15:15 - 17:15", raw: "15:15 a 17:15" },
        { num: 5, label: "17:30 - 19:30", raw: "17:30 a 19:30" }
    ];

    let currentBlockNum = -1;
    if (typeof getChileTime === 'function' && typeof timeToMinutes === 'function') {
        const { totalMinutes } = getChileTime();
        bloques.forEach(b => {
            const [startStr, endStr] = b.label.split(' - ');
            const startM = timeToMinutes(startStr);
            const endM = timeToMinutes(endStr);
            if (totalMinutes >= startM && totalMinutes < endM) {
                currentBlockNum = b.num;
            }
        });
    }

    let gridHtml = `<div class="solemnes-grid">`;

    // Row 1: Headers (Empty corner + 5 days)
    gridHtml += `<div class="sol-header-cell" style="background: transparent; border: none;"></div>`;
    for (let d = 1; d <= 5; d++) {
        gridHtml += `
            <div class="sol-header-cell">
                <span class="sol-header-title">${mapDias[d].title}</span>
                <span class="sol-header-sub">${mapDias[d].sub}</span>
            </div>
        `;
    }

    // Rows 2-6: Time blocks
    bloques.forEach(b => {
        const isCurrent = (b.num === currentBlockNum);
        // Time column
        gridHtml += `
            <div class="sol-time-cell" ${isCurrent ? 'style="border-left: 2px solid #fff;"' : ''}>
                ${isCurrent ? '<span class="pulse-dot-white" style="position: absolute; top: 12px; left: 12px;"></span>' : ''}
                <span class="sol-time-num">Bloque ${b.num}</span>
                <span class="sol-time-range">${b.label}</span>
            </div>
        `;

        // 5 day columns
        for (let d = 1; d <= 5; d++) {
            const cellData = SOLEMNES_DATA.find(item => item.dia === d && item.horario === b.raw);
            const ramos = cellData ? cellData.ramos : [];
            const matches = ramos.filter(r => {
                const matchesQuery = !query || normStr(r.nombre).includes(query);
                const matchesPersonal = !shouldHighlight || matchesPersonalCourse(r.nombre);
                return matchesQuery && matchesPersonal;
            });
            const hasMatch = matches.length > 0;
            const isFiltering = shouldHighlight || query !== '';
            
            // Opacity logic: if filtering and no matches in this cell, dim the whole cell heavily
            const cellOpacity = (isFiltering && !hasMatch && ramos.length > 0) ? '0.15' : '1';

            if (ramos.length === 0) {
                gridHtml += `
                    <div class="sol-day-cell" style="opacity: ${isFiltering ? '0.1' : '0.5'};">
                        <div class="sol-empty">-</div>
                    </div>
                `;
                continue;
            }

            let cellContent = '';
            ramos.forEach(r => {
                const matchingCourses = shouldHighlight ? matchingPersonalCourses(r.nombre) : [];
                const isMatch = (!shouldHighlight || matchingCourses.length > 0)
                    && (!query || normStr(r.nombre).includes(query));
                
                let theme = { bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }; // Default Celeste
                
                const colorName = SOLEMNES_COLORS[r.nombre];
                if (colorName) {
                    const cLower = colorName.toLowerCase();
                    if (cLower.includes('amarillo')) {
                        theme = { bg: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.4)', color: '#facc15' };
                    } else if (cLower.includes('verde')) {
                        theme = { bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.4)', color: '#34d399' };
                    } else if (cLower.includes('naranjo')) {
                        theme = { bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.4)', color: '#fb923c' };
                    } else if (cLower.includes('morado')) {
                        theme = { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)', color: '#c084fc' };
                    } else if (cLower.includes('blanco') || cLower.includes('sin color')) {
                        theme = { bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.2)', color: '#cbd5e1' };
                    }
                }

                // Preserve the pre-V1 community highlight: matched exams are
                // stark white, while unmatched entries retain their course color.
                if (shouldHighlight && isMatch) {
                    const isAssistantCourse = matchingCourses.some(course => String(course && course.rol || '').toLowerCase() === 'assistant');
                    theme = isAssistantCourse
                        ? { bg: 'linear-gradient(135deg, rgba(217, 119, 6, 0.24), rgba(180, 83, 9, 0.20))', border: 'rgba(251, 191, 36, 0.48)', color: '#fbbf24' }
                        : { bg: 'rgba(255, 255, 255, 0.15)', border: 'rgba(255, 255, 255, 0.7)', color: '#ffffff' };
                }
                
                const styleAttr = (!isFiltering || isMatch)
                    ? `style="background: ${theme.bg}; border-color: ${theme.border}; border-left-color: ${theme.color};"`
                    : '';
                // The matched class supplies the normal capsule border and
                // thick left accent too; keep it when no personal filter is active.
                const matchClass = isMatch ? 'matched' : 'dimmed';
                
                cellContent += `
                    <div class="sol-ramo-pill ${matchClass}" ${styleAttr}>
                        ${escapeHtml(r.nombre)}
                    </div>
                `;
            });

            gridHtml += `
                <div class="sol-day-cell" style="opacity: ${cellOpacity};">
                    ${cellContent}
                </div>
            `;
        }
    });

    gridHtml += `</div>`; // end solemnes-grid

    const finalHtml = `
        ${customStyles}
        <div class="solemnes-scroll-wrapper">
            ${gridHtml}
        </div>
    `;


    container.innerHTML = finalHtml;
    } catch (e) {
        console.error('No se pudieron renderizar las solemnes.', e);
        container.innerHTML = '<div class="empty-state">No se pudieron cargar las solemnes. Inténtalo nuevamente.</div>';
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const highlightToggle = document.getElementById('solemnes-highlight-toggle');
    if (highlightToggle) {
        highlightToggle.checked = localStorage.getItem('solemnes-highlight-enabled') === 'true';
        highlightToggle.addEventListener('change', () => {
            localStorage.setItem('solemnes-highlight-enabled', String(highlightToggle.checked));
            renderSolemnes();
        });
    }
    renderSolemnes();
    const originalCambiarTab = window.cambiarTab;
    if (originalCambiarTab) {
        window.cambiarTab = function(tabId, btn) {
            originalCambiarTab(tabId, btn);
            if (tabId === 'tab-solemnes') renderSolemnes();
        };
    } else {
        const interceptTab = setInterval(() => {
            if (typeof cambiarTab === 'function') {
                const old = cambiarTab;
                cambiarTab = function(tabId, btn) {
                    old(tabId, btn);
                    if (tabId === 'tab-solemnes') renderSolemnes();
                };
                clearInterval(interceptTab);
            }
        }, 100);
    }
});

['portal:career-changed', 'portal:careers-ready', 'portal:public-profile-changed', 'portal:schedule-updated'].forEach(eventName => {
    document.addEventListener(eventName, () => renderSolemnes());
});

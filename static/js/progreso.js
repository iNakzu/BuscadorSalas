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

const MALLA_MOCK = [
    { sem: 1, cursos: ["Álgebra y Geometría", "Cálculo I", "Química", "Programación", "Comunicación para la Ingeniería"] },
    { sem: 2, cursos: ["Álgebra Lineal", "Cálculo II", "Mecánica", "Programación Avanzada", "Curso de Formación General (II)"] },
    { sem: 3, cursos: ["Ecuaciones Diferenciales", "Cálculo III", "Calor y Ondas", "Estructuras de Datos y Algoritmos", "Redes de Datos"] },
    { sem: 4, cursos: ["Probabilidades y Estadísticas", "Electrónica y Electrotecnia", "Electricidad y Magnetismo", "Bases de Datos", "Desarrollo Web y Móvil", "Inglés I"] },
    { sem: 5, cursos: ["Optimización", "Taller de Redes y Servicios", "Proyecto en TICs I", "Bases de Datos Avanzadas", "Curso de Formación General (V)", "Inglés II", "Práctica Profesional I"] },
    { sem: 6, cursos: ["Contabilidad y Costos", "Arquitectura y Organización de Computadores", "Señales y Sistemas", "Sistemas Operativos", "Curso de Formación General (VI)", "Inglés III"] },
    { sem: 7, cursos: ["Gestión Organizacional", "Sistemas Distribuidos", "Comunicaciones Digitales", "Ingeniería de Software", "Curso de Formación General (VII)"] },
    { sem: 8, cursos: ["Introducción a la Economía", "Tecnologías Inalámbricas", "Criptografía y Seguridad en Redes", "Inteligencia Artificial", "Evaluación de Proyectos TIC", "Práctica Profesional II"] },
    { sem: 9, cursos: ["Electivo Profesional", "Arquitecturas Emergentes", "Electivo Profesional", "Arquitectura de Software", "Data Science"] },
    { sem: 10, cursos: ["Electivo Profesional", "Electivo Profesional", "Electivo Profesional", "Electivo Profesional", "Proyecto en TICs II"] },
    { sem: 11, cursos: ["Actividad de Titulación", "Opción Magíster"] }
];

let progresoState = {};

function initProgreso() {
    const saved = localStorage.getItem('mi_progreso_v1');
    if (saved) {
        try { progresoState = JSON.parse(saved); } catch(e) { progresoState = {}; }
    }
    renderProgreso();
}

function toggleRamoEstado(ramo) {
    // Estados: 0: pendiente (gris), 1: cursando (amarillo), 2: aprobado (verde)
    let estado = progresoState[ramo] || 0;
    estado = (estado + 1) % 3;
    if (estado === 0) delete progresoState[ramo];
    else progresoState[ramo] = estado;
    
    localStorage.setItem('mi_progreso_v1', JSON.stringify(progresoState));
    renderProgreso();
}

function renderProgreso() {
    const container = document.getElementById('progreso-container');
    if (!container) return;

    // Save scroll position
    const scrollWrapper = container.querySelector('.malla-scroll-wrapper');
    const scrollLeft = scrollWrapper ? scrollWrapper.scrollLeft : 0;
    const scrollTop = scrollWrapper ? scrollWrapper.scrollTop : 0;

    let totalRamos = 0;
    let aprobados = 0;
    let cursando = 0;

    let gridHtml = '<div class="malla-scroll-wrapper"><div class="malla-grid">';
    
    MALLA_MOCK.forEach(s => {
        gridHtml += `<div class="malla-columna"><div class="malla-sem-title">Semestre ${s.sem}</div>`;
        
        let counts = {};
        s.cursos.forEach((c, idx) => {
            totalRamos++;
            
            // Handle duplicate names (like "Electivo Profesional") by appending an index to the state key
            counts[c] = (counts[c] || 0) + 1;
            let stateKey = c;
            if (c === "Electivo Profesional" || c.startsWith("Curso de Formación")) {
                stateKey = `${c}_${s.sem}_${counts[c]}`;
            }

            const est = progresoState[stateKey] || 0;
            if (est === 2) aprobados++;
            if (est === 1) cursando++;
            
            let statusClass = 'estado-pendiente';
            let icon = '';
            
            const cleanName = c.replace(/\s\([IVX]+\)$/, '');
            const rgb = RAMO_COLORS[cleanName] || "200, 200, 200";

            if (est === 1) { 
                statusClass = 'estado-cursando'; 
                icon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'; 
            }
            if (est === 2) { 
                statusClass = 'estado-aprobado'; 
                icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: rgba(${rgb}, 1);" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`; 
            }

            gridHtml += `
                <div class="malla-ramo-card ${statusClass}" onclick="toggleRamoEstado('${stateKey}')" style="--ramo-color: ${rgb};">
                    <span class="malla-ramo-name">${cleanName}</span>
                    ${icon ? `<span class="malla-ramo-icon">${icon}</span>` : ''}
                </div>
            `;
        });
        gridHtml += `</div>`;
    });
    gridHtml += '</div></div>';

    const pAprobado = Math.round((aprobados / totalRamos) * 100) || 0;

    const html = `
        <div class="progreso-header">
            <h2>Malla Interactiva</h2>
            <p>Toca un ramo para cambiar su estado (Pendiente ➔ Cursando ➔ Aprobado). Tu progreso se guardará automáticamente en tu dispositivo.</p>
            
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
    container.innerHTML = html;

    // Restore scroll position
    const newScrollWrapper = container.querySelector('.malla-scroll-wrapper');
    if (newScrollWrapper) {
        newScrollWrapper.scrollLeft = scrollLeft;
        newScrollWrapper.scrollTop = scrollTop;
    }
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', initProgreso);

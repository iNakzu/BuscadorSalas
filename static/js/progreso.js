const RAMO_COLORS = {
    "Álgebra y Geometría": "52, 193, 205",
    "Álgebra Lineal": "52, 193, 205",
    "Ecuaciones Diferenciales": "52, 193, 205",
    "Probabilidades y Estadísticas": "187, 229, 235",
    "Optimización": "187, 229, 235",
    "Contabilidad y Costos": "187, 229, 235",
    "Gestión Organizacional": "187, 229, 235",
    "Introducción a la Economía": "187, 229, 235",
    "Electivo Profesional": "175, 206, 195",
    "Actividad de Titulación": "255, 255, 255",
    "Opción Magíster": "255, 255, 255",
    "Cálculo I": "52, 193, 205",
    "Cálculo II": "52, 193, 205",
    "Cálculo III": "52, 193, 205",
    "Electrónica y Electrotecnia": "187, 229, 235",
    "Taller de Redes y Servicios": "113, 159, 192",
    "Arquitectura y Organización de Computadores": "113, 159, 192",
    "Sistemas Distribuidos": "175, 206, 195",
    "Tecnologías Inalámbricas": "113, 159, 192",
    "Arquitecturas Emergentes": "113, 159, 192",
    "Química": "52, 193, 205",
    "Mecánica": "52, 193, 205",
    "Calor y Ondas": "52, 193, 205",
    "Electricidad y Magnetismo": "52, 193, 205",
    "Proyecto en TICs I": "175, 199, 218",
    "Señales y Sistemas": "113, 159, 192",
    "Comunicaciones Digitales": "113, 159, 192",
    "Criptografía y Seguridad de Redes": "113, 159, 192",
    "Programación": "187, 229, 235",
    "Programación Avanzada": "187, 229, 235",
    "Estructura de Datos y Algoritmos": "175, 206, 195",
    "Bases de Datos": "175, 206, 195",
    "Bases de Datos Avanzadas": "175, 206, 195",
    "Sistemas Operativos": "175, 206, 195",
    "Ingeniería de Software": "175, 206, 195",
    "Inteligencia Artificial": "250, 250, 250",
    "Arquitectura de Software": "175, 206, 195",
    "Comunicación para la Ingeniería": "255, 255, 255",
    "Curso de Formación General": "255, 255, 255",
    "Redes de Datos": "113, 159, 192",
    "Desarrollo Web y Móvil": "175, 206, 195",
    "Evaluación de Proyectos TIC": "175, 199, 218",
    "Data Science": "175, 199, 218",
    "Proyecto en TICs II": "175, 199, 218",
    "Inglés I": "255, 255, 255",
    "Inglés II": "255, 255, 255",
    "Inglés III": "255, 255, 255",
    "Práctica Profesional II": "250, 250, 250",
    "Práctica Profesional I": "250, 250, 250",
    "Criptografía y Seguridad en Redes": "113, 159, 192",
    "Estructuras de Datos y Algoritmos": "175, 206, 195",
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

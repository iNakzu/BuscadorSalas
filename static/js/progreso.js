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
            if (est === 1) { statusClass = 'estado-cursando'; icon = ''; }
            if (est === 2) { statusClass = 'estado-aprobado'; icon = ''; }

            gridHtml += `
                <div class="malla-ramo-card ${statusClass}" onclick="toggleRamoEstado('${stateKey}')">
                    <span class="malla-ramo-name">${c.replace(/\s\([IVX]+\)$/, '')}</span>
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
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', initProgreso);

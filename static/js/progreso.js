const MALLA_MOCK = [
    { sem: 1, cursos: ["Álgebra I", "Cálculo I", "Física I", "Intro a la Ingeniería", "Inglés I"] },
    { sem: 2, cursos: ["Álgebra II", "Cálculo II", "Física II", "Programación", "Inglés II"] },
    { sem: 3, cursos: ["Ecuaciones Dif.", "Cálculo III", "Física III", "Estructura de Datos", "Inglés III"] },
    { sem: 4, cursos: ["Estadística", "Sistemas Digitales", "Bases de Datos", "Redes de Comp. I", "Inglés IV"] },
    { sem: 5, cursos: ["Señales y Sist.", "Arquitectura Comp.", "Ing. de Software", "Redes de Comp. II", "Formación Gral I"] },
    { sem: 6, cursos: ["Comunicaciones", "Sist. Operativos", "Seguridad Infor.", "Proy. de Redes", "Formación Gral II"] },
    { sem: 7, cursos: ["Tecnologías Inalámbricas", "Gestión de TI", "Electivo I", "Sist. Distribuidos", "Ética"] },
    { sem: 8, cursos: ["Redes Ópticas", "Evaluación Proy.", "Electivo II", "Práctica Prof.", "Taller Titulación I"] },
    { sem: 9, cursos: ["Redes Móviles", "Electivo III", "Electivo IV", "Taller Titulación II"] }
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
        s.cursos.forEach(c => {
            totalRamos++;
            const est = progresoState[c] || 0;
            if (est === 2) aprobados++;
            if (est === 1) cursando++;
            
            let statusClass = 'estado-pendiente';
            let icon = '';
            if (est === 1) { statusClass = 'estado-cursando'; icon = ''; }
            if (est === 2) { statusClass = 'estado-aprobado'; icon = ''; }

            gridHtml += `
                <div class="malla-ramo-card ${statusClass}" onclick="toggleRamoEstado('${c}')">
                    <span class="malla-ramo-name">${c}</span>
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

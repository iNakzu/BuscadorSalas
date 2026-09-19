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
    {
        "sem": 1,
        "cursos": [
            {
                "id": "1",
                "name": "Álgebra y Geometría",
                "cred": "7",
                "reqs": []
            },
            {
                "id": "2",
                "name": "Cálculo I",
                "cred": "7",
                "reqs": []
            },
            {
                "id": "3",
                "name": "Química",
                "cred": "6",
                "reqs": []
            },
            {
                "id": "4",
                "name": "Programación",
                "cred": "6",
                "reqs": []
            },
            {
                "id": "5",
                "name": "Comunicación para la Ingeniería",
                "cred": "5",
                "reqs": []
            }
        ]
    },
    {
        "sem": 2,
        "cursos": [
            {
                "id": "6",
                "name": "Álgebra Lineal",
                "cred": "6",
                "reqs": [
                    "1"
                ]
            },
            {
                "id": "7",
                "name": "Cálculo II",
                "cred": "7",
                "reqs": [
                    "2"
                ]
            },
            {
                "id": "8",
                "name": "Mecánica",
                "cred": "7",
                "reqs": [
                    "2"
                ]
            },
            {
                "id": "9",
                "name": "Programación Avanzada",
                "cred": "6",
                "reqs": [
                    "4"
                ]
            },
            {
                "id": "10",
                "name": "Curso de Formación General",
                "cred": "5",
                "reqs": [
                    "SC"
                ]
            }
        ]
    },
    {
        "sem": 3,
        "cursos": [
            {
                "id": "11",
                "name": "Ecuaciones Diferenciales",
                "cred": "6",
                "reqs": [
                    "6",
                    "7"
                ]
            },
            {
                "id": "12",
                "name": "Cálculo III",
                "cred": "6",
                "reqs": [
                    "7"
                ]
            },
            {
                "id": "13",
                "name": "Calor y Ondas",
                "cred": "7",
                "reqs": [
                    "7",
                    "8"
                ]
            },
            {
                "id": "14",
                "name": "Estructura de Datos y Algoritmos",
                "cred": "6",
                "reqs": [
                    "9"
                ]
            },
            {
                "id": "15",
                "name": "Redes de Datos",
                "cred": "6",
                "reqs": [
                    "9"
                ]
            }
        ]
    },
    {
        "sem": 4,
        "cursos": [
            {
                "id": "16",
                "name": "Probabilidades y Estadísticas",
                "cred": "6",
                "reqs": [
                    "7"
                ]
            },
            {
                "id": "17",
                "name": "Electrónica y Electrotecnia",
                "cred": "6",
                "reqs": [
                    "8",
                    "11",
                    "12"
                ]
            },
            {
                "id": "18",
                "name": "Electricidad y Magnetismo",
                "cred": "7",
                "reqs": [
                    "11",
                    "12"
                ]
            },
            {
                "id": "19",
                "name": "Bases de Datos",
                "cred": "6",
                "reqs": [
                    "14"
                ]
            },
            {
                "id": "20",
                "name": "Desarrollo Web y Móvil",
                "cred": "6",
                "reqs": [
                    "9"
                ]
            },
            {
                "id": "21",
                "name": "Inglés I",
                "cred": "5",
                "reqs": []
            }
        ]
    },
    {
        "sem": 5,
        "cursos": [
            {
                "id": "22",
                "name": "Optimización",
                "cred": "6",
                "reqs": [
                    "6",
                    "12"
                ]
            },
            {
                "id": "23",
                "name": "Taller de Redes y Servicios",
                "cred": "6",
                "reqs": [
                    "15",
                    "16"
                ]
            },
            {
                "id": "24",
                "name": "Proyecto en TICs I",
                "cred": "6",
                "reqs": [
                    "15",
                    "20"
                ]
            },
            {
                "id": "25",
                "name": "Bases de Datos Avanzadas",
                "cred": "6",
                "reqs": [
                    "19"
                ]
            },
            {
                "id": "26",
                "name": "Curso de Formación General",
                "cred": "5",
                "reqs": [
                    "SC"
                ]
            },
            {
                "id": "27",
                "name": "Inglés II",
                "cred": "5",
                "reqs": [
                    "21"
                ]
            },
            {
                "id": "54",
                "name": "Práctica Profesional I",
                "cred": "7",
                "reqs": [
                    "4S"
                ]
            }
        ]
    },
    {
        "sem": 6,
        "cursos": [
            {
                "id": "28",
                "name": "Contabilidad y Costos",
                "cred": "6",
                "reqs": [
                    "2"
                ]
            },
            {
                "id": "29",
                "name": "Arquitectura y Organización de Computadores",
                "cred": "6",
                "reqs": [
                    "15",
                    "17"
                ]
            },
            {
                "id": "30",
                "name": "Señales y Sistemas",
                "cred": "6",
                "reqs": [
                    "13",
                    "17"
                ]
            },
            {
                "id": "31",
                "name": "Sistemas Operativos",
                "cred": "6",
                "reqs": [
                    "14",
                    "23"
                ]
            },
            {
                "id": "32",
                "name": "Curso de Formación General",
                "cred": "5",
                "reqs": [
                    "SC"
                ]
            },
            {
                "id": "33",
                "name": "Inglés III",
                "cred": "5",
                "reqs": [
                    "27"
                ]
            }
        ]
    },
    {
        "sem": 7,
        "cursos": [
            {
                "id": "34",
                "name": "Gestión Organizacional",
                "cred": "6",
                "reqs": [
                    "54"
                ]
            },
            {
                "id": "35",
                "name": "Sistemas Distribuidos",
                "cred": "6",
                "reqs": [
                    "15",
                    "31"
                ]
            },
            {
                "id": "36",
                "name": "Comunicaciones Digitales",
                "cred": "6",
                "reqs": [
                    "18",
                    "30"
                ]
            },
            {
                "id": "37",
                "name": "Ingeniería de Software",
                "cred": "6",
                "reqs": [
                    "19",
                    "24"
                ]
            },
            {
                "id": "38",
                "name": "Curso de Formación General",
                "cred": "5",
                "reqs": [
                    "SC"
                ]
            }
        ]
    },
    {
        "sem": 8,
        "cursos": [
            {
                "id": "39",
                "name": "Introducción a la Economía",
                "cred": "6",
                "reqs": [
                    "7"
                ]
            },
            {
                "id": "40",
                "name": "Tecnologías Inalámbricas",
                "cred": "6",
                "reqs": [
                    "36"
                ]
            },
            {
                "id": "41",
                "name": "Criptografía y Seguridad en Redes",
                "cred": "6",
                "reqs": [
                    "23"
                ]
            },
            {
                "id": "42",
                "name": "Inteligencia Artificial",
                "cred": "6",
                "reqs": [
                    "16",
                    "19",
                    "22"
                ]
            },
            {
                "id": "43",
                "name": "Evaluación de Proyectos TIC",
                "cred": "6",
                "reqs": [
                    "28",
                    "34",
                    "37"
                ]
            },
            {
                "id": "55",
                "name": "Práctica Profesional II",
                "cred": "7",
                "reqs": [
                    "8S"
                ]
            }
        ]
    },
    {
        "sem": 9,
        "cursos": [
            {
                "id": "44",
                "name": "Electivo Profesional",
                "cred": "6",
                "reqs": [
                    "SC"
                ]
            },
            {
                "id": "45",
                "name": "Arquitecturas Emergentes",
                "cred": "6",
                "reqs": [
                    "35"
                ]
            },
            {
                "id": "46",
                "name": "Electivo Profesional",
                "cred": "6",
                "reqs": [
                    "SC"
                ]
            },
            {
                "id": "47",
                "name": "Arquitectura de Software",
                "cred": "6",
                "reqs": [
                    "37"
                ]
            },
            {
                "id": "48",
                "name": "Data Science",
                "cred": "6",
                "reqs": [
                    "25",
                    "42"
                ]
            }
        ]
    },
    {
        "sem": 10,
        "cursos": [
            {
                "id": "49",
                "name": "Electivo Profesional",
                "cred": "7",
                "reqs": [
                    "SC"
                ]
            },
            {
                "id": "50",
                "name": "Electivo Profesional",
                "cred": "6",
                "reqs": [
                    "SC"
                ]
            },
            {
                "id": "51",
                "name": "Electivo Profesional",
                "cred": "6",
                "reqs": [
                    "SC"
                ]
            },
            {
                "id": "52",
                "name": "Electivo Profesional",
                "cred": "6",
                "reqs": [
                    "SC"
                ]
            },
            {
                "id": "53",
                "name": "Proyecto en TICs II",
                "cred": "6",
                "reqs": [
                    "43"
                ]
            }
        ]
    },
    {
        "sem": 11,
        "cursos": [
            {
                "id": "56",
                "name": "Actividad de Titulación",
                "cred": "-",
                "reqs": [
                    "SC"
                ]
            },
            {
                "id": "57",
                "name": "Opción Magíster",
                "cred": "-",
                "reqs": [
                    "SC"
                ]
            }
        ]
    }
]
;

let progresoState = {};

function initProgreso() {
    const saved = localStorage.getItem('mi_progreso_v1');
    if (saved) {
        try { progresoState = JSON.parse(saved); } catch(e) { progresoState = {}; }
    }
    renderProgreso();
}

function revertDependents(id) {
    for (let s of MALLA_MOCK) {
        for (let c of s.cursos) {
            if (progresoState[c.id] && c.reqs.includes(id)) {
                delete progresoState[c.id];
                revertDependents(c.id);
            }
        }
    }
}

function toggleRamoEstado(id) {
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
        if (progresoState[reqId] !== 2) {
            reqsMet = false;
            missingReqs.push(reqId);
        }
    }
    
    let estado = progresoState[id] || 0;
    
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
        alert(`🔒 Requisitos pendientes:\nNo puedes tomar este ramo porque no has aprobado:\n- ${missingNames.join('\n- ')}`);
        return;
    }
    
    estado = (estado + 1) % 3;
    if (estado === 0) {
        delete progresoState[id];
        revertDependents(id);
    } else {
        progresoState[id] = estado;
    }
    
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
        
        s.cursos.forEach((c) => {
            totalRamos++;
            
            const stateKey = c.id;
            const est = progresoState[stateKey] || 0;
            if (est === 2) aprobados++;
            if (est === 1) cursando++;
            
            let statusClass = 'estado-pendiente';
            let icon = '';
            
            const cleanName = c.name.replace(/\s\([IVX]+\)$/, '');
            const rgb = RAMO_COLORS[cleanName] || "200, 200, 200";

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

            gridHtml += `
                <div class="malla-ramo-card ${statusClass}" onclick="toggleRamoEstado('${stateKey}')" style="--ramo-color: ${rgb};">
                    <div class="ramo-top-right">${c.cred}</div>
                    <span class="malla-ramo-name">${cleanName}</span>
                    <div class="ramo-bottom-left">${c.id}</div>
                    <div class="ramo-bottom-right">${reqStr}</div>
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

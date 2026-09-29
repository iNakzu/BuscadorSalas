
window.statusSolemnes = window.statusSolemnes || {};

async function fetchSolemnesStatus() {
    try {
        const resp = await fetch('/api/solemnes_status');
        window.statusSolemnes = await resp.json();
        
        checkSolemneAutoSwitch(state.dia);
    } catch(e) {}
}

function checkSolemneAutoSwitch(diaStr) {
    if (diaStr === 'ALL') return; // Do not auto-switch for ALL
    const diaNum = parseInt(diaStr);
    if (!isNaN(diaNum) && window.statusSolemnes[diaNum] !== undefined) {
        const isSolemne = window.statusSolemnes[diaNum];
        if (window.SOLEMNES_MODE !== isSolemne) {
            const toggleEl = document.getElementById('toggle-solemnes');
            if (toggleEl) toggleEl.checked = isSolemne;
            toggleSolemnesMode(isSolemne);
        }
    }
}

const __dia_inicial = '1';
const __hora_inicial = window.statusSolemnes[__dia_inicial] ? '08:30:00_S' : '08:30:00';
let state = {
    facultad: 'INGENIERIA',
    dia: __dia_inicial,
    hora: __hora_inicial,
    profDia: __dia_inicial,
    profHora: '',
    ramoDia: __dia_inicial,
    ramoHora: '',
    mallaSemestre: '8',
    mallaDia: __dia_inicial,
    mallaHora: '',
    mallaRamo: '',
    salaDia: __dia_inicial,
    salaActiva: '',
    miHorarioDia: 'ALL',
    miHorarioRol: 'ALL',
    filtros: {}
};


function obtenerDiaActualNumero() {
    const d = new Date().getDay();
    return (d >= 1 && d <= 5) ? d : 1;
}

let mallaLoadedOnce = false;

function cambiarTab(panelId, btn) {
    if (btn.dataset.private === 'true' && (!window.PortalAuth || !window.PortalAuth.user)) {
        const gate = document.getElementById('auth-gate');
        if (gate) gate.hidden = false;
        return;
    }
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    if (btn.scrollIntoView) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    const target = document.getElementById(panelId);
    if (target) target.classList.add('active');
    if (panelId === 'tab-malla' && !window.mallaLoadedOnce) {
        cargarClasesMalla(true);
    }
    if (panelId === 'tab-mihorario' && typeof inicializarMiHorario === 'function') {
        inicializarMiHorario();
    }
    
    // Sincronizar el modo solemne con el dia activo de la nueva pestaña
    let activeDay = null;
    if (panelId === 'tab-salas') activeDay = typeof state !== 'undefined' ? state.dia : null;
    else if (panelId === 'tab-profes') activeDay = typeof state !== 'undefined' ? state.profDia : null;
    else if (panelId === 'tab-ramos') activeDay = typeof state !== 'undefined' ? state.ramoDia : null;
    else if (panelId === 'tab-horario') activeDay = typeof state !== 'undefined' ? state.salaDia : null;
    else if (panelId === 'tab-malla') activeDay = typeof state !== 'undefined' ? state.mallaDia : null;
    else if (panelId === 'tab-mihorario') activeDay = typeof state !== 'undefined' ? state.miHorarioDia : null;

    if (activeDay && typeof checkSolemneAutoSwitch === 'function') {
        checkSolemneAutoSwitch(activeDay);
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar-menu');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
}

document.addEventListener('click', event => {
    const gate = document.getElementById('auth-gate');
    if (gate && event.target === gate) gate.hidden = true;
    if (event.target.closest('.tab-btn') && window.innerWidth < 1024) toggleSidebar();
});
function setFacultadPill(val, btn) {
    document.querySelectorAll('#bar-facultad .pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const input = document.getElementById('input-campus-search');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clear-campus-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    state.facultad = val;
    if (state.hora) cargarSalas();
}

let debounceCampus = null;
function filtrarPorCampusTexto(val) {
    const clearBtn = document.getElementById('clear-campus-btn');
    if (clearBtn) clearBtn.style.display = val.length > 0 ? 'inline-block' : 'none';

    clearTimeout(debounceCampus);
    debounceCampus = setTimeout(() => {
        state.facultad = val.trim() || 'INGENIERIA';
        cargarSalas();
    }, 180);
}

function limpiarCampusTexto() {
    const input = document.getElementById('input-campus-search');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clear-campus-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    state.facultad = 'INGENIERIA';
    cargarSalas();
}

function setDia(val, btn) {
    if (typeof checkSolemneAutoSwitch === 'function') checkSolemneAutoSwitch(val);

    document.querySelectorAll('#bar-dia .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.dia = val;
    cargarSalas();
}

function setHora(val, btn) {
    document.querySelectorAll('#bar-hora .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.hora = val;
    cargarSalas();
}

async function cargarSalas() {
    if (!state.hora) {
        return;
    }

    try {
        const resp = await fetch(`/api/salas?dia=${state.dia}&hora=${encodeURIComponent(state.hora)}&facultad=${encodeURIComponent(state.facultad)}`);
        const data = await resp.json();

        const elLibres = document.getElementById('count-libres');
        if (elLibres) elLibres.textContent = data.total_libres;
        const elOcupadas = document.getElementById('count-ocupadas');
        if (elOcupadas) elOcupadas.textContent = data.total_ocupadas;

        const gridVacias = document.getElementById('grid-vacias');
        if (data.vacias.length === 0) {
            gridVacias.innerHTML = '<div class="empty-state">No se registraron salas libres para el criterio seleccionado.</div>';
        } else {
            const vaciasInfo = data.vacias_info || {};
            gridVacias.innerHTML = data.vacias.map(s => {
                const vinfo = vaciasInfo[s];
                const timeTxt = vinfo ? vinfo.texto : 'Libre';
                const proxTxt = (vinfo && vinfo.proximo_curso) ? `Próxima clase: <strong>${vinfo.proximo_curso}</strong>` : 'Sin más clases programadas hoy';

                return `
                    <div class="item-card free" onclick="verHorarioDirecto('${s}')" title="Ver horario semanal de ${s}">
                        <div class="item-top">
                            <span class="room-pill free">
                                <span class="pulse-dot"></span>
                                <span>${s}</span>
                            </span>
                            <span class="time-pill free">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                <span>${timeTxt}</span>
                            </span>
                        </div>
                        <div class="course-name" style="color: #34d399;">SALA DISPONIBLE</div>
                        <div class="item-meta">
                            <div>${proxTxt}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const gridOcupadas = document.getElementById('grid-ocupadas');
        const keys = Object.keys(data.ocupadas);
        if (keys.length === 0) {
            gridOcupadas.innerHTML = '<div class="empty-state">No hay clases registradas en este bloque.</div>';
        } else {
            gridOcupadas.innerHTML = keys.map(k => {
                const info = data.ocupadas[k];
                return `
                    <div class="item-card">
                        <div class="item-top">
                            <span class="room-pill" onclick="verHorarioDirecto('${k}')" title="Ver horario de esta sala">
                                <span class="status-dot occ"></span>
                                <span>${k}</span>
                            </span>
                            <span class="time-pill">${info.horario}</span>
                        </div>
                        <div class="course-name">${info.curso}</div>
                        <div class="item-meta">
                            <div>Profesor: <strong>${info.profe}</strong></div>
                            <span>Sección ${info.seccion} • Cód: ${info.codigo}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (e) {
        console.error(e);
    }
}

async function irABloqueActual(tipo = 'salas') {
    const bannerIdMap = {
        'salas': ['banner-alerta-horario', 'texto-alerta-horario'],
        'profes': ['banner-alerta-prof', 'texto-alerta-prof'],
        'ramos': ['banner-alerta-ramo', 'texto-alerta-ramo'],
        'malla': ['banner-alerta-malla', 'texto-alerta-malla'],
        'mihorario': ['banner-alerta-mihorario', 'texto-alerta-mihorario']
    };

    const [bId, tId] = bannerIdMap[tipo] || bannerIdMap['salas'];
    const banner = document.getElementById(bId);
    const alertaTxt = document.getElementById(tId);

    try {
        const resp = await fetch(`/api/ahora?facultad=${encodeURIComponent(state.facultad)}`);
        const data = await resp.json();
        
        const diaStr = String(data.dia);
        const rawHora = data.bloque.id;
        const horaActual = data.hora_actual || (data.hora_chile ? data.hora_chile.substring(0, 5) : new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));

        if (banner && alertaTxt) {
            if (!data.en_horario_valido) {
                alertaTxt.innerHTML = `<strong>Fuera de horario académico — ${horaActual} hrs.</strong><br>${data.mensaje_horario} Se muestra de referencia el primer bloque del día (${data.dia_nombre} ${data.bloque.label}).`;
                banner.classList.add('show');
            } else {
                banner.classList.remove('show');
            }
        }

        const coincideHora = (dh, th) => {
            if (!dh || !th) return false;
            return dh === th || dh.replace(/^0/, '') === th.replace(/^0/, '');
        };

        if (tipo === 'salas') {
            state.dia = diaStr;
            state.hora = rawHora;
            document.querySelectorAll('#bar-dia .pill-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.val === state.dia);
            });
            document.querySelectorAll('#bar-hora .pill-btn').forEach(b => {
                b.classList.toggle('active', coincideHora(b.dataset.val, state.hora));
            });
            cargarSalas();
        } else if (tipo === 'profes') {
            state.profDia = diaStr;
            document.querySelectorAll('#bar-prof-dia .pill-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.dia === state.profDia);
            });
            let horaSeleccionada = '';
            document.querySelectorAll('#bar-prof-hora .pill-btn').forEach(b => {
                const match = coincideHora(b.dataset.hora, rawHora);
                b.classList.toggle('active', match);
                if (match) horaSeleccionada = b.dataset.hora;
            });
            state.profHora = horaSeleccionada || rawHora;
            ejecutarBusquedaDocente();
        } else if (tipo === 'ramos') {
            state.ramoDia = diaStr;
            document.querySelectorAll('#bar-ramo-dia .pill-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.dia === state.ramoDia);
            });
            let horaSeleccionada = '';
            document.querySelectorAll('#bar-ramo-hora .pill-btn').forEach(b => {
                const match = coincideHora(b.dataset.hora, rawHora);
                b.classList.toggle('active', match);
                if (match) horaSeleccionada = b.dataset.hora;
            });
            state.ramoHora = horaSeleccionada || rawHora;
            ejecutarBusquedaRamo();
        } else if (tipo === 'malla') {
            state.mallaDia = diaStr;
            document.querySelectorAll('#bar-malla-dia .pill-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.dia === state.mallaDia);
            });
            let horaSeleccionada = '';
            document.querySelectorAll('#bar-malla-hora .pill-btn').forEach(b => {
                const match = coincideHora(b.dataset.hora, rawHora);
                b.classList.toggle('active', match);
                if (match) horaSeleccionada = b.dataset.hora;
            });
            state.mallaHora = horaSeleccionada || rawHora;
            cargarClasesMalla(false);
        } else if (tipo === 'mihorario') {
//            const diaNum = parseInt(diaStr, 10);
//            state.miHorarioDia = (diaNum >= 1 && diaNum <= 5) ? diaStr : '1';
//            document.querySelectorAll('#bar-mihorario-dia .pill-btn').forEach(b => {
//                b.classList.toggle('active', b.dataset.dia === state.miHorarioDia);
//            });
            renderMiHorario();
            setTimeout(() => {
                const activeCard = document.querySelector('.my-class-card.is-current-class') || document.querySelector('.my-timeline-card.is-current-class');
                if (activeCard) {
                    activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    } catch (e) {
        console.error(e);
    }
}

async function sincronizarDatos() {
    const btn = document.getElementById('btn-sync');
    if (btn) btn.classList.add('spinning');
    try {
        const resp = await fetch('/api/sync', { method: 'POST' });
        const data = await resp.json();
        if (btn) btn.classList.remove('spinning');
        if (data.status) {
            const lbl = document.getElementById('label-sync-count');
            if (lbl) lbl.textContent = `${data.status.total_classes} Clases`;
        }
        cargarSalas();
    } catch (e) {
        if (btn) btn.classList.remove('spinning');
        console.error(e);
    }
}

let debounceProf = null;
function setProfDia(diaVal, btn) {
    if (typeof checkSolemneAutoSwitch === "function") checkSolemneAutoSwitch(diaVal);
    document.querySelectorAll('#bar-prof-dia .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.profDia = diaVal;
    ejecutarBusquedaDocente();
}

function setProfHora(horaVal, btn) {
    if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        state.profHora = '';
    } else {
        document.querySelectorAll('#bar-prof-hora .pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.profHora = horaVal;
    }
    ejecutarBusquedaDocente();
}

function limpiarDocente() {
    const input = document.getElementById('input-prof-search');
    input.value = '';
    document.getElementById('clear-prof-btn').style.display = 'none';
    ejecutarBusquedaDocente();
}

function ejecutarBusquedaDocente() {
    const input = document.getElementById('input-prof-search');
    const q = input.value.trim();
    const clearBtn = document.getElementById('clear-prof-btn');
    clearBtn.style.display = q.length > 0 ? 'inline-block' : 'none';

    clearTimeout(debounceProf);
    debounceProf = setTimeout(async () => {
        const container = document.getElementById('prof-results-grid');
        if (q.length < 2) {
            container.innerHTML = '<div class="empty-state">Ingresa el nombre del profesor y elige el día para ver sus clases y salas asignadas.</div>';
            return;
        }

        container.innerHTML = '<div class="empty-state"><svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle; margin-right: 6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Buscando docente...</div>';
        try {
            const diaParam = state.profDia ? `&dia=${encodeURIComponent(state.profDia)}` : '';
            const horaParam = state.profHora ? `&hora=${encodeURIComponent(state.profHora)}` : '';
            const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}${diaParam}${horaParam}`);
            const data = await resp.json();

            if (!data.profesores || data.profesores.length === 0) {
                const diaMsg = state.profDia ? `para el día seleccionado` : '';
                const horaMsg = state.profHora ? ` en el horario seleccionado` : '';
                container.innerHTML = `<div class="empty-state">No se registraron clases para "${q}" ${diaMsg}${horaMsg}.</div>`;
                return;
            }

            container.innerHTML = data.profesores.map(p => `
                <div class="item-card prof">
                    <div class="item-top">
                        <span class="room-pill" onclick="verHorarioDirecto('${p.sala}')" title="Ver horario de esta sala">
                            <span class="status-dot occ"></span>
                            <span>${p.sala}</span>
                        </span>
                        <span class="time-pill" style="color:#c084fc; background: var(--purple-bg); border-color: rgba(168, 85, 247, 0.25);">${p.dia} ${p.hora_inicio} - ${p.hora_termino}</span>
                    </div>
                    <div class="course-name">${p.curso}</div>
                    <div class="item-meta">
                        <div>Profesor: <strong>${p.profe}</strong></div>
                        <span>Sección ${p.seccion} • Cód: ${p.codigo}</span>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = '<div class="empty-state">Error al consultar datos del docente.</div>';
        }
    }, 180);
}

let debounceRamo = null;
function setRamoDia(diaVal, btn) {
    if (typeof checkSolemneAutoSwitch === "function") checkSolemneAutoSwitch(diaVal);
    document.querySelectorAll('#bar-ramo-dia .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.ramoDia = diaVal;
    ejecutarBusquedaRamo();
}

function setRamoHora(horaVal, btn) {
    if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        state.ramoHora = '';
    } else {
        document.querySelectorAll('#bar-ramo-hora .pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.ramoHora = horaVal;
    }
    ejecutarBusquedaRamo();
}

function limpiarRamo() {
    const input = document.getElementById('input-ramo-search');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clear-ramo-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    ejecutarBusquedaRamo();
}

function ejecutarBusquedaRamo() {
    const input = document.getElementById('input-ramo-search');
    const q = input ? input.value.trim() : '';
    const clearBtn = document.getElementById('clear-ramo-btn');
    if (clearBtn) clearBtn.style.display = q.length > 0 ? 'inline-block' : 'none';

    clearTimeout(debounceRamo);
    debounceRamo = setTimeout(async () => {
        const container = document.getElementById('ramo-results-grid');
        if (!container) return;
        if (q.length < 2) {
            container.innerHTML = '<div class="empty-state">Ingresa el nombre de la asignatura o código (ej. Cálculo, CIT2010) para ver sus horarios y salas.</div>';
            return;
        }

        container.innerHTML = '<div class="empty-state"><svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle; margin-right: 6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Buscando asignaturas...</div>';
        try {
            const diaParam = state.ramoDia ? `&dia=${encodeURIComponent(state.ramoDia)}` : '';
            const horaParam = state.ramoHora ? `&hora=${encodeURIComponent(state.ramoHora)}` : '';
            const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}${diaParam}${horaParam}`);
            const data = await resp.json();
            const lista = data.ramos || data.cursos || [];

            if (lista.length === 0) {
                const diaMsg = state.ramoDia ? `para el día seleccionado` : '';
                const horaMsg = state.ramoHora ? ` en el horario seleccionado` : '';
                container.innerHTML = `<div class="empty-state">No se registraron asignaturas para "${q}" ${diaMsg}${horaMsg}.</div>`;
                return;
            }

            container.innerHTML = lista.map(r => `
                <div class="item-card ramo">
                    <div class="item-top">
                        <span class="room-pill" onclick="verHorarioDirecto('${r.sala}')" title="Ver horario de esta sala">
                            <span class="status-dot occ"></span>
                            <span>${r.sala}</span>
                        </span>
                        <span class="time-pill ramo-time">${r.dia} ${r.hora_inicio} - ${r.hora_termino}</span>
                    </div>
                    <div class="course-name">${r.curso}</div>
                    <div class="item-meta">
                        <div>Profesor: <strong>${r.profe}</strong></div>
                        <span>Sección ${r.seccion} • Cód: ${r.codigo}</span>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = '<div class="empty-state">Error al consultar datos de asignaturas.</div>';
        }
    }, 180);
}

let mallaRamosCache = [];

function toggleSemestreDropdown(event) {
    event.stopPropagation();
    const dd = document.getElementById('dropdown-semestre');
    if (dd) dd.classList.toggle('open');
}

function selectSemestreItem(sem, label) {
    const dd = document.getElementById('dropdown-semestre');
    if (dd) dd.classList.remove('open');
    const labelEl = document.getElementById('dropdown-semestre-label');
    if (labelEl) labelEl.textContent = label;
    document.querySelectorAll('#dropdown-semestre-menu .dropdown-item').forEach(item => {
        item.classList.toggle('active', item.dataset.sem === String(sem));
    });
    setMallaSemestre(sem);
}

document.addEventListener('click', function(e) {
    const dd = document.getElementById('dropdown-semestre');
    if (dd && !dd.contains(e.target)) {
        dd.classList.remove('open');
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const dd = document.getElementById('dropdown-semestre');
        if (dd) dd.classList.remove('open');
    }
});

function setMallaSemestre(sem) {
    state.mallaSemestre = String(sem);
    state.mallaRamo = '';
    
    // UI Updates
    document.querySelectorAll('#bar-malla-semestre .pill-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`#bar-malla-semestre .pill-btn[data-sem="${sem}"]`);
    if (btn) btn.classList.add('active');
    
    const input = document.getElementById('input-malla-search');
    const clearBtn = document.getElementById('clear-malla-btn');
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';

    cargarClasesMalla(true);
}

function setMallaDia(diaVal, btn) {
    if (typeof checkSolemneAutoSwitch === "function") checkSolemneAutoSwitch(diaVal);
    document.querySelectorAll('#bar-malla-dia .pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    state.mallaDia = diaVal;
    cargarClasesMalla(false);
}

function setMallaHora(horaVal, btn) {
    if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        state.mallaHora = '';
    } else {
        document.querySelectorAll('#bar-malla-hora .pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mallaHora = horaVal;
    }
    cargarClasesMalla(false);
}

function setMallaRamo(ramoVal, btn) {
    if (ramoVal && btn && btn.classList.contains('active')) {
        state.mallaRamo = '';
        document.querySelectorAll('#bar-malla-ramos .pill-btn').forEach(b => b.classList.remove('active'));
        const todosBtn = document.querySelector('#bar-malla-ramos .pill-btn[data-ramo=""]');
        if (todosBtn) todosBtn.classList.add('active');
    } else {
        document.querySelectorAll('#bar-malla-ramos .pill-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        state.mallaRamo = ramoVal;
    }
    
    const input = document.getElementById('input-malla-search');
    const clearBtn = document.getElementById('clear-malla-btn');
    if (input) input.value = state.mallaRamo || '';
    if (clearBtn) clearBtn.style.display = state.mallaRamo ? 'block' : 'none';
    
    cargarClasesMalla(false);
}

function filtrarSoloEsteRamo(ramoNombre) {
    state.mallaRamo = ramoNombre;
    document.querySelectorAll('#bar-malla-ramos .pill-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.ramo === ramoNombre);
    });
    
    const input = document.getElementById('input-malla-search');
    const clearBtn = document.getElementById('clear-malla-btn');
    if (input) input.value = state.mallaRamo || '';
    if (clearBtn) clearBtn.style.display = state.mallaRamo ? 'block' : 'none';
    
    cargarClasesMalla(false);
    const topEl = document.getElementById('bar-malla-ramos');
    if (topEl) topEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function cargarClasesMalla(refrescarChips = false) {
    mallaLoadedOnce = true;
    const container = document.getElementById('malla-results-grid');
    if (!container) return;
    
    container.innerHTML = '<div class="empty-state"><svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle; margin-right: 6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Obteniendo secciones...</div>';

    try {
        const semParam = `semestre=${encodeURIComponent(state.mallaSemestre)}`;
        const diaParam = state.mallaDia ? `&dia=${encodeURIComponent(state.mallaDia)}` : '';
        const ramoParam = state.mallaRamo ? `&ramo=${encodeURIComponent(state.mallaRamo)}` : '';
        const horaParam = state.mallaHora ? `&hora=${encodeURIComponent(state.mallaHora)}` : '';
        const resp = await fetch(`/api/malla?${semParam}${diaParam}${ramoParam}${horaParam}`);
        const data = await resp.json();

        // Actualizar chips de ramos del semestre si se requiere
        if (refrescarChips || !mallaRamosCache.length) {
            mallaRamosCache = data.ramos_del_semestre || [];
            const chipsContainer = document.getElementById('bar-malla-ramos');
            if (chipsContainer) {
                let chipsHtml = `<button type="button" class="pill-btn ${!state.mallaRamo ? 'active' : ''}" data-ramo="" onclick="setMallaRamo('', this)">Todos los ramos (${mallaRamosCache.length})</button>`;
                mallaRamosCache.forEach((r, idx) => {
                    if (idx % 4 === 3) {
                        chipsHtml += `<div class="pill-row-break"></div>`;
                    }
                    const isAct = state.mallaRamo === r;
                    chipsHtml += `<button type="button" class="pill-btn ${isAct ? 'active' : ''}" data-ramo="${r}" onclick="setMallaRamo('${r}', this)">${r}</button>`;
                });
                chipsContainer.innerHTML = chipsHtml;
            }
        }

        if (!data.clases || data.clases.length === 0) {
            const diaTxt = state.mallaDia ? ' para el día seleccionado' : '';
            const ramoTxt = state.mallaRamo ? ` de "${state.mallaRamo}"` : '';
            const horaTxt = state.mallaHora ? ' en el horario seleccionado' : '';
            container.innerHTML = `<div class="empty-state">No se registraron clases programadas en ${data.semestre_nombre}${ramoTxt}${diaTxt}${horaTxt}.</div>`;
            return;
        }

        container.innerHTML = data.clases.map(c => `
            <div class="item-card">
                <div class="item-top">
                    ${(c.sala || '').split(/[,/]+/).map(s => s.trim()).filter(s => s).map(s => `
                        <span class="room-pill" onclick="verHorarioDirecto('${s}')" title="Ver horario de la sala ${s}">
                            <span class="status-dot occ"></span>
                            <span>${s}</span>
                        </span>
                    `).join('')}
                    <span class="time-pill">${c.dia} ${c.hora_inicio} - ${c.hora_termino}</span>
                </div>
                <div class="course-name">${c.ramo_malla.toUpperCase()}</div>
                <div class="item-meta">
                    <div>Profesor: <strong>${c.profe}</strong></div>
                    <span>Sección ${c.seccion} • Cód: ${c.codigo}</span>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<div class="empty-state">Error al cargar información de la malla.</div>';
        console.error(e);
    }
}

let subFiltroSugeridas = 'TODAS';

function cambiarFiltroSugeridas(sub, btn) {
    subFiltroSugeridas = sub;
    document.querySelectorAll('.building-switch .switch-chip').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const input = document.getElementById('input-sala-search');
    filtrarSalasLista(input ? input.value : '');
}

function filtrarSalasLista(val) {
    const input = document.getElementById('input-sala-search');
    const q = (val || '').trim().toLowerCase();
    const clearBtn = document.getElementById('clear-sala-btn');
    if (clearBtn) clearBtn.style.display = q.length > 0 ? 'inline-block' : 'none';

    const container = document.getElementById('chips-salas');
    if (!container) return;

    let listaBase;
    if (q.length > 0) {
        // Si el usuario escribe una búsqueda, busca en todo el catálogo de salas
        listaBase = TODAS_LAS_SALAS.filter(s => s.toLowerCase().includes(q));
    } else {
        // Por defecto: Sugerencias exclusivas de Facultad de Ingeniería (Ejército E441 y Vergara V432)
        listaBase = TODAS_LAS_SALAS.filter(s => s.startsWith('E441') || s.startsWith('V432'));
        if (subFiltroSugeridas === 'E441') {
            listaBase = listaBase.filter(s => s.startsWith('E441'));
        } else if (subFiltroSugeridas === 'V432') {
            listaBase = listaBase.filter(s => s.startsWith('V432'));
        }
    }

    if (listaBase.length === 0) {
        container.innerHTML = '<span style="font-size: 12.5px; color: var(--text-sub); padding: 8px;">No se encontraron salas coincidentes.</span>';
        return;
    }

    container.innerHTML = listaBase.map(s => {
        const isE441 = s.startsWith('E441');
        const dotClass = isE441 ? 'chip-dot e441' : 'chip-dot v432';
        const isActive = s === state.salaActiva;
        return `
            <button type="button" class="room-chip ${isActive ? 'active' : ''}" data-sala="${s}" onclick="seleccionarSala('${s}')" title="${isE441 ? 'Ejército 441' : 'Vergara 432'}">
                <span class="${dotClass}"></span>
                <span>${s}</span>
            </button>
        `;
    }).join('');

    if (q.length > 0) {
        const exacta = listaBase.find(s => s.toLowerCase() === q);
        if (exacta) {
            seleccionarSala(exacta);
        }
    }
}

function setSalaDia(diaVal, btn) {
    if (typeof checkSolemneAutoSwitch === "function") checkSolemneAutoSwitch(diaVal);
    document.querySelectorAll('#bar-sala-dia .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.salaDia = diaVal;
    if (state.salaActiva) {
        renderizarHorarioSala(state.salaActiva);
    }
}

function limpiarSalaInput() {
    const input = document.getElementById('input-sala-search');
    if (input) input.value = '';
    filtrarSalasLista('');
}

function seleccionarSala(sala) {
    state.salaActiva = sala;
    const input = document.getElementById('input-sala-search');
    if (input) input.value = sala;
    document.querySelectorAll('.room-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.sala === sala);
    });
    renderizarHorarioSala(sala);
}

async function renderizarHorarioSala(sala) {
    const container = document.getElementById('timetable-display');
    container.innerHTML = '<div class="empty-state"><svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle; margin-right: 6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Obteniendo horario...</div>';
    try {
        const resp = await fetch(`/api/sala/${encodeURIComponent(sala)}`);
        const data = await resp.json();
        const diasNombres = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes" };
        
        const isE441 = sala.startsWith('E441');
        const campusLabel = isE441 ? 'Facultad de Ingeniería • Ejército 441' : (sala.startsWith('V432') ? 'Facultad de Ingeniería • Vergara 432' : 'Universidad Diego Portales');

        let html = `
            <div class="timetable-header-banner">
                <div class="timetable-title-group">
                    <span class="timetable-pill-tag">HORARIO Y PLANIFICACIÓN</span>
                    <div class="timetable-title-row">
                        <span class="timetable-room-indicator ${isE441 ? 'e441' : 'v432'}"></span>
                        <h3 class="timetable-room-title">${sala}</h3>
                    </div>
                </div>
                <div class="timetable-campus-pill">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <span>${campusLabel}</span>
                </div>
            </div>
        `;

        const diasAMostrar = state.salaDia ? [parseInt(state.salaDia)] : [1, 2, 3, 4, 5];

        const bloquesNormales = [
            { start: "08:30", finish: "09:50" },
            { start: "10:00", finish: "11:20" },
            { start: "11:30", finish: "12:50" },
            { start: "13:00", finish: "14:20" },
            { start: "14:30", finish: "15:50" },
            { start: "16:00", finish: "17:20" },
            { start: "17:25", finish: "18:45" }
        ];
        
        const bloquesSolemnes = [
            { start: "08:30", finish: "10:30" },
            { start: "10:45", finish: "12:45" },
            { start: "13:00", finish: "15:00" },
            { start: "15:15", finish: "17:15" },
            { start: "17:30", finish: "19:30" }
        ];

        const parseMin = (t) => {
            if (!t) return -1;
            const parts = t.split(':').map(Number);
            return (parts[0] || 0) * 60 + (parts[1] || 0);
        };

        for (let d of diasAMostrar) {
            const clasesDia = data.horario[d] || [];
            const tieneClasesHoy = clasesDia.length > 0;
            
            const matchedClases = new Set();
            let slotsHtml = '';

            const bloquesEstandar = (window.statusSolemnes && window.statusSolemnes[d]) ? bloquesSolemnes : bloquesNormales;
            bloquesEstandar.forEach(b => {
                const bStart = parseMin(b.start);
                const bEnd = parseMin(b.finish);

                const clasesBloque = clasesDia.filter(c => {
                    const cStart = parseMin(c.start);
                    return (cStart >= bStart - 10 && cStart < bEnd - 10) || c.start === b.start;
                });

                if (clasesBloque.length > 0) {
                    clasesBloque.forEach(c => {
                        matchedClases.add(c);
                        const hasTeacher = c.profe && c.profe.trim().length > 0 && c.profe.trim().toLowerCase() !== 'no informado';
                        slotsHtml += `
                            <div class="timetable-slot">
                                <div class="slot-time">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                    <span>${c.start} - ${c.finish}</span>
                                </div>
                                <div class="slot-details">
                                    <div class="slot-course-row">
                                        <span class="slot-course-title">${c.curso}</span>
                                        <span class="slot-meta-pill">Sec. ${c.seccion} • ${c.codigo}</span>
                                    </div>
                                    <div class="slot-teacher">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        <span>Profesor: ${hasTeacher ? `<strong>${c.profe.trim()}</strong>` : `<em class="teacher-empty">No informado</em>`}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                } else {
                    slotsHtml += `
                        <div class="timetable-slot slot-free">
                            <div class="slot-time">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                <span>${b.start} - ${b.finish}</span>
                            </div>
                            <div class="slot-details">
                                <div class="slot-free-row">
                                    <span class="pulse-dot"></span>
                                    <span class="slot-free-title">Sala Vacía</span>
                                    <span class="slot-free-tag">Disponible</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });

            // Clases fuera de bloques estándar si existieran
            clasesDia.forEach(c => {
                if (!matchedClases.has(c)) {
                    const hasTeacher = c.profe && c.profe.trim().length > 0 && c.profe.trim().toLowerCase() !== 'no informado';
                    slotsHtml += `
                        <div class="timetable-slot">
                            <div class="slot-time">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                <span>${c.start} - ${c.finish}</span>
                            </div>
                            <div class="slot-details">
                                <div class="slot-course-row">
                                    <span class="slot-course-title">${c.curso}</span>
                                    <span class="slot-meta-pill">Sec. ${c.seccion} • ${c.codigo}</span>
                                </div>
                                <div class="slot-teacher">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                    </svg>
                                    <span>Profesor: ${hasTeacher ? `<strong>${c.profe.trim()}</strong>` : `<em class="teacher-empty">No informado</em>`}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });

            html += `
                <div class="timetable-day-card ${tieneClasesHoy ? '' : 'free-day'}">
                    <div class="timetable-day-head">
                        <div class="day-title-group">
                            <span class="day-dot ${tieneClasesHoy ? '' : 'free'}"></span>
                            <span class="day-name">${diasNombres[d]}</span>
                        </div>
                        <span class="day-count-badge ${tieneClasesHoy ? '' : 'free'}">
                            ${tieneClasesHoy ? `
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                ${clasesDia.length} ${clasesDia.length === 1 ? 'clase' : 'clases'}
                            ` : `
                                <span class="pulse-dot"></span>
                                Libre (Sin clases)
                            `}
                        </span>
                    </div>
                    ${slotsHtml}
                </div>
            `;
        }

        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="empty-state">Error al cargar la información de la sala.</div>';
    }
}

function verHorarioDirecto(sala) {
    const tabBtn = document.querySelector('.tab-btn[onclick*="tab-horario"]');
    cambiarTab('tab-horario', tabBtn);
    seleccionarSala(sala);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
filtrarSalasLista('');

document.addEventListener('DOMContentLoaded', () => {
    // Sincronizar pills de día con el día actual (estado global)
    const syncPillBar = (barId, val) => {
        const bar = document.getElementById(barId);
        if (bar) {
            bar.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
            const btn = bar.querySelector(`[data-val="${val}"], [data-dia="${val}"]`);
            if (btn) btn.classList.add('active');
        }
    };
    if (typeof state !== 'undefined') {
        syncPillBar('bar-dia', state.dia);
        syncPillBar('bar-prof-dia', state.profDia);
        syncPillBar('bar-ramo-dia', state.ramoDia);
        syncPillBar('bar-sala-dia', state.salaDia);
        syncPillBar('bar-malla-dia', state.mallaDia);
    }

    fetchSolemnesStatus();
    inicializarMiHorario();
    const hash = window.location.hash.replace('#', '') || (new URLSearchParams(window.location.search)).get('tab');
    if (hash) {
        const btn = document.querySelector(`.tab-btn[onclick*="${hash}"]`);
        if (btn) cambiarTab(hash, btn);
    }
});

function toggleDropdown(id) {
    event.stopPropagation();
    document.querySelectorAll('.custom-dropdown').forEach(dd => {
        if (dd.id !== id) dd.classList.remove('open');
    });
    const dd = document.getElementById(id);
    if (dd) dd.classList.toggle('open');
}

function selectDropdownItem(dropdownId, value, label, callback) {
    const dd = document.getElementById(dropdownId);
    if (dd) dd.classList.remove('open');
    
    const labelEl = document.getElementById('label-' + dropdownId.replace('dd-', ''));
    if (labelEl) labelEl.textContent = label;
    
    const inputId = dropdownId.replace('dd-', '') + (dropdownId.includes('curso') ? '-select' : '');
    let inputEl = document.getElementById(inputId);
    if (!inputEl && dropdownId.startsWith('dd-agenda')) inputEl = document.getElementById(dropdownId.replace('dd-', ''));
    
    if (inputEl) {
        inputEl.value = value;
    }
    
    document.querySelectorAll(`#${dropdownId} .dropdown-item`).forEach(item => {
        item.classList.toggle('active', item.dataset.val === String(value));
    });
    
    if (callback && typeof callback === 'function') {
        callback();
    } else if (callback && typeof window[callback] === 'function') {
        window[callback]();
    }
}

document.addEventListener('click', function(e) {
    document.querySelectorAll('.custom-dropdown').forEach(dd => {
        if (!dd.contains(e.target)) {
            dd.classList.remove('open');
        }
    });
});

window.borrarCacheApp = function() {
    confirmarWeb("¿Estás seguro de que deseas borrar toda la caché de la aplicación? Esto restablecerá tu horario, progreso de malla y configuraciones locales.", () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload(true);
    }, 'Borrar caché local');
};

window.SOLEMNES_MODE = false;
function toggleSolemnesMode(isSolemne) {
    window.SOLEMNES_MODE = isSolemne;
    document.body.classList.toggle('solemne-mode', isSolemne);
    const normalBlocks = document.querySelectorAll('.normal-block');
    const solemneBlocks = document.querySelectorAll('.solemne-block');
    
    if (isSolemne) {
        normalBlocks.forEach(b => { b.style.display = 'none'; b.classList.remove('active'); });
        solemneBlocks.forEach(b => {
            b.style.display = 'inline-flex';
            if (b.dataset.val === '08:30:00_S') b.classList.add('active');
        });
    } else {
        solemneBlocks.forEach(b => { b.style.display = 'none'; b.classList.remove('active'); });
        normalBlocks.forEach(b => { b.style.display = 'inline-flex'; });
    }
    
    if (typeof state !== 'undefined') {
        state.hora = isSolemne ? '08:30:00_S' : '08:30:00';
        const barHora = document.getElementById('bar-hora');
        if (barHora) {
            const btns = barHora.querySelectorAll('.pill-btn');
            btns.forEach(btn => btn.classList.remove('active'));
            const activeBtn = barHora.querySelector(`[data-val="${state.hora}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }
    }
    
    // Clear active filters for other tabs (they are optional)
    if (window.filtrosGlobales) {
        window.filtrosGlobales.hora = "";
    }
    window.filtroProfHora = "";
    window.filtroRamoHora = "";
    window.filtroMallaHora = "";
    
    if (typeof fetchSalas === 'function') cargarSalas();
    if (typeof triggerProfSearch === 'function') triggerProfSearch();
    if (typeof triggerRamoSearch === 'function') triggerRamoSearch();
    if (typeof renderMalla === 'function') renderMalla();
    
    if (typeof renderMiHorario === 'function') {
        renderMiHorario();
    }
}

// Lógica de Scroll Horizontal de Pestañas con Rueda del Mouse
document.addEventListener('DOMContentLoaded', () => {
    const tabsWrapper = document.querySelector('.tabs-wrapper');
    if (!tabsWrapper) return;
});

function filtrarMallaTexto(val) {
    if (!val) {
        state.mallaRamo = '';
        document.querySelectorAll('#bar-malla-ramos .pill-btn').forEach(b => b.classList.remove('active'));
        const allBtn = document.querySelector('#bar-malla-ramos .pill-btn[data-ramo=""]');
        if (allBtn) allBtn.classList.add('active');
        const clearBtn = document.getElementById('clear-malla-btn');
        if (clearBtn) clearBtn.style.display = 'none';
        cargarClasesMalla(false);
        return;
    }
    
    const cleanVal = val.trim();
    state.mallaRamo = cleanVal;
    
    // UI Updates
    document.querySelectorAll('#bar-malla-ramos .pill-btn').forEach(b => b.classList.remove('active'));
    
    const clearBtn = document.getElementById('clear-malla-btn');
    if (clearBtn) clearBtn.style.display = 'block';
    
    cargarClasesMalla(false);
}

function limpiarMallaTexto() {
    const input = document.getElementById('input-malla-search');
    if (input) {
        input.value = '';
        filtrarMallaTexto('');
        input.focus();
    }
}

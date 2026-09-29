/* =========================================================
   TAB 6: MI HORARIO - DATOS Y LÓGICA REACTIVA EN TIEMPO REAL
   ========================================================= */

function cargarMiHorarioDesdeStorage() {
    let profile = null;
    try {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem('mi_horario_custom_v1');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) profile = { escuela: "EIT", clases: parsed }; else if (parsed && parsed.clases) profile = parsed;
            }
        }
    } catch (e) {
        console.error('Error al cargar mi horario desde localStorage', e);
    }
    if (!profile) {
        profile = JSON.parse(JSON.stringify(MI_HORARIO_DEFAULT_DATA));
    }
    // Limpiar "Ayudantía que impartes" y sincronizar secciones y profesores de ayudantías
    profile.clases.forEach(c => {
        if (c.seccion && c.seccion.toLowerCase().includes('ayudantía que impartes')) {
            c.seccion = '';
        }
        // Normalizar formato Sec. o Sec a Sección
        if (c.seccion) {
            if (c.seccion.toLowerCase().startsWith('sec.')) {
                c.seccion = c.seccion.replace(/^sec\.\s*/i, 'Sección ');
            } else if (c.seccion.toLowerCase().startsWith('sec ')) {
                c.seccion = c.seccion.replace(/^sec\s*/i, 'Sección ');
            }
        }
    });
    return profile;
}

let MI_HORARIO_DATA = cargarMiHorarioDesdeStorage();
let horarioAmigoComparacion = null;

function etiquetaBloqueHorario(clase) {
    const block = BLOQUES_HORARIOS && BLOQUES_HORARIOS.find(item => item.num === Number(clase.bloqueNum));
    return (block && block.label) || clase.bloqueLabel || '';
}

function guardarMiHorarioEnStorage() {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('mi_horario_custom_v1', JSON.stringify(MI_HORARIO_DATA));
        }
        if (window.PortalStore) window.PortalStore.save('schedule', MI_HORARIO_DATA);
    } catch (e) {
        console.error('Error al guardar mi horario en localStorage', e);
    }
    actualizarContadoresFiltrosMiHorario();
}


let miHorarioInitialized = false;

let miHorarioTimer = null;

function getChileTime() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Santiago',
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    }).formatToParts(now);

    let dayOfWeek = now.getDay();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();

    parts.forEach(p => {
        if (p.type === 'weekday') {
            const map = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 0 };
            if (map[p.value] !== undefined) dayOfWeek = map[p.value];
        } else if (p.type === 'hour') {
            hours = parseInt(p.value, 10);
        } else if (p.type === 'minute') {
            minutes = parseInt(p.value, 10);
        } else if (p.type === 'second') {
            seconds = parseInt(p.value, 10);
        }
    });

    const totalMinutes = hours * 60 + minutes;
    const totalSeconds = totalMinutes * 60 + seconds;
    return { dayOfWeek, hours, minutes, seconds, totalMinutes, totalSeconds };
}

function timeToMinutes(str) {
    if (!str) return 0;
    const [h, m] = str.split(':').map(Number);
    return h * 60 + (m || 0);
}

function inicializarMiHorario() {
    actualizarContadoresFiltrosMiHorario();
    if (!miHorarioInitialized) {
        miHorarioInitialized = true;
        renderMiHorario();
        actualizarHeroMiHorario();
        if (!miHorarioTimer) {
            miHorarioTimer = setInterval(actualizarHeroMiHorario, 1000);
        }
    } else {
        renderMiHorario();
        actualizarHeroMiHorario();
    }
}


function getHorarioActivo() {
    return MI_HORARIO_DATA.clases;
}

function actualizarHeroMiHorario() {
    const heroEl = document.getElementById('my-schedule-hero');
    if (!heroEl) return;

    if (horarioAmigoComparacion) {
        actualizarHeroHorarioComparado(heroEl, horarioAmigoComparacion);
        return;
    }
    
    const pill_style = 'background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; color: #f1f5f9;';
    
    const misClases = getHorarioActivo();
    if (!misClases || misClases.length === 0) {
        heroEl.innerHTML = `
            <div class="my-hero-top">
                <div class="my-hero-status-pill done">
                    <span class="pulse-dot"></span>
                    <span>Sin clases</span>
                </div>
            </div>
            <div class="my-hero-body">
                <div class="my-hero-class-info">
                    <div class="my-hero-title">No hay clases cargadas</div>
                </div>
            </div>`;
        return;
    }

    function getShortTipo(tipo) {
        if (!tipo) return '';
        const t = tipo.toLowerCase();
        if (t.includes('cátedra') || t.includes('catedra')) return 'Cát.';
        if (t.includes('ayudantía') || t.includes('ayudantia')) return 'Ayud.';
        if (t.includes('laboratorio')) return 'Lab.';
        return tipo;
    }

    function getColorClass(c) {
        if (!c) return '';
        if (c.rol === 'assistant') return 'assistant';
        if (c.tipo && c.tipo.toLowerCase().includes('laboratorio')) return 'laboratorio';
        if (c.tipo && c.tipo.toLowerCase().includes('ayudantía')) return 'ayudantia-student';
        return 'catedra';
    }

    function getEnTexto(c) {
        if (!c) return 'En clase';
        if (c.rol === 'assistant') return 'En ayudantía';
        if (c.tipo && c.tipo.toLowerCase().includes('laboratorio')) return 'En laboratorio';
        if (c.tipo && c.tipo.toLowerCase().includes('ayudantía')) return 'En ayudantía';
        return 'En cátedra';
    }

    // --- Obtener hora actual en Chile ---
    const chileTime = getChileTime();
    const nowDay  = chileTime.dayOfWeek;
    const nowMins = chileTime.hours * 60 + chileTime.minutes;

    // --- Clasificar clases del día actual ---
    const clasesHoy = misClases.filter(c => c.dia === nowDay);

    const claseActiva = clasesHoy.find(c => {
        const ini = timeToMinutes(c.horaInicio);
        const fin = timeToMinutes(c.horaFin);
        return nowMins >= ini && nowMins < fin;
    });

    // Cualquier clase pendiente hoy (sin importar cuánto falta)
    const proximaHoy = !claseActiva && clasesHoy.find(c => {
        const ini = timeToMinutes(c.horaInicio);
        return ini > nowMins;
    });

    const hayClasesHoy = clasesHoy.length > 0;
    const todasTerminaron = hayClasesHoy && clasesHoy.every(c => timeToMinutes(c.horaFin) <= nowMins);

    const proximaFutura = misClases.find(c => {
        return c.dia > nowDay;
    }) || misClases[0];

    let html = '';

    if (claseActiva) {
        const c = claseActiva;
        const ini = timeToMinutes(c.horaInicio);
        const fin = timeToMinutes(c.horaFin);
        const durTotal = fin - ini;
        const transcurrido = nowMins - ini;
        const progreso = Math.min(100, Math.round((transcurrido / durTotal) * 100));
        const quedan = fin - nowMins;

        html = `
            <div class="my-hero-top">
                <div class="my-hero-status-pill now ${getColorClass(c)}">
                    <span class="pulse-dot"></span>
                    <span>${getEnTexto(c)}</span>
                </div>
            </div>
            <div class="my-hero-body">
                <div class="my-hero-class-info">
                    <div class="my-hero-title" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                        <span>${escapeHtml(c.curso)}</span>
                    </div>
                    <div class="my-hero-subtitle">
                        ${c.sala ? `<span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><span>${c.sala}</span></span>` : ''}
                        <span class="hide-on-mobile" style="${pill_style}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>${etiquetaBloqueHorario(c)}</span>
                        ${c.rol !== 'assistant' ? `<span class="hide-on-mobile" style="${pill_style}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${c.profesor || '-'}</span>` : ''}
                        <span style="${pill_style}">Quedan <strong>${quedan}m</strong></span>
                    </div>
                </div>
            </div>
            <div class="my-hero-progress-container" title="Progreso de la clase: ${progreso}%">
                <div class="my-hero-progress-bar ${getColorClass(c)}" style="width: ${progreso}%;"></div>
            </div>`;

    } else if (proximaHoy) {
        const c = proximaHoy;
        const minsParaEmpezar = timeToMinutes(c.horaInicio) - nowMins;
        const hrs = Math.floor(minsParaEmpezar / 60);
        const mins = minsParaEmpezar % 60;
        const label = hrs > 0
            ? (mins > 0 ? `en ${hrs}h ${mins}m` : `en ${hrs}h`)
            : `en ${mins}m`;

        html = `
            <div class="my-hero-top">
                <div class="my-hero-status-pill now">
                    <span class="pulse-dot"></span>
                    <span>En ventana</span>
                </div>
            </div>
            <div class="my-hero-body">
                <div class="my-hero-class-info">
                    <div class="my-hero-title">Próxima clase ${label}</div>
                    <div class="my-hero-subtitle">
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding-top: 4px;">
                            <span>Tu próxima clase es <strong>${escapeHtml(c.curso)}</strong></span>
                            <span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg><span>${c.diaNombre} ${c.horaInicio}</span></span>
                            <span style="${pill_style}"><span class="hide-on-mobile">${c.tipo}</span><span class="show-mobile-inline">${getShortTipo(c.tipo)}</span></span>
                            ${c.sala ? `<span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><span>${c.sala}</span></span>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;

    } else if (todasTerminaron) {
        const c = proximaFutura;
        html = `
            <div class="my-hero-top">
                <div class="my-hero-status-pill done">
                    <span class="pulse-dot"></span>
                    <span>Fuera de jornada</span>
                </div>
            </div>
            <div class="my-hero-body">
                <div class="my-hero-class-info">
                    <div class="my-hero-title">No tienes más clases hoy</div>
                    <div class="my-hero-subtitle">
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding-top: 4px;">
                            <span>Tu próxima clase es <strong>${escapeHtml(c.curso)}</strong></span>
                            <span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg><span>${c.diaNombre} ${c.horaInicio}</span></span>
                            <span style="${pill_style}"><span class="hide-on-mobile">${c.tipo}</span><span class="show-mobile-inline">${getShortTipo(c.tipo)}</span></span>
                            ${c.sala ? `<span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><span>${c.sala}</span></span>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;

    } else {
        const c = proximaFutura;
        html = `
            <div class="my-hero-top">
                <div class="my-hero-status-pill done">
                    <span class="pulse-dot"></span>
                    <span>Fin de semana</span>
                </div>
            </div>
            <div class="my-hero-body">
                <div class="my-hero-class-info">
                    <div class="my-hero-title">Descanso de fin de semana!</div>
                    <div class="my-hero-subtitle">
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding-top: 4px;">
                            <span>Tu próxima clase es <strong>${escapeHtml(c.curso)}</strong></span>
                            <span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg><span>${c.diaNombre} ${c.horaInicio}</span></span>
                            <span style="${pill_style}"><span class="hide-on-mobile">${c.tipo}</span><span class="show-mobile-inline">${getShortTipo(c.tipo)}</span></span>
                            ${c.sala ? `<span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><span>${c.sala}</span></span>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
    }

    heroEl.innerHTML = html;
}

function actualizarHeroHorarioComparado(heroEl, comparison) {
    const classes = comparison.clases.slice().sort((a, b) =>
        Number(a.dia) - Number(b.dia) || timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio)
    );
    const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const now = getChileTime();
    const today = classes.filter(item => Number(item.dia) === now.dayOfWeek);
    const active = today.find(item => now.totalMinutes >= timeToMinutes(item.horaInicio) && now.totalMinutes < timeToMinutes(item.horaFin));
    const nextToday = today.find(item => timeToMinutes(item.horaInicio) > now.totalMinutes);
    const previousToday = today.filter(item => timeToMinutes(item.horaFin) <= now.totalMinutes)
        .sort((a, b) => timeToMinutes(b.horaFin) - timeToMinutes(a.horaFin))[0];
    const nextClass = nextToday || classes.find(item => Number(item.dia) > now.dayOfWeek) || classes[0];
    const pillStyle = 'background:rgba(255,255,255,.08);padding:4px 9px;border-radius:8px;font-size:12px;color:#cbd5e1;';
    const formatDuration = totalMinutes => {
        const minutes = Math.max(0, totalMinutes);
        const hours = Math.floor(minutes / 60);
        const remainder = minutes % 60;
        return hours ? `${hours} h${remainder ? ` ${remainder} min` : ''}` : `${minutes} min`;
    };
    const durationLabel = item => formatDuration(timeToMinutes(item.horaFin) - timeToMinutes(item.horaInicio));
    const classDetails = item => `
        <span class="friend-hero-detail">${escapeHtml(item.curso || 'Clase')}</span>
        <span class="friend-hero-meta">${escapeHtml(item.horaInicio)}–${escapeHtml(item.horaFin)}${item.sala ? ` · ${escapeHtml(item.sala)}` : ''}</span>
        <span style="${pillStyle}">Duración ${durationLabel(item)}</span>`;

    if (!classes.length) {
        heroEl.innerHTML = '<div class="my-hero-top"><div class="my-hero-status-pill done"><span>Sin clases</span></div></div><div class="my-hero-title">Esta persona todavía no tiene clases en su horario.</div>';
        return;
    }

    let status;
    let details;
    if (active) {
        const minutesLeft = timeToMinutes(active.horaFin) - now.totalMinutes;
        status = `En clase · quedan ${formatDuration(minutesLeft)}`;
        details = classDetails(active);
    } else if (nextToday) {
        const minutesToNext = timeToMinutes(nextToday.horaInicio) - now.totalMinutes;
        const countdown = minutesToNext >= 60
            ? `${Math.floor(minutesToNext / 60)} h${minutesToNext % 60 ? ` ${minutesToNext % 60} min` : ''}`
            : `${minutesToNext} min`;
        if (previousToday) {
            const windowMinutes = timeToMinutes(nextToday.horaInicio) - timeToMinutes(previousToday.horaFin);
            const windowHours = Math.floor(windowMinutes / 60);
            const windowRemainder = windowMinutes % 60;
            const windowLabel = windowHours ? `${windowHours} h${windowRemainder ? ` ${windowRemainder} min` : ''}` : `${windowMinutes} min`;
            status = `En ventana · ${windowLabel}`;
        } else {
            status = `Primera clase en ${countdown}`;
        }
        details = `<span>Próxima clase de ${escapeHtml(comparison.nombre)} en ${countdown}</span>${classDetails(nextToday)}`;
    } else if (today.length) {
        status = 'Terminó sus clases por hoy';
        details = nextClass ? `<span>Próxima clase · ${escapeHtml(dayNames[nextClass.dia] || '')} ${classDetails(nextClass)}</span>` : '';
    } else {
        status = 'Sin clases hoy';
        details = nextClass ? `<span>Próxima clase · ${escapeHtml(dayNames[nextClass.dia] || '')} ${classDetails(nextClass)}</span>` : '';
    }

    heroEl.innerHTML = `
        <div class="my-hero-top"><div class="my-hero-status-pill ${status.startsWith('En clase') || status.startsWith('En ventana') ? 'now' : status.startsWith('Primera clase') ? 'next' : 'done'}">${escapeHtml(status)}</div></div>
        <div class="my-hero-body"><div class="my-hero-class-info"><div class="my-hero-title">Horario de ${escapeHtml(comparison.nombre)}</div>
        <div class="my-hero-subtitle friend-hero-details">${details}</div></div></div>`;
}


function setMiHorarioRol(rolVal, btn) {
    document.querySelectorAll('#bar-mihorario-rol .pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    state.miHorarioRol = rolVal;
    renderMiHorario();
}

function filtrarMiHorarioTexto(val) {
    state.miHorarioSearch = (val || '').trim().toLowerCase();
    const clearBtn = document.getElementById('clear-mihorario-btn');
    if (clearBtn) clearBtn.style.display = state.miHorarioSearch.length > 0 ? 'inline-block' : 'none';
    renderMiHorario();
}

function limpiarMiHorarioTexto() {
    const inp = document.getElementById('input-mihorario-search');
    if (inp) inp.value = '';
    filtrarMiHorarioTexto('');
}

function normStr(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function actualizarContadoresFiltrosMiHorario() {
    const total = getHorarioActivo().length;
    const lunes = getHorarioActivo().filter(c => c.dia === 1).length;
    const martes = getHorarioActivo().filter(c => c.dia === 2).length;
    const miercoles = getHorarioActivo().filter(c => c.dia === 3).length;
    const jueves = getHorarioActivo().filter(c => c.dia === 4).length;
    const viernes = getHorarioActivo().filter(c => c.dia === 5).length;

    const bSemana = document.querySelector('#bar-mihorario-dia button[data-dia="ALL"]');
    if (bSemana) bSemana.textContent = `Toda la semana (${total})`;
    const bLunes = document.querySelector('#bar-mihorario-dia button[data-dia="1"]');
    if (bLunes) bLunes.textContent = `Lunes (${lunes})`;
    const bMartes = document.querySelector('#bar-mihorario-dia button[data-dia="2"]');
    if (bMartes) bMartes.textContent = `Martes (${martes})`;
    const bMiercoles = document.querySelector('#bar-mihorario-dia button[data-dia="3"]');
    if (bMiercoles) bMiercoles.textContent = `Miércoles (${miercoles})`;
    const bJueves = document.querySelector('#bar-mihorario-dia button[data-dia="4"]');
    if (bJueves) bJueves.textContent = `Jueves (${jueves})`;
    const bViernes = document.querySelector('#bar-mihorario-dia button[data-dia="5"]');
    if (bViernes) bViernes.textContent = `Viernes (${viernes})`;
}

function eliminarClaseMiHorario(id, ev) {
    if (ev) ev.stopPropagation();
    const idx = MI_HORARIO_DATA.clases.findIndex(c => c.id === id);
    if (idx === -1) return;
    const c = MI_HORARIO_DATA.clases[idx];
    confirmarWeb(`¿Eliminar "${c.curso}" de este bloque (${c.diaNombre} ${etiquetaBloqueHorario(c)})?`, () => {
        MI_HORARIO_DATA.clases.splice(idx, 1);
        guardarMiHorarioEnStorage();
        renderMiHorario();
        actualizarHeroMiHorario();
        mostrarToast(`"${c.curso}" eliminada de tu horario`);
    }, 'Eliminar clase');
}

let modalRolSeleccionado = 'student';
let modalClasesRealesBloqueActual = [];
let modalBusquedaRealTimeout = null;

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function setModalRol(rol) {
    modalRolSeleccionado = rol;
    const btnEst = document.getElementById('btn-modal-rol-student');
    const btnAyu = document.getElementById('btn-modal-rol-assistant');
    if (btnEst && btnAyu) {
        if (rol === 'assistant') {
            btnEst.classList.remove('active');
            btnAyu.classList.add('active');
        } else {
            btnEst.classList.add('active');
            btnAyu.classList.remove('active');
        }
    }
}

function setModalTipo(tipo, btn) {
    const inpTipo = document.getElementById('modal-add-tipo');
    if (inpTipo) inpTipo.value = tipo;
    const container = document.getElementById('modal-tipo-pills');
    if (container) {
        container.querySelectorAll('.my-tipo-pill').forEach(b => b.classList.remove('active'));
    }
    if (btn) {
        btn.classList.add('active');
    } else if (container) {
        const pills = container.querySelectorAll('.my-tipo-pill');
        pills.forEach(p => {
            const txt = p.textContent.trim().toLowerCase();
            const dtipo = (p.dataset.tipo || '').trim().toLowerCase();
            const target = (tipo || '').trim().toLowerCase();
            if (txt === target || dtipo === target || (target.startsWith('lab') && (txt === 'lab' || dtipo.startsWith('lab'))) || (target.startsWith('estud') && (txt === 'estudio' || dtipo.startsWith('estud')))) {
                p.classList.add('active');
            }
        });
    }
}

function abrirSalasDropdown() {
    const inp = document.getElementById('modal-add-sala');
    filtrarSalasDropdown(inp ? inp.value : '');
}

function filtrarSalasDropdown(val) {
    const dropdown = document.getElementById('modal-salas-dropdown');
    if (!dropdown) return;
    if (typeof TODAS_LAS_SALAS === 'undefined' || !Array.isArray(TODAS_LAS_SALAS)) {
        dropdown.style.display = 'none';
        return;
    }

    const q = (val || '').trim().toLowerCase();
    let matches = [];
    if (!q) {
        matches = TODAS_LAS_SALAS.slice(0, 20);
    } else {
        matches = TODAS_LAS_SALAS.filter(s => s.toLowerCase().includes(q)).slice(0, 20);
    }

    if (matches.length === 0) {
        dropdown.innerHTML = `<div style="padding: 10px 12px; font-size: 12px; color: #94a3b8; text-align: center;">No hay salas que coincidan</div>`;
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML = matches.map(s => `
        <div class="my-dropdown-item" onclick="seleccionarSalaModal('${escapeHtml(s)}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; margin-right:6px; vertical-align:middle; opacity:0.75;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
            <span>${escapeHtml(s)}</span>
        </div>
    `).join('');
    dropdown.style.display = 'block';
}

function seleccionarSalaModal(sala) {
    const inpSala = document.getElementById('modal-add-sala');
    if (inpSala) {
        inpSala.value = sala;
        inpSala.classList.add('field-autofilled');
        setTimeout(() => inpSala.classList.remove('field-autofilled'), 1200);
    }
    const dropdown = document.getElementById('modal-salas-dropdown');
    if (dropdown) dropdown.style.display = 'none';
}

// Cerrar dropdown de salas al hacer clic afuera
if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function(ev) {
        const dropdown = document.getElementById('modal-salas-dropdown');
        const inpSala = document.getElementById('modal-add-sala');
        if (dropdown && dropdown.style.display !== 'none') {
            if (!dropdown.contains(ev.target) && ev.target !== inpSala) {
                dropdown.style.display = 'none';
            }
        }
    });
}

function abrirModalAgregarClase(diaNum, bloqueNum) {
    const bloque = BLOQUES_HORARIOS.find(b => b.num === bloqueNum);
    const diasNombres = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const diaNombre = diasNombres[diaNum] || 'Día';
    const horaInicio = bloque ? bloque.inicio : '08:30';

    const inpDia = document.getElementById('modal-add-dia');
    const inpBloque = document.getElementById('modal-add-bloque');
    const inpHora = document.getElementById('modal-add-hora-inicio');
    const badge = document.getElementById('modal-bloque-badge');

    if (inpDia) inpDia.value = diaNum;
    if (inpBloque) inpBloque.value = bloqueNum;
    if (inpHora) inpHora.value = horaInicio;
    if (badge) badge.textContent = `${diaNombre} • Bloque ${bloqueNum} (${bloque ? bloque.label : ''})`;

    const inpCurso = document.getElementById('modal-add-curso');
    const inpSala = document.getElementById('modal-add-sala');
    const inpSec = document.getElementById('modal-add-seccion');
    const inpProf = document.getElementById('modal-add-profesor');
    const inpSearchReal = document.getElementById('modal-input-real-search');
    const clearBtn = document.getElementById('modal-clear-real-btn');
    const dropdown = document.getElementById('modal-salas-dropdown');

    if (inpCurso) inpCurso.value = '';
    if (inpSala) inpSala.value = '';
    if (inpSec) inpSec.value = ''; // Sin hardcodear Sec. 1
    if (inpProf) inpProf.value = '';
    if (inpSearchReal) inpSearchReal.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (dropdown) dropdown.style.display = 'none';

    setModalTipo('Cátedra');
    setModalRol('student');

    // Cargar clases reales de este bloque desde data.json vía /api/search
    cargarClasesRealesBloque(diaNum, horaInicio);

    const modal = document.getElementById('modal-agregar-ramo');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            if (inpSearchReal) inpSearchReal.focus();
        }, 60);
    }
}

function cerrarModalAgregarClase() {
    const modal = document.getElementById('modal-agregar-ramo');
    if (modal) modal.style.display = 'none';
    const dropdown = document.getElementById('modal-salas-dropdown');
    if (dropdown) dropdown.style.display = 'none';
}

async function cargarClasesRealesBloque(diaNum, horaInicio) {
    const listEl = document.getElementById('modal-real-classes-list');
    const badgeEl = document.getElementById('modal-real-badge');
    if (!listEl) return;

    listEl.innerHTML = `
        <div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
            <span><svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle; margin-right: 6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Obteniendo clases...</span>
        </div>
    `;

    try {
        const resp = await fetch(`/api/search?dia=${diaNum}&hora=${encodeURIComponent(horaInicio + ':00')}`);
        if (!resp.ok) throw new Error('Error al cargar');
        const data = await resp.json();
        modalClasesRealesBloqueActual = data.cursos || [];
        if (badgeEl) badgeEl.textContent = `${modalClasesRealesBloqueActual.length} clases en bloque`;
        renderListaClasesRealesModal(modalClasesRealesBloqueActual, false);
    } catch (err) {
        console.error('Error cargando clases reales:', err);
        listEl.innerHTML = `<div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 12px;">No se pudieron cargar clases sugeridas para este bloque. Puedes ingresarlas manualmente abajo.</div>`;
        if (badgeEl) badgeEl.textContent = '0 clases';
    }
}

function renderListaClasesRealesModal(lista, esBusquedaGlobal) {
    const listEl = document.getElementById('modal-real-classes-list');
    if (!listEl) return;

    if (!lista || lista.length === 0) {
        listEl.innerHTML = `
            <div style="padding: 14px; text-align: center; color: #94a3b8; font-size: 12px;">
                No se encontraron clases coincidentes. Puedes completar los campos manualmente.
            </div>
        `;
        return;
    }

    listEl.innerHTML = lista.map(c => {
        const cursoNombre = escapeHtml(c.curso || 'Asignatura');
        const sala = escapeHtml(c.sala || 'Sin sala');
        const rawSec = (c.seccion !== undefined && c.seccion !== null && c.seccion !== '') ? String(c.seccion).trim() : '';
        const sec = rawSec ? (rawSec.toLowerCase().startsWith('secc') ? rawSec : (rawSec.toLowerCase().startsWith('sec') ? rawSec.replace(/^sec\.?\s*/i, 'Sección ') : `Sección ${rawSec}`)) : '';
        const profe = escapeHtml(c.profe || '');
        const codigo = escapeHtml(c.codigo || '');
        const objSafe = JSON.stringify(c).replace(/"/g, '&quot;');

        return `
            <div class="my-real-class-item" onclick="seleccionarClaseRealPorObj(${objSafe})">
                <div class="my-real-item-info">
                    <div class="my-real-item-title">${cursoNombre}</div>
                    <div class="my-real-item-meta">
                        <span class="my-real-item-chip" style="color: #60a5fa; border-color: rgba(59,130,246,0.35); background: rgba(59,130,246,0.12);">${sala}</span>
                        ${sec ? `<span class="my-real-item-chip">${escapeHtml(sec)}</span>` : ''}
                        ${codigo ? `<span class="my-real-item-chip" style="opacity: 0.8;">${codigo}</span>` : ''}
                        ${profe ? `<span style="font-size: 11.5px; opacity: 0.88; color: #cbd5e1;">${profe}</span>` : ''}
                    </div>
                </div>
                <div class="my-real-select-btn">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>Elegir</span>
                </div>
            </div>
        `;
    }).join('');
}

function filtrarClasesRealesModal(query) {
    const clearBtn = document.getElementById('modal-clear-real-btn');
    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

    if (modalBusquedaRealTimeout) clearTimeout(modalBusquedaRealTimeout);

    const q = (query || '').trim();
    const diaNum = document.getElementById('modal-add-dia').value;
    const horaInicio = document.getElementById('modal-add-hora-inicio').value;
    const badgeEl = document.getElementById('modal-real-badge');

    if (!q) {
        if (badgeEl) badgeEl.textContent = `${modalClasesRealesBloqueActual.length} clases en bloque`;
        renderListaClasesRealesModal(modalClasesRealesBloqueActual, false);
        return;
    }

    modalBusquedaRealTimeout = setTimeout(async () => {
        // 1. Filtrar primero dentro de las clases de este bloque en memoria
        const normQ = normStr(q);
        const matchesLocal = modalClasesRealesBloqueActual.filter(c => {
            return normStr(c.curso || '').includes(normQ) ||
                   normStr(c.codigo || '').includes(normQ) ||
                   normStr(c.profe || '').includes(normQ) ||
                   normStr(c.sala || '').includes(normQ);
        });

        if (matchesLocal.length > 0) {
            if (badgeEl) badgeEl.textContent = `${matchesLocal.length} en este bloque`;
            renderListaClasesRealesModal(matchesLocal, false);
            return;
        }

        // 2. Si no hay en este bloque exacto, buscar en toda la base de cursos
        const listEl = document.getElementById('modal-real-classes-list');
        if (listEl) {
            listEl.innerHTML = `<div style="padding: 12px; text-align:center; color:#94a3b8; font-size:12px;">Buscando en toda la base de datos...</div>`;
        }

        try {
            const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            if (!resp.ok) throw new Error('Error al buscar');
            const data = await resp.json();
            const cursos = data.cursos || [];
            if (badgeEl) badgeEl.textContent = `${cursos.length} cursos disponibles`;
            renderListaClasesRealesModal(cursos.slice(0, 30), true);
        } catch (err) {
            console.error('Error buscando clases:', err);
        }
    }, 200);
}

function limpiarBusquedaRealModal() {
    const inp = document.getElementById('modal-input-real-search');
    if (inp) inp.value = '';
    filtrarClasesRealesModal('');
    if (inp) inp.focus();
}

function seleccionarClaseRealPorObj(c) {
    if (!c) return;

    const inpCurso = document.getElementById('modal-add-curso');
    const inpSala = document.getElementById('modal-add-sala');
    const inpSec = document.getElementById('modal-add-seccion');
    const inpProf = document.getElementById('modal-add-profesor');

    if (inpCurso) {
        inpCurso.value = c.curso || '';
        inpCurso.classList.add('field-autofilled');
        setTimeout(() => inpCurso.classList.remove('field-autofilled'), 1200);
    }

    if (inpSala) {
        inpSala.value = (c.sala && c.sala !== '-') ? c.sala : '';
        inpSala.classList.add('field-autofilled');
        setTimeout(() => inpSala.classList.remove('field-autofilled'), 1200);
    }

    if (inpSec) {
        const numSec = (c.seccion !== undefined && c.seccion !== null) ? String(c.seccion).trim() : '';
        inpSec.value = numSec ? (numSec.toLowerCase().startsWith('secc') ? numSec : (numSec.toLowerCase().startsWith('sec') ? numSec.replace(/^sec\.?\s*/i, 'Sección ') : `Sección ${numSec}`)) : '';
        inpSec.classList.add('field-autofilled');
        setTimeout(() => inpSec.classList.remove('field-autofilled'), 1200);
    }

    if (inpProf) {
        inpProf.value = c.profe || '';
        inpProf.classList.add('field-autofilled');
        setTimeout(() => inpProf.classList.remove('field-autofilled'), 1200);
    }

    // Detección automática de tipo
    const lowerCurso = (c.curso || '').toLowerCase();
    let tipoDetectado = 'Cátedra';
    if (lowerCurso.includes('ayudant')) tipoDetectado = 'Ayudantía';
    else if (lowerCurso.includes('laborat') || lowerCurso.includes('lab.')) tipoDetectado = 'Laboratorio';
    else if (lowerCurso.includes('taller')) tipoDetectado = 'Taller';
    else if (lowerCurso.includes('estudio')) tipoDetectado = 'Estudio';

    setModalTipo(tipoDetectado);

    mostrarToast(`¡Autocompletado con ${c.curso}!`);
}

function guardarNuevaClaseModal(ev) {
    if (ev) ev.preventDefault();
    const diaNum = parseInt(document.getElementById('modal-add-dia').value, 10);
    const bloqueNum = parseInt(document.getElementById('modal-add-bloque').value, 10);
    const curso = (document.getElementById('modal-add-curso').value || '').trim();
    const sala = (document.getElementById('modal-add-sala').value || '').trim().toUpperCase();
    const seccion = (document.getElementById('modal-add-seccion').value || '').trim();
    const tipo = (document.getElementById('modal-add-tipo').value || 'Cátedra').trim();
    const profesor = (document.getElementById('modal-add-profesor').value || '').trim();
    const rol = modalRolSeleccionado;

    if (!curso) {
        mostrarAlertaWeb('Por favor escribe el nombre de la asignatura.', 'Falta la asignatura', 'error');
        document.getElementById('modal-add-curso').focus();
        return;
    }
    if (!sala) {
        mostrarAlertaWeb('Por favor ingresa la sala asignada (ej. E441.2.S201).', 'Falta la sala', 'error');
        document.getElementById('modal-add-sala').focus();
        return;
    }

    const bloque = BLOQUES_HORARIOS.find(b => b.num === bloqueNum);
    const diasNombres = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

    // Si ya existía alguna clase en este bloque exacto, se reemplaza
    MI_HORARIO_DATA.clases = MI_HORARIO_DATA.clases.filter(c => !(c.dia === diaNum && c.bloqueNum === bloqueNum));

    const nuevaClase = {
        id: 'custom-' + Date.now(),
        dia: diaNum,
        diaNombre: diasNombres[diaNum] || 'Día',
        bloqueNum: bloqueNum,
        bloqueLabel: bloque ? bloque.label : '08:30 - 09:50',
        horaInicio: bloque ? bloque.inicio : '08:30',
        horaFin: bloque ? bloque.fin : '09:50',
        curso: curso,
        tipo: tipo,
        seccion: seccion,
        sala: sala,
        profesor: profesor,
        rol: rol
    };

    MI_HORARIO_DATA.clases.push(nuevaClase);
    guardarMiHorarioEnStorage();
    cerrarModalAgregarClase();
    renderMiHorario();
    actualizarHeroMiHorario();
    mostrarToast(`"${curso}" guardada en ${diasNombres[diaNum]} Bloque ${bloqueNum}`);
}

function mostrarToast(mensaje) {
    let t = document.getElementById('my-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'my-toast';
        t.className = 'my-toast';
        document.body.appendChild(t);
    }
    t.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>${mensaje}</span>
    `;
    t.classList.add('show');
    if (window._toastTimeout) clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
        t.classList.remove('show');
    }, 2800);
}

const BLOQUES_NORMALES = [
    { num: 1, label: '08:30 - 09:50', inicio: '08:30', fin: '09:50' },
    { num: 2, label: '10:00 - 11:20', inicio: '10:00', fin: '11:20' },
    { num: 3, label: '11:30 - 12:50', inicio: '11:30', fin: '12:50' },
    { num: 4, label: '13:00 - 14:20', inicio: '13:00', fin: '14:20' },
    { num: 5, label: '14:30 - 15:50', inicio: '14:30', fin: '15:50' },
    { num: 6, label: '16:00 - 17:20', inicio: '16:00', fin: '17:20' },
    { num: 7, label: '17:30 - 18:50', inicio: '17:30', fin: '18:50' }
];
const BLOQUES_SOLEMNES = [
    { num: 1, label: '08:30 - 10:30', inicio: '08:30', fin: '10:30' },
    { num: 2, label: '10:45 - 12:45', inicio: '10:45', fin: '12:45' },
    { num: 3, label: '13:00 - 15:00', inicio: '13:00', fin: '15:00' },
    { num: 4, label: '15:15 - 17:15', inicio: '15:15', fin: '17:15' },
    { num: 5, label: '17:30 - 19:30', inicio: '17:30', fin: '19:30' }
];

const BLOQUES_HORARIOS = BLOQUES_NORMALES;

function normalizarClasesAmigo(clases) {
    const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    return clases.map(item => {
        const start = String(item.horaInicio || '').slice(0, 5);
        const savedBlock = BLOQUES_HORARIOS.find(block => block.num === Number(item.bloqueNum));
        const block = savedBlock || bloqueHorarioMasCercano(start);
        return {
            ...item,
            dia: Number(item.dia),
            diaNombre: item.diaNombre || days[Number(item.dia)] || '',
            bloqueNum: block.num,
            bloqueLabel: block.label,
            horaInicio: block.inicio,
            horaFin: block.fin
        };
    });
}

function renderMiHorario() {
    const container = document.getElementById('mihorario-display-container');
    if (!container) return;

    const { dayOfWeek, totalMinutes } = getChileTime();

    const comparison = horarioAmigoComparacion;
    // En el modo de otra persona, la grilla contiene exclusivamente sus clases.
    let items = comparison ? [] : getHorarioActivo().filter(c => {
        if (state.miHorarioRol !== 'ALL' && c.rol !== state.miHorarioRol) return false;
        if (state.miHorarioSearch) {
            const s = normStr(state.miHorarioSearch);
            const matchCurso = normStr(c.curso).includes(s);
            const matchSala = normStr(c.sala).includes(s);
            const matchProf = normStr(c.profesor).includes(s);
            const matchTipo = normStr(c.tipo).includes(s);
            if (!matchCurso && !matchSala && !matchProf && !matchTipo) return false;
        }
        return true;
    });
    const friendItems = comparison ? normalizarClasesAmigo(comparison.clases).map((item, index) => ({ ...item, isFriend: true, id: `friend-${index}` })) : [];

    // Vista de toda la semana (5 Columnas)
        const diasConfig = [
            { num: 1, nombre: 'Lunes' },
            { num: 2, nombre: 'Martes' },
            { num: 3, nombre: 'Miércoles' },
            { num: 4, nombre: 'Jueves' },
            { num: 5, nombre: 'Viernes' }
        ];

        let colsHtml = '';
        diasConfig.forEach(d => {
            const dayItems = items.filter(c => c.dia === d.num);
            const friendDayItems = friendItems.filter(c => c.dia === d.num);
            const isToday = (dayOfWeek === d.num);

            let cardsHtml = '';
            BLOQUES_HORARIOS.forEach(b => {
                const slotItems = [
                    ...dayItems.filter(item => Number(item.bloqueNum) === b.num),
                    ...friendDayItems.filter(item => item.bloqueNum === b.num)
                ];
                const startM = timeToMinutes(b.inicio);
                const endM = timeToMinutes(b.fin);
                const isCurrent = isToday && (totalMinutes >= startM && totalMinutes < endM);

                if (slotItems.length) {
                    slotItems.forEach(c => {
                    const tipoCls = 'tipo-' + (c.tipo || 'Cátedra').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                    let cleanSec = (c.seccion || '').trim();
                    if (cleanSec.toLowerCase().startsWith('sec.')) {
                        cleanSec = cleanSec.replace(/^sec\.\s*/i, 'Sección ');
                    } else if (cleanSec.toLowerCase().startsWith('sec ')) {
                        cleanSec = cleanSec.replace(/^sec\s*/i, 'Sección ');
                    }
                    const secText = `<span class="my-type-sec">• ${escapeHtml(cleanSec && !cleanSec.toLowerCase().includes('ayudantía que impartes') ? cleanSec : 'Sección -')}</span>`;
                    const tipoHtml = `<span class="my-type-tag ${tipoCls}"><span>${escapeHtml(c.tipo || 'Cátedra')}</span>${secText}</span>`;

                    cardsHtml += `
                        <div class="my-class-card ${tipoCls} ${c.isFriend ? 'is-friend-overlay' : (c.rol === 'assistant' ? 'is-assistant' : 'is-student')} ${isCurrent ? 'is-current-class' : ''}" ${c.isFriend ? '' : `id="card-${c.id}"`}>
                            <div class="my-card-header">
                                <span class="my-card-time">
                                    ${isCurrent ? '<span class="pulse-dot-white"></span>' : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'}
                                    <span>${c.isFriend ? c.bloqueLabel : etiquetaBloqueHorario(c)}</span>
                                </span>
                                ${c.isFriend ? `<span class="my-card-origin-tag">${escapeHtml(comparison.nombre)}</span>` : comparison ? '<span class="my-card-origin-tag">Tu clase</span>' : `<button type="button" class="my-btn-delete" onclick="eliminarClaseMiHorario('${c.id}', event)" title="Eliminar asignatura de este bloque">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>`}
                            </div>
                            <div class="my-card-title">${escapeHtml(c.curso)}</div>
                            <div class="my-card-meta">
                                ${tipoHtml}
                                <span class="my-prof-name" title="Docente: ${escapeHtml(c.profesor || '-')}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> <span>${escapeHtml(c.profesor || '-')}</span></span>
                            </div>
                            <div class="my-card-footer">
                                ${(c.sala || '').split(/[,/]+/).map(s => s.trim()).filter(s => s).map(s => `
                                <span class="my-room-pill" ${c.isFriend ? '' : `onclick="verHorarioDirecto('${s}')"`} title="Sala ${s}">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                                    <span>${escapeHtml(s)}</span>
                                </span>
                                `).join('')}
                                <span class="my-card-bloque-num">Bloque ${c.bloqueNum}</span>
                            </div>
                        </div>
                    `;
                    });
                } else {
                    cardsHtml += comparison ? `
                        <div class="my-empty-slot is-comparison-empty">
                            <div class="my-empty-header"><span class="my-empty-time"><span>${b.label}</span></span><span class="my-card-bloque-num">Bloque ${b.num}</span></div>
                            <div class="my-empty-body"><span class="my-empty-text">Sin clases</span></div>
                        </div>
                    ` : `
                        <div class="my-empty-slot ${isCurrent ? 'is-current-empty' : ''}" onclick="abrirModalAgregarClase(${d.num}, ${b.num})" title="Haz clic para agregar una asignatura en este bloque (${b.label})">
                            <div class="my-empty-header">
                                <span class="my-empty-time">
                                    ${isCurrent ? '<span class="pulse-dot-white"></span>' : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'}
                                    <span>${b.label}</span>
                                </span>
                                <span class="my-card-bloque-num">Bloque ${b.num}</span>
                            </div>
                            <div class="my-empty-body">
                                <span class="my-empty-text">Sin clases</span>
                                <span class="my-empty-add-hint">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Agregar ramo
                                </span>
                            </div>
                        </div>
                    `;
                }
            });

            colsHtml += `
                <div class="my-day-col ${isToday ? 'is-today-col' : ''}" id="my-day-col-${d.num}">
                    <div class="my-day-header">
                        <div class="my-day-title-box">
                            <span class="my-day-title">${d.nombre}</span>
                            ${isToday ? '<span class="my-today-chip">Hoy</span>' : ''}
                        </div>
                        <span class="my-day-count">${comparison ? friendDayItems.length : dayItems.length}</span>
                    </div>
                    <div class="my-day-cards">
                        ${cardsHtml}
                    </div>
                </div>
            `;
        });

        container.innerHTML = `
            ${comparison ? `<div class="schedule-comparison-banner"><div><strong>Horario de ${escapeHtml(comparison.nombre)}</strong><span>Vista de solo lectura</span></div><button type="button" onclick="cerrarComparacionHorario()">Volver a mi horario</button></div>` : ''}
            <div class="my-week-grid ${comparison ? 'is-comparison-view' : ''}">
                ${colsHtml}
            </div>
        `;
//    }
}

window.mostrarHorarioAmigoEnMiHorario = function (schedule) {
    if (!schedule || !Array.isArray(schedule.clases)) return;
    horarioAmigoComparacion = { nombre: String(schedule.nombre || 'tu amigo'), clases: normalizarClasesAmigo(schedule.clases) };
    renderMiHorario();
    actualizarHeroMiHorario();
    const container = document.getElementById('mihorario-display-container');
    if (container && container.scrollIntoView) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.cerrarComparacionHorario = function () {
    horarioAmigoComparacion = null;
    renderMiHorario();
    actualizarHeroMiHorario();
    if (document.dispatchEvent && typeof CustomEvent !== 'undefined') {
        document.dispatchEvent(new CustomEvent('portal:community-schedule-closed'));
    }
};


let horarioSincronizado = false;
async function autoSyncHorario() {
    if (horarioSincronizado || !MI_HORARIO_DATA.clases.length) return;
    const targetObj = MI_HORARIO_DATA;
    
    try {
        const resp = await fetch('/api/sync_horario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clases: targetObj.clases })
        });
        
        if (resp.ok) {
            const nuevasClases = await resp.json();
            if (nuevasClases && nuevasClases.length > 0) {
                targetObj.clases = nuevasClases;
                horarioSincronizado = true;
                guardarMiHorarioEnStorage();
                renderMiHorario(); // Re-renderizar con salas actualizadas
            }
        }
    } catch(e) {
        console.error("Error sincronizando horario:", e);
    }
}

// Auto-sync al cargar
setTimeout(() => autoSyncHorario(), 1500);

document.addEventListener('DOMContentLoaded', () => {
    if (window.PortalStore) window.PortalStore.register('schedule', 'mi_horario_custom_v1', MI_HORARIO_DEFAULT_DATA);
});
document.addEventListener('portal:remote-state', event => {
    if (event.detail.module !== 'schedule') return;
    MI_HORARIO_DATA = event.detail.payload;
    renderMiHorario();
});

function seleccionarFotoHorario() {
    const input = document.getElementById('schedule-import-file');
    if (!input) return;
    if (!window.PortalAuth || !window.PortalAuth.client) {
        mostrarEstadoImportacionHorario('La importación requiere iniciar sesión.', true);
        return;
    }
    input.click();
}

function mostrarEstadoImportacionHorario(message, isError = false) {
    const status = document.getElementById('schedule-import-status');
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', Boolean(isError));
}

async function importarHorarioDesdeFoto(event) {
    const input = event && event.target;
    const file = input && input.files && input.files[0];
    if (!file) return;
    const button = document.getElementById('schedule-import-button');
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes((file.type || '').toLowerCase())) {
        mostrarEstadoImportacionHorario('Elige una foto JPG, PNG, WebP o HEIC.', true);
        input.value = '';
        return;
    }
    if (file.size > 9 * 1024 * 1024) {
        mostrarEstadoImportacionHorario('La imagen debe pesar menos de 9 MB.', true);
        input.value = '';
        return;
    }
    const auth = window.PortalAuth;
    if (!auth || !auth.client) {
        mostrarEstadoImportacionHorario('La importación requiere iniciar sesión.', true);
        input.value = '';
        return;
    }

    if (button) {
        button.disabled = true;
        button.classList.add('is-loading');
    }
    mostrarEstadoImportacionHorario('Leyendo la foto con Gemini…');
    try {
        const sessionResult = await auth.client.auth.getSession();
        const session = sessionResult.data && sessionResult.data.session;
        const token = session && session.access_token;
        if (sessionResult.error || !token) throw new Error('Tu sesión venció. Inicia sesión otra vez.');
        const form = new FormData();
        form.append('image', file, file.name || 'horario');
        const response = await fetch('/api/import_schedule', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token },
            body: form
        });
        let result = {};
        try { result = await response.json(); } catch (_error) {}
        if (!response.ok) throw new Error(result.error || 'No se pudo leer la foto. Inténtalo de nuevo.');
        if (!Array.isArray(result.clases) || !result.clases.length) {
            throw new Error('No se detectaron clases completas en la imagen.');
        }
        cargarHorarioImportado(result.clases);
    } catch (error) {
        mostrarEstadoImportacionHorario(error.message || 'No se pudo importar el horario.', true);
    } finally {
        if (button) {
            button.disabled = false;
            button.classList.remove('is-loading');
        }
        if (input) input.value = '';
    }
}

function bloqueHorarioMasCercano(hora) {
    const minutos = timeToMinutes(hora);
    if (minutos === null) return BLOQUES_HORARIOS[0];
    return BLOQUES_HORARIOS.reduce((closest, block) =>
        Math.abs(timeToMinutes(block.inicio) - minutos) < Math.abs(timeToMinutes(closest.inicio) - minutos) ? block : closest
    , BLOQUES_HORARIOS[0]);
}

function cargarHorarioImportado(clasesDetectadas) {
    if (!Array.isArray(clasesDetectadas) || !clasesDetectadas.length) return;
    const days = [[], [], [], [], [], []];
    clasesDetectadas.forEach(item => {
        const day = Number(item.dia);
        if (day >= 1 && day <= 5) days[day].push(item);
    });
    const imported = [];
    const types = ['Cátedra', 'Ayudantía', 'Laboratorio', 'Taller', 'Estudio'];
    days.forEach((items, day) => {
        items.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
        items.forEach((item, index) => {
            const sourceType = String(item.tipo || '').toLocaleLowerCase('es');
            const tipo = types.find(value => sourceType.includes(value.toLocaleLowerCase('es'))) || 'Cátedra';
            const bloque = bloqueHorarioMasCercano(item.horaInicio);
            imported.push({
                id: 'import-' + Date.now() + '-' + day + '-' + index,
                dia: day,
                diaNombre: item.diaNombre,
                bloqueNum: bloque.num,
                bloqueLabel: bloque.label,
                horaInicio: bloque.inicio,
                horaFin: bloque.fin,
                curso: item.curso,
                tipo: tipo,
                seccion: item.seccion || '',
                sala: item.sala || '',
                profesor: item.profesor || '',
                rol: 'student'
            });
        });
    });
    MI_HORARIO_DATA = { ...MI_HORARIO_DATA, clases: imported };
    guardarMiHorarioEnStorage();
    renderMiHorario();
    actualizarHeroMiHorario();
    const scheduleDisplay = document.getElementById('mihorario-display-container');
    if (scheduleDisplay) scheduleDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
    mostrarEstadoImportacionHorario('');
    mostrarToast('Horario cargado: ' + imported.length + ' clases.');
}

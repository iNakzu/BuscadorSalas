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
    let changed = quitarBloqueLabels(profile.clases);
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
    changed = rellenarSeccionesMismoRamo(profile.clases) || changed;
    if (changed && typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem('mi_horario_custom_v1', JSON.stringify(profile));
        } catch (e) {
            console.error('Error al limpiar etiquetas redundantes del horario local', e);
        }
    }
    return profile;
}

function quitarBloqueLabels(clases) {
    if (!Array.isArray(clases)) return false;
    let changed = false;
    clases.forEach(clase => {
        if (clase && Object.prototype.hasOwnProperty.call(clase, 'bloqueLabel')) {
            delete clase.bloqueLabel;
            changed = true;
        }
    });
    return changed;
}

let MI_HORARIO_DATA = cargarMiHorarioDesdeStorage();
let horarioPerfilSeleccionado = null;

function etiquetaBloqueHorario(clase) {
    const block = BLOQUES_HORARIOS && BLOQUES_HORARIOS.find(item => item.num === Number(clase.bloqueNum));
    return (block && block.label) || (clase.horaInicio && clase.horaFin ? `${clase.horaInicio} - ${clase.horaFin}` : '');
}

function guardarMiHorarioEnStorage() {
    let remoteSave = null;
    try {
        quitarBloqueLabels(MI_HORARIO_DATA && MI_HORARIO_DATA.clases);
        rellenarSeccionesMismoRamo(MI_HORARIO_DATA && MI_HORARIO_DATA.clases);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('mi_horario_custom_v1', JSON.stringify(MI_HORARIO_DATA));
        }
        if (window.PortalStore) remoteSave = window.PortalStore.save('schedule', MI_HORARIO_DATA);
    } catch (e) {
        console.error('Error al guardar mi horario en localStorage', e);
    }
    actualizarContadoresFiltrosMiHorario();
    if (typeof CustomEvent === 'function') document.dispatchEvent(new CustomEvent('portal:schedule-updated'));
    return remoteSave;
}

window.portalGetSchedulePushData = () => (MI_HORARIO_DATA && Array.isArray(MI_HORARIO_DATA.clases) ? MI_HORARIO_DATA.clases : [])
    .map(clase => ({ day: Number(clase.dia), time: String(clase.horaInicio || '').slice(0, 5) }));


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

    const pill_style = 'background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; color: #f1f5f9;';
    
    const misClases = horarioPerfilSeleccionado || getHorarioActivo();
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
                    <div class="my-hero-subtitle">Importa una foto de tu horario para comenzar.</div>
                </div>
            </div>`;
        return;
    }

    function getShortTipo(tipo) {
        if (!tipo) return '';
        const t = normalizarTipoClase(tipo).toLocaleLowerCase('es');
        if (t.includes('cátedra') || t.includes('catedra')) return 'Cát.';
        if (t.includes('ayudantía') || t.includes('ayudantia')) return 'Ayud.';
        if (t.includes('laboratorio')) return 'Lab.';
        return tipo;
    }

    function getColorClass(c) {
        if (!c) return '';
        if (c.rol === 'assistant') return 'assistant';
        const tipo = normalizarTipoClase(c.tipo).toLocaleLowerCase('es');
        if (tipo.includes('laboratorio')) return 'laboratorio';
        if (tipo.includes('ayudantía') || tipo.includes('ayudantia')) return 'ayudantia-student';
        return 'catedra';
    }

    function getEnTexto(c) {
        if (!c) return 'En clase';
        if (c.rol === 'assistant') return 'Dando ayudantía';
        const tipo = normalizarTipoClase(c.tipo).toLocaleLowerCase('es');
        if (tipo.includes('laboratorio')) return 'En laboratorio';
        if (tipo.includes('ayudantía') || tipo.includes('ayudantia')) return 'En ayudantía';
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
    const hayClaseFinalizadaHoy = clasesHoy.some(c =>
        timeToMinutes(c.horaInicio) < nowMins && timeToMinutes(c.horaFin) <= nowMins
    );
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
                        <span class="my-course-display">${escapeHtml(getCourseDisplay(c))}</span>
                    </div>
                    <div class="my-hero-subtitle">
                        ${c.sala ? `<span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><span>${escapeHtml(c.sala)}</span></span>` : ''}
                        <span class="hide-on-mobile" style="${pill_style}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>${escapeHtml(etiquetaBloqueHorario(c))}</span>
                        ${c.rol !== 'assistant' ? `<span class="hide-on-mobile" style="${pill_style}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${escapeHtml(c.profesor || '-')}</span>` : ''}
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
        const tiempoLibre = hrs > 0
            ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`)
            : `${mins} min`;
        const tituloProximaClase = hayClaseFinalizadaHoy
            ? `Tienes ${tiempoLibre} libre${minsParaEmpezar === 1 ? '' : 's'}`
            : `Comienza ${label}`;

        html = `
            <div class="my-hero-top">
                <div class="my-hero-status-pill ${hayClaseFinalizadaHoy ? 'now' : 'next'}">
                    <span class="pulse-dot"></span>
                    <span>${hayClaseFinalizadaHoy ? 'En ventana' : 'Clase hoy'}</span>
                </div>
            </div>
            <div class="my-hero-body">
                <div class="my-hero-class-info">
                    <div class="my-hero-title">${tituloProximaClase}</div>
                    <div class="my-hero-subtitle">
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding-top: 4px;">
                            <span>Tienes clase de <strong class="my-course-display">${escapeHtml(getCourseDisplay(c))}</strong></span>
                            <span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg><span>${escapeHtml(c.diaNombre)} ${escapeHtml(c.horaInicio)}</span></span>
                            <span style="${pill_style}">${escapeHtml(c.rol === 'assistant' ? 'Ayudante' : getShortTipo(c.tipo))}</span>
                            ${c.sala ? `<span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><span>${escapeHtml(c.sala)}</span></span>` : ''}
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
                            <span>Tu próxima clase es <strong class="my-course-display">${escapeHtml(getCourseDisplay(c))}</strong></span>
                            <span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg><span>${escapeHtml(c.diaNombre)} ${escapeHtml(c.horaInicio)}</span></span>
                            <span style="${pill_style}">${escapeHtml(c.rol === 'assistant' ? 'Ayudante' : getShortTipo(c.tipo))}</span>
                            ${c.sala ? `<span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><span>${escapeHtml(c.sala)}</span></span>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;

    } else {
        const c = proximaFutura;
        const estadoSinClase = nowDay >= 1 && nowDay <= 5 ? 'Sin clases hoy' : 'Fin de semana';
        html = `
            <div class="my-hero-top">
                <div class="my-hero-status-pill done">
                    <span class="pulse-dot"></span>
                    <span>${estadoSinClase}</span>
                </div>
            </div>
            <div class="my-hero-body">
                <div class="my-hero-class-info">
                    <div class="my-hero-title">Hoy toca descansar</div>
                    <div class="my-hero-subtitle">
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding-top: 4px;">
                            <span>Tu próxima clase es <strong class="my-course-display">${escapeHtml(getCourseDisplay(c))}</strong></span>
                            <span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg><span>${escapeHtml(c.diaNombre)} ${escapeHtml(c.horaInicio)}</span></span>
                            <span style="${pill_style}">${escapeHtml(c.rol === 'assistant' ? 'Ayudante' : getShortTipo(c.tipo))}</span>
                            ${c.sala ? `<span style="${pill_style}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><span>${escapeHtml(c.sala)}</span></span>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
    }

    heroEl.innerHTML = html;
}

function setMiHorarioRol(rolVal, btn) {
    document.querySelectorAll('#bar-mihorario-rol .pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    state.miHorarioRol = rolVal;
    renderMiHorario();
}

function normStr(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatCourseTitle(value) {
    const text = String(value || '').trim().replace(/\s*:\s*/g, ': ');
    if (!text) return '';
    const connectors = new Set(['a', 'al', 'con', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'lo', 'los', 'o', 'para', 'por', 'sí', 'un', 'una', 'y']);
    const words = text.split(/\s+/);
    const allCapsSource = words.filter(word => /[\p{L}]/u.test(word)).every(word => word === word.toLocaleUpperCase('es'));
    return words.map((word, index) => {
        if (connectors.has(word.toLocaleLowerCase('es'))) {
            const lower = word.toLocaleLowerCase('es');
            return index > 0 ? lower : lower.replace(/^([\p{L}])/u, initial => initial.toLocaleUpperCase('es'));
        }
        if (index > 0 && word.toLocaleLowerCase('es') === 'mismo' && words[index - 1].toLocaleLowerCase('es') === 'sí') return 'mismo';
        if (index > 0 && words[index - 1].endsWith(':')) {
            if ((!allCapsSource && /^[A-ZÁÉÍÓÚÜÑ]{2,6}$/.test(word)) || (allCapsSource && /^[A-ZÁÉÍÓÚÜÑ]{2,3}$/.test(word))) return word;
            return word.toLocaleLowerCase('es').replace(/^([\p{L}])/u, initial => initial.toLocaleUpperCase('es'));
        }
        if ((!allCapsSource && /^[A-ZÁÉÍÓÚÜÑ]{2,6}$/.test(word)) || (allCapsSource && /^[A-ZÁÉÍÓÚÜÑ]{2,3}$/.test(word))) return word;
        return word.toLocaleLowerCase('es').replace(/^([\p{L}])/u, initial => initial.toLocaleUpperCase('es'));
    }).join(' ');
}

function getCourseDisplay(clase) {
    return String(clase && (clase.cursoDisplay || clase.curso_display) || '').trim() || formatCourseTitle(clase && clase.curso);
}

function normalizarTipoClase(tipo) {
    const value = String(tipo || '').trim();
    return !value || value.toLocaleLowerCase('es') === 'estudio' ? 'Cátedra' : value;
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

function eliminarClaseMiHorario(id, ev, afterDelete) {
    if (ev) ev.stopPropagation();
    const idx = MI_HORARIO_DATA.clases.findIndex(c => c.id === id);
    if (idx === -1) return;
    MI_HORARIO_DATA.clases.splice(idx, 1);
    guardarMiHorarioEnStorage();
    if (typeof afterDelete === 'function') afterDelete();
    renderMiHorario();
    actualizarHeroMiHorario();
}

let modalRolSeleccionado = 'student';
let modalBusquedaProfesorTimeout = null;
let modalProfesorRequestId = 0;
let modalScrollY = null;
let modalCenteringResizeHandler = null;

function centrarEditorEnContenido() {
    const modal = document.getElementById('modal-agregar-ramo');
    const dialog = modal ? modal.querySelector('.my-modal-dialog') : null;
    if (!dialog) return;
    if (window.innerWidth < 1024) {
        dialog.style.left = '';
        dialog.style.position = '';
        dialog.style.width = '';
        return;
    }
    const main = document.querySelector('.container > main');
    if (!main) return;
    const bounds = main.getBoundingClientRect();
    const centerOffset = ((bounds.left + bounds.right) / 2) - (window.innerWidth / 2);
    dialog.style.position = 'relative';
    dialog.style.left = Math.round(centerOffset) + 'px';
    dialog.style.width = Math.round(Math.min(bounds.width * 0.95, 980)) + 'px';
}

function bloquearScrollFondoHorario() {
    if (modalScrollY !== null || !document.body) return;
    modalScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = '-' + modalScrollY + 'px';
    document.body.classList.add('schedule-modal-open');
}

function restaurarScrollFondoHorario() {
    if (modalScrollY === null || !document.body) return;
    const scrollY = modalScrollY;
    modalScrollY = null;
    document.body.classList.remove('schedule-modal-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
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

function horarioJsArg(value) {
    return escapeHtml(JSON.stringify(String(value == null ? '' : value)));
}

function setModalRol(rol) {
    modalRolSeleccionado = rol === 'assistant' ? 'assistant' : 'student';
    const input = document.getElementById('modal-add-rol');
    const label = document.getElementById('label-modal-rol');
    const dropdown = document.getElementById('dd-modal-rol');
    const typeDropdown = document.getElementById('dd-modal-tipo');
    const typeTrigger = document.getElementById('modal-label-tipo');
    const typeLabel = document.getElementById('label-modal-tipo');
    const typeLock = document.getElementById('modal-tipo-lock');
    if (input) input.value = modalRolSeleccionado;
    if (label) label.textContent = modalRolSeleccionado === 'assistant' ? 'Ayudante' : 'Estudiante';
    if (typeDropdown) typeDropdown.classList.toggle('is-locked', modalRolSeleccionado === 'assistant');
    if (typeTrigger) {
        typeTrigger.disabled = modalRolSeleccionado === 'assistant';
        typeTrigger.setAttribute('aria-disabled', String(modalRolSeleccionado === 'assistant'));
    }
    if (typeLock) typeLock.hidden = modalRolSeleccionado !== 'assistant';
    const typeInput = document.getElementById('modal-add-tipo');
    if (typeLabel) typeLabel.textContent = modalRolSeleccionado === 'assistant' ? '' : (typeInput && typeInput.value || 'Cátedra');
    if (dropdown) {
        dropdown.classList.remove('open');
        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.toggle('active', item.dataset.val === modalRolSeleccionado);
        });
    }
}

function setModalTipo(tipo) {
    if (modalRolSeleccionado === 'assistant') return;
    tipo = normalizarTipoClase(tipo);
    const inpTipo = document.getElementById('modal-add-tipo');
    if (inpTipo) inpTipo.value = tipo;
    const label = document.getElementById('label-modal-tipo');
    const dropdown = document.getElementById('dd-modal-tipo');
    if (label) label.textContent = tipo || 'Cátedra';
    if (dropdown) {
        dropdown.classList.remove('open');
        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.toggle('active', item.dataset.val === tipo);
        });
    }
}

function setModalSelectValue(dropdownId, inputId, labelId, value, placeholder, displayValue) {
    const selectedValue = String(value || '').trim();
    const dropdown = document.getElementById(dropdownId);
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    if (input) input.value = selectedValue;
    if (label) {
        label.textContent = selectedValue ? String(displayValue || selectedValue) : placeholder;
    }
    if (dropdown) {
        dropdown.classList.remove('open');
        dropdown.querySelectorAll('.dropdown-item[data-val]').forEach(item => {
            item.classList.toggle('active', item.dataset.val === selectedValue);
        });
    }
}

function abrirSalasDropdown() {
    const list = document.getElementById('modal-salas-options');
    if (!list) return;
    const selectedInput = document.getElementById('modal-add-sala');
    const selected = selectedInput ? selectedInput.value : '';
    const rooms = typeof TODAS_LAS_SALAS !== 'undefined' && Array.isArray(TODAS_LAS_SALAS)
        ? TODAS_LAS_SALAS.map(room => String(room || '').trim()).filter(Boolean) : [];
    const buildings = ['E441', 'V432'];
    const orderedRooms = buildings.reduce((ordered, building) => {
        const buildingRooms = [...new Set(rooms.filter(room =>
            new RegExp('^' + building + '(?:\\.|$)', 'i').test(room)
        ))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }));
        return ordered.concat(buildingRooms);
    }, []);
    const roomOptions = orderedRooms.map(room =>
        '<button class="dropdown-item' + (room === selected ? ' active' : '') + '" data-val="' + escapeHtml(room) +
        '" onclick="seleccionarSalaModal(' + horarioJsArg(room) + ')" role="option" type="button">' + escapeHtml(room) + '</button>'
    ).join('');
    const noRoomOption = '<button class="dropdown-item' + (!selected ? ' active' : '') +
        '" data-val="" onclick="seleccionarSalaModal(\'\')" role="option" type="button">-</button>';
    list.innerHTML = noRoomOption + (roomOptions ||
        '<div class="my-modal-select-message">No hay salas disponibles en E441 o V432</div>');
}

function seleccionarSalaModal(sala) {
    setModalSelectValue('dd-modal-sala', 'modal-add-sala', 'label-modal-sala', sala, '-');
}

function abrirProfesoresDropdown() {
    const search = document.getElementById('modal-profesor-search');
    if (search) search.value = '';
    buscarProfesoresModal('');
}

function buscarProfesoresModal(query) {
    if (modalBusquedaProfesorTimeout) clearTimeout(modalBusquedaProfesorTimeout);
    const list = document.getElementById('modal-profesores-options');
    const q = String(query || '').trim();
    const requestId = ++modalProfesorRequestId;
    if (!list) return;
    if (q.length < 2) {
        const selectedInput = document.getElementById('modal-add-profesor');
        list.innerHTML = '<button class="dropdown-item' + (!(selectedInput && selectedInput.value) ? ' active' : '') +
            '" data-val="" onclick="seleccionarProfesorModal(\'\')" role="option" type="button">Sin profesor</button>' +
            '<div class="my-modal-select-message">Escribe al menos 2 letras para buscar</div>';
        return;
    }

    list.innerHTML = '<div class="my-modal-select-message">Buscando docentes…</div>';
    modalBusquedaProfesorTimeout = setTimeout(async () => {
        try {
            const response = await fetch('/api/search?q=' + encodeURIComponent(q));
            if (!response.ok) throw new Error('No se pudo buscar');
            const data = await response.json();
            if (requestId !== modalProfesorRequestId) return;
            const selectedInput = document.getElementById('modal-add-profesor');
            const selected = selectedInput ? selectedInput.value : '';
            const names = [...new Set((data.profesores || [])
                .map(item => String(item.profe || '').trim())
                .filter(Boolean))].slice(0, 12);
            const options = names.map(name =>
                '<button class="dropdown-item' + (name === selected ? ' active' : '') + '" data-val="' +
                escapeHtml(name) + '" onclick="seleccionarProfesorModal(' + horarioJsArg(name) +
                ')" role="option" type="button">' + escapeHtml(name) + '</button>'
            );
            options.unshift('<button class="dropdown-item' + (!selected ? ' active' : '') +
                '" data-val="" onclick="seleccionarProfesorModal(\'\')" role="option" type="button">Sin profesor</button>');
            list.innerHTML = options.length ? options.join('') :
                '<button class="dropdown-item" data-val="" onclick="seleccionarProfesorModal(\'\')" role="option" type="button">Sin profesor</button>' +
                '<div class="my-modal-select-message">No se encontraron docentes</div>';
        } catch (_error) {
            if (requestId !== modalProfesorRequestId) return;
            list.innerHTML = '<div class="my-modal-select-message">No se pudieron cargar sugerencias</div>';
        }
    }, 180);
}

function seleccionarProfesorModal(nombre) {
    setModalSelectValue('dd-modal-profesor', 'modal-add-profesor', 'label-modal-profesor', nombre, 'Sin profesor');
    const search = document.getElementById('modal-profesor-search');
    if (search) search.value = '';
    const list = document.getElementById('modal-profesores-options');
    if (list) list.innerHTML = '<div class="my-modal-select-message">Escribe al menos 2 letras para buscar</div>';
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
    const roomSelect = document.getElementById('dd-modal-sala');
    const teacherSelect = document.getElementById('dd-modal-profesor');
    const profesorSearch = document.getElementById('modal-profesor-search');
    const idInput = document.getElementById('modal-add-id');
    const modalTitle = document.getElementById('modal-titulo-bloque');
    const saveButton = document.getElementById('modal-save-class');
    const deleteButton = document.getElementById('modal-delete-class');
    if (idInput) idInput.value = '';
    if (modalTitle) modalTitle.textContent = 'Agregar Asignatura';
    if (saveButton) saveButton.setAttribute('aria-label', 'Guardar en tu horario');
    if (deleteButton) deleteButton.hidden = true;
    if (inpCurso) inpCurso.value = '';
    if (inpSala) inpSala.value = '';
    if (inpSec) inpSec.value = ''; // Sin hardcodear Sec. 1
    if (inpProf) inpProf.value = '';
    if (profesorSearch) profesorSearch.value = '';
    if (roomSelect) roomSelect.classList.remove('open');
    if (teacherSelect) teacherSelect.classList.remove('open');
    setModalSelectValue('dd-modal-sala', 'modal-add-sala', 'label-modal-sala', '', '-');
    setModalSelectValue('dd-modal-profesor', 'modal-add-profesor', 'label-modal-profesor', '', 'Seleccionar profesor...');

    setModalTipo('Cátedra');
    setModalRol('student');

    const modal = document.getElementById('modal-agregar-ramo');
    if (modal) {
        bloquearScrollFondoHorario();
        centrarEditorEnContenido();
        if (!modalCenteringResizeHandler) {
            modalCenteringResizeHandler = centrarEditorEnContenido;
            window.addEventListener('resize', modalCenteringResizeHandler);
        }
        modal.style.display = 'flex';
        setTimeout(() => {
            const focusTarget = inpCurso;
            if (focusTarget) focusTarget.focus();
        }, 60);
    }
}

function normalizarNumeroSeccion(valor) {
    const digits = String(valor == null ? '' : valor).match(/\d+/);
    if (!digits) return '';
    const numero = Number.parseInt(digits[0], 10);
    return Number.isSafeInteger(numero) && numero > 0 ? String(numero) : '';
}

function normalizarNombreRamoParaComparar(nombre) {
    return String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function nombreRamoParaComparar(clase) {
    return clase ? getCourseDisplay(clase) : '';
}

function propagarSeccionMismoRamo(claseOrigen, seccion) {
    const nombreRamo = normalizarNombreRamoParaComparar(nombreRamoParaComparar(claseOrigen));
    if (!nombreRamo || !seccion || !MI_HORARIO_DATA || !Array.isArray(MI_HORARIO_DATA.clases)) return;
    MI_HORARIO_DATA.clases.forEach(clase => {
        if (clase !== claseOrigen && normalizarNombreRamoParaComparar(nombreRamoParaComparar(clase)) === nombreRamo) {
            clase.seccion = seccion;
        }
    });
}

function rellenarSeccionesMismoRamo(clases) {
    if (!Array.isArray(clases)) return false;
    const porRamo = new Map();
    clases.forEach(clase => {
        const nombre = normalizarNombreRamoParaComparar(nombreRamoParaComparar(clase));
        const seccion = normalizarNumeroSeccion(clase && clase.seccion);
        if (!nombre || !seccion) return;
        if (!porRamo.has(nombre)) porRamo.set(nombre, []);
        const tipo = normalizarTipoClase(clase.tipo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
        const profesor = String(clase.profesor || '').trim();
        const tieneProfesor = profesor && !['-', 'sin profesor', 'no definido'].includes(profesor.toLocaleLowerCase('es'));
        const prioridad = (tieneProfesor ? 2 : 0) + (tipo === 'catedra' ? 1 : 0);
        porRamo.get(nombre).push({ clase, seccion, prioridad });
    });

    let changed = false;
    clases.forEach(clase => {
        const nombre = normalizarNombreRamoParaComparar(nombreRamoParaComparar(clase));
        const candidatas = porRamo.get(nombre);
        if (!candidatas || !candidatas.length) return;
        const prioritaria = candidatas.reduce((best, candidate) => candidate.prioridad > best.prioridad ? candidate : best);
        const seccionActual = normalizarNumeroSeccion(clase && clase.seccion);
        if (seccionActual === prioritaria.seccion) return;
        clase.seccion = prioritaria.clase.seccion;
        changed = true;
    });
    return changed;
}

function abrirModalEditarClase(id, ev) {
    if (ev) ev.stopPropagation();
    const clase = MI_HORARIO_DATA.clases.find(item => String(item.id) === String(id));
    if (!clase) return;

    abrirModalAgregarClase(Number(clase.dia), Number(clase.bloqueNum));
    const values = {
        'modal-add-id': clase.id,
        'modal-add-curso': clase.curso || '',
        'modal-add-sala': clase.sala || '',
        'modal-add-seccion': normalizarNumeroSeccion(clase.seccion),
        'modal-add-profesor': clase.profesor || ''
    };
    Object.keys(values).forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) input.value = values[inputId];
    });
    if (document.getElementById('modal-add-curso')) {
        document.getElementById('modal-add-curso').value = getCourseDisplay(clase);
    }
    setModalSelectValue('dd-modal-sala', 'modal-add-sala', 'label-modal-sala', clase.sala || '', '-');
    setModalSelectValue('dd-modal-profesor', 'modal-add-profesor', 'label-modal-profesor', clase.profesor || '', 'Sin profesor');
    const title = document.getElementById('modal-titulo-bloque');
    const saveButton = document.getElementById('modal-save-class');
    const deleteButton = document.getElementById('modal-delete-class');
    if (title) title.textContent = 'Editar Asignatura';
    if (saveButton) saveButton.setAttribute('aria-label', 'Guardar cambios');
    if (deleteButton) deleteButton.hidden = false;
    setModalRol('student');
    setModalTipo(clase.tipo || 'Cátedra');
    setModalRol(clase.rol || 'student');
}

function eliminarClaseDesdeEditor(ev) {
    if (ev) ev.preventDefault();
    const idInput = document.getElementById('modal-add-id');
    if (!idInput || !idInput.value) return;
    eliminarClaseMiHorario(idInput.value, ev, cerrarModalAgregarClase);
}

function cerrarModalAgregarClase() {
    const modal = document.getElementById('modal-agregar-ramo');
    if (modal) modal.style.display = 'none';
    if (modalCenteringResizeHandler) {
        window.removeEventListener('resize', modalCenteringResizeHandler);
        modalCenteringResizeHandler = null;
    }
    const dialog = modal ? modal.querySelector('.my-modal-dialog') : null;
    if (dialog) {
        dialog.style.left = '';
        dialog.style.position = '';
        dialog.style.width = '';
    }
    const roomSelect = document.getElementById('dd-modal-sala');
    const teacherSelect = document.getElementById('dd-modal-profesor');
    if (roomSelect) roomSelect.classList.remove('open');
    if (teacherSelect) teacherSelect.classList.remove('open');
    restaurarScrollFondoHorario();
}

function guardarNuevaClaseModal(ev) {
    if (ev) ev.preventDefault();
    const diaNum = parseInt(document.getElementById('modal-add-dia').value, 10);
    const bloqueNum = parseInt(document.getElementById('modal-add-bloque').value, 10);
    const curso = (document.getElementById('modal-add-curso').value || '').trim();
    const sala = (document.getElementById('modal-add-sala').value || '').trim().toUpperCase();
    const seccion = normalizarNumeroSeccion(document.getElementById('modal-add-seccion').value);
    const tipo = (document.getElementById('modal-add-tipo').value || 'Cátedra').trim();
    const profesor = (document.getElementById('modal-add-profesor').value || '').trim();
    const rol = modalRolSeleccionado;
    const idInput = document.getElementById('modal-add-id');
    const editId = idInput ? idInput.value || '' : '';

    // El nombre del ramo es el único dato necesario; los detalles restantes son opcionales.
    if (!curso) return;

    const bloque = BLOQUES_HORARIOS.find(b => b.num === bloqueNum);
    const diasNombres = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

    const editedIndex = editId ? MI_HORARIO_DATA.clases.findIndex(c => String(c.id) === String(editId)) : -1;
    if (editId && editedIndex === -1) return;

    const nuevaClase = {
        ...(editedIndex >= 0 ? MI_HORARIO_DATA.clases[editedIndex] : {}),
        id: editId || 'custom-' + Date.now(),
        dia: diaNum,
        diaNombre: diasNombres[diaNum] || 'Día',
        bloqueNum: bloqueNum,
        horaInicio: bloque ? bloque.inicio : '08:30',
        horaFin: bloque ? bloque.fin : '09:50',
        curso: curso,
        cursoDisplay: curso,
        tipo: tipo,
        seccion: seccion,
        sala: sala,
        profesor: profesor,
        rol: rol
    };

    if (editedIndex >= 0) {
        MI_HORARIO_DATA.clases[editedIndex] = nuevaClase;
    } else {
        // Al agregar, se reemplaza lo que ya hubiera en ese bloque.
        MI_HORARIO_DATA.clases = MI_HORARIO_DATA.clases.filter(c => !(c.dia === diaNum && c.bloqueNum === bloqueNum));
        MI_HORARIO_DATA.clases.push(nuevaClase);
    }
    propagarSeccionMismoRamo(nuevaClase, seccion);
    guardarMiHorarioEnStorage();
    cerrarModalAgregarClase();
    renderMiHorario();
    actualizarHeroMiHorario();
    autoSyncHorario();
}

const BLOQUES_NORMALES = [
    { num: 1, label: '08:30 - 09:50', inicio: '08:30', fin: '09:50' },
    { num: 2, label: '10:00 - 11:20', inicio: '10:00', fin: '11:20' },
    { num: 3, label: '11:30 - 12:50', inicio: '11:30', fin: '12:50' },
    { num: 4, label: '13:00 - 14:20', inicio: '13:00', fin: '14:20' },
    { num: 5, label: '14:30 - 15:50', inicio: '14:30', fin: '15:50' },
    { num: 6, label: '16:00 - 17:20', inicio: '16:00', fin: '17:20' },
    { num: 7, label: '17:25 - 18:45', inicio: '17:25', fin: '18:45' }
];
const BLOQUES_SOLEMNES = [
    { num: 1, label: '08:30 - 10:30', inicio: '08:30', fin: '10:30' },
    { num: 2, label: '10:45 - 12:45', inicio: '10:45', fin: '12:45' },
    { num: 3, label: '13:00 - 15:00', inicio: '13:00', fin: '15:00' },
    { num: 4, label: '15:15 - 17:15', inicio: '15:15', fin: '17:15' },
    { num: 5, label: '17:30 - 19:30', inicio: '17:30', fin: '19:30' }
];

const BLOQUES_HORARIOS = BLOQUES_NORMALES;

function normalizarClasesPerfil(clases) {
    const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    return clases.map(item => {
        const start = String(item.horaInicio || '').slice(0, 5);
        const savedBlock = BLOQUES_HORARIOS.find(block => block.num === Number(item.bloqueNum));
        const block = savedBlock || bloqueHorarioMasCercano(start);
        const normalizedItem = { ...item };
        delete normalizedItem.bloqueLabel;
        return {
            ...normalizedItem,
            dia: Number(item.dia),
            diaNombre: item.diaNombre || days[Number(item.dia)] || '',
            bloqueNum: block.num,
            horaInicio: block.inicio,
            horaFin: block.fin
        };
    });
}

function renderMiHorario() {
    // Reconciliar también al renderizar: algunos horarios ya están en localStorage
    // antes de que llegue el estado remoto, así las secciones aparecen de inmediato.
    if (!Array.isArray(horarioPerfilSeleccionado)
        && rellenarSeccionesMismoRamo(MI_HORARIO_DATA && MI_HORARIO_DATA.clases)) {
        guardarMiHorarioEnStorage();
    }
    const container = document.getElementById('mihorario-display-container');
    if (!container) return;

    const { dayOfWeek, totalMinutes } = getChileTime();

    const sharedProfileView = Array.isArray(horarioPerfilSeleccionado);
    const items = sharedProfileView ? normalizarClasesPerfil(horarioPerfilSeleccionado).map((item, index) => ({ ...item, isSharedProfile: true, id: `shared-${index}` })) : getHorarioActivo().filter(c =>
        state.miHorarioRol === 'ALL' || c.rol === state.miHorarioRol
    );

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
            const isToday = (dayOfWeek === d.num);

            let cardsHtml = '';
            BLOQUES_HORARIOS.forEach(b => {
                const slotItems = dayItems.filter(item => Number(item.bloqueNum) === b.num);
                const startM = timeToMinutes(b.inicio);
                const endM = timeToMinutes(b.fin);
                const isCurrent = isToday && (totalMinutes >= startM && totalMinutes < endM);

                if (slotItems.length) {
                    slotItems.forEach(c => {
                    const tipoClase = normalizarTipoClase(c.tipo);
                    const tipoCls = 'tipo-' + tipoClase.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                    let cleanSec = (c.seccion || '').trim();
                    const sectionValue = cleanSec && !cleanSec.toLowerCase().includes('ayudantía que impartes') && cleanSec !== '-'
                        ? cleanSec.replace(/^(?:secci[oó]n|sec\.?)\s*/i, '').replace(/^s(?=\s*\d)\s*/i, '').trim()
                        : '';
                    const sectionLabel = sectionValue ? `Sección ${sectionValue}` : 'Sección -';
                    const secText = `<span class="my-type-sec">• ${escapeHtml(sectionLabel)}</span>`;
                    const tipoVisible = c.rol === 'assistant' ? 'Ayudante' : tipoClase;
                    const tipoHtml = `<span class="my-type-tag ${tipoCls}"><span>${escapeHtml(tipoVisible)}</span>${secText}</span>`;

                    cardsHtml += `
                        <div class="my-class-card ${tipoCls} ${c.rol === 'assistant' ? 'is-assistant' : 'is-student'} ${isCurrent ? 'is-current-class' : ''}" id="card-${escapeHtml(c.id)}">
                            <div class="my-card-header">
                                <span class="my-card-time">
                                    ${isCurrent ? '<span class="pulse-dot-white"></span>' : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'}
                                    <span>${escapeHtml(etiquetaBloqueHorario(c))}</span>
                                </span>
                                ${c.isSharedProfile ? '' : `<button type="button" class="my-btn-edit" onclick="abrirModalEditarClase(${escapeHtml(JSON.stringify(String(c.id)))}, event)" title="Editar asignatura" aria-label="Editar ${escapeHtml(c.curso)}">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <path d="M12 20h9"></path>
                                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"></path>
                                    </svg>
                                </button>`}
                            </div>
                            <div class="my-card-title">${escapeHtml(getCourseDisplay(c))}</div>
                            <div class="my-card-meta">
                                ${tipoHtml}
                                <span class="my-prof-name" title="Docente: ${escapeHtml(c.profesor || '-')}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> <span>${escapeHtml(c.profesor || '-')}</span></span>
                            </div>
                            <div class="my-card-footer">
                                ${String(c.sala || '').split(/[,/]+/).map(s => s.trim()).filter(s => s && s !== '-' && !/^sala no definida$/i.test(s)).map(s => `
                                <span class="my-room-pill" onclick="verHorarioDirecto(${horarioJsArg(s)})" title="Sala ${escapeHtml(s)}">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                                    <span>${escapeHtml(s)}</span>
                                </span>
                                `).join('') || `<span class="my-room-pill is-unassigned-room" aria-label="Sala no asignada" title="Sin sala asignada">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                                    <span>-</span>
                                </span>`}
                                <span class="my-card-bloque-num">Bloque ${escapeHtml(c.bloqueNum)}</span>
                            </div>
                        </div>
                    `;
                    });
                } else {
                    cardsHtml += sharedProfileView ? `
                        <div class="my-empty-slot is-readonly">
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
                        <span class="my-day-count">${dayItems.length}</span>
                    </div>
                    <div class="my-day-cards">
                        ${cardsHtml}
                    </div>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="my-week-grid">
                ${colsHtml}
            </div>
        `;
//    }
}

window.mostrarHorarioPerfilEnMiHorario = function (clases) {
    if (!Array.isArray(clases)) return;
    horarioPerfilSeleccionado = normalizarClasesPerfil(clases);
    renderMiHorario();
    actualizarHeroMiHorario();
};

window.cerrarHorarioPerfilEnMiHorario = function () {
    horarioPerfilSeleccionado = null;
    renderMiHorario();
    actualizarHeroMiHorario();
};


let horarioSyncInFlight = false;
let horarioSyncPending = false;
function horarioTieneDatosPendientes() {
    if (!Array.isArray(MI_HORARIO_DATA.clases)) return false;
    return MI_HORARIO_DATA.clases.some(clase => {
        const block = BLOQUES_NORMALES.find(item => item.num === Number(clase.bloqueNum));
        const start = String(clase.horaInicio || '').slice(0, 5);
        const finish = String(clase.horaFin || '').slice(0, 5);
        const canonicalTime = block && start === block.inicio && finish === block.fin;
        const legacyLastBlock = Number(clase.bloqueNum) === 7 && start === '17:30' && finish === '18:50';
        if (!canonicalTime && !legacyLastBlock) return false;
        const room = String(clase.sala || '').trim();
        return !room || room === '-' || !String(clase.seccion || '').trim() || !String(clase.profesor || '').trim();
    });
}

function mergeEnrichedSchedule(originalClasses, enrichedClasses) {
    if (!Array.isArray(originalClasses) || !Array.isArray(enrichedClasses)) return originalClasses;
    const responseById = new Map(enrichedClasses.filter(item => item && item.id != null).map(item => [String(item.id), item]));
    const fieldsToPreserve = ['curso', 'sala', 'seccion', 'profesor'];
    return originalClasses.map((original, index) => {
        if (!original || typeof original !== 'object') return original;
        const enriched = original.id != null
            ? responseById.get(String(original.id))
            : enrichedClasses[index];
        if (!enriched || typeof enriched !== 'object') return original;
        const merged = { ...original, ...enriched };
        fieldsToPreserve.forEach(field => {
            const oldValue = original[field];
            const newValue = enriched[field];
            const oldText = String(oldValue == null ? '' : oldValue).trim();
            const newText = String(newValue == null ? '' : newValue).trim();
            const emptyMarkers = ['', '-'];
            if (field === 'sala') emptyMarkers.push('sala no definida');
            if (field === 'seccion') emptyMarkers.push('sección -', 'seccion -');
            const oldTeacherNeedsReconciliation = field === 'profesor' && oldText &&
                oldText !== oldText.toLocaleUpperCase('es');
            if (oldTeacherNeedsReconciliation && !newText) return;
            if (oldText && emptyMarkers.includes(newText)) merged[field] = oldValue;
        });
        return merged;
    });
}

async function autoSyncHorario() {
    if (!Array.isArray(MI_HORARIO_DATA.clases) || !MI_HORARIO_DATA.clases.length) return;
    if (typeof fetch !== 'function') return;
    if (horarioSyncInFlight) {
        horarioSyncPending = true;
        return;
    }
    const signature = JSON.stringify(MI_HORARIO_DATA.clases);

    horarioSyncInFlight = true;
    try {
        const resp = await fetch('/api/sync_horario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clases: MI_HORARIO_DATA.clases })
        });
        
        if (resp.ok) {
            const nuevasClases = await resp.json();
            if (Array.isArray(nuevasClases) && nuevasClases.length > 0) {
                // Don't replace newer edits with a stale response.
                if (JSON.stringify(MI_HORARIO_DATA.clases) !== signature) {
                    horarioSyncPending = true;
                    return;
                }
                const updatedSignature = JSON.stringify(nuevasClases);
                if (updatedSignature !== signature) {
                    MI_HORARIO_DATA.clases = mergeEnrichedSchedule(MI_HORARIO_DATA.clases, nuevasClases);
                    renderMiHorario();
                }
                await guardarMiHorarioEnStorage();
            }
        }
    } catch(e) {
        console.error("Error sincronizando horario:", e);
    } finally {
        horarioSyncInFlight = false;
        if (horarioSyncPending) {
            horarioSyncPending = false;
            setTimeout(autoSyncHorario, 0);
        }
    }
}

// Auto-sync al cargar
setTimeout(() => autoSyncHorario(), 1500);
setInterval(() => {
    if (document.visibilityState !== 'hidden' && horarioTieneDatosPendientes()) autoSyncHorario();
}, 60 * 1000);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' && horarioTieneDatosPendientes()) autoSyncHorario();
});
document.addEventListener('portal:section-entered', event => {
    if (event.detail && event.detail.panelId === 'tab-mihorario') return autoSyncHorario();
});

document.addEventListener('DOMContentLoaded', () => {
    if (window.PortalStore) window.PortalStore.register('schedule', 'mi_horario_custom_v1', MI_HORARIO_DEFAULT_DATA);
});
document.addEventListener('portal:remote-state', event => {
    if (event.detail.module !== 'schedule') return;
    MI_HORARIO_DATA = event.detail.payload || JSON.parse(JSON.stringify(MI_HORARIO_DEFAULT_DATA));
    const removedLabels = quitarBloqueLabels(MI_HORARIO_DATA.clases);
    const filledSections = rellenarSeccionesMismoRamo(MI_HORARIO_DATA.clases);
    if (removedLabels || filledSections) guardarMiHorarioEnStorage();
    renderMiHorario();
    autoSyncHorario();
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
    const types = ['Cátedra', 'Ayudantía', 'Laboratorio', 'Taller'];
    days.forEach((items, day) => {
        items.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
        items.forEach((item, index) => {
            const sourceType = String(item.tipo || '').toLocaleLowerCase('es');
            const tipo = types.find(value => sourceType.includes(value.toLocaleLowerCase('es'))) || 'Cátedra';
            const bloques = bloquesCubiertosPorClaseImportada(item);
            bloques.forEach((bloque, segmentIndex) => {
                imported.push({
                    id: 'import-' + Date.now() + '-' + day + '-' + index + '-' + segmentIndex,
                    dia: day,
                    diaNombre: item.diaNombre,
                    bloqueNum: bloque.num,
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
    });
    const occupiedBlocks = new Set();
    for (const item of imported) {
        const key = item.dia + ':' + item.bloqueNum;
        if (occupiedBlocks.has(key)) {
            mostrarEstadoImportacionHorario('La imagen muestra más de una clase en un mismo bloque. Corrige el horario y vuelve a intentarlo.', true);
            return false;
        }
        occupiedBlocks.add(key);
    }
    MI_HORARIO_DATA = { ...MI_HORARIO_DATA, clases: imported };
    guardarMiHorarioEnStorage();
    renderMiHorario();
    actualizarHeroMiHorario();
    autoSyncHorario();
    const scheduleDisplay = document.getElementById('mihorario-display-container');
    if (scheduleDisplay) scheduleDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
    mostrarEstadoImportacionHorario('');
    return true;
}

function bloquesCubiertosPorClaseImportada(clase) {
    const start = String(clase && clase.horaInicio || '').slice(0, 5);
    const finish = String(clase && clase.horaFin || '').slice(0, 5);
    const startIndex = BLOQUES_NORMALES.findIndex(block => block.inicio === start);
    if (startIndex >= 0) {
        const finishIndex = BLOQUES_NORMALES.findIndex((block, index) =>
            index >= startIndex && block.fin === finish
        );
        const count = finishIndex >= startIndex ? finishIndex - startIndex + 1 : 0;
        if (count > 0) {
            const finalIndex = Math.min(BLOQUES_NORMALES.length, startIndex + count);
            return BLOQUES_NORMALES.slice(startIndex, finalIndex);
        }
    }
    return [bloqueHorarioMasCercano(start)];
}

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
        if (c.id === 'mar-1') {
            c.seccion = 'Sección 19';
            c.profesor = 'Matías Robotham';
            c.tipo = 'Ayudantía';
        } else if (c.id === 'vie-1') {
            c.seccion = 'Sección 13';
            c.profesor = 'Karina Arancibia';
            c.tipo = 'Ayudantía';
        } else if (c.id === 'vie-3') {
            c.seccion = 'Sección 3';
            c.profesor = 'Jaime Contreras';
            c.tipo = 'Ayudantía';
        } else if (c.id === 'vie-4') {
            c.seccion = 'Sección 11';
            c.profesor = 'Rosa Rivero';
            c.tipo = 'Ayudantía';
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

function guardarMiHorarioEnStorage() {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('mi_horario_custom_v1', JSON.stringify(MI_HORARIO_DATA));
        }
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


let vistaHorarioActual = 'nakzu'; // 'yo', 'alexis', 'cruce'

function cambiarVistaHorario(vista, btn) {
    vistaHorarioActual = vista;
    const bar = document.getElementById('pill-bar-horarios');
    if (bar) bar.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderMiHorario();
    actualizarHeroMiHorario();
}

function generarHorarioCruce() {
    const cruce = [];
    let id_counter = 1;
    const diasNombres = {1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes'};
    for (let dia = 1; dia <= 5; dia++) {
        for (let b of BLOQUES_HORARIOS) {
            let alguienOcupado = false;
            for (const amigo of cruceSeleccionados) {
                let items = (amigo === 'nakzu') ? MI_HORARIO_DATA.clases : HORARIOS_GUARDADOS[amigo].clases;
                if (!items) continue;
                const clase = items.find(c => c.dia === dia && c.bloqueNum === b.num);
                if (clase) {
                    alguienOcupado = true;
                    break;
                }
            }
            
            if (!alguienOcupado) {
                cruce.push({
                    id: 'cruce-' + id_counter++,
                    dia: dia,
                    diaNombre: diasNombres[dia],
                    bloqueNum: b.num,
                    bloqueLabel: b.label,
                    horaInicio: b.inicio,
                    horaFin: b.fin,
                    curso: '¡Todos libres!',
                    tipo: 'Cruce Libre',
                    seccion: '-',
                    sala: '-',
                    profesor: '-',
                    rol: 'cruce'
                });
            }
        }
    }
    return cruce;
}

function getHorarioActivo() {
    if (vistaHorarioActual === 'cruce') return generarHorarioCruce();
    if (vistaHorarioActual === 'nakzu') return MI_HORARIO_DATA.clases;
    return HORARIOS_GUARDADOS[vistaHorarioActual] ? HORARIOS_GUARDADOS[vistaHorarioActual].clases : MI_HORARIO_DATA.clases;
}

function actualizarHeroMiHorario() {
    const heroEl = document.getElementById('my-schedule-hero');
    if (!heroEl) return;
    
    // VERIFICAR MODO ESTUDIO
    if (localStorage.getItem('isStudying') === 'true') {
        heroEl.innerHTML = `
            <div class="my-hero-top">
                <div class="my-hero-status-pill estudio">
                    <span class="pulse-dot-purple"></span>
                    <span>Modo Estudio</span>
                </div>
            </div>
            <div class="my-hero-body" style="margin-top: -12px;">
                <div class="my-hero-class-info">
                    <div class="my-hero-title">Enfoque Profundo</div>
                    <div class="my-hero-subtitle" style="margin-top: -6px;">
                        <span>Silencia las distracciones. Cronómetro en marcha.</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const { dayOfWeek, totalMinutes, totalSeconds } = getChileTime();

    // Si es fin de semana
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        heroEl.innerHTML = `
            <div class="my-hero-top">
                <div class="my-hero-status-pill done">
                    <span>Fin de semana</span>
                </div>
            </div>
            <div class="my-hero-body" style="margin-top: -12px;">
                <div class="my-hero-class-info">
                    <div class="my-hero-title">Descanso de fin de semana!</div>
                    <div class="my-hero-subtitle" style="margin-top: -6px;">
                        <span>Tu próxima clase es el <strong>Lunes a las 11:30</strong>.</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // Clases de hoy
    const clasesHoy = getHorarioActivo().filter(c => c.dia === dayOfWeek).sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));

    // 1. ¿Está en clase ahora?
    let claseActual = null;
    for (const c of clasesHoy) {
        const startM = timeToMinutes(c.horaInicio);
        const endM = timeToMinutes(c.horaFin);
        if (totalMinutes >= startM && totalMinutes < endM) {
            claseActual = c;
            break;
        }
    }

    if (claseActual) {
        const startSec = timeToMinutes(claseActual.horaInicio) * 60;
        const endSec = timeToMinutes(claseActual.horaFin) * 60;
        const progress = Math.min(100, Math.max(0, ((totalSeconds - startSec) / (endSec - startSec)) * 100));
        const minRestantes = Math.max(1, Math.ceil((endSec - totalSeconds) / 60));

        heroEl.innerHTML = `
            <div class="my-hero-top">
                <div class="my-hero-status-pill now">
                    <span class="pulse-dot"></span>
                    <span>${vistaHorarioActual === 'cruce' ? 'Tope libre' : (claseActual.rol === 'assistant' ? 'En ayudantía' : 'En clase')}</span>
                </div>
                <div class="my-hero-top-badges ${claseActual.tipo ? 'tipo-' + claseActual.tipo.toLowerCase().replace(' ', '') : ''} ${claseActual.rol === 'student' ? 'is-student' : ''}">
                    <span class="my-room-pill ${claseActual.rol === 'assistant' ? 'is-assistant-room' : ''}" onclick="verHorarioDirecto('${claseActual.sala}')" title="Ver horario de la sala ${claseActual.sala}">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                        <span>${claseActual.sala}</span>
                    </span>
                </div>
            </div>
            <div class="my-hero-body">
                <div class="my-hero-class-info">
                    <div class="my-hero-title">
                        <span>${claseActual.curso}</span>
                    </div>
                    <div class="my-hero-subtitle">
                        <span style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">Bloque ${claseActual.bloqueNum} (${claseActual.bloqueLabel})</span>
                        ${claseActual.profesor ? `<span style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px; margin-top: -2px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${claseActual.profesor}</span>` : ''}
                        <span style="background: rgba(14,165,233,0.1); color:#38bdf8; padding: 2px 8px; border-radius: 4px;">Quedan <strong>${minRestantes} min</strong></span>
                    </div>
                </div>
            </div>
            <div class="my-hero-progress-container" title="Progreso de la clase: ${Math.round(progress)}%">
                <div class="my-hero-progress-bar" style="width: ${progress.toFixed(1)}%;"></div>
            </div>
        `;
        return;
    }

    // 2. ¿Tiene una próxima clase hoy?
    const proximaHoy = clasesHoy.find(c => timeToMinutes(c.horaInicio) > totalMinutes);
    if (proximaHoy) {
        const diffMin = timeToMinutes(proximaHoy.horaInicio) - totalMinutes;
        const diffTexto = diffMin >= 60 ? `${Math.floor(diffMin / 60)}h ${diffMin % 60}m` : `${diffMin} min`;

        heroEl.innerHTML = `
            <div class="my-hero-top">
                <div class="my-hero-status-pill next">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>${vistaHorarioActual === 'cruce' ? `Ventana libre: ${diffTexto}` : `En ventana (${diffTexto})`}</span>
                </div>
                <div class="my-hero-top-badges ${proximaHoy.tipo ? 'tipo-' + proximaHoy.tipo.toLowerCase().replace(' ', '') : ''} ${proximaHoy.rol === 'student' ? 'is-student' : ''}">
                    <span class="my-room-pill ${proximaHoy.rol === 'assistant' ? 'is-assistant-room' : ''}" onclick="verHorarioDirecto('${proximaHoy.sala}')" title="Ver horario de la sala ${proximaHoy.sala}">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                        <span>${proximaHoy.sala}</span>
                    </span>
                </div>
            </div>
            <div class="my-hero-body">
                <div class="my-hero-class-info">
                    <div class="my-hero-title">
                        <span>${proximaHoy.curso}</span>
                    </div>
                    <div class="my-hero-subtitle">
                        <span style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">Inicia a las <strong>${proximaHoy.horaInicio}</strong> (Bloque ${proximaHoy.bloqueNum})</span>
                        ${proximaHoy.profesor ? `<span style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px; margin-top: -2px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${proximaHoy.profesor}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // 3. Ya terminaron todas las clases de hoy (o aún no empiezan y el día tiene clases)
    let siguienteClase = null;
    for (let d = 1; d <= 7; d++) {
        const checkDia = ((dayOfWeek - 1 + d) % 7) + 1;
        if (checkDia >= 1 && checkDia <= 5) {
            const clasesDelDia = getHorarioActivo().filter(c => c.dia === checkDia).sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));
            if (clasesDelDia.length > 0) {
                siguienteClase = clasesDelDia[0];
                break;
            }
        }
    }

    const msgSiguiente = siguienteClase
        ? (vistaHorarioActual === 'cruce' 
            ? `Próximo tope libre el <strong>${siguienteClase.diaNombre} a las ${siguienteClase.horaInicio}</strong>.`
            : (siguienteClase.rol === 'assistant' ? `Tu próxima ayudantía es el <strong>${siguienteClase.diaNombre} a las ${siguienteClase.horaInicio}</strong>.` : `Tu próxima clase es el <strong>${siguienteClase.diaNombre} a las ${siguienteClase.horaInicio}</strong>.`))
        : (vistaHorarioActual === 'cruce' ? 'No hay topes libres programados.' : 'No tienes más clases programadas.');

    heroEl.innerHTML = `
        <div class="my-hero-top">
            <div class="my-hero-status-pill done">
                <span>${vistaHorarioActual === 'cruce' ? 'Sin topes libres' : 'Fuera de jornada'}</span>
            </div>
        </div>
        <div class="my-hero-body" style="margin-top: -12px;">
            <div class="my-hero-class-info">
                <div class="my-hero-title">${vistaHorarioActual === 'cruce' ? 'Ya no quedan topes libres hoy' : 'No tienes más clases por hoy!'}</div>
                <div class="my-hero-subtitle" style="margin-top: -6px;">
                    <span>${msgSiguiente}</span>
                </div>
            </div>
        </div>
    `;
}

function setMiHorarioDia(diaVal, btn) {
    document.querySelectorAll('#bar-mihorario-dia .pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    state.miHorarioDia = diaVal;
    renderMiHorario();
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

function restablecerHorarioDefault() {
    if (vistaHorarioActual !== 'nakzu') { mostrarToast('Solo puedes restablecer tu propio horario'); return; }
    confirmarWeb('¿Deseas restablecer tu horario al original de 20 clases predeterminadas? Se revertirán las asignaturas agregadas o eliminadas.', () => {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('mi_horario_custom_v1');
            }
        } catch (e) {}

        MI_HORARIO_DATA = JSON.parse(JSON.stringify(MI_HORARIO_DEFAULT_DATA));
        guardarMiHorarioEnStorage();
        renderMiHorario();
        actualizarHeroMiHorario();
        mostrarToast('Horario restablecido a la versión inicial');
    }, 'Restablecer horario');
}

function eliminarClaseMiHorario(id, ev) {
    if (vistaHorarioActual !== 'nakzu') return;
    if (ev) ev.stopPropagation();
    const idx = MI_HORARIO_DATA.clases.findIndex(c => c.id === id);
    if (idx === -1) return;
    const c = MI_HORARIO_DATA.clases[idx];
    confirmarWeb(`¿Eliminar "${c.curso}" de este bloque (${c.diaNombre} ${c.bloqueLabel})?`, () => {
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
    if (vistaHorarioActual !== 'nakzu') { mostrarToast('Solo puedes editar tu propio horario'); return; }
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
            <span>Cargando clases UDP del bloque...</span>
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

        // 2. Si no hay en este bloque exacto, buscar en toda la base de datos de cursos UDP
        const listEl = document.getElementById('modal-real-classes-list');
        if (listEl) {
            listEl.innerHTML = `<div style="padding: 12px; text-align:center; color:#94a3b8; font-size:12px;">Buscando en toda la base de datos UDP...</div>`;
        }

        try {
            const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            if (!resp.ok) throw new Error('Error al buscar');
            const data = await resp.json();
            const cursos = data.cursos || [];
            if (badgeEl) badgeEl.textContent = `${cursos.length} en toda la UDP`;
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

const BLOQUES_HORARIOS = [
    { num: 1, label: '08:30 - 09:50', inicio: '08:30', fin: '09:50' },
    { num: 2, label: '10:00 - 11:20', inicio: '10:00', fin: '11:20' },
    { num: 3, label: '11:30 - 12:50', inicio: '11:30', fin: '12:50' },
    { num: 4, label: '13:00 - 14:20', inicio: '13:00', fin: '14:20' },
    { num: 5, label: '14:30 - 15:50', inicio: '14:30', fin: '15:50' },
    { num: 6, label: '16:00 - 17:20', inicio: '16:00', fin: '17:20' },
    { num: 7, label: '17:25 - 18:45', inicio: '17:25', fin: '18:45' }
];

function renderMiHorario() {
    const container = document.getElementById('mihorario-display-container');
    if (!container) return;

    const { dayOfWeek, totalMinutes } = getChileTime();

    // Filtrado por rol y texto insensible a tildes
    let items = getHorarioActivo().filter(c => {
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

    // Vista de toda la semana (5 Columnas)
    if (state.miHorarioDia === 'ALL') {
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
                const c = dayItems.find(item => item.bloqueNum === b.num);
                const startM = timeToMinutes(b.inicio);
                const endM = timeToMinutes(b.fin);
                const isCurrent = isToday && (totalMinutes >= startM && totalMinutes < endM);

                if (c) {
                    const tipoCls = 'tipo-' + (c.tipo || 'Cátedra').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                    let cleanSec = (c.seccion || '').trim();
                    if (cleanSec.toLowerCase().startsWith('sec.')) {
                        cleanSec = cleanSec.replace(/^sec\.\s*/i, 'Sección ');
                    } else if (cleanSec.toLowerCase().startsWith('sec ')) {
                        cleanSec = cleanSec.replace(/^sec\s*/i, 'Sección ');
                    }
                    const secText = (cleanSec && !cleanSec.toLowerCase().includes('ayudantía que impartes')) ? `<span class="my-type-sec">• ${escapeHtml(cleanSec)}</span>` : '';
                    const tipoHtml = `<span class="my-type-tag ${tipoCls}"><span>${escapeHtml(c.tipo || 'Cátedra')}</span>${secText}</span>`;

                    cardsHtml += `
                        <div class="my-class-card ${tipoCls} ${c.rol === 'assistant' ? 'is-assistant' : (c.rol === 'cruce' ? 'is-cruce' : 'is-student')} ${isCurrent ? 'is-current-class' : ''}" id="card-${c.id}">
                            <div class="my-card-header">
                                <span class="my-card-time">
                                    ${isCurrent ? '<span class="pulse-dot-white"></span>' : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'}
                                    <span>${c.bloqueLabel}</span>
                                </span>
                                ${vistaHorarioActual === 'nakzu' ? `<button type="button" class="my-btn-delete" onclick="eliminarClaseMiHorario('${c.id}', event)" title="Eliminar asignatura de este bloque">` : '<div style="display:none">'}
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                ${vistaHorarioActual === 'nakzu' ? '</button>' : '</div>'}
                            </div>
                            <div class="my-card-title">${escapeHtml(c.curso)}</div>
                            <div class="my-card-meta">
                                ${tipoHtml}
                                ${c.profesor ? `<span class="my-prof-name" title="Docente: ${escapeHtml(c.profesor)}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> <span>${escapeHtml(c.profesor)}</span></span>` : ''}
                            </div>
                            <div class="my-card-footer">
                                <span class="my-room-pill" onclick="verHorarioDirecto('${c.sala}')" title="Ver horario de la sala ${c.sala}">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                                    <span>${escapeHtml(c.sala)}</span>
                                </span>
                                <span class="my-card-bloque-num">Bloque ${c.bloqueNum}</span>
                            </div>
                        </div>
                    `;
                } else {
                    cardsHtml += `
                        <div class="my-empty-slot ${isCurrent ? 'is-current-empty' : ''}" ${vistaHorarioActual === 'nakzu' ? `onclick="abrirModalAgregarClase(${d.num}, ${b.num})" title="Haz clic para agregar una asignatura en este bloque (${b.label})"` : `title="Bloque libre"`} style="${vistaHorarioActual !== 'nakzu' ? 'cursor: default;' : ''}">
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
    } else {
        // Vista de día individual
        const diaNum = parseInt(state.miHorarioDia, 10);
        const dayItems = items.filter(c => c.dia === diaNum);
        const isToday = (dayOfWeek === diaNum);
        const diaNombre = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'][diaNum - 1] || 'Día';

        let timelineCardsHtml = '';
        BLOQUES_HORARIOS.forEach(b => {
            const c = dayItems.find(item => item.bloqueNum === b.num);
            const startM = timeToMinutes(b.inicio);
            const endM = timeToMinutes(b.fin);
            const isCurrent = isToday && (totalMinutes >= startM && totalMinutes < endM);

            if (c) {
                const tipoCls = 'tipo-' + (c.tipo || 'Cátedra').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                let cleanSec = (c.seccion || '').trim();
                if (cleanSec.toLowerCase().startsWith('sec.')) {
                    cleanSec = cleanSec.replace(/^sec\.\s*/i, 'Sección ');
                } else if (cleanSec.toLowerCase().startsWith('sec ')) {
                    cleanSec = cleanSec.replace(/^sec\s*/i, 'Sección ');
                }
                const secText = (cleanSec && !cleanSec.toLowerCase().includes('ayudantía que impartes')) ? `<span class="my-type-sec">• ${escapeHtml(cleanSec)}</span>` : '';
                const tipoHtml = `<span class="my-type-tag ${tipoCls}"><span>${escapeHtml(c.tipo || 'Cátedra')}</span>${secText}</span>`;

                timelineCardsHtml += `
                    <div class="my-timeline-card ${tipoCls} ${c.rol === 'assistant' ? 'is-assistant' : (c.rol === 'cruce' ? 'is-cruce' : 'is-student')} ${isCurrent ? 'is-current-class' : ''}" id="card-${c.id}">
                        <div class="my-time-box">
                            <div class="my-time-range">${isCurrent ? '<span class="pulse-dot-white"></span>' : ''}${c.bloqueLabel}</div>
                            <div class="my-bloque-badge">Bloque ${c.bloqueNum} (80 min)</div>
                        </div>
                        <div class="my-info-box">
                            <div class="my-info-title">
                                <span>${escapeHtml(c.curso)}</span>
                            </div>
                            <div class="my-info-meta">
                                ${tipoHtml}
                                ${c.profesor ? `<span>• Prof: ${escapeHtml(c.profesor)}</span>` : ''}
                            </div>
                        </div>
                        <div class="my-actions-box">
                            <span class="my-room-pill" onclick="verHorarioDirecto('${c.sala}')" title="Ver horario de la sala ${c.sala}" style="font-size: 12px; padding: 6px 11px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                                <span>${c.sala}</span>
                            </span>
                            ${vistaHorarioActual === 'nakzu' ? `<button type="button" class="my-btn-delete-timeline" onclick="eliminarClaseMiHorario('${c.id}', event)" title="Eliminar asignatura de este bloque">` : '<div style="display:none">'}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                <span>Eliminar</span>
                            ${vistaHorarioActual === 'nakzu' ? '</button>' : '</div>'}
                        </div>
                    </div>
                `;
            } else {
                timelineCardsHtml += `
                    <div class="my-timeline-empty-card ${isCurrent ? 'is-current-empty-timeline' : ''}" ${vistaHorarioActual === 'nakzu' ? `onclick="abrirModalAgregarClase(${diaNum}, ${b.num})" title="Haz clic para agregar una asignatura en este bloque (${b.label})"` : `title="Bloque libre"`} style="${vistaHorarioActual !== 'nakzu' ? 'cursor: default;' : ''}">
                        <div class="my-time-box">
                            <div class="my-time-range" style="color: #64748b;">${isCurrent ? '<span class="pulse-dot-white"></span>' : ''}${b.label}</div>
                            <div class="my-bloque-badge">Bloque ${b.num} (80 min)</div>
                        </div>
                        <div class="my-empty-body" style="justify-content: space-between; padding-right: 6px;">
                            <span class="my-empty-text">Sin clases</span>
                            <span class="my-empty-timeline-btn">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Agregar Asignatura
                            </span>
                        </div>
                    </div>
                `;
            }
        });

        container.innerHTML = `
            <div class="my-timeline-container">
                ${timelineCardsHtml}
            </div>
        `;
    }
}


let cruceSeleccionados = [];

function abrirModalCruce() {
    const modal = document.getElementById('modal-cruce');
    const container = document.getElementById('cruce-checkboxes');
    if (!modal || !container) return;

    const options = [{id: 'nakzu', name: 'Nakzu'}];
    for (const amigo in HORARIOS_GUARDADOS) {
        if (amigo !== 'nakzu') {
            options.push({id: amigo, name: amigo.charAt(0).toUpperCase() + amigo.slice(1)});
        }
    }

    let html = '';
    for (const opt of options) {
        // Por defecto Nakzu activo y otro amigo también activo
        const isChecked = cruceSeleccionados.length > 0 ? cruceSeleccionados.includes(opt.id) : true;
        
        html += `
            <label class="cruce-option">
                <div class="cruce-info">
                    <div class="cruce-avatar" style="${opt.id === 'nakzu' ? 'background: linear-gradient(135deg, #3b82f6, #06b6d4);' : ''}">${opt.name.charAt(0)}</div>
                    <span>${escapeHtml(opt.name)}</span>
                </div>
                <input type="checkbox" value="${opt.id}" ${isChecked ? 'checked' : ''} class="cruce-checkbox">
                <div class="cruce-toggle"></div>
            </label>
        `;
    }

    container.innerHTML = html;
    modal.style.display = 'flex';
}

function cerrarModalCruce() {
    const modal = document.getElementById('modal-cruce');
    if (modal) modal.style.display = 'none';
}

function ejecutarCruce() {
    const container = document.getElementById('cruce-checkboxes');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    cruceSeleccionados = Array.from(checkboxes).map(cb => cb.value);

    if (cruceSeleccionados.length === 0) {
        mostrarToast('Debes seleccionar al menos un horario para comparar.');
        return;
    }

    cerrarModalCruce();
    
    const btnCruce = document.querySelector('.pill-btn[onclick*="abrirModalCruce"]');
    cambiarVistaHorario('cruce', btnCruce);
}

window.triggerHorariosChange = function() {
    const val = document.getElementById('horarios-friend-select').value;
    cambiarVistaHorario(val, null);
};

const HORARIO_PROFILES = [
    { val: 'nakzu', label: 'Nakzu' },
    { val: 'alexis', label: 'Aleex1s' },
    { val: 'felipe', label: 'Felipe' }
];
let currentHorarioProfileIndex = 0;

window.cycleHorarioProfile = function(direction) {
    const newIndex = (currentHorarioProfileIndex + direction + HORARIO_PROFILES.length) % HORARIO_PROFILES.length;
    const oldProfile = HORARIO_PROFILES[currentHorarioProfileIndex];
    const newProfile = HORARIO_PROFILES[newIndex];
    currentHorarioProfileIndex = newIndex;

    const labelEl = document.getElementById('label-horarios-friend-cycler');
    const inputEl = document.getElementById('horarios-friend-select');
    
    if (labelEl && inputEl) {
        // Preparar animación (dirección)
        const slideOutClass = direction > 0 ? 'slide-out-left' : 'slide-out-right';
        const slideInClass = direction > 0 ? 'slide-in-right' : 'slide-in-left';
        
        labelEl.classList.remove('active');
        labelEl.classList.add(slideOutClass);
        
        setTimeout(() => {
            // Cambiar texto e iniciar estado de entrada
            labelEl.textContent = newProfile.label;
            labelEl.classList.remove(slideOutClass);
            labelEl.classList.add(slideInClass);
            
            // Forzar reflow
            void labelEl.offsetWidth;
            
            // Animar hacia el centro
            labelEl.classList.remove(slideInClass);
            labelEl.classList.add('active');
            
            // Actualizar input y disparar lógica
            inputEl.value = newProfile.val;
            if (typeof window.triggerHorariosChange === 'function') {
                window.triggerHorariosChange();
            }
        }, 200); // Mitad de la animación
    }
};

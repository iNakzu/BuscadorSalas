// ==============================================================================
// METRO DE SANTIAGO & TRANSPORTE PÚBLICO
// v7 — Cápsulas informativas (estado real + alertas X) — Mobile-first
// ==============================================================================

let datosTransporteCache = null;
let activeParaderoCode = null;

async function initTransporte() {
    await cargarDatosTransporte();
}

function consultarParaderoManual() {
    const input = document.getElementById('transporte-codigo-input');
    if (!input) return;
    const val = input.value.trim().toUpperCase();
    if (!val) {
        mostrarAlertaWeb('Ingresa un código de paradero válido.', 'Código inválido', 'error');
        return;
    }
    activeParaderoCode = val;
    cargarBusesParadero(val);
}

function formatearMensajeAlerta(str) {
    return (str || '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '✓');
}

function compactarServicio(str) {
    return (str || 'Servicio')
        .replace(/No hay buses que se dirijan al paradero/gi, 'Sin buses')
        .replace(/Servicio en Horario Habil/gi, 'Horario activo')
        .replace(/Servicio en Horario Hábil/gi, 'Horario activo');
}

function esPublicacionFinJornada(alerta) {
    const texto = (alerta && alerta.mensaje ? alerta.mensaje : '').toLowerCase();
    return (texto.includes('finaliza') && texto.includes('jornada')) ||
        texto.includes('fin de la jornada');
}

function alertaDentroDe24Horas(alerta) {
    const fecha = new Date(alerta && alerta.ts ? alerta.ts : '');
    if (Number.isNaN(fecha.getTime())) return false;
    const diferencia = Date.now() - fecha.getTime();
    return diferencia >= -5 * 60 * 1000 && diferencia <= 24 * 60 * 60 * 1000;
}

function filtrarAlertasActivas(alertas) {
    const vigentes = (alertas || []).filter(a =>
        alertaDentroDe24Horas(a) &&
        !esPublicacionFinJornada(a)
    );
    if (vigentes.some(a => a.resolucion_global)) return [];
    return vigentes.filter(a => !a.resolucion && !a.resolucion_global);
}

function formatearFechaAlerta(value) {
    if (!value) return '';
    const fecha = new Date(value);
    if (Number.isNaN(fecha.getTime())) return '';
    return new Intl.DateTimeFormat('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Santiago'
    }).format(fecha);
}

// ─── Escape helper ────────────────────────────────────────────────────────────
function escapeHtmlTrans(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ─── Detecta alertas de una línea concreta ────────────────────────────────────
function _alertasDeLinea(alertas, lineaCode) {
    if (!alertas || alertas.length === 0) return [];
    return alertas.filter(a =>
        a.lineas && a.lineas.includes(lineaCode)
    );
}

// ─── Toast de nueva alerta ────────────────────────────────────────────────────
function _mostrarToastAlerta(alertas) {
    const nuevas = alertas.filter(a => !_alertasAnterioresIds.has(a.id));
    if (nuevas.length === 0) return;

    nuevas.forEach(alerta => {
        _alertasAnterioresIds.add(alerta.id);
        const toastId = `toast-metro-${alerta.id}`;
        if (document.getElementById(toastId)) return;

        const toast = document.createElement('div');
        toast.id = toastId;
        toast.setAttribute('role', 'alert');
        toast.style.cssText = `
            position:fixed; bottom:80px; right:16px; z-index:9999;
            background:rgba(10,15,30,0.95);
            border:1px solid rgba(248,113,113,0.5);
            border-left:4px solid #f87171;
            border-radius:12px;
            padding:12px 14px;
            max-width:min(300px, calc(100vw - 32px));
            box-shadow:0 8px 32px rgba(0,0,0,0.6);
            backdrop-filter:blur(16px);
            animation:slideInToast 0.35s ease;
            font-family:inherit;
        `;

        const tipoLabel = {
            estacion:'Estación afectada', tramo:'Tramo cortado',
            combinacion:'Combinación no operativa', red:'Alerta de red'
        }[alerta.tipo] || 'Alerta Metro';

        toast.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:10px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" style="flex-shrink:0;margin-top:1px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div style="flex:1;min-width:0;">
                    <div style="color:#f87171;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">${escapeHtmlTrans(tipoLabel)}</div>
                    <div style="color:#f8fafc;font-size:12px;font-weight:600;line-height:1.4;">${escapeHtmlTrans(alerta.target)}</div>
                    <div style="color:#94a3b8;font-size:11px;margin-top:3px;line-height:1.35;">${escapeHtmlTrans(alerta.mensaje.substring(0,100))}${alerta.mensaje.length>100?'…':''}</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:#475569;cursor:pointer;padding:0;font-size:18px;line-height:1;flex-shrink:0;">&times;</button>
            </div>
        `;

        document.body.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 12000);
    });
}

// ─── Panel de alertas global (encima del grid de líneas) ──────────────────────
function _renderPanelAlertas(alertas, container) {
    if (!container) return;
    alertas = filtrarAlertasActivas(alertas);
    if (alertas.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    let html = `
        <div class="metro-alertas-scroll" style="background:rgba(153,27,27,0.12);border:1px solid rgba(248,113,113,0.35);border-radius:12px;padding:12px 14px;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:9px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span style="font-size:11px;font-weight:800;color:#f87171;text-transform:uppercase;letter-spacing:.07em;">Alertas detectadas vía X</span>
                <span style="background:rgba(248,113,113,0.2);color:#f87171;font-size:10px;font-weight:800;padding:1px 6px;border-radius:8px;border:1px solid rgba(248,113,113,0.3);">${alertas.length}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:7px;">
    `;

    alertas.forEach(a => {
        const lineasBadges = (a.lineas || []).map(l =>
            `<span style="background:rgba(248,113,113,0.15);color:#fca5a5;font-size:9.5px;font-weight:800;padding:1px 5px;border-radius:4px;border:1px solid rgba(248,113,113,0.3);">${escapeHtmlTrans(l)}</span>`
        ).join('');
        html += `
            <div style="background:rgba(0,0,0,0.25);border-radius:8px;padding:9px 11px;border-left:3px solid #f87171;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;min-width:0;">
                    <div style="display:flex;align-items:center;gap:5px;min-width:0;flex:1;flex-wrap:wrap;">
                        <span style="color:#fca5a5;font-size:11px;font-weight:700;">${escapeHtmlTrans(a.target)}</span>
                        ${lineasBadges}
                    </div>
                    <span style="color:#64748b;font-size:10px;font-weight:600;white-space:nowrap;flex-shrink:0;">${escapeHtmlTrans(formatearFechaAlerta(a.ts))}</span>
                </div>
                <div style="color:#94a3b8;font-size:11px;line-height:1.4;">${escapeHtmlTrans(formatearMensajeAlerta(a.mensaje.substring(0,160)))}${a.mensaje.length>160?'…':''}</div>
            </div>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

// ─── Cápsula de línea rediseñada — útil e informativa ────────────────────────
function _renderLineaCapsule(l, alertasLinea, metroAbierto) {
    const tieneAlerta = alertasLinea.length > 0;
    const servicioActivo = Boolean(metroAbierto);

    // Estado del badge
    const estadoColor = tieneAlerta ? '#f87171' : (servicioActivo ? '#34d399' : '#fbbf24');
    const estadoBg    = tieneAlerta ? 'rgba(248,113,113,0.12)' : (servicioActivo ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.12)');
    const estadoBorder= tieneAlerta ? 'rgba(248,113,113,0.35)' : (servicioActivo ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.3)');
    const estadoTxt   = tieneAlerta ? 'Afectada' : (servicioActivo ? 'Operativa' : 'Metro cerrado');

    // Construir el contenido del panel expandible — solo info útil:
    // 1. Alertas activas (si hay)
    // 2. Estado del servicio
    // 3. Terminales (para saber de dónde a dónde va)
    // 4. Horario de operación del día actual
    let expandHtml = '';

    if (tieneAlerta) {
        expandHtml += `
            <div>
                <div style="font-size:10.5px;font-weight:800;color:#f87171;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;display:flex;align-items:center;gap:5px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Incidentes activos
                </div>
                ${alertasLinea.map(a => `
                    <div style="background:rgba(153,27,27,0.15);border:1px solid rgba(248,113,113,0.25);border-radius:10px;padding:12px;margin-bottom:8px;">
                        <div style="color:#fca5a5;font-weight:700;font-size:13px;margin-bottom:6px;">${escapeHtmlTrans(a.target)}</div>
                        <div style="color:#cbd5e1;font-size:11.5px;line-height:1.5;">${escapeHtmlTrans(formatearMensajeAlerta(a.mensaje.substring(0,200)))}${a.mensaje.length>200?'…':''}</div>
                        <div style="color:#64748b;font-size:10px;font-weight:600;margin-top:8px;">${escapeHtmlTrans(formatearFechaAlerta(a.ts))}</div>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (servicioActivo) {
        expandHtml += `
            <div style="display:flex;align-items:center;gap:7px;background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:10px 12px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span style="color:#86efac;font-size:12.5px;font-weight:600;">Sin interrupciones reportadas</span>
            </div>
        `;
    } else {
        expandHtml += `
            <div style="display:flex;align-items:center;gap:7px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:10px 12px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5" style="flex-shrink:0;"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
                <span style="color:#fcd34d;font-size:12px;font-weight:600;">Servicio fuera de horario de operación.</span>
            </div>
        `;
    }

    return `
        <div class="metro-linea-capsule" style="
            background:rgba(15,23,42,0.60);
            border:1px solid ${tieneAlerta ? 'rgba(248,113,113,0.45)' : 'rgba(255,255,255,0.08)'};
            border-radius:14px;
            overflow:hidden;
            ${tieneAlerta ? 'box-shadow:0 0 0 1px rgba(248,113,113,0.12),0 4px 20px rgba(153,27,27,0.1);' : ''}
        ">
            <!-- Header de la cápsula -->
            <div class="metro-linea-header"
                onclick="toggleLineaDetalle('${l.linea}')"
                onmouseover="this.style.background='rgba(255,255,255,0.03)'"
                onmouseout="this.style.background='transparent'"
                style="
                    padding:13px 15px;
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    cursor:pointer;
                    user-select:none;
                    gap:10px;
                    background:transparent;
                    transition: background 0.2s;
                "
            >
                <!-- Izq: badge de color + nombre corto -->
                <div style="display:flex;align-items:center;gap:11px;min-width:0;">
                    <div style="position:relative;flex-shrink:0;">
                        <div style="
                            width:40px;height:40px;
                            background:${l.color};
                            border-radius:11px;
                            display:flex;align-items:center;justify-content:center;
                            box-shadow:0 2px 10px ${l.color}50;
                            font-size:11px;font-weight:900;color:#fff;
                        ">${escapeHtmlTrans(l.linea)}</div>
                        ${tieneAlerta ? `<div id="alerta-dot-${l.linea}" style="position:absolute;top:-3px;right:-3px;width:11px;height:11px;background:#f87171;border-radius:50%;border:2px solid rgba(10,15,30,0.9);box-shadow:0 0 5px #f87171;"></div>` : `<div id="alerta-dot-${l.linea}" style="display:none;position:absolute;top:-3px;right:-3px;width:11px;height:11px;background:#f87171;border-radius:50%;border:2px solid rgba(10,15,30,0.9);box-shadow:0 0 5px #f87171;"></div>`}
                    </div>
                    <div style="min-width:0;">
                        <div style="font-size:13px;font-weight:700;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtmlTrans(l.nombre)}</div>
                        <div style="font-size:10.5px;color:#64748b;margin-top:1px;">${l.estaciones_total} estaciones &nbsp;·&nbsp; ${escapeHtmlTrans(l.longitud_km)}</div>
                    </div>
                </div>

                <!-- Der: estado + chevron -->
                <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                    <div id="estado-badge-${l.linea}" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:${estadoColor};background:${estadoBg};padding:4px 9px;border-radius:7px;border:1px solid ${estadoBorder};">
                        <span class="estado-dot" style="width:6px;height:6px;border-radius:50%;background:${estadoColor};box-shadow:0 0 5px ${estadoColor};flex-shrink:0;"></span>
                        <span class="estado-txt">${estadoTxt}</span>
                    </div>
                    <svg id="chevron-${l.linea}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:#64748b;transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
                </div>

            </div>

            <!-- Detalle expandible -->
            <div id="detalle-linea-${l.linea}" class="metro-linea-detail" style="display:none;padding:12px 15px;border-top:1px solid rgba(255,255,255,0.08);background:transparent;">
                ${expandHtml}
            </div>
        </div>
    `;
}

function _renderEstadoMetroCapsule(metroAbierto, alertas) {
    const servicioActivo = Boolean(metroAbierto);
    const hayAlertas = Array.isArray(alertas) && alertas.length > 0;
    const estado = !servicioActivo
        ? {
            color: '#fbbf24',
            bg: 'rgba(245,158,11,0.12)',
            border: 'rgba(245,158,11,0.35)',
            title: 'Metro cerrado',
            detail: 'Fuera del horario de servicio'
        }
        : hayAlertas
            ? {
                color: '#f87171',
                bg: 'rgba(248,113,113,0.12)',
                border: 'rgba(248,113,113,0.35)',
                title: 'Red afectada',
                detail: `${alertas.length} alerta${alertas.length === 1 ? '' : 's'} activa${alertas.length === 1 ? '' : 's'}`
            }
            : {
                color: '#34d399',
                bg: 'rgba(16,185,129,0.10)',
                border: 'rgba(16,185,129,0.28)',
                title: 'Red operativa',
                detail: 'Sin interrupciones reportadas'
            };

    return `
        <div class="metro-status-capsule" style="color:${estado.color};background:${estado.bg};border-color:${estado.border};padding-left:12px;">
            <span class="metro-status-copy">
                <strong>${estado.title}</strong>
                <small>${estado.detail}</small>
            </span>
        </div>
    `;
}

// ─── Carga principal ──────────────────────────────────────────────────────────
async function cargarDatosTransporte() {
    const lineasGrid     = document.getElementById('metro-lineas-grid');
    const horarioBadge   = document.getElementById('metro-horario-badge');
    const tarifasBox     = document.getElementById('tarifas-detalle-box');
    const alertasPanel   = document.getElementById('metro-alertas-panel');

    if (horarioBadge) {
        horarioBadge.innerHTML = `<svg class='spin' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5'><path d='M21 12a9 9 0 1 1-6.219-8.56'></path></svg>`;
    }

    try {
        const stopQuery = activeParaderoCode ? `?stop=${encodeURIComponent(activeParaderoCode)}` : '';
        const res  = await fetch(`/api/transporte${stopQuery}`);
        const data = await res.json();
        datosTransporteCache = data;

        // 1. Cápsula de estado general
        if (horarioBadge) {
            horarioBadge.innerHTML = _renderEstadoMetroCapsule(data.metro_abierto, filtrarAlertasActivas(data.alertas));
        }

        // 2. Panel global de alertas
        const alertas = filtrarAlertasActivas(data.alertas);
        _renderPanelAlertas(alertas, alertasPanel);

        // 3. Cápsulas de líneas
        if (lineasGrid && Array.isArray(data.lineas_metro)) {
            lineasGrid.innerHTML = data.lineas_metro
                .map(l => _renderLineaCapsule(l, _alertasDeLinea(alertas, l.linea), data.metro_abierto))
                .join('');
        }

        // 4. Tarifas
        if (tarifasBox && data.tarifas) {
            const labels = {
                punta:        { name:'Punta',        desc:'07:00-08:59 · 18:00-19:59', border:'rgba(239,68,68,0.3)',   bg:'rgba(239,68,68,0.15)',   col:'#f87171' },
                valle:        { name:'Valle',         desc:'09:00-17:59 · 20:00-20:44', border:'rgba(56,189,248,0.3)',  bg:'rgba(56,189,248,0.15)',  col:'#38bdf8' },
                bajo:         { name:'Bajo',          desc:'06:00-06:59 · 20:45-23:00', border:'rgba(16,185,129,0.3)', bg:'rgba(16,185,129,0.15)',  col:'#34d399' },
                estudiante:   { name:'TNE (Escolar)', desc:'Todo horario · 365 días',   border:'rgba(168,85,247,0.3)', bg:'rgba(168,85,247,0.15)',  col:'#c084fc' },
                adulto_mayor: { name:'BAM (Mayor)',   desc:'Beneficio rebajado',         border:'rgba(245,158,11,0.3)', bg:'rgba(245,158,11,0.15)',  col:'#fbbf24' }
            };
            tarifasBox.innerHTML = Object.keys(data.tarifas).map(k => {
                const t    = data.tarifas[k];
                const meta = labels[k] || { name:k, desc:t.horario, border:'rgba(255,255,255,0.1)', bg:'rgba(255,255,255,0.1)', col:'#cbd5e1' };
                return `
                    <div style="background:rgba(15,23,42,0.55);border:1px solid ${meta.border};border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:7px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                            <div style="color:#f8fafc;font-weight:700;font-size:13px;">${meta.name}</div>
                            <span style="background:${meta.bg};color:${meta.col};font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px;flex-shrink:0;">Metro: ${t.metro}</span>
                        </div>
                        <div style="color:#64748b;font-size:10.5px;">${meta.desc}</div>
                        <div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.05);padding-top:6px;font-size:11.5px;">
                            <span style="color:#64748b;">Bus Red: <strong style="color:#cbd5e1;">${t.bus}</strong></span>
                            <span style="color:#64748b;">Metro: <strong style="color:#cbd5e1;">${t.metro}</strong></span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 5. Buses del paradero activo
        renderBusesList(data.paradero, activeParaderoCode);

    } catch (e) {
        if (lineasGrid) {
            lineasGrid.innerHTML = '<div style="color:#f87171;font-size:12px;padding:12px;">Error de conexión al cargar la red de transporte.</div>';
        }
        console.error('[Transporte]', e);
    }
}

// ─── Acordeón ─────────────────────────────────────────────────────────────────
function toggleLineaDetalle(lineaCode) {
    const el   = document.getElementById(`detalle-linea-${lineaCode}`);
    const chev = document.getElementById(`chevron-${lineaCode}`);
    if (!el) return;
    const abierto = el.style.display !== 'none' && el.style.display !== '';
    el.style.display   = abierto ? 'none' : 'block';
    if (chev) chev.style.transform = abierto ? 'rotate(0deg)' : 'rotate(180deg)';
}

// ─── Buses del paradero ───────────────────────────────────────────────────────
async function cargarBusesParadero(code) {
    const busesList = document.getElementById('transporte-buses-list');
    if (!busesList) return;

    busesList.innerHTML = `
        <div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:13px;">
            <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle; margin-right: 6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Conectando con GPS...
        </div>
    `;

    try {
        const res  = await fetch(`/api/transporte?stop=${encodeURIComponent(code)}`);
        const data = await res.json();
        renderBusesList(data.paradero, code);
    } catch (e) {
        busesList.innerHTML = `<div style="color:#f87171;text-align:center;padding:20px;">Error al consultar el paradero ${escapeHtmlTrans(code)}.</div>`;
    }
}

function renderBusesList(paraderoData, code) {
    const busesList = document.getElementById('transporte-buses-list');
    if (!busesList) return;

    if (!code) {
        busesList.innerHTML = `
            <div style="text-align:center;padding:22px 16px;background:rgba(15,23,42,0.4);border-radius:10px;border:1px dashed rgba(255,255,255,0.08);color:#94a3b8;font-size:12.5px;">
                <div style="font-weight:600;color:#f8fafc;margin-bottom:4px;">Busca un paradero</div>
                <div style="font-size:11px;color:#64748b;">Ingresa un código para ver sus buses.</div>
            </div>
        `;
        return;
    }

    if (!paraderoData || !paraderoData.services || paraderoData.services.length === 0) {
        busesList.innerHTML = `
            <div style="text-align:center;padding:22px 16px;background:rgba(15,23,42,0.4);border-radius:10px;border:1px dashed rgba(255,255,255,0.08);color:#94a3b8;font-size:12.5px;">
                <div style="font-weight:600;color:#f8fafc;margin-bottom:4px;">No hay buses disponibles</div>
                <div style="font-size:11px;color:#64748b;">Revisa el código del paradero.</div>
            </div>
        `;
        return;
    }

    let html = `
        <div style="font-size:11.5px;color:#94a3b8;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
            <span>Paradero: <strong style="color:#38bdf8;">${escapeHtmlTrans(paraderoData.name || code)}</strong></span>
            <span style="color:#64748b;">${paraderoData.services.length} recorridos</span>
        </div>
    `;

    const services = [...paraderoData.services].sort((a, b) => {
        const aTieneGps = Array.isArray(a.buses) && a.buses.length > 0;
        const bTieneGps = Array.isArray(b.buses) && b.buses.length > 0;
        if (aTieneGps !== bTieneGps) return bTieneGps - aTieneGps;
        if (!aTieneGps) return 0;
        const aMin = Number(a.buses[0].min_arrival_time);
        const bMin = Number(b.buses[0].min_arrival_time);
        return (Number.isFinite(aMin) ? aMin : Number.MAX_SAFE_INTEGER) -
            (Number.isFinite(bMin) ? bMin : Number.MAX_SAFE_INTEGER);
    });

    services.forEach(s => {
        const hasBuses     = Array.isArray(s.buses) && s.buses.length > 0;
        const primerBus    = hasBuses ? s.buses[0] : null;
        const tiempoLlegada = primerBus
            ? (primerBus.min_arrival_time !== undefined
                ? `${primerBus.min_arrival_time}–${primerBus.max_arrival_time} min`
                : 'En camino')
            : 'Sin buses';
        const distancia = primerBus && primerBus.meters_distance ? `${primerBus.meters_distance} m` : '';

        html += `
            <div class="transporte-bus-row" style="background:rgba(15,23,42,0.55);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:11px 13px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
                <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                    <span style="background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;font-weight:800;font-size:12.5px;padding:5px 10px;border-radius:8px;min-width:48px;text-align:center;flex-shrink:0;">${escapeHtmlTrans(s.id)}</span>
                    <div style="min-width:0;">
                        <div style="font-size:12.5px;font-weight:600;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtmlTrans(compactarServicio(s.status_description || 'Servicio regular'))}</div>
                        ${distancia ? `<div style="font-size:10.5px;color:#64748b;margin-top:1px;">GPS: ${distancia}</div>` : ''}
                    </div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <div style="font-size:13px;font-weight:700;color:${hasBuses ? '#38bdf8' : '#64748b'};">${escapeHtmlTrans(tiempoLlegada)}</div>
                    <div style="font-size:10px;color:#94a3b8;">${hasBuses ? 'Arribo' : 'Sin buses'}</div>
                </div>
            </div>
        `;
    });

    busesList.innerHTML = html;
}

// ─── Auto-polling de alertas (cada 90 s, sin recargar la página) ──────────────
// Consulta /api/metro-alertas en silencio. Si llegan alertas nuevas:
//  · actualiza el panel de alertas global
//  · actualiza el color del badge de cada línea afectada
async function _pollAlertas() {
    try {
        const res  = await fetch('/api/metro-alertas', { cache: 'no-store' });
        const data = await res.json();
        const alertas = filtrarAlertasActivas(data.alertas);

        // Actualizar panel global
        _renderPanelAlertas(alertas, document.getElementById('metro-alertas-panel'));

        // Actualizar badge de estado de cada línea (rojo/verde) sin rerenderizar todo
        if (datosTransporteCache && Array.isArray(datosTransporteCache.lineas_metro)) {
            datosTransporteCache.lineas_metro.forEach(l => {
                const alertasLinea = _alertasDeLinea(alertas, l.linea);
                const tieneAlerta  = alertasLinea.length > 0;

                // Badge de estado dentro del header de la cápsula
                const badgeEl = document.getElementById(`estado-badge-${l.linea}`);
                if (badgeEl) {
                    const col = tieneAlerta ? '#f87171' : '#34d399';
                    const bg  = tieneAlerta ? 'rgba(248,113,113,0.12)' : 'rgba(16,185,129,0.10)';
                    const brd = tieneAlerta ? 'rgba(248,113,113,0.35)' : 'rgba(16,185,129,0.25)';
                    badgeEl.style.color        = col;
                    badgeEl.style.background   = bg;
                    badgeEl.style.borderColor  = brd;
                    badgeEl.querySelector('.estado-dot').style.background   = col;
                    badgeEl.querySelector('.estado-dot').style.boxShadow    = `0 0 5px ${col}`;
                    badgeEl.querySelector('.estado-txt').textContent        = tieneAlerta ? 'Afectada' : 'Operativa';
                }

                // Punto rojo encima del badge de color de la línea
                const dotEl = document.getElementById(`alerta-dot-${l.linea}`);
                if (dotEl) dotEl.style.display = tieneAlerta ? 'block' : 'none';
            });
        }

    } catch (e) {
        // Silencioso — no interrumpir la UI si el poll falla
    }
}

// Iniciar el ciclo de polling después de la carga inicial
function _iniciarPollingAlertas() {
    setInterval(_pollAlertas, 90000); // cada 90 segundos
}

document.addEventListener('DOMContentLoaded', () => {
    initTransporte();
    // Esperar 10 s después de cargar para empezar el polling periódico
    setTimeout(_iniciarPollingAlertas, 10000);
});

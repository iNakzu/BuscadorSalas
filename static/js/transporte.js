// ==============================================================================
// METRO DE SANTIAGO & TRANSPORTE PÚBLICO (RED METROPOLITANA DE MOVILIDAD)
// v6 — Cápsulas rediseñadas + Sistema de Alertas X (@metrodesantiago)
// ==============================================================================

let datosTransporteCache = null;
let activeParaderoCode = 'PA349';
let _alertasAnterioresIds = new Set(); // Para detectar alertas nuevas y mostrar toast

async function initTransporte() {
    await cargarDatosTransporte();
}

function consultarParaderoManual() {
    const input = document.getElementById('transporte-codigo-input');
    if (!input) return;
    const val = input.value.trim().toUpperCase();
    if (!val) {
        alert('Por favor ingresa un código de paradero válido (ej: PA349).');
        return;
    }
    activeParaderoCode = val;
    cargarBusesParadero(val);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtmlTrans(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Dado el array de alertas y un código de línea (ej. "L1"),
 * devuelve las alertas que afectan esa línea.
 */
function _alertasDeLinea(alertas, lineaCode) {
    if (!alertas || alertas.length === 0) return [];
    return alertas.filter(a =>
        (a.lineas && a.lineas.includes(lineaCode)) ||
        (a.tipo === 'red')
    );
}

// ─── Toast de notificación ────────────────────────────────────────────────────

function _mostrarToastAlerta(alertas) {
    // Encontrar alertas nuevas que no estaban antes
    const nuevas = alertas.filter(a => !_alertasAnterioresIds.has(a.id));
    if (nuevas.length === 0) return;

    nuevas.forEach(alerta => {
        _alertasAnterioresIds.add(alerta.id);

        const toastId = `toast-metro-${alerta.id}`;
        if (document.getElementById(toastId)) return; // ya existe

        const toast = document.createElement('div');
        toast.id = toastId;
        toast.setAttribute('role', 'alert');
        toast.style.cssText = `
            position: fixed; bottom: 80px; right: 20px; z-index: 9999;
            background: rgba(10, 15, 30, 0.92);
            border: 1px solid rgba(248, 113, 113, 0.55);
            border-left: 4px solid #f87171;
            border-radius: 12px;
            padding: 14px 18px;
            max-width: 320px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(248,113,113,0.15);
            backdrop-filter: blur(16px);
            animation: slideInToast 0.4s ease;
            font-family: inherit;
        `;

        const tipoLabel = {
            estacion: 'Estación Afectada',
            tramo: 'Tramo Interrumpido',
            combinacion: 'Combinación No Operativa',
            red: 'Alerta de Red'
        }[alerta.tipo] || 'Alerta Metro';

        toast.innerHTML = `
            <div style="display:flex; align-items:flex-start; gap:10px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" style="flex-shrink:0; margin-top:1px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <div style="flex:1; min-width:0;">
                    <div style="color:#f87171; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:3px;">${escapeHtmlTrans(tipoLabel)}</div>
                    <div style="color:#f8fafc; font-size:12.5px; font-weight:600; line-height:1.4; word-break:break-word;">${escapeHtmlTrans(alerta.target)}</div>
                    <div style="color:#94a3b8; font-size:11px; margin-top:4px; line-height:1.35;">${escapeHtmlTrans(alerta.mensaje.substring(0,120))}${alerta.mensaje.length>120?'…':''}</div>
                    <div style="color:#475569; font-size:10px; margin-top:6px; display:flex; align-items:center; gap:4px;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        Vía X @metrodesantiago
                    </div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:#475569; cursor:pointer; padding:0; line-height:1; flex-shrink:0; font-size:16px;">&times;</button>
            </div>
        `;

        document.body.appendChild(toast);

        // Auto-remover después de 12 segundos
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 12000);
    });
}

// ─── Panel de Alertas ─────────────────────────────────────────────────────────

function _renderPanelAlertas(alertas, container) {
    if (!container) return;
    if (!alertas || alertas.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    const tipoIcon = {
        estacion: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
        tramo: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`,
        combinacion: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
        red: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
    };

    const tipoLabel = {
        estacion: 'Estación', tramo: 'Tramo', combinacion: 'Combinación', red: 'Red'
    };

    let html = `
        <div style="
            background: rgba(153, 27, 27, 0.12);
            border: 1px solid rgba(248, 113, 113, 0.35);
            border-radius: 12px;
            padding: 12px 14px;
            margin-bottom: 14px;
        ">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span style="font-size:11px; font-weight:800; color:#f87171; text-transform:uppercase; letter-spacing:0.07em;">Alertas Activas X @metrodesantiago</span>
                <span style="background:rgba(248,113,113,0.2); color:#f87171; font-size:10px; font-weight:800; padding:1px 7px; border-radius:10px; border:1px solid rgba(248,113,113,0.35);">${alertas.length}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:7px;">
    `;

    alertas.forEach(a => {
        const icon = tipoIcon[a.tipo] || tipoIcon.red;
        const label = tipoLabel[a.tipo] || 'Red';
        const lineasBadges = (a.lineas || []).map(l =>
            `<span style="background:rgba(248,113,113,0.15); color:#fca5a5; font-size:9.5px; font-weight:800; padding:1px 5px; border-radius:4px; border:1px solid rgba(248,113,113,0.3);">${escapeHtmlTrans(l)}</span>`
        ).join('');

        html += `
            <div style="background:rgba(0,0,0,0.25); border-radius:8px; padding:9px 11px; border-left:3px solid #f87171;">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
                    <span style="color:#f87171;">${icon}</span>
                    <span style="color:#fca5a5; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">${escapeHtmlTrans(label)}</span>
                    ${lineasBadges}
                </div>
                <div style="color:#e2e8f0; font-size:12px; font-weight:600; line-height:1.4; margin-bottom:3px;">${escapeHtmlTrans(a.target)}</div>
                <div style="color:#94a3b8; font-size:11px; line-height:1.35;">${escapeHtmlTrans(a.mensaje.substring(0,160))}${a.mensaje.length>160?'…':''}</div>
                ${a.link ? `<a href="${escapeHtmlTrans(a.link)}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8; font-size:10px; margin-top:4px; display:inline-block; text-decoration:none;">Ver en X ↗</a>` : ''}
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;
    container.innerHTML = html;
}

// ─── Cápsulas de Líneas rediseñadas ──────────────────────────────────────────

function _renderLineaCapsule(l, alertasLinea) {
    const tieneAlerta = alertasLinea.length > 0;

    const combHtml = (l.combinaciones || []).map(c => `
        <span style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 2px 7px; font-size: 10.5px; color: #cbd5e1;">${escapeHtmlTrans(c)}</span>
    `).join('');

    const estHtml = (l.principales_estaciones || []).join(' ➔ ');

    // Status dot & badge
    const estadoColor = tieneAlerta ? '#f87171' : '#34d399';
    const estadoBg = tieneAlerta ? 'rgba(248,113,113,0.12)' : 'rgba(16,185,129,0.1)';
    const estadoBorder = tieneAlerta ? 'rgba(248,113,113,0.35)' : 'rgba(16,185,129,0.25)';
    const estadoTexto = tieneAlerta ? 'Afectada' : escapeHtmlTrans(l.estado);

    // Banner de alerta dentro de la cápsula (si hay)
    let alertaBannerHtml = '';
    if (tieneAlerta) {
        const alertaEjemplo = alertasLinea[0];
        const tipoMap = { estacion: 'Estación afectada', tramo: 'Tramo interrumpido', combinacion: 'Combinación no operativa', red: 'Alerta de red' };
        alertaBannerHtml = `
            <div style="
                background: rgba(153,27,27,0.18);
                border-top: 1px solid rgba(248,113,113,0.25);
                padding: 7px 16px;
                display: flex;
                align-items: center;
                gap: 7px;
            ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" style="flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span style="color:#fca5a5; font-size:11px; font-weight:700;">${escapeHtmlTrans(tipoMap[alertaEjemplo.tipo] || 'Alerta')}:</span>
                <span style="color:#e2e8f0; font-size:11px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtmlTrans(alertaEjemplo.mensaje.substring(0,100))}${alertaEjemplo.mensaje.length>100?'…':''}</span>
                ${alertaEjemplo.link ? `<a href="${escapeHtmlTrans(alertaEjemplo.link)}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8; font-size:10px; text-decoration:none; flex-shrink:0;">Ver ↗</a>` : ''}
            </div>
        `;
    }

    return `
        <div class="linea-capsule" style="
            background: rgba(15, 23, 42, 0.60);
            border: 1px solid ${tieneAlerta ? 'rgba(248,113,113,0.45)' : 'rgba(255,255,255,0.08)'};
            border-radius: 14px;
            overflow: hidden;
            transition: border-color 0.25s ease, box-shadow 0.25s ease;
            ${tieneAlerta ? 'box-shadow: 0 0 0 1px rgba(248,113,113,0.15), 0 4px 24px rgba(153,27,27,0.12);' : ''}
        ">
            <!-- Header principal de la cápsula -->
            <div
                onclick="toggleLineaDetalle('${l.linea}')"
                style="
                    padding: 14px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                    user-select: none;
                    gap: 12px;
                    background: ${tieneAlerta ? 'rgba(153,27,27,0.08)' : 'rgba(30, 41, 59, 0.30)'};
                    transition: background 0.2s ease;
                "
                onmouseenter="this.style.background='${tieneAlerta ? 'rgba(153,27,27,0.14)' : 'rgba(30,41,59,0.5)'}'"
                onmouseleave="this.style.background='${tieneAlerta ? 'rgba(153,27,27,0.08)' : 'rgba(30,41,59,0.30)'}'"
            >
                <!-- Izquierda: badge de línea + info -->
                <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                    <!-- Badge circular con color de línea -->
                    <div style="
                        position: relative;
                        flex-shrink: 0;
                    ">
                        <div style="
                            width: 42px; height: 42px;
                            background: ${l.color};
                            border-radius: 12px;
                            display: flex; align-items: center; justify-content: center;
                            box-shadow: 0 3px 12px ${l.color}50;
                            font-size: 11px; font-weight: 900; color: #fff;
                            letter-spacing: -0.02em;
                        ">${escapeHtmlTrans(l.linea)}</div>
                        ${tieneAlerta ? `
                        <div style="
                            position: absolute; top: -3px; right: -3px;
                            width: 12px; height: 12px;
                            background: #f87171;
                            border-radius: 50%;
                            border: 2px solid rgba(10,15,30,0.9);
                            box-shadow: 0 0 6px #f87171;
                        "></div>` : ''}
                    </div>

                    <!-- Texto de la línea -->
                    <div style="min-width: 0; flex: 1;">
                        <div style="font-size: 13.5px; font-weight: 700; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${escapeHtmlTrans(l.nombre)}
                        </div>
                        <div style="font-size: 11.5px; color: #94a3b8; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${escapeHtmlTrans(l.terminales)}
                        </div>
                        <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
                            ${l.estaciones_total} estaciones &nbsp;·&nbsp; ${escapeHtmlTrans(l.longitud_km)}
                        </div>
                    </div>
                </div>

                <!-- Derecha: estado + chevron -->
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    <div style="
                        display: flex; align-items: center; gap: 5px;
                        font-size: 11px; font-weight: 700;
                        color: ${estadoColor};
                        background: ${estadoBg};
                        padding: 4px 10px; border-radius: 7px;
                        border: 1px solid ${estadoBorder};
                    ">
                        <span style="
                            width: 7px; height: 7px; border-radius: 50%;
                            background: ${estadoColor};
                            box-shadow: 0 0 5px ${estadoColor};
                            flex-shrink: 0;
                        "></span>
                        <span>${estadoTexto}</span>
                    </div>
                    <svg id="chevron-${l.linea}" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: #64748b; transition: transform 0.2s ease;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
            </div>

            <!-- Banner de alerta (visible si hay alerta) -->
            ${alertaBannerHtml}

            <!-- Detalle expandible -->
            <div id="detalle-linea-${l.linea}" style="display: none; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(8, 12, 24, 0.5);">
                <!-- Alertas detalladas de esta línea -->
                ${tieneAlerta ? `
                <div style="padding: 12px 16px 0;">
                    <div style="font-weight: 700; color: #f87171; margin-bottom: 7px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; display:flex; align-items:center; gap:5px;">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Alertas detectadas en X
                    </div>
                    ${alertasLinea.map(a => `
                        <div style="background:rgba(153,27,27,0.15); border:1px solid rgba(248,113,113,0.2); border-radius:8px; padding:8px 10px; margin-bottom:6px; font-size:11.5px;">
                            <div style="color:#fca5a5; font-weight:600; margin-bottom:3px;">${escapeHtmlTrans(a.target)}</div>
                            <div style="color:#94a3b8; line-height:1.4;">${escapeHtmlTrans(a.mensaje.substring(0,200))}${a.mensaje.length>200?'…':''}</div>
                            ${a.link ? `<a href="${escapeHtmlTrans(a.link)}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8; font-size:10px; margin-top:4px; display:inline-block; text-decoration:none;">Publicación original en X ↗</a>` : ''}
                        </div>
                    `).join('')}
                </div>
                ` : ''}

                <!-- Combinaciones y estaciones clave -->
                <div style="padding: 12px 16px; font-size: 11.5px;">
                    <div style="margin-bottom: 10px;">
                        <div style="font-weight: 700; color: #38bdf8; margin-bottom: 6px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em;">Combinaciones de Red</div>
                        <div style="display: flex; gap: 5px; flex-wrap: wrap;">${combHtml}</div>
                    </div>
                    <div>
                        <div style="font-weight: 700; color: #a78bfa; margin-bottom: 6px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em;">Estaciones Clave</div>
                        <div style="color: #94a3b8; line-height: 1.55;">${escapeHtmlTrans(estHtml)}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ─── Carga principal de datos ─────────────────────────────────────────────────

async function cargarDatosTransporte() {
    const lineasGrid = document.getElementById('metro-lineas-grid');
    const horarioBadge = document.getElementById('metro-horario-badge');
    const tarifasBox = document.getElementById('tarifas-detalle-box');
    const alertasContainer = document.getElementById('metro-alertas-panel');

    if (horarioBadge) {
        horarioBadge.innerHTML = `<span class="pulse-dot"></span><span>Consultando red...</span>`;
    }

    try {
        const res = await fetch(`/api/transporte?stop=${encodeURIComponent(activeParaderoCode)}`);
        const data = await res.json();
        datosTransporteCache = data;

        // 1. Estado General de la Red
        if (horarioBadge) {
            horarioBadge.innerHTML = `
                <span class="status-dot ${data.metro_abierto ? '' : 'occ'}" style="${data.metro_abierto ? 'background: #34d399; box-shadow: 0 0 6px #10b981;' : 'background: #f43f5e; box-shadow: 0 0 6px #f43f5e;'}"></span>
                <span>${data.metro_abierto ? 'Red Operativa (' + data.hora_chile + ' hrs)' : 'Metro Cerrado (' + data.hora_chile + ' hrs)'}</span>
            `;
        }

        // 2. Panel de Alertas globales
        const alertas = data.alertas || [];
        _renderPanelAlertas(alertas, alertasContainer);
        if (alertas.length > 0) {
            _mostrarToastAlerta(alertas);
        }

        // 3. Renderizar Cápsulas de Líneas rediseñadas
        if (lineasGrid && Array.isArray(data.lineas_metro)) {
            let html = '';
            data.lineas_metro.forEach(l => {
                const alertasLinea = _alertasDeLinea(alertas, l.linea);
                html += _renderLineaCapsule(l, alertasLinea);
            });
            lineasGrid.innerHTML = html;
        }

        // 4. Tarifas
        if (tarifasBox && data.tarifas) {
            let tarHtml = '';
            const labels = {
                'punta':        { name: 'Horario Punta',        desc: '07:00-08:59 y 18:00-19:59',   border: 'rgba(239, 68, 68, 0.3)',   badgeBg: 'rgba(239, 68, 68, 0.15)',   badgeCol: '#f87171' },
                'valle':        { name: 'Horario Valle',        desc: '09:00-17:59 y 20:00-20:44',   border: 'rgba(56, 189, 248, 0.3)',  badgeBg: 'rgba(56, 189, 248, 0.15)',  badgeCol: '#38bdf8' },
                'bajo':         { name: 'Horario Bajo',         desc: '06:00-06:59 y 20:45-23:00',   border: 'rgba(16, 185, 129, 0.3)',  badgeBg: 'rgba(16, 185, 129, 0.15)', badgeCol: '#34d399' },
                'estudiante':   { name: 'Pase Escolar (TNE)',   desc: 'Válido 24 horas los 365 días', border: 'rgba(168, 85, 247, 0.3)',  badgeBg: 'rgba(168, 85, 247, 0.15)', badgeCol: '#c084fc' },
                'adulto_mayor': { name: 'Adulto Mayor (BAM)',   desc: 'Beneficio tarifa rebajada',    border: 'rgba(245, 158, 11, 0.3)',  badgeBg: 'rgba(245, 158, 11, 0.15)', badgeCol: '#fbbf24' }
            };

            Object.keys(data.tarifas).forEach(k => {
                const t = data.tarifas[k];
                const meta = labels[k] || { name: k, desc: t.horario, border: 'rgba(255,255,255,0.1)', badgeBg: 'rgba(255,255,255,0.1)', badgeCol: '#cbd5e1' };
                tarHtml += `
                    <div style="background: rgba(15, 23, 42, 0.55); border: 1px solid ${meta.border}; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="color: #f8fafc; font-weight: 700; font-size: 13px;">${meta.name}</div>
                                <span style="background: ${meta.badgeBg}; color: ${meta.badgeCol}; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 5px;">Metro: ${t.metro}</span>
                            </div>
                            <div style="color: #94a3b8; font-size: 11px; margin-top: 3px;">${meta.desc}</div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px; font-size: 11.5px;">
                            <span style="color: #64748b;">Bus Red: <strong style="color: #cbd5e1;">${t.bus}</strong></span>
                            <span style="color: #64748b;">Tren: <strong style="color: #cbd5e1;">${t.metro}</strong></span>
                        </div>
                    </div>
                `;
            });
            tarifasBox.innerHTML = tarHtml;
        }

        // 5. Buses del Paradero Activo
        renderBusesList(data.paradero, activeParaderoCode);

    } catch (e) {
        if (lineasGrid) {
            lineasGrid.innerHTML = '<div style="color: #f87171; font-size: 12px; padding: 12px;">Error de conexión al cargar la red de transporte.</div>';
        }
        console.error('[Transporte] Error al cargar datos:', e);
    }
}

// ─── Acordeón ─────────────────────────────────────────────────────────────────

function toggleLineaDetalle(lineaCode) {
    const el = document.getElementById(`detalle-linea-${lineaCode}`);
    const chev = document.getElementById(`chevron-${lineaCode}`);
    if (!el) return;

    if (el.style.display === 'none' || !el.style.display) {
        el.style.display = 'block';
        if (chev) chev.style.transform = 'rotate(180deg)';
    } else {
        el.style.display = 'none';
        if (chev) chev.style.transform = 'rotate(0deg)';
    }
}

// ─── Buses del paradero ───────────────────────────────────────────────────────

async function cargarBusesParadero(code) {
    const busesList = document.getElementById('transporte-buses-list');
    if (!busesList) return;

    busesList.innerHTML = `
        <div style="text-align: center; padding: 25px 0; color: #94a3b8; font-size: 13px;">
            <span class="pulse-dot"></span> Consultando servicios para el paradero <strong>${escapeHtmlTrans(code)}</strong>...
        </div>
    `;

    try {
        const res = await fetch(`/api/transporte?stop=${encodeURIComponent(code)}`);
        const data = await res.json();
        renderBusesList(data.paradero, code);
    } catch (e) {
        busesList.innerHTML = `<div style="color: #f87171; text-align: center; padding: 20px;">Error al consultar el paradero ${escapeHtmlTrans(code)}.</div>`;
    }
}

function renderBusesList(paraderoData, code) {
    const busesList = document.getElementById('transporte-buses-list');
    if (!busesList) return;

    if (!paraderoData || !paraderoData.services || paraderoData.services.length === 0) {
        busesList.innerHTML = `
            <div style="text-align: center; padding: 25px 16px; background: rgba(15, 23, 42, 0.4); border-radius: 10px; border: 1px dashed rgba(255,255,255,0.08); color: #94a3b8; font-size: 13px;">
                <div style="font-weight: 600; color: #f8fafc; margin-bottom: 4px;">Información de GPS no disponible en este momento para el código ${escapeHtmlTrans(code)}</div>
                <div style="font-size: 11.5px; color: #64748b;">Puede deberse a horario nocturno sin salidas activas o a un código fuera del perímetro urbano.</div>
            </div>
        `;
        return;
    }

    let busesHtml = `
        <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span>Paradero oficial: <strong style="color: #38bdf8;">${escapeHtmlTrans(paraderoData.name || code)}</strong></span>
            <span style="color: #64748b;">${paraderoData.services.length} recorridos asignados</span>
        </div>
    `;

    paraderoData.services.forEach(s => {
        const hasBuses = Array.isArray(s.buses) && s.buses.length > 0;
        const primerBus = hasBuses ? s.buses[0] : null;
        const tiempoLlegada = primerBus ? (primerBus.min_arrival_time !== undefined ? `${primerBus.min_arrival_time} - ${primerBus.max_arrival_time} min` : 'En camino') : 'Sin buses cercanos';
        const distancia = primerBus ? (primerBus.meters_distance ? `${primerBus.meters_distance} metros` : '') : '';

        busesHtml += `
            <div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; font-weight: 800; font-size: 13px; padding: 5px 11px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); min-width: 52px; text-align: center;">
                        ${escapeHtmlTrans(s.id)}
                    </span>
                    <div>
                        <div style="font-size: 13.5px; font-weight: 600; color: #f1f5f9;">${escapeHtmlTrans(s.status_description || 'Servicio Regular')}</div>
                        ${distancia ? `<div style="font-size: 11px; color: #64748b; margin-top: 1px;">Distancia GPS: <span style="color: #94a3b8;">${distancia}</span></div>` : '<div style="font-size: 11px; color: #64748b; margin-top: 1px;">Monitoreo en tiempo real</div>'}
                    </div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                    <div style="font-size: 13.5px; font-weight: 700; color: ${hasBuses ? '#38bdf8' : '#64748b'};">${escapeHtmlTrans(tiempoLlegada)}</div>
                    <div style="font-size: 10.5px; color: #94a3b8;">${hasBuses ? 'Arribo estimado' : 'Frecuencia habitual'}</div>
                </div>
            </div>
        `;
    });
    busesList.innerHTML = busesHtml;
}

// ─── Animación CSS para el toast (inyectada una vez) ──────────────────────────
(function _injectToastCSS() {
    if (document.getElementById('metro-toast-style')) return;
    const style = document.createElement('style');
    style.id = 'metro-toast-style';
    style.textContent = `
        @keyframes slideInToast {
            from { opacity: 0; transform: translateX(40px); }
            to   { opacity: 1; transform: translateX(0); }
        }
    `;
    document.head.appendChild(style);
})();

document.addEventListener('DOMContentLoaded', initTransporte);

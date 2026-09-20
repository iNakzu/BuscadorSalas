// ==============================================================================
// METRO DE SANTIAGO & TRANSPORTE PÚBLICO
// v7 — Cápsulas informativas (estado real + alertas X) — Mobile-first
// ==============================================================================

let datosTransporteCache = null;
let activeParaderoCode = 'PA349';
let _alertasAnterioresIds = new Set();

async function initTransporte() {
    await cargarDatosTransporte();
}

function consultarParaderoManual() {
    const input = document.getElementById('transporte-codigo-input');
    if (!input) return;
    const val = input.value.trim().toUpperCase();
    if (!val) {
        alert('Ingresa un código de paradero válido (ej: PA349).');
        return;
    }
    activeParaderoCode = val;
    cargarBusesParadero(val);
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
        (a.lineas && a.lineas.includes(lineaCode)) ||
        a.tipo === 'red'
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
    if (!alertas || alertas.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    let html = `
        <div style="background:rgba(153,27,27,0.12);border:1px solid rgba(248,113,113,0.35);border-radius:12px;padding:12px 14px;margin-bottom:12px;">
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
                <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:3px;">
                    <span style="color:#fca5a5;font-size:11px;font-weight:700;">${escapeHtmlTrans(a.target)}</span>
                    ${lineasBadges}
                </div>
                <div style="color:#94a3b8;font-size:11px;line-height:1.4;">${escapeHtmlTrans(a.mensaje.substring(0,160))}${a.mensaje.length>160?'…':''}</div>
                ${a.link ? `<a href="${escapeHtmlTrans(a.link)}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;font-size:10px;margin-top:4px;display:inline-block;text-decoration:none;">Ver publicación en X ↗</a>` : ''}
            </div>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

// ─── Cápsula de línea rediseñada — útil e informativa ────────────────────────
function _renderLineaCapsule(l, alertasLinea) {
    const tieneAlerta = alertasLinea.length > 0;

    // Estado del badge
    const estadoColor = tieneAlerta ? '#f87171' : '#34d399';
    const estadoBg    = tieneAlerta ? 'rgba(248,113,113,0.12)' : 'rgba(16,185,129,0.10)';
    const estadoBorder= tieneAlerta ? 'rgba(248,113,113,0.35)' : 'rgba(16,185,129,0.25)';
    const estadoTxt   = tieneAlerta ? 'Afectada' : 'Operativa';

    // Construir el contenido del panel expandible — solo info útil:
    // 1. Alertas activas (si hay)
    // 2. Estado del servicio
    // 3. Terminales (para saber de dónde a dónde va)
    // 4. Horario de operación del día actual
    let expandHtml = '';

    if (tieneAlerta) {
        expandHtml += `
            <div style="margin-bottom:10px;">
                <div style="font-size:10.5px;font-weight:800;color:#f87171;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;display:flex;align-items:center;gap:5px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Incidentes activos
                </div>
                ${alertasLinea.map(a => `
                    <div style="background:rgba(153,27,27,0.2);border:1px solid rgba(248,113,113,0.25);border-radius:8px;padding:8px 10px;margin-bottom:5px;">
                        <div style="color:#fca5a5;font-weight:700;font-size:12px;margin-bottom:3px;">${escapeHtmlTrans(a.target)}</div>
                        <div style="color:#94a3b8;font-size:11px;line-height:1.4;">${escapeHtmlTrans(a.mensaje.substring(0,200))}${a.mensaje.length>200?'…':''}</div>
                        ${a.link ? `<a href="${escapeHtmlTrans(a.link)}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;font-size:10px;margin-top:4px;display:inline-block;text-decoration:none;">Ver en X ↗</a>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        expandHtml += `
            <div style="display:flex;align-items:center;gap:7px;background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:9px 12px;margin-bottom:10px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span style="color:#86efac;font-size:12px;font-weight:600;">Sin interrupciones reportadas.</span>
            </div>
        `;
    }

    // Fila de datos útiles: terminales + estaciones
    expandHtml += `
        <div class="linea-expand-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11.5px;">
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:8px 10px;">
                <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;">Recorrido</div>
                <div style="color:#cbd5e1;line-height:1.4;font-size:11px;">${escapeHtmlTrans(l.terminales)}</div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:8px 10px;">
                <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;">Horario hoy</div>
                <div style="color:#cbd5e1;font-size:11px;">Lun-Vie 06:00–23:00</div>
                <div style="color:#64748b;font-size:10.5px;">Sáb 06:30 · Dom 08:00</div>
            </div>
        </div>
    `;

    // Si hay combinaciones relevantes como "dónde se puede transferir"
    if (l.combinaciones && l.combinaciones.length > 0) {
        expandHtml += `
            <div style="margin-top:8px;">
                <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;">Transferencias disponibles</div>
                <div style="display:flex;flex-wrap:wrap;gap:5px;">
                    ${l.combinaciones.map(c => `<span style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:2px 8px;font-size:10.5px;color:#94a3b8;">${escapeHtmlTrans(c)}</span>`).join('')}
                </div>
            </div>
        `;
    }

    return `
        <div style="
            background:rgba(15,23,42,0.60);
            border:1px solid ${tieneAlerta ? 'rgba(248,113,113,0.45)' : 'rgba(255,255,255,0.08)'};
            border-radius:14px;
            overflow:hidden;
            ${tieneAlerta ? 'box-shadow:0 0 0 1px rgba(248,113,113,0.12),0 4px 20px rgba(153,27,27,0.1);' : ''}
        ">
            <!-- Header de la cápsula -->
            <div
                onclick="toggleLineaDetalle('${l.linea}')"
                style="
                    padding:13px 15px;
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    cursor:pointer;
                    user-select:none;
                    gap:10px;
                    background:${tieneAlerta ? 'rgba(153,27,27,0.08)' : 'rgba(30,41,59,0.30)'};
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
                        ${tieneAlerta ? `<div style="position:absolute;top:-3px;right:-3px;width:11px;height:11px;background:#f87171;border-radius:50%;border:2px solid rgba(10,15,30,0.9);box-shadow:0 0 5px #f87171;"></div>` : ''}
                    </div>
                    <div style="min-width:0;">
                        <div style="font-size:13px;font-weight:700;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtmlTrans(l.nombre)}</div>
                        <div style="font-size:10.5px;color:#64748b;margin-top:1px;">${l.estaciones_total} estaciones &nbsp;·&nbsp; ${escapeHtmlTrans(l.longitud_km)}</div>
                    </div>
                </div>

                <!-- Der: estado + chevron -->
                <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                    <div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:${estadoColor};background:${estadoBg};padding:4px 9px;border-radius:7px;border:1px solid ${estadoBorder};">
                        <span style="width:6px;height:6px;border-radius:50%;background:${estadoColor};box-shadow:0 0 5px ${estadoColor};flex-shrink:0;"></span>
                        ${estadoTxt}
                    </div>
                    <svg id="chevron-${l.linea}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:#64748b;transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
            </div>

            <!-- Detalle expandible -->
            <div id="detalle-linea-${l.linea}" style="display:none;padding:12px 15px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(8,12,24,0.5);">
                ${expandHtml}
            </div>
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
        horarioBadge.innerHTML = `<span class="pulse-dot"></span><span>Consultando red...</span>`;
    }

    try {
        const res  = await fetch(`/api/transporte?stop=${encodeURIComponent(activeParaderoCode)}`);
        const data = await res.json();
        datosTransporteCache = data;

        // 1. Badge estado general
        if (horarioBadge) {
            const abierto = data.metro_abierto;
            horarioBadge.innerHTML = `
                <span class="status-dot" style="${abierto ? 'background:#34d399;box-shadow:0 0 6px #10b981;' : 'background:#f43f5e;box-shadow:0 0 6px #f43f5e;'}"></span>
                <span>${abierto ? 'Red Operativa (' + data.hora_chile + ' hrs)' : 'Metro Cerrado (' + data.hora_chile + ' hrs)'}</span>
            `;
        }

        // 2. Panel global de alertas
        const alertas = data.alertas || [];
        _renderPanelAlertas(alertas, alertasPanel);
        if (alertas.length > 0) _mostrarToastAlerta(alertas);

        // 3. Cápsulas de líneas
        if (lineasGrid && Array.isArray(data.lineas_metro)) {
            lineasGrid.innerHTML = data.lineas_metro
                .map(l => _renderLineaCapsule(l, _alertasDeLinea(alertas, l.linea)))
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
            <span class="pulse-dot"></span> Consultando paradero <strong>${escapeHtmlTrans(code)}</strong>...
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

    if (!paraderoData || !paraderoData.services || paraderoData.services.length === 0) {
        busesList.innerHTML = `
            <div style="text-align:center;padding:22px 16px;background:rgba(15,23,42,0.4);border-radius:10px;border:1px dashed rgba(255,255,255,0.08);color:#94a3b8;font-size:12.5px;">
                <div style="font-weight:600;color:#f8fafc;margin-bottom:4px;">Sin datos GPS para <span style="color:#38bdf8;">${escapeHtmlTrans(code)}</span></div>
                <div style="font-size:11px;color:#64748b;">Puede ser horario nocturno o código no válido.</div>
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

    paraderoData.services.forEach(s => {
        const hasBuses     = Array.isArray(s.buses) && s.buses.length > 0;
        const primerBus    = hasBuses ? s.buses[0] : null;
        const tiempoLlegada = primerBus
            ? (primerBus.min_arrival_time !== undefined
                ? `${primerBus.min_arrival_time}–${primerBus.max_arrival_time} min`
                : 'En camino')
            : 'Sin buses cercanos';
        const distancia = primerBus && primerBus.meters_distance ? `${primerBus.meters_distance} m` : '';

        html += `
            <div style="background:rgba(15,23,42,0.55);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:11px 13px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
                <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                    <span style="background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;font-weight:800;font-size:12.5px;padding:5px 10px;border-radius:8px;min-width:48px;text-align:center;flex-shrink:0;">${escapeHtmlTrans(s.id)}</span>
                    <div style="min-width:0;">
                        <div style="font-size:12.5px;font-weight:600;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtmlTrans(s.status_description || 'Servicio regular')}</div>
                        ${distancia ? `<div style="font-size:10.5px;color:#64748b;margin-top:1px;">GPS: ${distancia}</div>` : ''}
                    </div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <div style="font-size:13px;font-weight:700;color:${hasBuses ? '#38bdf8' : '#64748b'};">${escapeHtmlTrans(tiempoLlegada)}</div>
                    <div style="font-size:10px;color:#94a3b8;">${hasBuses ? 'Arribo est.' : 'Sin datos'}</div>
                </div>
            </div>
        `;
    });

    busesList.innerHTML = html;
}

// ─── CSS de animación toast (inyectado una sola vez) ─────────────────────────
(function _injectCSS() {
    if (document.getElementById('metro-toast-style')) return;
    const s = document.createElement('style');
    s.id = 'metro-toast-style';
    s.textContent = `
        @keyframes slideInToast {
            from { opacity:0; transform:translateX(40px); }
            to   { opacity:1; transform:translateX(0); }
        }
    `;
    document.head.appendChild(s);
})();

document.addEventListener('DOMContentLoaded', initTransporte);

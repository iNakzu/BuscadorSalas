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
        input.focus();
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
    return alertas.filter(a => {
        const lineas = Array.isArray(a.lineas) ? a.lineas.map(l => String(l).toUpperCase()) : [];
        if (lineas.length) return lineas.includes(lineaCode.toUpperCase());
        const t = (a.target || '').toUpperCase();
        if (t === 'TODA LA RED' || t === 'RED GENERAL') return true;
        return (t.match(/\bL(?:4A|[1-6])\b/g) || []).includes(lineaCode.toUpperCase());
    });
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
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
}

// ─── Lista de líneas Metro ───────────────────────────────────────────────────

function _estadoLineaMetro(alertasLinea, metroAbierto) {
    const tieneAlerta = alertasLinea.length > 0;
    const servicioActivo = Boolean(metroAbierto);
    if (tieneAlerta) return { key: 'alert', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', label: 'Con problemas' };
    if (servicioActivo) return { key: 'operational', color: '#34d399', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)', label: 'Operativa' };
    return { key: 'closed', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)', label: 'Cerrada' };
}

function _renderMetroRoute(terminales) {
    const partes = String(terminales || '').split(/\s*⇄\s*/);
    if (partes.length !== 2) return `<span class="metro-route-single">${escapeHtmlTrans(terminales)}</span>`;

    return `
        <div class="metro-route">
            <span>${escapeHtmlTrans(partes[0])}</span>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"></path><path d="m15 7 5 5-5 5"></path></svg>
            <span>${escapeHtmlTrans(partes[1])}</span>
        </div>
    `;
}

function _renderDetalleLineaMetro(l, alertasLinea, metroAbierto) {
    const estado = _estadoLineaMetro(alertasLinea, metroAbierto);
    let messageHtml = '';

    if (estado.key === 'alert') {
        messageHtml = `
            <div class="metro-tab-alerts">
                <div class="metro-tab-alerts-list">
                ${alertasLinea.map(a => `
                    <div class="metro-tab-alert-item">
                        <div class="metro-tab-alert-meta">
                            <strong>${escapeHtmlTrans(a.target)}</strong>
                            <span>${escapeHtmlTrans(formatearFechaAlerta(a.ts))}</span>
                        </div>
                        <div>${escapeHtmlTrans(formatearMensajeAlerta(a.mensaje))}</div>
                    </div>
                `).join('')}
                </div>
            </div>
        `;
    } else if (estado.key === 'operational') {
        messageHtml = `
            <div class="metro-line-status-card is-operational">
                <span class="metro-line-status-copy">
                    <span class="metro-line-status-kicker">Estado del servicio</span>
                    <strong>Servicio disponible</strong>
                    <span>Sin interrupciones reportadas en esta línea.</span>
                </span>
            </div>
        `;
    } else {
        messageHtml = `
            <div class="metro-line-status-card is-closed">
                <span class="metro-line-status-copy">
                    <span class="metro-line-status-kicker">Estado del servicio</span>
                    <strong>Servicio fuera de horario</strong>
                    <span>La línea no opera en este momento.</span>
                </span>
            </div>
        `;
    }

    return `
        <div class="metro-tab-detail" id="metro-line-card-${l.linea}" role="button" tabindex="0" aria-expanded="false" aria-controls="metro-service-${l.linea}" onclick="toggleEstadoLineaMetro('${l.linea}')" onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleEstadoLineaMetro('${l.linea}'); }" style="--metro-line-color:${l.color};">
            <div class="metro-tab-detail-head">
                <div class="metro-tab-line-mark" style="background:${l.color};">${escapeHtmlTrans(l.linea)}</div>
                <div class="metro-tab-detail-title">
                    <small>${escapeHtmlTrans(l.nombre)}</small>
                    ${_renderMetroRoute(l.terminales)}
                </div>
                <div class="metro-tab-metrics" aria-label="Datos de la línea">
                    <span>${l.estaciones_total} estaciones</span>
                    <span>${escapeHtmlTrans(l.longitud_km)}</span>
                </div>
                <div class="metro-line-state-control">
                    <span class="metro-line-state" style="color:${estado.color}; background:${estado.bg}; border-color:${estado.border};">
                        <span class="metro-line-status-dot estado-dot-anim" aria-hidden="true"></span>
                        ${escapeHtmlTrans(estado.label)}
                    </span>
                    <svg class="metro-state-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
            </div>
            <div class="metro-line-service-detail" id="metro-service-${l.linea}" style="display:none;">
                ${messageHtml}
            </div>
        </div>
    `;
}

function toggleEstadoLineaMetro(lineaCode) {
    const detail = document.getElementById(`metro-service-${lineaCode}`);
    const card = document.getElementById(`metro-line-card-${lineaCode}`);
    if (!detail || !card) return;

    const abierto = detail.style.display === 'block';
    detail.style.display = abierto ? 'none' : 'block';
    card.setAttribute('aria-expanded', String(!abierto));
    card.classList.toggle('is-open', !abierto);
}

function renderMetroTabs(lineas, alertas, metroAbierto) {
    const lineasGrid = document.getElementById('metro-lineas-grid');
    if (!lineasGrid || !Array.isArray(lineas) || !lineas.length) return;
    const expandidas = new Set(
        [...lineasGrid.querySelectorAll('.metro-tab-detail[aria-expanded="true"]')]
            .map(card => card.id.slice('metro-line-card-'.length))
    );

    lineasGrid.innerHTML = `
        <div class="metro-line-list" aria-label="Estado de las líneas de Metro">
            ${lineas.map(l => _renderDetalleLineaMetro(l, _alertasDeLinea(alertas, l.linea), metroAbierto)).join('')}
        </div>
    `;
    expandidas.forEach(lineaCode => {
        const card = document.getElementById(`metro-line-card-${lineaCode}`);
        const detail = document.getElementById(`metro-service-${lineaCode}`);
        if (!card || !detail) return;
        detail.style.display = 'block';
        card.setAttribute('aria-expanded', 'true');
        card.classList.add('is-open');
    });
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
                detail: alertas.length === 1 ? 'Incidente activo en la red' : 'Múltiples incidentes activos'
            }
            : {
                color: '#34d399',
                bg: 'rgba(16,185,129,0.10)',
                border: 'rgba(16,185,129,0.28)',
                title: 'Red operativa',
                detail: 'Sin interrupciones reportadas'
            };

    return `
        <div class="metro-status-capsule" style="color:${estado.color};background:${estado.bg};border-color:${estado.border};padding-left:12px;display:flex;align-items:center;gap:10px;">
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



    try {
        const stopQuery = activeParaderoCode ? `?stop=${encodeURIComponent(activeParaderoCode)}` : '';
        const res  = await fetch(`/api/transporte${stopQuery}`);
        if (!res.ok) throw new Error(`Transporte HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.alertas)) throw new Error('Respuesta de transporte sin alertas');
        datosTransporteCache = data;

        const alertas = filtrarAlertasActivas(data.alertas);

        // 1. Cápsula de estado general
        if (horarioBadge) {
            horarioBadge.innerHTML = _renderEstadoMetroCapsule(data.metro_abierto, alertas);
        }

        // 2. Panel global de alertas
        _renderPanelAlertas(alertas, alertasPanel);

        // 3. Tabs y detalle de líneas
        if (lineasGrid && Array.isArray(data.lineas_metro)) {
            renderMetroTabs(data.lineas_metro, alertas, data.metro_abierto);
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

// ─── Buses del paradero ───────────────────────────────────────────────────────
async function cargarBusesParadero(code) {
    const busesList = document.getElementById('transporte-buses-list');
    if (!busesList) return;

    busesList.innerHTML = `
        <div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:13px;">
            <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle; margin-right: 6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Localizando buses...
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
        if (!res.ok) throw new Error(`Metro alertas HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.alertas)) throw new Error('Respuesta de metro sin alertas');
        const alertas = filtrarAlertasActivas(data.alertas);

        // Actualizar estado general y líneas con las alertas de la API.
        _renderPanelAlertas(alertas, document.getElementById('metro-alertas-panel'));
        const horarioBadge = document.getElementById('metro-horario-badge');
        if (horarioBadge && datosTransporteCache) {
            horarioBadge.innerHTML = _renderEstadoMetroCapsule(datosTransporteCache.metro_abierto, alertas);
        }

        // Re-renderizar tabs para reflejar alertas sin desincronizar su estado.
        if (datosTransporteCache && Array.isArray(datosTransporteCache.lineas_metro)) {
            datosTransporteCache.alertas = alertas;
            renderMetroTabs(datosTransporteCache.lineas_metro, alertas, datosTransporteCache.metro_abierto);
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

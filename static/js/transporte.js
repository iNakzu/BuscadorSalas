// ==============================================================================
// METRO DE SANTIAGO & TRANSPORTE PÚBLICO (RED METROPOLITANA DE MOVILIDAD)
// ==============================================================================

let datosTransporteCache = null;
let activeParaderoCode = 'PA349';

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

async function cargarDatosTransporte() {
    const lineasGrid = document.getElementById('metro-lineas-grid');
    const horarioBadge = document.getElementById('metro-horario-badge');
    const tarifasBox = document.getElementById('tarifas-detalle-box');

    if (horarioBadge) {
        horarioBadge.innerHTML = `<span class="pulse-dot"></span><span>Consultando red...</span>`;
    }

    try {
        const res = await fetch(`/api/transporte?stop=${encodeURIComponent(activeParaderoCode)}`);
        const data = await res.json();
        datosTransporteCache = data;

        // 1. Estado General de la Red y Horario
        if (horarioBadge) {
            horarioBadge.innerHTML = `
                <span class="status-dot ${data.metro_abierto ? '' : 'occ'}" style="${data.metro_abierto ? 'background: #34d399; box-shadow: 0 0 6px #10b981;' : 'background: #f43f5e; box-shadow: 0 0 6px #f43f5e;'}"></span>
                <span>${data.metro_abierto ? 'Red Operativa (' + data.hora_chile + ' hrs)' : 'Metro Cerrado (' + data.hora_chile + ' hrs)'}</span>
            `;
        }

        // 2. Renderizar Líneas de Metro con acordeón interactivo y detalles técnicos
        if (lineasGrid && Array.isArray(data.lineas_metro)) {
            let html = '';
            data.lineas_metro.forEach((l) => {
                const combHtml = (l.combinaciones || []).map(c => `
                    <span style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 2px 7px; font-size: 10.5px; color: #cbd5e1;">${escapeHtmlTrans(c)}</span>
                `).join('');

                const estHtml = (l.principales_estaciones || []).join(' ➔ ');

                html += `
                    <div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; overflow: hidden; transition: all 0.2s ease;">
                        <div onclick="toggleLineaDetalle('${l.linea}')" style="padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; gap: 10px; background: rgba(30, 41, 59, 0.35);">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="background: ${l.color}; color: #ffffff; font-size: 12px; font-weight: 800; padding: 3px 8px; border-radius: 7px; box-shadow: 0 2px 8px ${l.color}40; min-width: 40px; text-align: center;">
                                    ${l.linea}
                                </span>
                                <div>
                                    <div style="font-size: 13px; font-weight: 700; color: #f8fafc;">${escapeHtmlTrans(l.nombre)}: <span style="font-weight: 500; color: #cbd5e1;">${escapeHtmlTrans(l.terminales)}</span></div>
                                    <div style="font-size: 11px; color: #94a3b8; margin-top: 1px;">
                                        <span>${l.estaciones_total} estaciones</span> • <span>${l.longitud_km}</span>
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: #34d399; background: rgba(16,185,129,0.1); padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(16,185,129,0.25);">
                                    <span class="status-dot"></span>
                                    <span>${escapeHtmlTrans(l.estado)}</span>
                                </div>
                                <svg id="chevron-${l.linea}" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #94a3b8; transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                        </div>

                        <!-- Detalle expandible de la línea -->
                        <div id="detalle-linea-${l.linea}" style="display: none; padding: 12px 14px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(10, 15, 30, 0.45); font-size: 11.5px;">
                            <div style="margin-bottom: 8px;">
                                <div style="font-weight: 700; color: #38bdf8; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;">Combinaciones de Red:</div>
                                <div style="display: flex; gap: 5px; flex-wrap: wrap;">${combHtml}</div>
                            </div>
                            <div>
                                <div style="font-weight: 700; color: #a78bfa; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;">Estaciones Clave:</div>
                                <div style="color: #94a3b8; line-height: 1.45;">${escapeHtmlTrans(estHtml)}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
            lineasGrid.innerHTML = html;
        }

        // 3. Renderizar Cuadro de Tarifas en Tarjetas
        if (tarifasBox && data.tarifas) {
            let tarHtml = '';
            const labels = {
                'punta': { name: 'Horario Punta', desc: '07:00-08:59 y 18:00-19:59', border: 'rgba(239, 68, 68, 0.3)', badgeBg: 'rgba(239, 68, 68, 0.15)', badgeCol: '#f87171' },
                'valle': { name: 'Horario Valle', desc: '09:00-17:59 y 20:00-20:44', border: 'rgba(56, 189, 248, 0.3)', badgeBg: 'rgba(56, 189, 248, 0.15)', badgeCol: '#38bdf8' },
                'bajo':  { name: 'Horario Bajo',  desc: '06:00-06:59 y 20:45-23:00', border: 'rgba(16, 185, 129, 0.3)', badgeBg: 'rgba(16, 185, 129, 0.15)', badgeCol: '#34d399' },
                'estudiante': { name: 'Pase Escolar (TNE)', desc: 'Válido 24 horas los 365 días', border: 'rgba(168, 85, 247, 0.3)', badgeBg: 'rgba(168, 85, 247, 0.15)', badgeCol: '#c084fc' },
                'adulto_mayor': { name: 'Adulto Mayor (BAM)', desc: 'Beneficio tarifa rebajada', border: 'rgba(245, 158, 11, 0.3)', badgeBg: 'rgba(245, 158, 11, 0.15)', badgeCol: '#fbbf24' }
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

        // 4. Renderizar Buses del Paradero Activo
        renderBusesList(data.paradero, activeParaderoCode);

    } catch (e) {
        if (lineasGrid) {
            lineasGrid.innerHTML = '<div style="color: #f87171; font-size: 12px; padding: 12px;">Error de conexión al cargar la red de transporte.</div>';
        }
    }
}

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
            <div class="songsterr-item-row" style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
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

function escapeHtmlTrans(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', initTransporte);

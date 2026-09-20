// ==============================================================================
// METRO & TRANSPORTE PÚBLICO SANTIAGO (RED MOVILIDAD API)
// ==============================================================================

const PARADEROS_UDP = [
    { id: 'PA450', nombre: 'Toesca / Vergara (L2 Toesca)', desc: 'Salida directa Facultad de Ingeniería y Ejército' },
    { id: 'PA349', nombre: 'Metro Los Héroes (L1 / L2)', desc: 'Alameda esquina Ejército' },
    { id: 'PA435', nombre: 'Parque O’Higgins (L2)', desc: 'Acceso sur por Rondizzoni / Viel' },
    { id: 'PA187', nombre: 'Metro República (L1)', desc: 'Conexión barrio universitario poniente' }
];

let selectedParadero = 'PA450';

async function initTransporte() {
    renderSelectorParaderos();
    await cargarDatosTransporte();
}

function renderSelectorParaderos() {
    const sel = document.getElementById('transporte-paradero-select');
    if (!sel) return;

    let html = '';
    PARADEROS_UDP.forEach(p => {
        html += `<option value="${p.id}" ${p.id === selectedParadero ? 'selected' : ''}>${p.nombre}</option>`;
    });
    sel.innerHTML = html;
}

function cambiarParadero(pId) {
    selectedParadero = pId;
    cargarDatosTransporte();
}

async function cargarDatosTransporte() {
    const lineasGrid = document.getElementById('metro-lineas-grid');
    const busesList = document.getElementById('transporte-buses-list');
    const horarioDesc = document.getElementById('metro-horario-badge');
    if (!lineasGrid || !busesList) return;

    try {
        const res = await fetch(`/api/transporte?stop=${encodeURIComponent(selectedParadero)}`);
        const data = await res.json();

        // 1. Estado del Metro
        if (horarioDesc) {
            horarioDesc.innerHTML = `
                <span class="status-dot ${data.metro_abierto ? '' : 'occ'}" style="${data.metro_abierto ? 'background: #34d399; box-shadow: 0 0 6px #10b981;' : 'background: #f43f5e; box-shadow: 0 0 6px #f43f5e;'}"></span>
                <span>${data.metro_abierto ? 'Red Operativa (' + data.hora_chile + ' hrs)' : 'Metro Cerrado'}</span>
            `;
        }

        let metroHtml = '';
        (data.lineas_metro || []).forEach(l => {
            metroHtml += `
                <div style="background: rgba(30, 41, 59, 0.55); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: ${l.color}; color: #fff; font-size: 11px; font-weight: 800; padding: 3px 7px; border-radius: 6px;">${l.linea}</span>
                        <div style="font-size: 12.5px; font-weight: 600; color: #f1f5f9;">${escapeHtmlTrans(l.nombre.split('(')[0])}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="status-dot"></span>
                        <span style="font-size: 11px; font-weight: 700; color: #34d399;">${escapeHtmlTrans(l.estado)}</span>
                    </div>
                </div>
            `;
        });
        lineasGrid.innerHTML = metroHtml;

        // 2. Buses Red Movilidad / Llegadas en vivo al paradero
        const paraderoData = data.paradero;
        if (!paraderoData || !paraderoData.services || paraderoData.services.length === 0) {
            busesList.innerHTML = `
                <div style="text-align: center; padding: 25px 0; color: #94a3b8; font-size: 13px;">
                    Información de micros no disponible en este momento para ${selectedParadero}.
                </div>
            `;
            return;
        }

        let busesHtml = '';
        paraderoData.services.forEach(s => {
            const hasBuses = Array.isArray(s.buses) && s.buses.length > 0;
            const primerBus = hasBuses ? s.buses[0] : null;
            const tiempoLlegada = primerBus ? (primerBus.min_arrival_time !== undefined ? `${primerBus.min_arrival_time} - ${primerBus.max_arrival_time} min` : 'En camino') : 'Sin buses cercanos';
            const distancia = primerBus ? (primerBus.meters_distance ? `${primerBus.meters_distance}m` : '') : '';

            busesHtml += `
                <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; font-weight: 800; font-size: 12.5px; padding: 4px 10px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.15);">${escapeHtmlTrans(s.id)}</span>
                        <div>
                            <div style="font-size: 13px; font-weight: 600; color: #f1f5f9;">${escapeHtmlTrans(s.status_description || 'Servicio')}</div>
                            ${distancia ? `<div style="font-size: 11px; color: #64748b;">Distancia: ${distancia}</div>` : ''}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 13px; font-weight: 700; color: ${hasBuses ? '#38bdf8' : '#64748b'};">${escapeHtmlTrans(tiempoLlegada)}</div>
                        <div style="font-size: 10.5px; color: #94a3b8;">${hasBuses ? 'Estimado' : 'Frecuencia regular'}</div>
                    </div>
                </div>
            `;
        });
        busesList.innerHTML = busesHtml;

    } catch (e) {
        if (lineasGrid) {
            lineasGrid.innerHTML = '<div style="color: #f87171; font-size: 12px;">Error al cargar datos del Metro.</div>';
        }
    }
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

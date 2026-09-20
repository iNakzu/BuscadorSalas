// ==============================================================================
// CLIMA: SANTIAGO, CHILLÁN, ANCUD (CHILOÉ), WROCŁAW (POLONIA), NEW YORK (USA)
// ==============================================================================

const CIUDADES_CLIMA = ['santiago', 'chillan', 'ancud', 'wroclaw', 'usa'];

function getWeatherDescription(code, isDay) {
    // WMO Weather interpretation codes
    const map = {
        0: 'Cielo Despejado',
        1: 'Mayormente Despejado',
        2: 'Parcialmente Nublado',
        3: 'Nublado',
        45: 'Niebla',
        48: 'Niebla con escarcha',
        51: 'Llovizna Ligera',
        53: 'Llovizna Moderada',
        55: 'Llovizna Densa',
        61: 'Lluvia Ligera',
        63: 'Lluvia Moderada',
        65: 'Lluvia Fuerte',
        71: 'Nieve Ligera',
        73: 'Nieve Moderada',
        75: 'Nieve Intensa',
        77: 'Granizo / Aguanieve',
        80: 'Chubascos Aislados',
        81: 'Chubascos Moderados',
        82: 'Chubascos Violentos',
        85: 'Nevadas Aisladas',
        86: 'Nevadas Intensas',
        95: 'Tormenta Eléctrica',
        96: 'Tormenta con Granizo'
    };
    return map[code] || 'Condiciones Estables';
}

function getWeatherIconSVG(code, isDay) {
    if (code === 0 || code === 1) {
        return isDay 
            ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
            : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    }
    if (code === 2 || code === 3) {
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`;
    }
    if (code >= 51 && code <= 67 || (code >= 80 && code <= 82)) {
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><line x1="16" y1="13" x2="16" y2="21"></line><line x1="8" y1="13" x2="8" y2="21"></line><line x1="12" y1="15" x2="12" y2="23"></line><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>`;
    }
    if (code >= 71 && code <= 86) {
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e0e7ff" stroke-width="2"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="8" y1="20" x2="8.01" y2="20"></line><line x1="12" y1="18" x2="12.01" y2="18"></line><line x1="12" y1="22" x2="12.01" y2="22"></line><line x1="16" y1="16" x2="16.01" y2="16"></line><line x1="16" y1="20" x2="16.01" y2="20"></line></svg>`;
    }
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><circle cx="12" cy="12" r="5"></circle></svg>`;
}

async function cargarClimaGlobal() {
    const grid = document.getElementById('clima-cards-grid');
    if (!grid) return;

    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: #94a3b8;"><span class="status-dot"></span> Obteniendo datos satelitales en tiempo real...</div>';

    try {
        const promises = CIUDADES_CLIMA.map(c => fetch(`/api/clima?ciudad=${c}`).then(r => r.json()));
        const results = await Promise.all(promises);

        let html = '';
        results.forEach(d => {
            if (d.error || !d.current) return;
            const c = d.current;
            const meta = d.meta;
            const desc = getWeatherDescription(c.weather_code, c.is_day);
            const iconSvg = getWeatherIconSVG(c.weather_code, c.is_day);
            const daily = d.daily || {};
            const tMax = (daily.temperature_2m_max && daily.temperature_2m_max[0] !== undefined) ? Math.round(daily.temperature_2m_max[0]) : '-';
            const tMin = (daily.temperature_2m_min && daily.temperature_2m_min[0] !== undefined) ? Math.round(daily.temperature_2m_min[0]) : '-';

            html += `
                <div class="control-card" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 14px; position: relative; overflow: hidden;">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                            <div>
                                <span style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">${meta.tag}</span>
                                <div style="font-size: 17px; font-weight: 800; color: #f8fafc; margin-top: 2px;">${meta.nombre}</div>
                            </div>
                            <div style="padding: 0;">
                                ${iconSvg}
                            </div>
                        </div>

                        <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 14px;">
                            <div style="font-size: 38px; font-weight: 800; color: #ffffff; line-height: 1;">${Math.round(c.temperature_2m)}°</div>
                            <div style="font-size: 13px; font-weight: 600; color: #94a3b8;">${desc}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 11.5px;">
                        <div>
                            <div style="color: #64748b; font-size: 10px;">Sensación</div>
                            <div style="color: #cbd5e1; font-weight: 700;">${Math.round(c.apparent_temperature)}°C</div>
                        </div>
                        <div>
                            <div style="color: #64748b; font-size: 10px;">Máx / Mín</div>
                            <div style="color: #cbd5e1; font-weight: 700;">${tMax}° / ${tMin}°</div>
                        </div>
                        <div>
                            <div style="color: #64748b; font-size: 10px;">Viento</div>
                            <div style="color: #cbd5e1; font-weight: 700;">${Math.round(c.wind_speed_10m)} km/h</div>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html || '<div style="color: #f87171;">No se pudieron cargar los datos meteorológicos.</div>';

    } catch (e) {
        grid.innerHTML = '<div style="color: #f87171; text-align: center; padding: 20px;">Error al conectar con la API de clima.</div>';
    }
}

document.addEventListener('DOMContentLoaded', cargarClimaGlobal);

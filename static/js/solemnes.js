function normStr(str) {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function renderSolemnes() {
    const container = document.getElementById('solemnes-container');
    if (!container) return;

    const searchInput = document.getElementById('solemnes-search');
    const query = searchInput ? normStr(searchInput.value) : '';

    let html = '';

    const mapDias = {
        1: "24 de Septiembre",
        2: "25 de Septiembre",
        3: "28 de Septiembre",
        4: "29 de Septiembre",
        5: "30 de Septiembre"
    };

    // Agrupar por días
    for (let d = 1; d <= 5; d++) {
        // Filtrar los bloques de este día
        const dayBlocks = SOLEMNES_DATA.filter(item => item.dia === d);
        
        let hasMatches = false;
        let dayHtml = `
            <div class="my-day-col" style="background: rgba(30, 41, 59, 0.4); border-radius: 12px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div class="my-day-header" style="margin-bottom: 16px;">
                    <span class="my-day-title" style="color: #e2e8f0; font-size: 18px; display: flex; flex-direction: column;">
                        <span>Día ${d}</span>
                        <span style="font-size: 14px; color: #94a3b8; font-weight: normal; margin-top: 4px;">${mapDias[d]}</span>
                    </span>
                </div>
                <div class="my-day-cards" style="display: flex; flex-direction: column; gap: 12px;">
        `;

        dayBlocks.forEach(b => {
            const matches = query ? b.ramos.filter(r => normStr(r).includes(query)) : b.ramos;
            
            if (matches.length > 0) {
                hasMatches = true;
                
                dayHtml += `
                    <div class="my-timeline-card" style="padding: 12px 16px; background: rgba(15, 23, 42, 0.6);">
                        <div class="my-time-box" style="margin-bottom: 8px;">
                            <div class="my-time-range" style="color: #38bdf8; font-weight: 600;">${b.horario}</div>
                        </div>
                        <div class="my-info-box" style="gap: 8px;">
                `;

                b.ramos.forEach(r => {
                    const isMatch = query && normStr(r).includes(query);
                    const opacity = query ? (isMatch ? '1' : '0.3') : '1';
                    const fw = isMatch ? '600' : '400';
                    const color = isMatch ? '#ffffff' : '#94a3b8';
                    const bg = isMatch ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)';
                    const border = isMatch ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent';
                    
                    dayHtml += `
                        <div style="opacity: ${opacity}; font-weight: ${fw}; color: ${color}; background: ${bg}; border: ${border}; padding: 6px 12px; border-radius: 8px; font-size: 14px; transition: all 0.2s;">
                            ${escapeHtml(r)}
                        </div>
                    `;
                });

                dayHtml += `
                        </div>
                    </div>
                `;
            }
        });

        dayHtml += `
                </div>
            </div>
        `;

        if (hasMatches || !query) {
            html += dayHtml;
        }
    }

    if (!html) {
        html = `
            <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px auto; display: block; opacity: 0.5;">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <p>No se encontraron solemnes para "${escapeHtml(searchInput.value)}"</p>
            </div>
        `;
    }

    container.innerHTML = html;
}

// Hook into DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Si la tab activa llega a ser solemnes (ej si es la default), renderizamos
    renderSolemnes();
    
    // Override cambiarTab to auto-render solemnes when clicked
    const originalCambiarTab = window.cambiarTab;
    if (originalCambiarTab) {
        window.cambiarTab = function(tabId, btn) {
            originalCambiarTab(tabId, btn);
            if (tabId === 'tab-solemnes') {
                renderSolemnes();
            }
        };
    } else {
        // En caso de que se defina después (app.js se carga diferido pero esto tmb)
        // Ya que app.js define cambiarTab en global, podemos interceptarlo
        const interceptTab = setInterval(() => {
            if (typeof cambiarTab === 'function') {
                const old = cambiarTab;
                cambiarTab = function(tabId, btn) {
                    old(tabId, btn);
                    if (tabId === 'tab-solemnes') {
                        renderSolemnes();
                    }
                };
                clearInterval(interceptTab);
            }
        }, 100);
    }
});

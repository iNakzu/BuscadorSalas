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

const customStyles = `
<style>
    #tab-solemnes {
        padding: 0 !important;
    }
    .solemnes-scroll-wrapper {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        padding: 0 16px 20px 16px;
    }
    .solemnes-grid {
        display: grid;
        grid-template-columns: 100px repeat(5, minmax(220px, 1fr));
        gap: 12px;
        min-width: 1200px; /* Force wide layout for horizontal scroll */
        margin-top: 20px;
    }
    
    .sol-header-cell {
        background: rgba(30, 41, 59, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
    }
    .sol-header-title {
        color: #e2e8f0;
        font-size: 15px;
        font-weight: 600;
    }
    .sol-header-sub {
        color: #94a3b8;
        font-size: 12px;
        margin-top: 4px;
    }

    .sol-time-cell {
        background: rgba(15, 23, 42, 0.4);
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.03);
    }
    .sol-time-num {
        color: #94a3b8;
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .sol-time-range {
        color: #38bdf8;
        font-size: 14px;
        font-weight: 600;
    }

    .sol-day-cell {
        background: rgba(15, 23, 42, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.03);
        border-radius: 12px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        transition: opacity 0.3s ease;
    }

    .sol-ramo-pill {
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 12.5px;
        line-height: 1.3;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        transition: all 0.2s;
    }
    .sol-ramo-pill.matched {
        background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(6, 182, 212, 0.15));
        border: 1px solid rgba(56, 189, 248, 0.4);
        border-left: 3px solid #38bdf8;
        color: #ffffff;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .sol-ramo-pill.dimmed {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid transparent;
        color: #64748b;
        font-weight: 400;
    }

    /* Custom scrollbar */
    .solemnes-scroll-wrapper::-webkit-scrollbar {
        height: 8px;
    }
    .solemnes-scroll-wrapper::-webkit-scrollbar-track {
        background: rgba(0,0,0,0.2);
        border-radius: 4px;
        margin: 0 16px;
    }
    .solemnes-scroll-wrapper::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.2);
        border-radius: 4px;
    }
    
    .sol-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #475569;
        font-size: 13px;
        font-weight: 500;
        font-style: italic;
    }
</style>
`;


function renderSolemnes() {
    const container = document.getElementById('solemnes-container');
    if (!container) return;
    try {


    const searchInput = document.getElementById('solemnes-search');
    const query = searchInput ? normStr(searchInput.value) : '';

    const mapDias = {
        1: { title: "Día 1", sub: "Jueves 24 Sept" },
        2: { title: "Día 2", sub: "Viernes 25 Sept" },
        3: { title: "Día 3", sub: "Lunes 28 Sept" },
        4: { title: "Día 4", sub: "Martes 29 Sept" },
        5: { title: "Día 5", sub: "Miérc 30 Sept" }
    };

    const bloques = [
        { num: 1, label: "8:30 - 10:30", raw: "8:30 a 10:30" },
        { num: 2, label: "10:45 - 12:45", raw: "10:45 a 12:45" },
        { num: 3, label: "13:00 - 15:00", raw: "13:00 a 15:00" },
        { num: 4, label: "15:15 - 17:15", raw: "15:15 a 17:15" },
        { num: 5, label: "17:30 - 19:30", raw: "17:30 a 19:30" }
    ];

    let gridHtml = `<div class="solemnes-grid">`;

    // Row 1: Headers (Empty corner + 5 days)
    gridHtml += `<div class="sol-header-cell" style="background: transparent; border: none;"></div>`;
    for (let d = 1; d <= 5; d++) {
        gridHtml += `
            <div class="sol-header-cell">
                <span class="sol-header-title">${mapDias[d].title}</span>
                <span class="sol-header-sub">${mapDias[d].sub}</span>
            </div>
        `;
    }

    // Rows 2-6: Time blocks
    bloques.forEach(b => {
        // Time column
        gridHtml += `
            <div class="sol-time-cell">
                <span class="sol-time-num">Bloque ${b.num}</span>
                <span class="sol-time-range">${b.label}</span>
            </div>
        `;

        // 5 day columns
        for (let d = 1; d <= 5; d++) {
            const cellData = SOLEMNES_DATA.find(item => item.dia === d && item.horario === b.raw);
            const ramos = cellData ? cellData.ramos : [];
            const matches = query ? ramos.filter(r => normStr(r.nombre).includes(query)) : ramos;
            const hasMatch = matches.length > 0;
            
            // Opacity logic: if searching and no matches in this cell, dim the whole cell heavily
            const cellOpacity = (query && !hasMatch && ramos.length > 0) ? '0.15' : '1';

            if (ramos.length === 0) {
                gridHtml += `
                    <div class="sol-day-cell" style="opacity: ${query ? '0.1' : '0.5'};">
                        <div class="sol-empty">-</div>
                    </div>
                `;
                continue;
            }

            let cellContent = '';
            ramos.forEach(r => {
                const isMatch = query ? normStr(r.nombre).includes(query) : true;
                
                let theme = { bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }; // Default Celeste
                
                if (r.color_txt) {
                    const cLower = r.color_txt.toLowerCase();
                    if (cLower.includes('amarillo')) {
                        theme = { bg: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.4)', color: '#facc15' };
                    } else if (cLower.includes('verde')) {
                        theme = { bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.4)', color: '#34d399' };
                    } else if (cLower.includes('naranjo')) {
                        theme = { bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.4)', color: '#fb923c' };
                    } else if (cLower.includes('morado')) {
                        theme = { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)', color: '#c084fc' };
                    } else if (cLower.includes('blanco') || cLower.includes('sin color')) {
                        theme = { bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.2)', color: '#cbd5e1' };
                    }
                }
                
                const styleAttr = isMatch ? `style="background: ${theme.bg}; border-color: ${theme.border}; border-left-color: ${theme.color};"` : '';
                
                cellContent += `
                    <div class="sol-ramo-pill ${isMatch ? 'matched' : 'dimmed'}" ${styleAttr}>
                        ${escapeHtml(r.nombre)}
                    </div>
                `;
            });

            gridHtml += `
                <div class="sol-day-cell" style="opacity: ${cellOpacity};">
                    ${cellContent}
                </div>
            `;
        }
    });

    gridHtml += `</div>`; // end solemnes-grid

    const finalHtml = `
        ${customStyles}
        <div class="solemnes-scroll-wrapper">
            ${gridHtml}
        </div>
    `;


    container.innerHTML = finalHtml;
    } catch (e) {
        container.innerHTML = '<div style="color:red; padding: 20px;">Error rendering solemnes: ' + e.message + ' ' + e.stack + '</div>';
    }
}


document.addEventListener('DOMContentLoaded', () => {
    renderSolemnes();
    const originalCambiarTab = window.cambiarTab;
    if (originalCambiarTab) {
        window.cambiarTab = function(tabId, btn) {
            originalCambiarTab(tabId, btn);
            if (tabId === 'tab-solemnes') renderSolemnes();
        };
    } else {
        const interceptTab = setInterval(() => {
            if (typeof cambiarTab === 'function') {
                const old = cambiarTab;
                cambiarTab = function(tabId, btn) {
                    old(tabId, btn);
                    if (tabId === 'tab-solemnes') renderSolemnes();
                };
                clearInterval(interceptTab);
            }
        }, 100);
    }
});

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

    let colsHtml = '';

    for (let d = 1; d <= 5; d++) {
        let cardsHtml = '';
        
        bloques.forEach(b => {
            const cellData = SOLEMNES_DATA.find(item => item.dia === d && item.horario === b.raw);
            const ramos = cellData ? cellData.ramos : [];
            const matches = query ? ramos.filter(r => normStr(r).includes(query)) : ramos;
            const hasMatch = matches.length > 0;
            
            // Si buscamos y no hay match en este bloque, opacamos la cápsula
            const cardOpacity = (query && !hasMatch && ramos.length > 0) ? '0.25' : '1';

            if (ramos.length > 0) {
                let innerHtml = '';
                ramos.forEach(r => {
                    const isMatch = query && normStr(r).includes(query);
                    const isHighlighted = query ? isMatch : true;
                    // En solemnes todos pueden ser "tipo-catedra" para tener el azul default, o podemos darles distintos.
                    // Le daremos el color azul bonito
                    const bgColor = isHighlighted ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)';
                    const fw = isHighlighted ? '600' : '400';
                    const color = isHighlighted ? '#ffffff' : '#94a3b8';
                    const border = isHighlighted ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent';
                    innerHtml += `
                        <div style="background: ${bgColor}; border: ${border}; color: ${color}; font-weight: ${fw}; padding: 6px; border-radius: 6px; font-size: 11.5px; margin-top: 6px; text-align: center; transition: all 0.2s;">
                            ${escapeHtml(r)}
                        </div>
                    `;
                });

                // Renderizamos una class-card de horario
                cardsHtml += `
                    <div class="my-class-card tipo-catedra" style="opacity: ${cardOpacity}; transition: opacity 0.3s; min-height: 120px;">
                        <div class="my-card-header">
                            <span class="my-card-time">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                <span>${b.label}</span>
                            </span>
                            <div style="display:none"></div>
                        </div>
                        <div style="padding: 0 12px 12px 12px;">
                            ${innerHtml}
                        </div>
                        <div class="my-card-footer" style="margin-top: auto;">
                            <span class="my-card-bloque-num">Bloque ${b.num}</span>
                        </div>
                    </div>
                `;
            } else {
                // Bloque vacío
                const emptyOpacity = query ? '0.1' : '1';
                cardsHtml += `
                    <div class="my-empty-slot" style="opacity: ${emptyOpacity}; min-height: 120px; transition: opacity 0.3s;" title="Sin Solemnes en este bloque">
                        <div class="my-empty-header">
                            <span class="my-empty-time">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                <span>${b.label}</span>
                            </span>
                            <span class="my-card-bloque-num">Bloque ${b.num}</span>
                        </div>
                        <div class="my-empty-body">
                            <span class="my-empty-text">Sin Solemnes</span>
                        </div>
                    </div>
                `;
            }
        });

        colsHtml += `
            <div class="my-day-col">
                <div class="my-day-header">
                    <div class="my-day-title-box" style="flex-direction: column; align-items: flex-start; gap: 2px;">
                        <span class="my-day-title" style="font-size: 15px;">${mapDias[d].title}</span>
                        <span style="font-size: 12px; color: #94a3b8; font-weight: 500;">${mapDias[d].sub}</span>
                    </div>
                    <span class="my-day-count">${SOLEMNES_DATA.filter(item => item.dia === d).length} blq</span>
                </div>
                <div class="my-day-cards">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    const finalHtml = `
        <style>
            #tab-solemnes .my-week-grid {
                display: flex !important;
                min-width: 900px; /* Forzar scroll horizontal en móviles */
                padding-bottom: 12px;
            }
            .solemnes-scroll-wrapper {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
            .solemnes-scroll-wrapper::-webkit-scrollbar {
                height: 8px;
            }
            .solemnes-scroll-wrapper::-webkit-scrollbar-track {
                background: rgba(0,0,0,0.2);
                border-radius: 4px;
            }
            .solemnes-scroll-wrapper::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2);
                border-radius: 4px;
            }
        </style>
        <div class="solemnes-scroll-wrapper">
            <div class="my-week-grid">
                ${colsHtml}
            </div>
        </div>
    `;

    container.innerHTML = finalHtml;
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

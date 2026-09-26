// ==========================================================================
// RIFF LAB & GEAR HUB - GUITAR COVERS & NEURAL DSP PRESETS
// ==========================================================================

let coversData = [];
let riffSearchQuery = '';
let songsterrSearchTimer = null;

const DEFAULT_COVERS = [
    {
        id: 'cov_1',
        title: 'Bleed',
        artist: 'Meshuggah',
        tuning: '8-String F-Bb-Eb-Ab-Db-Gb-Bb-Eb',
        status: 'polishing', // learning | polishing | mastered
        currentBpm: 105,
        targetBpm: 115,
        presetUsed: 'Archetype: Gojira (Thall Rhytm)',
        tabUrl: '',
        notes: 'Enfocar en la precisión del herta con la mano derecha.'
    },
    {
        id: 'cov_2',
        title: 'Silvera',
        artist: 'Gojira',
        tuning: 'D Standard (D-G-C-F-A-D)',
        status: 'mastered',
        currentBpm: 130,
        targetBpm: 130,
        presetUsed: 'Archetype: Gojira (High Gain Silvera)',
        tabUrl: '',
        notes: 'Tapping con armónicos en el breakdown.'
    },
    {
        id: 'cov_3',
        title: 'Physical Education',
        artist: 'Animals As Leaders',
        tuning: 'Drop E (8-String)',
        status: 'learning',
        currentBpm: 90,
        targetBpm: 128,
        presetUsed: 'Archetype: Abasi (Thump Clean)',
        tabUrl: '',
        notes: 'Practicar la técnica de select pick y thump.'
    },
    {
        id: 'cov_4',
        title: 'Master of Puppets',
        artist: 'Metallica',
        tuning: 'E Standard',
        status: 'mastered',
        currentBpm: 212,
        targetBpm: 212,
        presetUsed: 'Fortin Nameless Suite (Crunch Punch)',
        tabUrl: '',
        notes: 'Resistencia en downpicking constante.'
    }
];

function initRiffLab() {
    try {
        const storedCovers = localStorage.getItem('riff_covers');
        coversData = storedCovers ? JSON.parse(storedCovers) : DEFAULT_COVERS;
        if (!storedCovers) saveCovers();

        const storedPresets = localStorage.getItem('riff_presets');
        presetsData = storedPresets ? JSON.parse(storedPresets) : DEFAULT_PRESETS;
        if (!storedPresets) savePresets();
    } catch(e) {
        coversData = DEFAULT_COVERS;
        presetsData = DEFAULT_PRESETS;
    }

    renderRiffLab();
}

function saveCovers() {
    localStorage.setItem('riff_covers', JSON.stringify(coversData));
}

function savePresets() {

}

function renderRiffLab() {
    renderRiffMetrics();
    renderCoversList();
    renderPresetsList();
    renderRiffKanban();
    updateRiffFocus();
}

function getFilteredCovers() {
    const statusFilter = document.getElementById('riff-status-filter');
    const status = statusFilter ? statusFilter.value : 'all';
    const query = riffSearchQuery.trim().toLowerCase();
    return coversData.filter(c => {
        const matchesStatus = status === 'all' || c.status === status;
        const haystack = `${c.title} ${c.artist} ${c.tuning} ${c.presetUsed} ${c.notes}`.toLowerCase();
        return matchesStatus && (!query || haystack.includes(query));
    });
}

function getFilteredPresets() {
    const query = riffSearchQuery.trim().toLowerCase();
    return presetsData.filter(p => {
        const haystack = `${p.name} ${p.plugin} ${p.amp} ${p.cab} ${p.drive} ${p.notes}`.toLowerCase();
        return !query || haystack.includes(query);
    });
}

function filtrarRiffLab(query) {
    riffSearchQuery = query || '';
    renderCoversList();
    renderPresetsList();
}

function updateRiffFocus() {
    const titleEl = document.getElementById('riff-focus-title');
    const subtitleEl = document.getElementById('riff-focus-subtitle');
    if (!titleEl || !subtitleEl) return;
    const next = coversData.find(c => c.status !== 'mastered') || coversData[0];
    if (!next) return;
    const progress = next.targetBpm > 0 ? Math.min(100, Math.round((next.currentBpm / next.targetBpm) * 100)) : 100;
    titleEl.textContent = `${next.title} · ${next.currentBpm} BPM`;
    subtitleEl.textContent = `${progress}% del objetivo · ${next.status === 'learning' ? 'Construye la base' : 'Pule la precisión'}`;
}

function focusNextCover() {
    const next = coversData.find(c => c.status !== 'mastered') || coversData[0];
    if (!next) return;
    const search = document.getElementById('riff-search-input');
    const status = document.getElementById('riff-status-filter');
    if (search) search.value = next.title;
    if (status) status.value = 'all';
    filtrarRiffLab(next.title);
}

function renderRiffMetrics() {
    const totalCoversEl = document.getElementById('riff-metric-covers');
    const masteredEl = document.getElementById('riff-metric-mastered');
    
    if (totalCoversEl) totalCoversEl.innerText = coversData.length;
    if (masteredEl) {
        const mastered = coversData.filter(c => c.status === 'mastered').length;
        masteredEl.innerText = `${mastered}/${coversData.length}`;
    }
    }

function renderCoversList() {
    const container = document.getElementById('riff-covers-grid');
    if (!container) return;
    const visibleCovers = getFilteredCovers();

    if (visibleCovers.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #64748b;">
                <div style="font-size: 15px; font-weight: 600; color: #94a3b8; margin-bottom: 6px;">No hay resultados para tu búsqueda</div>
                <div style="font-size: 13px;">Prueba con otro término o cambia el estado seleccionado.</div>
            </div>
        `;
        return;
    }

    let html = '';
    visibleCovers.forEach(c => {
        let statusLabel = 'Aprendiendo';
        if (c.status === 'polishing') statusLabel = 'Puliendo';
        if (c.status === 'mastered') statusLabel = 'Dominado';

        const bpmProgress = c.targetBpm > 0 ? Math.min(100, Math.round((c.currentBpm / c.targetBpm) * 100)) : 100;
        const tuningLabel = getCompactTuningLabel(c.tuning);

        html += `
            <div class="cover-card">
                <div class="cover-header">
                    <div>
                        <div class="cover-title">${escapeHtmlRiff(c.title)}</div>
                        <div class="cover-artist">${escapeHtmlRiff(c.artist)}</div>
                    </div>
                    <span class="tuning-pill" title="Afinación: ${escapeHtmlRiff(c.tuning)}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"></path><path d="M8 7l4-4 4 4"></path><path d="M8 17l4 4 4-4"></path></svg> ${escapeHtmlRiff(tuningLabel)}</span>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <span class="status-tag ${c.status}">${statusLabel}</span>
                    <div style="font-size: 12px; font-weight: 700; color: #38bdf8;">
                        ${c.currentBpm} <span style="color: #64748b; font-size: 11px;">/ ${c.targetBpm} BPM</span>
                    </div>
                </div>

                <!-- BPM Progress Bar -->
                <div style="background: rgba(15, 23, 42, 0.7); height: 5px; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${bpmProgress}%; height: 100%; background: linear-gradient(90deg, #38bdf8, #8b5cf6); border-radius: 4px;"></div>
                </div>

                ${c.presetUsed ? `
                    <div style="font-size: 11.5px; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>
                        <span style="color: #cbd5e1;">Preset:</span> ${escapeHtmlRiff(c.presetUsed)}
                    </div>
                ` : ''}

                ${c.notes ? `
                    <div style="font-size: 11.5px; color: #94a3b8; background: rgba(15, 23, 42, 0.45); padding: 6px 8px; border-radius: 6px; font-style: italic;">
                        ${escapeHtmlRiff(c.notes)}
                    </div>
                ` : ''}

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <button onclick="buscarTabSongsterr('${escapeHtmlRiff(c.artist)}', '${escapeHtmlRiff(c.title)}')" class="habit-action-btn" style="font-size: 11px; padding: 3px 8px; color: #38bdf8; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 6px; gap: 4px;" title="Buscar tablatura en Songsterr API">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <span>Tab</span>
                        </button>
                        <button onclick="cambiarEstadoCover('${c.id}', 'learning')" class="habit-action-btn" style="font-size: 11px; padding: 3px 6px;" title="Aprendiendo">1</button>
                        <button onclick="cambiarEstadoCover('${c.id}', 'polishing')" class="habit-action-btn" style="font-size: 11px; padding: 3px 6px;" title="Puliendo">2</button>
                        <button onclick="cambiarEstadoCover('${c.id}', 'mastered')" class="habit-action-btn" style="font-size: 11px; padding: 3px 6px; color: #34d399;" title="Dominado">✓</button>
                    </div>

                    <div style="display: flex; gap: 6px;">
                        <button onclick="ajustarBpmCover('${c.id}', 5)" class="habit-action-btn" style="font-size: 11px; padding: 3px 6px;" title="Subir +5 BPM">+5 BPM</button>
                        <button onclick="eliminarCover('${c.id}')" class="habit-action-btn" title="Eliminar cover">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderRiffKanban() {
    const container = document.getElementById('riff-kanban-grid');
    if (!container) return;
    const cols = [
        { id: 'learning', title: 'Aprendiendo', color: '#f59e0b', hint: 'Construye la base' },
        { id: 'polishing', title: 'Puliendo', color: '#38bdf8', hint: 'Sube precisión y BPM' },
        { id: 'mastered', title: 'Dominado', color: '#34d399', hint: 'Listo para tocar' }
    ];
    container.innerHTML = cols.map(col => {
        const items = coversData.filter(c => c.status === col.id);
        return `
            <div class="riff-kanban-column">
                <div class="riff-kanban-column-header" style="border-top-color: ${col.color};">
                    <div><strong>${col.title}</strong><span>${col.hint}</span></div>
                    <b>${items.length}</b>
                </div>
                <div class="riff-kanban-list">
                    ${items.length ? items.map(c => `
                        <article class="riff-kanban-card">
                            <div>
                                <strong>${escapeHtmlRiff(c.title)}</strong>
                                <span>${escapeHtmlRiff(c.artist)}</span>
                            </div>
                            <div class="riff-kanban-card-meta">${c.currentBpm}/${c.targetBpm} BPM</div>
                            <div class="riff-kanban-card-actions">
                                ${col.id !== 'learning' ? `<button onclick="cambiarEstadoCover('${c.id}', 'learning')">Aprendiendo</button>` : ''}
                                ${col.id !== 'polishing' ? `<button onclick="cambiarEstadoCover('${c.id}', 'polishing')">Puliendo</button>` : ''}
                                ${col.id !== 'mastered' ? `<button onclick="cambiarEstadoCover('${c.id}', 'mastered')">Dominado</button>` : ''}
                            </div>
                        </article>
                    `).join('') : '<div class="riff-kanban-empty">Sin covers en esta etapa</div>'}
                </div>
            </div>
        `;
    }).join('');
}

function renderPresetsList() {
    const container = document.getElementById('riff-presets-grid');
    if (!container) return;
    const visiblePresets = getFilteredPresets();

    if (visiblePresets.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #64748b;">
                <div style="font-size: 15px; font-weight: 600; color: #94a3b8; margin-bottom: 6px;">No tienes presets guardados</div>
                <div style="font-size: 13px;">Guarda las cadenas de tus plugins de Neural DSP para tenerlas a mano en cualquier ensayo o grabación.</div>
            </div>
        `;
        return;
    }

    let html = '';
    visiblePresets.forEach(p => {
        html += `
            <div class="preset-card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div class="cover-title">${escapeHtmlRiff(p.name)}</div>
                        <div class="plugin-badge" style="margin-top: 4px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg> ${escapeHtmlRiff(p.plugin)}</div>
                    </div>
                    <button onclick="eliminarPreset('${p.id}')" class="habit-action-btn" title="Eliminar preset">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div style="font-size: 12px; color: #cbd5e1; display: flex; flex-direction: column; gap: 4px; background: rgba(15, 23, 42, 0.4); padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);">
                    <div><strong style="color: #38bdf8;">Amp:</strong> ${escapeHtmlRiff(p.amp || 'N/A')}</div>
                    <div><strong style="color: #a78bfa;">Cab:</strong> ${escapeHtmlRiff(p.cab || 'N/A')}</div>
                    <div><strong style="color: #f59e0b;">Boost/OD:</strong> ${escapeHtmlRiff(p.drive || 'N/A')}</div>
                </div>

                ${p.notes ? `
                    <div class="preset-notes">${escapeHtmlRiff(p.notes)}</div>
                ` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

function cambiarEstadoCover(id, newStatus) {
    const c = coversData.find(item => item.id === id);
    if (c) {
        c.status = newStatus;
        saveCovers();
        renderRiffLab();
    }
}

function ajustarBpmCover(id, delta) {
    const c = coversData.find(item => item.id === id);
    if (c) {
        c.currentBpm = Math.min(c.targetBpm, c.currentBpm + delta);
        saveCovers();
        renderRiffLab();
    }
}

function eliminarCover(id) {
    confirmarWeb('¿Quieres quitar este cover de tu repertorio?', () => {
        coversData = coversData.filter(c => c.id !== id);
        saveCovers();
        renderRiffLab();
    });
}

function agregarNuevoCover() {
    abrirModalNuevoCover();
}

function agregarNuevoPreset() {
    abrirModalNuevoPreset();
}

function getRiffModal() {
    let modal = document.getElementById('riff-form-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'riff-form-modal';
        modal.className = 'riff-web-modal';
        document.body.appendChild(modal);
    }
    return modal;
}

function cerrarRiffModal() {
    const modal = document.getElementById('riff-form-modal');
    if (modal) modal.style.display = 'none';
}

function abrirModalNuevoCover() {
    const modal = getRiffModal();
    modal.style.display = 'flex';
    modal.innerHTML = `
        <form class="riff-modal-card" onsubmit="guardarCoverDesdeModal(event)">
            <div class="riff-modal-header"><div><span class="section-kicker">Riff Lab</span><h2>Nuevo cover</h2></div><button type="button" class="riff-modal-close" onclick="cerrarRiffModal()">×</button></div>
            <label>Canción<input id="riff-cover-title" name="title" required autocomplete="off" placeholder="Busca una canción..." oninput="buscarSugerenciasSongsterr(this.value)"></label>
            <div id="riff-song-suggestions" class="riff-song-suggestions"></div>
            <label>Artista / banda<input id="riff-cover-artist" name="artist" placeholder="Ej. Gojira"></label>
            <div class="riff-form-grid">
                <label>Afinación<input name="tuning" value="E Standard"></label>
                <label>BPM objetivo<input name="targetBpm" type="number" min="1" value="120"></label>
            </div>
            
            <label>Notas<textarea name="notes" rows="3" placeholder="Qué quieres trabajar..."></textarea></label>
            <div class="riff-modal-actions"><button type="button" class="riff-modal-secondary" onclick="cerrarRiffModal()">Cancelar</button><button class="riff-modal-primary" type="submit">Guardar cover</button></div>
        </form>
    `;
    document.getElementById('riff-cover-title').focus();
}

function guardarCoverDesdeModal(event) {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const targetBpm = Math.max(1, parseInt(data.get('targetBpm'), 10) || 120);
    coversData.unshift({
        id: 'cov_' + Date.now(), title: data.get('title').trim(),
        artist: data.get('artist').trim() || 'Desconocido', tuning: data.get('tuning').trim() || 'E Standard',
        status: 'learning', currentBpm: Math.round(targetBpm * 0.7), targetBpm,
        tabUrl: '', notes: data.get('notes').trim()
    });
    saveCovers();
    cerrarRiffModal();
    renderRiffLab();
}

function buscarSugerenciasSongsterr(value) {
    clearTimeout(songsterrSearchTimer);
    const box = document.getElementById('riff-song-suggestions');
    if (!box) return;
    if (value.trim().length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = '<span class="riff-suggestions-loading">Buscando en Songsterr...</span>';
    songsterrSearchTimer = setTimeout(async () => {
        try {
            const response = await fetch(`/api/songsterr?pattern=${encodeURIComponent(value.trim())}`);
            const songs = await response.json();
            if (!Array.isArray(songs) || !songs.length) {
                box.innerHTML = '<span class="riff-suggestions-loading">Sin coincidencias. Puedes escribir el nombre manualmente.</span>';
                return;
            }
            box.innerHTML = songs.slice(0, 5).map(song => `
                <button type="button" onclick="seleccionarSugerenciaSongsterr(decodeURIComponent('${encodeURIComponent(song.title)}'), decodeURIComponent('${encodeURIComponent(song.artist)}'))">
                    <strong>${escapeHtmlRiff(song.title)}</strong><span>${escapeHtmlRiff(song.artist)}</span>
                </button>
            `).join('');
        } catch (error) {
            box.innerHTML = '<span class="riff-suggestions-loading">No se pudo consultar Songsterr. Completa los campos manualmente.</span>';
        }
    }, 280);
}

function seleccionarSugerenciaSongsterr(title, artist) {
    document.getElementById('riff-cover-title').value = title;
    document.getElementById('riff-cover-artist').value = artist;
    document.getElementById('riff-song-suggestions').innerHTML = '';
}

function guardarPresetDesdeModal(event) {
    event.preventDefault();
    const data = new FormData(event.target);
    presetsData.unshift({ id: 'pre_' + Date.now(), name: data.get('name').trim(), plugin: data.get('plugin').trim() || 'Neural DSP', amp: data.get('amp').trim(), cab: '', drive: data.get('drive').trim(), notes: data.get('notes').trim() });
    savePresets();
    cerrarRiffModal();
    renderRiffLab();
}


function escapeHtmlRiff(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getCompactTuningLabel(tuning) {
    const value = (tuning || '').toString().trim();
    if (!value) return '';

    return value
        .replace(/\s*\(([A-G](?:#|b)?(?:\s*-\s*[A-G](?:#|b)?)+)\)/gi, '')
        .replace(/\s+[A-G](?:#|b)?(?:\s*-\s*[A-G](?:#|b)?)+$/i, '')
        .trim();
}

// ==============================================================================
// SONGSTERR API TAB INTEGRATION
// ==============================================================================
async function buscarTabSongsterr(artist, title) {
    const query = `${artist} ${title}`.trim();
    const modalId = 'modal-songsterr';
    let modal = document.getElementById(modalId);
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); z-index: 1050; display: flex; align-items: center; justify-content: center; padding: 20px;';
        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';
    modal.innerHTML = `
        <div style="background: rgba(30, 41, 59, 0.95); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 16px; max-width: 550px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 28px; height: 28px; border-radius: 7px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; display: flex; align-items: center; justify-content: center;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                    </div>
                    <div style="font-size: 15px; font-weight: 700; color: #f8fafc;">Songsterr Tabs API</div>
                </div>
                <button onclick="document.getElementById('${modalId}').style.display = 'none'" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; padding: 4px;">✕</button>
            </div>
            <div style="font-size: 13px; color: #94a3b8;">Buscando tablaturas interactivas para: <strong style="color: #38bdf8;">${escapeHtmlRiff(query)}</strong>...</div>
            <div id="songsterr-results-box" style="display: flex; flex-direction: column; gap: 8px; min-height: 80px; justify-content: center; align-items: center;">
                <span class="status-dot"></span>
                <span style="font-size: 12px; color: #64748b; margin-top: 6px;">Consultando catálogo oficial de Songsterr...</span>
            </div>
        </div>
    `;

    try {
        const res = await fetch(`/api/songsterr?pattern=${encodeURIComponent(query)}`);
        const songs = await res.json();
        const box = document.getElementById('songsterr-results-box');

        if (!Array.isArray(songs) || songs.length === 0) {
            box.innerHTML = `
                <div style="text-align: center; padding: 20px 0; color: #94a3b8;">
                    <div style="font-size: 14px; font-weight: 600; color: #f8fafc; margin-bottom: 4px;">No se encontraron tabs exactos</div>
                    <div style="font-size: 12px; margin-bottom: 12px;">Puedes buscarlo directamente en Songsterr web:</div>
                    <a href="https://www.songsterr.com/a/wa/search?pattern=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(56, 189, 248, 0.18); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; padding: 7px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600; text-decoration: none;">
                        Abrir búsqueda en Songsterr ➔
                    </a>
                </div>
            `;
            return;
        }

        let listHtml = '';
        songs.slice(0, 5).forEach(s => {
            const songUrl = `https://www.songsterr.com/a/wsa/${encodeURIComponent(s.artist.toLowerCase().replace(/\\s+/g, '-'))}-${encodeURIComponent(s.title.toLowerCase().replace(/\\s+/g, '-'))}-tab-s${s.songId}`;
            const tracksCount = (s.tracks && s.tracks.length) ? s.tracks.length : 1;
            
            listHtml += `
                <div class="songsterr-item-row" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                    <div>
                        <div style="font-size: 14px; font-weight: 700; color: #f1f5f9;">${escapeHtmlRiff(s.title)}</div>
                        <div style="font-size: 12px; color: #94a3b8; display: flex; gap: 8px; align-items: center; margin-top: 2px;">
                            <span>${escapeHtmlRiff(s.artist)}</span>
                            <span style="color: #64748b;">•</span>
                            <span style="color: #a78bfa; font-size: 11px;">${tracksCount} pistas (Guitarras, Bajo, Batería)</span>
                        </div>
                    </div>
                    <a href="${songUrl}" target="_blank" rel="noopener noreferrer" style="background: linear-gradient(135deg, #38bdf8 0%, #2563eb 100%); color: #ffffff; padding: 6px 14px; border-radius: 7px; font-size: 12px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; box-shadow: 0 2px 10px rgba(56,189,248,0.35);">
                        <span>Tocar Tab</span> ➔
                    </a>
                </div>
            `;
        });

        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.alignItems = 'stretch';
        box.innerHTML = listHtml;

    } catch (e) {
        const box = document.getElementById('songsterr-results-box');
        if (box) {
            box.innerHTML = `
                <div style="color: #f87171; font-size: 12.5px; text-align: center; padding: 10px 0;">
                    Error al consultar Songsterr API. <br>
                    <a href="https://www.songsterr.com/a/wa/search?pattern=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline; margin-top: 6px; display: inline-block;">
                        Buscar manualmente en Songsterr ➔
                    </a>
                </div>
            `;
        }
    }
}

document.addEventListener('DOMContentLoaded', initRiffLab);

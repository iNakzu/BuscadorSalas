// ==========================================================================
// RIFF LAB & GEAR HUB - GUITAR COVERS, NEURAL DSP PRESETS & METRONOME
// ==========================================================================

let coversData = [];
let presetsData = [];
let activeRiffTab = 'covers'; // 'covers' | 'presets'

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

const DEFAULT_PRESETS = [
    {
        id: 'pre_1',
        name: 'Gojira Modern Heavy Rhythm',
        plugin: 'Archetype: Gojira X',
        amp: 'Amp 3 (High Gain)',
        cab: 'Cab 1 (SM57 + R121)',
        drive: 'OD-1 (Drive 0, Level 10, Tone 6)',
        notes: 'Graves ajustados, realce en 2.5kHz para corte en mezcla de metal moderno. Noise gate en -52dB.'
    },
    {
        id: 'pre_2',
        name: 'Petrucci Ethereal Shimmer Lead',
        plugin: 'Archetype: Petrucci',
        amp: 'Amp 4 (Lead Piezo Blend)',
        cab: 'Stereo Cab 4x12',
        drive: 'Compressor + TS9 Drive 3',
        notes: 'Delay dotted 8th a 450ms, Shimmer reverb al 30%. Fluido para solos melódicos.'
    },
    {
        id: 'pre_3',
        name: 'Nolly Djent Chug Punch',
        plugin: 'Archetype: Nolly',
        amp: 'Amp 3 (5150 Style)',
        cab: 'Nolly Custom 4x12',
        drive: 'Precision Drive (Attack 3, Bright 6)',
        notes: 'EQ con corte de graves antes del amp. Ideal para afinaciones bajas como Drop C o Drop A.'
    },
    {
        id: 'pre_4',
        name: 'Fortin Nameless Raw Metal',
        plugin: 'Fortin Nameless Suite',
        amp: 'Nameless High Gain',
        cab: 'Fortin Zilla Cab IRs',
        drive: 'Grind Pedal (Boost On)',
        notes: 'Agresividad pura de tubo británico modificado. Respuesta instantánea al palm mute.'
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
    initMetronome();
}

function saveCovers() {
    localStorage.setItem('riff_covers', JSON.stringify(coversData));
}

function savePresets() {
    localStorage.setItem('riff_presets', JSON.stringify(presetsData));
}

function switchRiffView(view) {
    activeRiffTab = view;
    document.getElementById('btn-view-covers').classList.toggle('active', view === 'covers');
    document.getElementById('btn-view-presets').classList.toggle('active', view === 'presets');
    document.getElementById('riff-covers-container').style.display = view === 'covers' ? 'block' : 'none';
    document.getElementById('riff-presets-container').style.display = view === 'presets' ? 'block' : 'none';
}

function renderRiffLab() {
    renderRiffMetrics();
    renderCoversList();
    renderPresetsList();
}

function renderRiffMetrics() {
    const totalCoversEl = document.getElementById('riff-metric-covers');
    const masteredEl = document.getElementById('riff-metric-mastered');
    const presetsEl = document.getElementById('riff-metric-presets');

    if (totalCoversEl) totalCoversEl.innerText = coversData.length;
    if (masteredEl) {
        const mastered = coversData.filter(c => c.status === 'mastered').length;
        masteredEl.innerText = `${mastered}/${coversData.length}`;
    }
    if (presetsEl) presetsEl.innerText = presetsData.length;
}

function renderCoversList() {
    const container = document.getElementById('riff-covers-grid');
    if (!container) return;

    if (coversData.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #64748b;">
                <div style="font-size: 15px; font-weight: 600; color: #94a3b8; margin-bottom: 6px;">No tienes covers en tu repertorio</div>
                <div style="font-size: 13px;">Haz clic en "Nuevo Cover" para agregar canciones y afinar tu práctica.</div>
            </div>
        `;
        return;
    }

    let html = '';
    coversData.forEach(c => {
        let statusLabel = 'Aprendiendo';
        if (c.status === 'polishing') statusLabel = 'Puliendo';
        if (c.status === 'mastered') statusLabel = 'Dominado';

        const bpmProgress = c.targetBpm > 0 ? Math.min(100, Math.round((c.currentBpm / c.targetBpm) * 100)) : 100;

        html += `
            <div class="cover-card">
                <div class="cover-header">
                    <div>
                        <div class="cover-title">${escapeHtmlRiff(c.title)}</div>
                        <div class="cover-artist">${escapeHtmlRiff(c.artist)}</div>
                    </div>
                    <span class="tuning-pill" title="Afinación de guitarra">⚲ ${escapeHtmlRiff(c.tuning)}</span>
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
                    <div style="display: flex; gap: 4px;">
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

function renderPresetsList() {
    const container = document.getElementById('riff-presets-grid');
    if (!container) return;

    if (presetsData.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #64748b;">
                <div style="font-size: 15px; font-weight: 600; color: #94a3b8; margin-bottom: 6px;">No tienes presets guardados</div>
                <div style="font-size: 13px;">Guarda las cadenas de tus plugins de Neural DSP para tenerlas a mano en cualquier ensayo o grabación.</div>
            </div>
        `;
        return;
    }

    let html = '';
    presetsData.forEach(p => {
        html += `
            <div class="preset-card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div class="cover-title">${escapeHtmlRiff(p.name)}</div>
                        <div class="plugin-badge" style="margin-top: 4px;">⚡ ${escapeHtmlRiff(p.plugin)}</div>
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
    if (confirm("¿Eliminar este cover de tu repertorio?")) {
        coversData = coversData.filter(c => c.id !== id);
        saveCovers();
        renderRiffLab();
    }
}

function eliminarPreset(id) {
    if (confirm("¿Eliminar este preset de Neural DSP?")) {
        presetsData = presetsData.filter(p => p.id !== id);
        savePresets();
        renderRiffLab();
    }
}

function agregarNuevoCover() {
    const title = prompt("Canción (Ej: 'The Art of Dying'):");
    if (!title || !title.trim()) return;

    const artist = prompt("Banda / Artista (Ej: 'Gojira'):") || "Desconocido";
    const tuning = prompt("Afinación (Ej: 'Drop D', 'D Standard', 'Drop C', '8-String'):") || "E Standard";
    const targetBpm = parseInt(prompt("BPM de la canción (Ej: 135):") || "120", 10);
    const presetUsed = prompt("Preset o plugin recomendado (Ej: 'Archetype Gojira - Rhythm'):") || "";

    const nuevo = {
        id: 'cov_' + Date.now(),
        title: title.trim(),
        artist: artist.trim(),
        tuning: tuning.trim(),
        status: 'learning',
        currentBpm: Math.round(targetBpm * 0.7),
        targetBpm: targetBpm,
        presetUsed: presetUsed.trim(),
        tabUrl: '',
        notes: ''
    };

    coversData.unshift(nuevo);
    saveCovers();
    renderRiffLab();
}

function agregarNuevoPreset() {
    const name = prompt("Nombre del preset (Ej: 'Fortin High Gain Lead'):");
    if (!name || !name.trim()) return;

    const plugin = prompt("Plugin de Neural DSP (Ej: 'Archetype Gojira X', 'Archetype Petrucci', 'Fortin Nameless'):") || "Neural DSP";
    const amp = prompt("Modelo de amplificador / configuración:") || "";
    const drive = prompt("Pedal de boost / overdrive / distorsión:") || "";
    const notes = prompt("Notas de ecualización o mezcla (Opcional):") || "";

    const nuevo = {
        id: 'pre_' + Date.now(),
        name: name.trim(),
        plugin: plugin.trim(),
        amp: amp.trim(),
        cab: '',
        drive: drive.trim(),
        notes: notes.trim()
    };

    presetsData.unshift(nuevo);
    savePresets();
    renderRiffLab();
}

// ==========================================================================
// SPEED TRAINER METRONOME (HTML5 WEB AUDIO API SYNTHESIZER)
// ==========================================================================
let metronomeAudioCtx = null;
let isMetronomeRunning = false;
let metronomeBpm = 120;
let metronomeTimer = null;

function initMetronome() {
    const bpmSlider = document.getElementById('metronome-slider');
    const bpmVal = document.getElementById('metronome-bpm-val');
    if (bpmSlider && bpmVal) {
        bpmSlider.value = metronomeBpm;
        bpmVal.innerText = metronomeBpm;
        bpmSlider.oninput = function() {
            setMetronomeBpm(parseInt(this.value, 10));
        };
    }
}

function setMetronomeBpm(bpm) {
    metronomeBpm = Math.max(40, Math.min(300, bpm));
    const bpmVal = document.getElementById('metronome-bpm-val');
    const bpmSlider = document.getElementById('metronome-slider');
    if (bpmVal) bpmVal.innerText = metronomeBpm;
    if (bpmSlider) bpmSlider.value = metronomeBpm;

    if (isMetronomeRunning) {
        toggleMetronome();
        toggleMetronome();
    }
}

function changeBpm(delta) {
    setMetronomeBpm(metronomeBpm + delta);
}

function playClickSound() {
    try {
        if (!metronomeAudioCtx) {
            metronomeAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (metronomeAudioCtx.state === 'suspended') {
            metronomeAudioCtx.resume();
        }

        const osc = metronomeAudioCtx.createOscillator();
        const gain = metronomeAudioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1050, metronomeAudioCtx.currentTime); // Sharp woodblock click
        gain.gain.setValueAtTime(1, metronomeAudioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, metronomeAudioCtx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(metronomeAudioCtx.destination);

        osc.start();
        osc.stop(metronomeAudioCtx.currentTime + 0.05);

        // Flash visual dot
        const dot = document.getElementById('metronome-dot');
        if (dot) {
            dot.classList.add('pulse');
            setTimeout(() => dot.classList.remove('pulse'), 90);
        }
    } catch(e) { }
}

function toggleMetronome() {
    const btn = document.getElementById('metronome-play-btn');
    if (isMetronomeRunning) {
        clearInterval(metronomeTimer);
        isMetronomeRunning = false;
        if (btn) {
            btn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                <span>Iniciar</span>
            `;
            btn.style.background = 'rgba(56, 189, 248, 0.15)';
            btn.style.borderColor = 'rgba(56, 189, 248, 0.35)';
            btn.style.color = '#38bdf8';
        }
    } else {
        isMetronomeRunning = true;
        playClickSound();
        const intervalMs = (60 / metronomeBpm) * 1000;
        metronomeTimer = setInterval(playClickSound, intervalMs);
        if (btn) {
            btn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                <span>Detener</span>
            `;
            btn.style.background = 'rgba(239, 68, 68, 0.2)';
            btn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            btn.style.color = '#f87171';
        }
    }
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

document.addEventListener('DOMContentLoaded', initRiffLab);

let focusTimer = null;
let timeLeft = 30 * 60; // 30 minutos por defecto
let isRunning = false;
let currentMode = 'estudio'; // 'estudio' o 'descanso'

// Lofi Radio State
let radioAudio = new Audio('https://stream.laut.fm/lofi');
radioAudio.crossOrigin = "anonymous";
let isRadioPlaying = false;
radioAudio.volume = 0.5;

let audioCtx = null;
let analyser = null;
let dataArray = null;
let animationId = null;



function initEstudio() {
    renderEstudio();
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function toggleTimer() {
    if (isRunning) {
        clearInterval(focusTimer);
        isRunning = false;
        localStorage.removeItem('isStudying');
    } else {
        isRunning = true;
        localStorage.setItem('isStudying', 'true');
        focusTimer = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateTimerDisplay();
            } else {
                clearInterval(focusTimer);
                isRunning = false;
                localStorage.removeItem('isStudying');
                if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
                alert(currentMode === 'estudio' ? '¡Bloque de estudio terminado! Tómate un descanso.' : '¡Descanso terminado! Volvamos al estudio.');
                switchMode(currentMode === 'estudio' ? 'descanso' : 'estudio');
            }
        }, 1000);
    }
    updateEstudioUI();
}

function resetTimer() {
    clearInterval(focusTimer);
    isRunning = false;
    localStorage.removeItem('isStudying');
    timeLeft = currentMode === 'estudio' ? 30 * 60 : 15 * 60;
    updateTimerDisplay();
    updateEstudioUI();
}

function switchMode(mode) {
    clearInterval(focusTimer);
    isRunning = false;
    localStorage.removeItem('isStudying');
    currentMode = mode;
    timeLeft = mode === 'estudio' ? 30 * 60 : 15 * 60;
    renderEstudio();
}

function updateTimerDisplay() {
    const el = document.getElementById('focus-time');
    if (el) el.textContent = formatTime(timeLeft);
}

function updateEstudioUI() {
    const btn = document.getElementById('btn-toggle-timer');
    if (btn) {
        btn.innerHTML = isRunning ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pausar` : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Iniciar`;
        btn.className = isRunning ? 'estudio-btn btn-pause' : 'estudio-btn btn-start';
    }
    
    const circle = document.querySelector('.focus-circle');
    if (circle) {
        if (isRunning) circle.classList.add('pulsing');
        else circle.classList.remove('pulsing');
    }
}


// --- LOFI RADIO LOGIC ---
function initAudioAnalyser() {
    if (audioCtx) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaElementSource(radioAudio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        analyser.fftSize = 64;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    } catch(e) {
        console.error("Audio Context no soportado o bloqueado", e);
    }
}

function updateVisualizer() {
    if (!isRadioPlaying || !analyser) return;
    
    analyser.getByteFrequencyData(dataArray);
    
    const bars = document.querySelectorAll('.radio-visualizer .bar');
    if (bars.length > 0) {
        // Distribute 8 bars across the frequency spectrum
        const step = Math.floor(dataArray.length / bars.length);
        
        bars.forEach((bar, i) => {
            let value = dataArray[i * step];
            // Normalize value to a scale between 0.1 and 1
            let scale = Math.max(0.1, value / 255);
            bar.style.transform = `scaleY(${scale})`;
            bar.style.animation = 'none'; // Disable CSS animation when real data is playing
        });
    }
    
    animationId = requestAnimationFrame(updateVisualizer);
}

function toggleRadio() {
    if (isRadioPlaying) {
        radioAudio.pause();
        isRadioPlaying = false;
        if (animationId) cancelAnimationFrame(animationId);
        
        // Reset bars
        const bars = document.querySelectorAll('.radio-visualizer .bar');
        bars.forEach(bar => {
            bar.style.transform = 'scaleY(0.2)';
            bar.style.animation = 'none';
        });
    } else {
        initAudioAnalyser();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        radioAudio.play().catch(e => alert("Error al reproducir radio: " + e));
        isRadioPlaying = true;
        updateVisualizer();
    }
    updateRadioUI();
}

function setRadioVolume(val) {
    radioAudio.volume = val / 100;
}

function updateRadioUI() {
    const btn = document.getElementById('btn-radio-toggle');
    const visualizer = document.getElementById('radio-visualizer');
    
    if (btn) {
        btn.innerHTML = isRadioPlaying ? 
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>` : 
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    }
    if (visualizer) {
        visualizer.style.opacity = isRadioPlaying ? '1' : '0.2';
        visualizer.style.animationPlayState = isRadioPlaying ? 'running' : 'paused';
    }
}

function renderEstudio() {
    const container = document.getElementById('estudio-container');
    if (!container) return;

    const html = `
        <div class="estudio-wrapper" style="width:100%; max-width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:80vh; padding-top: 5vh;">
            <div class="focus-circle ${isRunning ? 'pulsing' : ''} ${currentMode}">
                <div class="focus-time" id="focus-time">${formatTime(timeLeft)}</div>
                <div class="focus-label">${currentMode === 'estudio' ? 'ENFOQUE PROFUNDO' : 'RELAJO'}</div>
            </div>
            
            <div class="estudio-controls" style="display:flex; justify-content:center; align-items:center; width:100%;">
                <button id="btn-toggle-timer" class="estudio-btn ${isRunning ? 'btn-pause' : 'btn-start'}" onclick="toggleTimer()">
                    ${isRunning ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pausar` : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Iniciar`}
                </button>
                <button class="estudio-btn btn-reset" onclick="resetTimer()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:-2px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg> Reiniciar</button>
            </div>
            
            <!-- MODERN LOFI RADIO -->
            <div class="radio-card" style="margin: 40px auto 0 auto; align-self:center; display:flex; flex-direction:column; text-align:left;">
                <div class="radio-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="radio-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                        </div>
                        <div>
                            <div class="radio-title">Lofi Beats Radio</div>
                            <div class="radio-subtitle">Chill & Focus 24/7</div>
                        </div>
                    </div>
                    <div class="radio-visualizer" id="radio-visualizer" style="opacity: ${isRadioPlaying ? '1' : '0.2'};">
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                    </div>
                </div>
                
                <div class="radio-controls">
                    <button id="btn-radio-toggle" class="radio-btn-play" onclick="toggleRadio()">
                        ${isRadioPlaying ? 
                            `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>` : 
                            `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`}
                    </button>
                    <div style="display:flex; align-items:center; gap:8px; width: 100%;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>
                        <input type="range" min="0" max="100" value="${radioAudio.volume * 100}" class="radio-volume" oninput="setRadioVolume(this.value)">
                    </div>
                </div>
            </div>
            
            </div>
    `;
    
    container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', initEstudio);

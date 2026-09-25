let focusTimer = null;
let timeLeft = 30 * 60; // 30 minutos por defecto
let isRunning = false;
let currentMode = 'estudio'; // 'estudio' o 'descanso'

// Lofi Radio State
let radioAudio = new Audio('https://listen.reyfm.de/lofi_128kbps.mp3');
let isRadioPlaying = false;
radioAudio.volume = 0.5;
let animationId = null;



function initEstudio() {
    renderEstudio();
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function toggleEstudioTimer() {
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
                if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
                // Seamlessly swap mode and time without stopping
                currentMode = currentMode === 'estudio' ? 'descanso' : 'estudio';
                timeLeft = currentMode === 'estudio' ? 30 * 60 : 15 * 60;
                
                // Re-render UI to update text and circle colors
                renderEstudio();
            }
        }, 1000);
    }
    updateEstudioUI();
}

function resetEstudioTimer() {
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
        btn.innerHTML = isRunning ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>` : `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-left:2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        btn.className = isRunning ? 'estudio-btn-glossy btn-pause' : 'estudio-btn-glossy btn-start';
    }
    
    const circle = document.querySelector('.focus-circle');
    if (circle) {
        if (isRunning) {
            circle.classList.add('pulsing');
            circle.classList.add('lofi-active');
        } else {
            circle.classList.remove('pulsing');
            circle.classList.remove('lofi-active');
        }
        
        const label = circle.querySelector('.focus-label');
        if (label) {
            const newText = isRunning 
                ? (currentMode === 'estudio' ? 'DEEP FOCUS' : 'CHILL BREAK') 
                : (currentMode === 'estudio' ? 'ENFOQUE PROFUNDO' : 'RELAJO');
                
            if (label.textContent !== newText) {
                label.style.opacity = '0';
                label.style.transform = 'translateY(4px)';
                
                setTimeout(() => {
                    label.textContent = newText;
                    if (isRunning) {
                        label.classList.add('lofi-text-anim');
                    } else {
                        label.classList.remove('lofi-text-anim');
                    }
                    label.style.opacity = '1';
                    label.style.transform = 'translateY(0)';
                }, 250);
            }
        }
    }
}


// --- LOFI RADIO LOGIC ---
function updateVisualizer() {
    if (!isRadioPlaying) return;
    
    const bars = document.querySelectorAll('.radio-visualizer .bar');
    if (bars.length > 0) {
        bars.forEach(bar => {
            // Fake frequency data using random math for realistic feel
            let randomScale = 0.2 + (Math.random() * 0.8);
            bar.style.transform = `scaleY(${randomScale})`;
            bar.style.transition = 'transform 0.1s ease-in-out';
            bar.style.animation = 'none';
        });
    }
    
    // throttle the fake updates to ~15fps so it looks like an equalizer
    setTimeout(() => {
        animationId = requestAnimationFrame(updateVisualizer);
    }, 70);
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
            bar.style.transition = 'transform 0.3s ease';
        });
    } else {
        radioAudio.play().catch(e => mostrarAlertaWeb("Error al reproducir radio: " + e, 'No se pudo reproducir', 'error'));
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
    const focusCircle = document.querySelector('.focus-circle');
    
    if (btn) {
        btn.innerHTML = isRadioPlaying ? 
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>` : 
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    }
    if (visualizer) {
        visualizer.style.opacity = isRadioPlaying ? '1' : '0';
        visualizer.style.animationPlayState = isRadioPlaying ? 'running' : 'paused';
    }
}

function renderEstudio() {
    const container = document.getElementById('estudio-container');
    if (!container) return;

    const html = `
        <div class="estudio-wrapper">
            <div class="focus-circle ${isRunning ? 'pulsing lofi-active' : ''} ${currentMode}">
                <div class="focus-time" id="focus-time">${formatTime(timeLeft)}</div>
                <div class="focus-label ${isRunning ? 'lofi-text-anim' : ''}">${currentMode === 'estudio' ? (isRunning ? 'DEEP FOCUS' : 'ENFOQUE PROFUNDO') : (isRunning ? 'CHILL BREAK' : 'RELAJO')}</div>
            </div>
            
            <div class="estudio-controls" style="display:flex; justify-content:center; align-items:center; width:100%; gap: 20px;">
                <button id="btn-toggle-timer" class="estudio-btn-glossy ${isRunning ? 'btn-pause' : 'btn-start'}" onclick="toggleEstudioTimer()" title="Iniciar / Pausar">
                    ${isRunning ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>` : `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-left:2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`}
                </button>
                <button class="estudio-btn-glossy btn-reset" onclick="resetEstudioTimer()" title="Reiniciar ciclo">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                </button>
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
                    <div class="radio-visualizer" id="radio-visualizer" style="opacity: ${isRadioPlaying ? '1' : '0'};">
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

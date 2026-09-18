let pomodoroTimer = null;
let timeLeft = 50 * 60; // 50 minutos por defecto
let isRunning = false;
let currentMode = 'estudio'; // 'estudio' o 'descanso'

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
        clearInterval(pomodoroTimer);
        isRunning = false;
        localStorage.removeItem('isStudying');
    } else {
        isRunning = true;
        localStorage.setItem('isStudying', 'true');
        pomodoroTimer = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateTimerDisplay();
            } else {
                clearInterval(pomodoroTimer);
                isRunning = false;
                localStorage.removeItem('isStudying');
                // Alarma simple
                if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
                alert(currentMode === 'estudio' ? '¡Bloque de estudio terminado! Tómate un descanso.' : '¡Descanso terminado! Volvamos al estudio.');
                switchMode(currentMode === 'estudio' ? 'descanso' : 'estudio');
            }
        }, 1000);
    }
    updateEstudioUI();
}

function resetTimer() {
    clearInterval(pomodoroTimer);
    isRunning = false;
    localStorage.removeItem('isStudying');
    timeLeft = currentMode === 'estudio' ? 50 * 60 : 10 * 60;
    updateTimerDisplay();
    updateEstudioUI();
}

function switchMode(mode) {
    clearInterval(pomodoroTimer);
    isRunning = false;
    localStorage.removeItem('isStudying');
    currentMode = mode;
    timeLeft = mode === 'estudio' ? 50 * 60 : 10 * 60;
    renderEstudio();
}

function updateTimerDisplay() {
    const el = document.getElementById('pomodoro-time');
    if (el) el.textContent = formatTime(timeLeft);
}

function updateEstudioUI() {
    const btn = document.getElementById('btn-toggle-timer');
    if (btn) {
        btn.innerHTML = isRunning ? '⏸ Pausar' : '▶ Iniciar Enfoque';
        btn.className = isRunning ? 'estudio-btn btn-pause' : 'estudio-btn btn-start';
    }
    
    const circle = document.querySelector('.pomodoro-circle');
    if (circle) {
        if (isRunning) circle.classList.add('pulsing');
        else circle.classList.remove('pulsing');
    }
}

function renderEstudio() {
    const container = document.getElementById('estudio-container');
    if (!container) return;

    const html = `
        <div class="estudio-wrapper">
            <div class="estudio-header">
                <h2>Modo Estudio En Vivo</h2>
                <p>Silencia distracciones y enfócate. Al iniciar, tus amigos verán que estás estudiando.</p>
            </div>
            
            <div class="estudio-mode-selector">
                <button class="mode-btn ${currentMode === 'estudio' ? 'active' : ''}" onclick="switchMode('estudio')">50m Estudio</button>
                <button class="mode-btn ${currentMode === 'descanso' ? 'active' : ''}" onclick="switchMode('descanso')">10m Descanso</button>
            </div>
            
            <div class="pomodoro-circle ${isRunning ? 'pulsing' : ''} ${currentMode}">
                <div class="pomodoro-time" id="pomodoro-time">${formatTime(timeLeft)}</div>
                <div class="pomodoro-label">${currentMode === 'estudio' ? 'ENFOQUE PROFUNDO' : 'RELAJO'}</div>
            </div>
            
            <div class="estudio-controls">
                <button id="btn-toggle-timer" class="estudio-btn ${isRunning ? 'btn-pause' : 'btn-start'}" onclick="toggleTimer()">
                    ${isRunning ? '⏸ Pausar' : '▶ Iniciar Enfoque'}
                </button>
                <button class="estudio-btn btn-reset" onclick="resetTimer()">⏹ Reiniciar</button>
            </div>
            
            <div class="estudio-social-box">
                <div class="social-title">Estado Social</div>
                <div class="social-desc">Mientras el cronómetro corre, tus amigos verán una insignia especial en tu perfil de horario.</div>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', initEstudio);

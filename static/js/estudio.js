let focusTimer = null;
let timeLeft = 30 * 60; // 30 minutos por defecto
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

function renderEstudio() {
    const container = document.getElementById('estudio-container');
    if (!container) return;

    const html = `
        <div class="estudio-wrapper">
            <div class="estudio-header">
                <h2>Modo Estudio En Vivo</h2>
                <p>Silencia distracciones y enfócate. Al iniciar, tus amigos verán que estás estudiando.</p>
            </div>
            

            
            <div class="focus-circle ${isRunning ? 'pulsing' : ''} ${currentMode}">
                <div class="focus-time" id="focus-time">${formatTime(timeLeft)}</div>
                <div class="focus-label">${currentMode === 'estudio' ? 'ENFOQUE PROFUNDO' : 'RELAJO'}</div>
            </div>
            
            <div class="estudio-controls">
                <button id="btn-toggle-timer" class="estudio-btn ${isRunning ? 'btn-pause' : 'btn-start'}" onclick="toggleTimer()">
                    ${isRunning ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pausar` : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Iniciar`}
                </button>
                <button class="estudio-btn btn-reset" onclick="resetTimer()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:-2px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg> Reiniciar</button>
            </div>
            
            
        </div>
    `;
    container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', initEstudio);

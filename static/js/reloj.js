let clockInterval = null;
let stopwatchInterval = null;
let stopwatchTime = 0; // en centésimas de segundo
let stopwatchRunning = false;
let currentRelojMode = 'clock'; // 'clock' or 'stopwatch'

function initReloj() {
    renderReloj();
    startClock();
}

function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(updateClock, 1000);
    updateClock();
}

function updateClock() {
    if (currentRelojMode !== 'clock') return;
    const now = new Date();
    let h = now.getHours().toString().padStart(2, '0');
    let m = now.getMinutes().toString().padStart(2, '0');
    let s = now.getSeconds().toString().padStart(2, '0');
    
    const timeEl = document.getElementById('reloj-time-display');
    if (timeEl) {
        timeEl.innerHTML = `${h}:${m}<span class="reloj-sec">:${s}</span>`;
    }
    
    const dateEl = document.getElementById('reloj-date-display');
    if (dateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        let dateStr = now.toLocaleDateString('es-ES', options);
        // Capitalize first letter
        dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
        dateEl.textContent = dateStr;
    }
    
    // Update cities
    const timeNy = document.getElementById('time-ny');
    if (timeNy) {
        timeNy.textContent = now.toLocaleTimeString('es-ES', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
    }
    const timeWroclaw = document.getElementById('time-wroclaw');
    if (timeWroclaw) {
        timeWroclaw.textContent = now.toLocaleTimeString('es-ES', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });
    }
    const timeTokyo = document.getElementById('time-tokyo');
    if (timeTokyo) {
        timeTokyo.textContent = now.toLocaleTimeString('es-ES', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
    }
}

function toggleStopwatch() {
    if (stopwatchRunning) {
        clearInterval(stopwatchInterval);
        stopwatchRunning = false;
    } else {
        stopwatchRunning = true;
        stopwatchInterval = setInterval(() => {
            stopwatchTime += 1;
            updateStopwatchDisplay();
        }, 10);
    }
    updateRelojUI();
}

function resetStopwatch() {
    clearInterval(stopwatchInterval);
    stopwatchRunning = false;
    stopwatchTime = 0;
    updateStopwatchDisplay();
    updateRelojUI();
}

function updateStopwatchDisplay() {
    const timeEl = document.getElementById('reloj-time-display');
    if (!timeEl) return;
    
    let centiseconds = stopwatchTime % 100;
    let totalSeconds = Math.floor(stopwatchTime / 100);
    let s = totalSeconds % 60;
    let totalMinutes = Math.floor(totalSeconds / 60);
    let m = totalMinutes % 60;
    let h = Math.floor(totalMinutes / 60);
    
    let display = "";
    if (h > 0) display += h.toString().padStart(2, '0') + ":";
    display += m.toString().padStart(2, '0') + ":" + s.toString().padStart(2, '0');
    
    timeEl.innerHTML = `${display}<span class="reloj-sec">.${centiseconds.toString().padStart(2, '0')}</span>`;
}

function switchRelojMode(mode) {
    currentRelojMode = mode;
    renderReloj();
    if (mode === 'clock') {
        updateClock();
    } else {
        updateStopwatchDisplay();
    }
}

function updateRelojUI() {
    const btn = document.getElementById('btn-toggle-sw');
    if (btn) {
        btn.innerHTML = stopwatchRunning ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pausar` : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Iniciar`;
        btn.className = stopwatchRunning ? 'estudio-btn btn-pause' : 'estudio-btn btn-start';
    }
}

let isZenMode = false;

function toggleZenMode() {
    if (currentRelojMode !== 'clock') return;
    isZenMode = !isZenMode;
    const wrapper = document.querySelector('.reloj-wrapper');
    if (wrapper) {
        if (isZenMode) wrapper.classList.add('zen-mode');
        else wrapper.classList.remove('zen-mode');
    }
}

function renderReloj() {
    const container = document.getElementById('reloj-container');
    if (!container) return;

    let content = '';
    
    if (currentRelojMode === 'clock') {
        content = `
            <div class="reloj-header hide-in-zen">
                <h2>Tu reloj está exacto.</h2>
                <p>La precisión de sincronización es de ±0.015 s.<br>Hora en Santiago, Chile ahora:</p>
            </div>
            
            <div class="reloj-time clickeable-time" id="reloj-time-display" onclick="toggleZenMode()">
                00:00<span class="reloj-sec">:00</span>
            </div>
            
            <div class="reloj-date hide-in-zen" id="reloj-date-display">Cargando fecha...</div>
            
            <div class="reloj-cities hide-in-zen">
                <div class="city-box">
                    <div class="city-name">Nueva York</div>
                    <div class="city-time" id="time-ny">--:--</div>
                </div>
                <div class="city-box">
                    <div class="city-name">Wrocław</div>
                    <div class="city-time" id="time-wroclaw">--:--</div>
                </div>
                <div class="city-box">
                    <div class="city-name">Tokio</div>
                    <div class="city-time" id="time-tokyo">--:--</div>
                </div>
            </div>
        `;
    } else {
        content = `
            <div class="reloj-time" id="reloj-time-display">00:00<span class="reloj-sec">.00</span></div>
            <div class="estudio-controls hide-in-zen" style="margin-top: 30px;">
                <button id="btn-toggle-sw" class="estudio-btn ${stopwatchRunning ? 'btn-pause' : 'btn-start'}" onclick="toggleStopwatch()">
                    ${stopwatchRunning ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pausar` : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Iniciar`}
                </button>
                <button class="estudio-btn btn-reset" onclick="resetStopwatch()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:-2px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg> Reiniciar</button>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="reloj-wrapper ${isZenMode && currentRelojMode === 'clock' ? 'zen-mode' : ''}">
            <div class="estudio-mode-selector hide-in-zen" style="margin-bottom: 20px;">
                <button class="mode-btn ${currentRelojMode === 'clock' ? 'active' : ''}" onclick="switchRelojMode('clock')">Hora Exacta</button>
                <button class="mode-btn ${currentRelojMode === 'stopwatch' ? 'active' : ''}" onclick="switchRelojMode('stopwatch')">Cronómetro</button>
            </div>
            ${content}
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', initReloj);

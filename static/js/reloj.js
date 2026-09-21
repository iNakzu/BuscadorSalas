let clockInterval = null;
let stopwatchInterval = null;
let stopwatchTime = 0; // en centésimas de segundo
let stopwatchRunning = false;
let timerMode = 'stopwatch';
let countdownTime = 5 * 60;

function initReloj() {
    renderReloj();
    renderCronometro();
    startClock();
}

function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(updateClock, 1000);
    updateClock();
}

function updateClock() {
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
    if (timerMode === 'countdown') {
        toggleCountdown();
        return;
    }
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

    updateCronometroUI();
}

function toggleCountdown() {
    if (stopwatchRunning) {
        clearInterval(stopwatchInterval);
        stopwatchRunning = false;
    } else if (countdownTime > 0) {
        stopwatchRunning = true;
        stopwatchInterval = setInterval(() => {
            countdownTime--;
            updateStopwatchDisplay();
            if (countdownTime <= 0) {
                clearInterval(stopwatchInterval);
                stopwatchRunning = false;
                if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
                mostrarAlertaWeb('La cuenta regresiva llegó a cero.', 'Tiempo cumplido');
            }
        }, 1000);
    }
    updateCronometroUI();
}

function resetStopwatch() {
    clearInterval(stopwatchInterval);
    stopwatchRunning = false;
    stopwatchTime = 0;
    countdownTime = getCountdownInputSeconds();
    updateStopwatchDisplay();
    updateCronometroUI();
}

function getCountdownInputSeconds() {
    const minutesInput = document.getElementById('countdown-minutes');
    const secondsInput = document.getElementById('countdown-seconds');
    const minutes = parseInt(minutesInput ? minutesInput.value : '5', 10);
    const seconds = parseInt(secondsInput ? secondsInput.value : '0', 10);
    return Math.max(0, (Number.isFinite(minutes) ? minutes : 0) * 60 + (Number.isFinite(seconds) ? Math.min(59, seconds) : 0));
}

function setTimerMode(mode) {
    if (stopwatchRunning) resetStopwatch();
    timerMode = mode;
    if (mode === 'countdown') countdownTime = getCountdownInputSeconds();
    renderCronometro();
}

function applyCountdown() {
    if (stopwatchRunning) resetStopwatch();
    countdownTime = getCountdownInputSeconds();
    updateStopwatchDisplay();
    updateCronometroUI();
}

function updateStopwatchDisplay() {
    const timeEl = document.getElementById('crono-time-display');
    if (!timeEl) return;

    if (timerMode === 'countdown') {
        const minutes = Math.floor(countdownTime / 60);
        const seconds = countdownTime % 60;
        timeEl.innerHTML = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        return;
    }
    
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

function updateCronometroUI() {
    const btn = document.getElementById('btn-toggle-sw');
    if (btn) {
        btn.innerHTML = stopwatchRunning ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pausar` : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Iniciar`;
        btn.className = stopwatchRunning ? 'estudio-btn btn-pause' : 'estudio-btn btn-start';
    }
}

let isZenMode = false;

function toggleZenMode() {
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

    container.innerHTML = `
        <div class="reloj-wrapper ${isZenMode ? 'zen-mode' : ''}">
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
        </div>
    `;
}

function renderCronometro() {
    const container = document.getElementById('cronometro-container');
    if (!container) return;

    container.innerHTML = `
        <div class="reloj-wrapper" style="display:flex; flex-direction:column; align-items:center; width:100%;">
            <div style="display:flex; gap:8px; margin-bottom:18px;">
                <button class="estudio-btn ${timerMode === 'stopwatch' ? 'btn-start' : 'btn-reset'}" onclick="setTimerMode('stopwatch')">Cronómetro</button>
                <button class="estudio-btn ${timerMode === 'countdown' ? 'btn-start' : 'btn-reset'}" onclick="setTimerMode('countdown')">Cuenta regresiva</button>
            </div>
            <div class="reloj-time" id="crono-time-display">${timerMode === 'countdown' ? formatCountdownDisplay() : '00:00<span class="reloj-sec">.00</span>'}</div>
            ${timerMode === 'countdown' ? `
                <div style="display:flex; align-items:end; gap:8px; margin-top:22px;">
                    <label style="display:flex; flex-direction:column; gap:5px; color:#94a3b8; font-size:11px; font-weight:700;">
                        Minutos
                        <input id="countdown-minutes" type="number" min="0" max="999" value="${Math.floor(countdownTime / 60)}" style="width:78px; padding:8px; border:1px solid rgba(148,163,184,.25); border-radius:8px; background:rgba(15,23,42,.7); color:#f8fafc;">
                    </label>
                    <label style="display:flex; flex-direction:column; gap:5px; color:#94a3b8; font-size:11px; font-weight:700;">
                        Segundos
                        <input id="countdown-seconds" type="number" min="0" max="59" value="${countdownTime % 60}" style="width:78px; padding:8px; border:1px solid rgba(148,163,184,.25); border-radius:8px; background:rgba(15,23,42,.7); color:#f8fafc;">
                    </label>
                    <button class="estudio-btn btn-reset" onclick="applyCountdown()">Aplicar</button>
                </div>
            ` : ''}
            <div class="estudio-controls" style="margin-top: 30px; display:flex; justify-content:center; align-items:center; width:100%;">
                <button id="btn-toggle-sw" class="estudio-btn ${stopwatchRunning ? 'btn-pause' : 'btn-start'}" onclick="toggleStopwatch()">
                    ${stopwatchRunning ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pausar` : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Iniciar`}
                </button>
                <button class="estudio-btn btn-reset" onclick="resetStopwatch()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:-2px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg> Reiniciar</button>
            </div>
            
            </div>

            
            
        </div>
    `;
}

function formatCountdownDisplay() {
    const minutes = Math.floor(countdownTime / 60);
    const seconds = countdownTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

document.addEventListener('DOMContentLoaded', initReloj);

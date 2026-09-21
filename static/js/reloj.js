let clockInterval = null;
let stopwatchInterval = null;
let stopwatchTime = 0; // en centésimas de segundo
let stopwatchRunning = false;
let timerMode = 'stopwatch';
let countdownTime = 5 * 60;
let countdownEndAt = null;

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
        countdownEndAt = null;
    } else {
        stopwatchRunning = true;
        countdownEndAt = null;
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
        countdownEndAt = null;
    } else if (countdownTime > 0) {
        stopwatchRunning = true;
        countdownEndAt = Date.now() + countdownTime * 1000;
        stopwatchInterval = setInterval(() => {
            countdownTime--;
            updateStopwatchDisplay();
            if (countdownTime <= 0) {
                clearInterval(stopwatchInterval);
                stopwatchRunning = false;
                countdownEndAt = null;
                if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
                mostrarAlertaWeb('La cuenta regresiva llegó a cero.', 'Tiempo cumplido');
            }
        }, 1000);
    }
    updateStopwatchDisplay();
    updateCronometroUI();
}

function resetStopwatch() {
    clearInterval(stopwatchInterval);
    stopwatchRunning = false;
    stopwatchTime = 0;
    countdownTime = getCountdownInputSeconds();
    countdownEndAt = null;
    updateStopwatchDisplay();
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
    countdownEndAt = null;
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
        const endEl = document.getElementById('crono-end-time');
        if (endEl) {
            endEl.textContent = countdownEndAt
                ? `Termina a las ${formatClockTime(new Date(countdownEndAt))}`
                : 'Sin iniciar';
        }
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
    const endEl = document.getElementById('crono-end-time');
    if (endEl) endEl.textContent = 'Sin término fijado';
}

function formatClockTime(date) {
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function updateCronometroUI() {
    const btn = document.getElementById('btn-toggle-sw');
    if (btn) {
        btn.innerHTML = stopwatchRunning
            ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect></svg>`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="7,4 19,12 7,20"></polygon></svg>`;
        btn.title = stopwatchRunning ? 'Pausar' : 'Iniciar';
        btn.setAttribute('aria-label', stopwatchRunning ? 'Pausar' : 'Iniciar');
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
        <div class="reloj-wrapper" style="min-height:0; width:100%;">
            <div class="cronometro-shell">
                <div class="cronometro-mode-switch" role="tablist" aria-label="Modo de tiempo">
                    <button class="cronometro-mode-btn ${timerMode === 'stopwatch' ? 'active' : ''}" onclick="setTimerMode('stopwatch')" title="Cronómetro" aria-label="Cronómetro">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 1.5M9 3h6"></path></svg>
                    </button>
                    <button class="cronometro-mode-btn ${timerMode === 'countdown' ? 'active' : ''}" onclick="setTimerMode('countdown')" title="Cuenta regresiva" aria-label="Cuenta regresiva">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h12M6 20h12"></path><path d="M8 4c0 4 8 4 8 8s-8 4-8 8"></path></svg>
                    </button>
                </div>
                <div class="cronometro-display-card">
                    <div class="reloj-time cronometro-display" id="crono-time-display">${timerMode === 'countdown' ? formatCountdownDisplay() : '00:00<span class="reloj-sec">.00</span>'}</div>
                    <div class="cronometro-end-time" id="crono-end-time">${timerMode === 'countdown' ? 'Sin iniciar' : 'Sin término fijado'}</div>
                </div>
                ${timerMode === 'countdown' ? `
                    <div class="cronometro-config">
                        <label class="cronometro-field" title="Minutos">
                            <input aria-label="Minutos" id="countdown-minutes" type="number" min="0" max="999" value="${Math.floor(countdownTime / 60)}">
                        </label>
                        <label class="cronometro-field" title="Segundos">
                            <input aria-label="Segundos" id="countdown-seconds" type="number" min="0" max="59" value="${countdownTime % 60}">
                        </label>
                        <button class="estudio-btn cronometro-icon-btn" onclick="applyCountdown()" title="Aplicar tiempo" aria-label="Aplicar tiempo">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
                        </button>
                    </div>
                ` : ''}
                <div class="cronometro-actions">
                    <button id="btn-toggle-sw" class="estudio-btn cronometro-icon-btn ${stopwatchRunning ? 'btn-pause' : 'btn-start'}" onclick="toggleStopwatch()" title="${stopwatchRunning ? 'Pausar' : 'Iniciar'}" aria-label="${stopwatchRunning ? 'Pausar' : 'Iniciar'}">
                        ${stopwatchRunning ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect></svg>` : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="7,4 19,12 7,20"></polygon></svg>`}
                    </button>
                    <button class="estudio-btn cronometro-icon-btn btn-reset" onclick="resetStopwatch()" title="Reiniciar" aria-label="Reiniciar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.7"></path><path d="M4 4v5h5"></path></svg>
                    </button>
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

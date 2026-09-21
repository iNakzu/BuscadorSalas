let clockInterval = null;
let stopwatchInterval = null;
let stopwatchTime = 0; // en centésimas de segundo
let stopwatchRunning = false;
let countdownTime = 5 * 60;
let countdownEndAt = null;
let timerConfigured = false;

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
    const chronoDateEl = document.getElementById('crono-date-display');
    if (chronoDateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        let dateStr = now.toLocaleDateString('es-ES', options);
        chronoDateEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
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
    if (!stopwatchRunning) {
        const configuredSeconds = getTimerInputSeconds();
        timerConfigured = configuredSeconds > 0;
        if (timerConfigured) countdownTime = configuredSeconds;
    }
    if (timerConfigured) {
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
    if (!stopwatchRunning) countdownTime = getTimerInputSeconds();
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
    timerConfigured = false;
    countdownTime = 0;
    countdownEndAt = null;
    renderCronometro();
    updateCronometroUI();
}

function getTimerInputSeconds() {
    const hoursInput = document.getElementById('timer-hours');
    const minutesInput = document.getElementById('timer-minutes');
    const secondsInput = document.getElementById('timer-seconds');
    const hours = parseInt(hoursInput ? hoursInput.value : '0', 10);
    const minutes = parseInt(minutesInput ? minutesInput.value : '0', 10);
    const seconds = parseInt(secondsInput ? secondsInput.value : '0', 10);
    return Math.max(0, (Number.isFinite(hours) ? hours : 0) * 3600 + (Number.isFinite(minutes) ? Math.min(59, minutes) : 0) * 60 + (Number.isFinite(seconds) ? Math.min(59, seconds) : 0));
}

function markTimerConfigured() {
    if (stopwatchRunning) return;
    timerConfigured = getTimerInputSeconds() > 0;
    countdownTime = getTimerInputSeconds();
    updateCronometroUI();
}

function updateStopwatchDisplay() {
    const timeEl = document.getElementById('crono-time-display');
    if (!timeEl) return;

    if (timerConfigured) {
        const seconds = countdownTime % 60;
        const hours = Math.floor(countdownTime / 3600);
        const displayMinutes = Math.floor((countdownTime % 3600) / 60);
        timeEl.innerHTML = `<input class="cronometro-time-input" value="${hours.toString().padStart(2, '0')}" inputmode="numeric" maxlength="2" aria-label="Horas" onfocus="this.select()" oninput="markTimerConfigured()" ${stopwatchRunning ? 'readonly' : ''}><span>:</span><input class="cronometro-time-input" value="${displayMinutes.toString().padStart(2, '0')}" inputmode="numeric" maxlength="2" aria-label="Minutos" onfocus="this.select()" oninput="markTimerConfigured()" ${stopwatchRunning ? 'readonly' : ''}><span>:</span><input class="cronometro-time-input reloj-sec" value="${seconds.toString().padStart(2, '0')}" inputmode="numeric" maxlength="2" aria-label="Segundos" onfocus="this.select()" oninput="markTimerConfigured()" ${stopwatchRunning ? 'readonly' : ''}>`;
        const endEl = document.getElementById('crono-end-time');
        if (endEl) {
            endEl.textContent = countdownEndAt
                ? formatClockTime(new Date(countdownEndAt))
                : '';
        }
        return;
    }
    
    let centiseconds = stopwatchTime % 100;
    let totalSeconds = Math.floor(stopwatchTime / 100);
    let s = totalSeconds % 60;
    let totalMinutes = Math.floor(totalSeconds / 60);
    let m = totalMinutes % 60;
    let h = Math.floor(totalMinutes / 60);
    
    timeEl.innerHTML = `<span>${h.toString().padStart(2, '0')}</span><span>:</span><span>${m.toString().padStart(2, '0')}</span><span>:</span><span class="reloj-sec">${s.toString().padStart(2, '0')}</span>`;
    const endEl = document.getElementById('crono-end-time');
    if (endEl) endEl.textContent = '';
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
        <div class="reloj-wrapper cronometro-page">
            <div class="cronometro-shell">
                <div class="cronometro-spacer" aria-hidden="true"></div>
                <div class="cronometro-display-card">
                    <div class="reloj-time cronometro-display" id="crono-time-display">
                        <input class="cronometro-time-input" id="timer-hours" value="00" inputmode="numeric" maxlength="2" aria-label="Horas" onfocus="this.select()" oninput="markTimerConfigured()">
                        <span>:</span>
                        <input class="cronometro-time-input" id="timer-minutes" value="00" inputmode="numeric" maxlength="2" aria-label="Minutos" onfocus="this.select()" oninput="markTimerConfigured()">
                        <span>:</span>
                        <input class="cronometro-time-input reloj-sec" id="timer-seconds" value="00" inputmode="numeric" maxlength="2" aria-label="Segundos" onfocus="this.select()" oninput="markTimerConfigured()">
                    </div>
                    <div class="reloj-date cronometro-date" id="crono-date-display"></div>
                    <div class="cronometro-end-time" id="crono-end-time"></div>
                </div>
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

document.addEventListener('DOMContentLoaded', initReloj);

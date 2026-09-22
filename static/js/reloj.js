let clockInterval = null;
let timerInterval = null;
let timerRunning = false;
let timerRemaining = 10 * 60;
let timerValues = { hours: 0, minutes: 10, seconds: 0 };
let timerEndAt = null;
let stopwatchInterval = null;
let stopwatchRunning = false;
let stopwatchCentiseconds = 0;
let stopwatchLaps = [];
let activeTimeMode = 'timer';
let isZenMode = false;
let isTimerFocusMode = false;
const TIMER_SEGMENTS = 60;

function renderTimerSegments(progress) {
    const activeSegments = Math.ceil(progress * TIMER_SEGMENTS);
    const center = 50;
    const innerRadius = 43;
    const outerRadius = 47;
    return `
        <svg class="timer-segments" viewBox="0 0 100 100" aria-hidden="true">
            ${Array.from({ length: TIMER_SEGMENTS }, (_, index) => {
                const angle = (index * 360 / TIMER_SEGMENTS - 90) * Math.PI / 180;
                const x1 = center + innerRadius * Math.cos(angle);
                const y1 = center + innerRadius * Math.sin(angle);
                const x2 = center + outerRadius * Math.cos(angle);
                const y2 = center + outerRadius * Math.sin(angle);
                return `<line class="timer-segment ${index < activeSegments ? 'active' : ''}" data-segment-index="${index}" x1="${x1.toFixed(3)}" y1="${y1.toFixed(3)}" x2="${x2.toFixed(3)}" y2="${y2.toFixed(3)}"></line>`;
            }).join('')}
        </svg>
    `;
}

function initReloj() {
    renderReloj();
    renderTimer();
    renderStopwatch();
    startClock();
}

function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(updateClock, 1000);
    updateClock();
}

function updateClock() {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    const timeEl = document.getElementById('reloj-time-display');
    if (timeEl) timeEl.innerHTML = `${h}:${m}<span class="reloj-sec">:${s}</span>`;

    const dateText = now.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const date = dateText.charAt(0).toUpperCase() + dateText.slice(1);
    const dateEl = document.getElementById('reloj-date-display');
    if (dateEl) dateEl.textContent = date;

    const cityTimes = [
        ['time-ny', 'America/New_York'],
        ['time-wroclaw', 'Europe/Warsaw'],
        ['time-tokyo', 'Asia/Tokyo']
    ];
    cityTimes.forEach(([id, timeZone]) => {
        const cityEl = document.getElementById(id);
        if (cityEl) {
            cityEl.textContent = now.toLocaleTimeString('es-ES', {
                timeZone,
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    });
}

function toggleZenMode() {
    isZenMode = !isZenMode;
    const wrapper = document.querySelector('#reloj-container .reloj-wrapper');
    if (wrapper) wrapper.classList.toggle('zen-mode', isZenMode);
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
            <div class="reloj-time clickeable-time" id="reloj-time-display" onclick="toggleZenMode()">00:00<span class="reloj-sec">:00</span></div>
            <div class="reloj-date hide-in-zen" id="reloj-date-display">Cargando fecha...</div>
            <div class="reloj-cities hide-in-zen">
                <div class="city-box"><div class="city-name">Nueva York</div><div class="city-time" id="time-ny">--:--</div></div>
                <div class="city-box"><div class="city-name">Wrocław</div><div class="city-time" id="time-wroclaw">--:--</div></div>
                <div class="city-box"><div class="city-name">Tokio</div><div class="city-time" id="time-tokyo">--:--</div></div>
            </div>
        </div>
    `;
}

function renderTimer() {
    const container = document.getElementById('timer-container');
    if (!container) return;
    if (timerRunning) {
        container.innerHTML = `
            <div class="tiempo-page timer-running-page ${isTimerFocusMode ? 'timer-focus-mode' : ''}">
                <div class="timer-progress-ring" style="--timer-progress: ${getTimerProgress()}">
                    ${renderTimerSegments(getTimerProgress())}
                    <div class="timer-progress-content">
                        <div class="timer-progress-label">Timer</div>
                        <div class="reloj-time timer-running-display clickeable-time" id="timer-running-display" onclick="toggleTimerFocusMode()" title="Alternar vista enfocada">00:00<span class="reloj-sec">:00</span></div>
                        <div class="timer-finish-time" id="timer-finish-time">${getTimerEndLabel()}</div>
                    </div>
                </div>
                <div class="tiempo-primary-actions timer-running-actions">
                    <button id="timer-main-btn" class="tiempo-main-btn" onclick="toggleTimer()">Pausar</button>
                    <button class="tiempo-reset-btn" onclick="resetTimer()" title="Reiniciar" aria-label="Reiniciar">
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.7"></path><path d="M4 4v5h5"></path></svg>
                    </button>
                </div>
            </div>
        `;
        updateTimerUI();
        return;
    }
    isTimerFocusMode = false;
    document.body.classList.remove('timer-focus-active');
    container.innerHTML = `
        <div class="tiempo-page">
            <div class="tiempo-wheel-picker" aria-label="Duración del timer">
                ${renderWheel('hours', 'Horas', 0, 99)}
                <span class="tiempo-wheel-colon">:</span>
                ${renderWheel('minutes', 'Minutos', 0, 59)}
                <span class="tiempo-wheel-colon">:</span>
                ${renderWheel('seconds', 'Segundos', 0, 59)}
            </div>
            <div class="tiempo-presets">
                <button data-seconds="300" class="${isTimerPresetSelected(5 * 60) ? 'selected' : ''}" onclick="setTimerPreset(5 * 60)">05:00</button>
                <button data-seconds="600" class="${isTimerPresetSelected(10 * 60) ? 'selected' : ''}" onclick="setTimerPreset(10 * 60)">10:00</button>
                <button data-seconds="900" class="${isTimerPresetSelected(15 * 60) ? 'selected' : ''}" onclick="setTimerPreset(15 * 60)">15:00</button>
                <button data-seconds="1800" class="${isTimerPresetSelected(30 * 60) ? 'selected' : ''}" onclick="setTimerPreset(30 * 60)">30:00</button>
            </div>
            <div class="tiempo-primary-actions">
                <button id="timer-main-btn" class="tiempo-main-btn" onclick="toggleTimer()">${timerRunning ? 'Pausar' : 'Iniciar'}</button>
                <button class="tiempo-reset-btn" onclick="resetTimer()" title="Reiniciar" aria-label="Reiniciar">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.7"></path><path d="M4 4v5h5"></path></svg>
                </button>
            </div>
            <div id="timer-end-label" class="tiempo-end-label"></div>
        </div>
    `;
    bindTimerWheelGestures();
    updateTimerUI();
}

function toggleTimerFocusMode() {
    isTimerFocusMode = !isTimerFocusMode;
    const page = document.querySelector('.timer-running-page');
    if (page) page.classList.toggle('timer-focus-mode', isTimerFocusMode);
    document.body.classList.toggle('timer-focus-active', isTimerFocusMode);
}

function renderStopwatch() {
    const container = document.getElementById('cronometro-container');
    if (!container) return;
    container.innerHTML = `
        <div class="tiempo-page">
            <div class="reloj-time tiempo-stopwatch-display" id="stopwatch-display">00:00<span class="reloj-sec">:00</span></div>
            <div class="tiempo-primary-actions">
                <button class="tiempo-secondary-btn" onclick="recordLap()" ${stopwatchRunning ? '' : 'disabled'}>Vuelta</button>
                <button id="stopwatch-main-btn" class="tiempo-main-btn" onclick="toggleStopwatch()">${stopwatchRunning ? 'Pausar' : 'Iniciar'}</button>
                <button class="tiempo-reset-btn" onclick="resetStopwatch()" title="Reiniciar" aria-label="Reiniciar">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.7"></path><path d="M4 4v5h5"></path></svg>
                </button>
            </div>
            <div id="stopwatch-laps" class="tiempo-laps"></div>
        </div>
    `;
    updateStopwatchUI();
}

function renderWheel(field, label, min, max) {
    const value = timerValues[field];
    const previous = value <= min ? max : value - 1;
    const next = value >= max ? min : value + 1;
    return `
        <div class="tiempo-wheel" data-field="${field}" onwheel="scrollTimerWheel(event, '${field}')">
            <div class="tiempo-wheel-label">${label}</div>
            <button class="tiempo-wheel-value muted" onclick="changeTimerValue('${field}', -1)">${formatUnit(previous)}</button>
            <button class="tiempo-wheel-value current" onclick="changeTimerValue('${field}', 0)">${formatUnit(value)}</button>
            <button class="tiempo-wheel-value muted" onclick="changeTimerValue('${field}', 1)">${formatUnit(next)}</button>
        </div>
    `;
}

function formatUnit(value) {
    return String(value).padStart(2, '0');
}

function isTimerPresetSelected(seconds) {
    return !timerRunning && getTimerSeconds() === seconds;
}

function scrollTimerWheel(event, field) {
    if (timerRunning) return;
    event.preventDefault();
    changeTimerValue(field, event.deltaY > 0 ? 1 : -1);
}

function bindTimerWheelGestures() {
    document.querySelectorAll('.tiempo-wheel').forEach(wheel => {
        let startY = null;
        let lastY = null;
        let dragged = false;
        let remainder = 0;

        wheel.addEventListener('pointerdown', event => {
            if (timerRunning) return;
            startY = lastY = event.clientY;
            dragged = false;
            remainder = 0;
            if (wheel.setPointerCapture) wheel.setPointerCapture(event.pointerId);
            wheel.classList.add('is-dragging');
        });

        wheel.addEventListener('pointermove', event => {
            if (timerRunning || lastY === null) return;
            const distance = lastY - event.clientY;
            lastY = event.clientY;
            remainder += distance;
            if (Math.abs(remainder) >= 22) {
                const steps = Math.trunc(remainder / 22);
                changeTimerValue(wheel.dataset.field, steps, false);
                remainder -= steps * 22;
                dragged = true;
            }
        });

        const finishDrag = event => {
            if (lastY === null) return;
            if (wheel.releasePointerCapture) wheel.releasePointerCapture(event.pointerId);
            startY = null;
            lastY = null;
            remainder = 0;
            wheel.classList.remove('is-dragging');
            if (dragged) {
                event.preventDefault();
                setTimeout(() => { dragged = false; }, 0);
            }
        };

        wheel.addEventListener('pointerup', finishDrag);
        wheel.addEventListener('pointercancel', finishDrag);
    });
}

function setTimeMode(mode) {
    if (timerRunning || stopwatchRunning) return;
    activeTimeMode = mode;
    renderTimer();
    renderStopwatch();
}

function changeTimerValue(field, delta, shouldRender = true) {
    if (timerRunning) return;
    const limits = { hours: [0, 99], minutes: [0, 59], seconds: [0, 59] };
    const [min, max] = limits[field];
    let value = timerValues[field] + delta;
    if (value < min) value = max;
    if (value > max) value = min;
    timerValues[field] = value;
    timerRemaining = getTimerSeconds();
    if (shouldRender) {
        renderTimer();
    } else {
        updateTimerWheelDisplay(field, min, max);
        updateTimerPresetButtons();
    }
}

function updateTimerWheelDisplay(field, min, max) {
    const wheel = document.querySelector(`.tiempo-wheel[data-field="${field}"]`);
    if (!wheel) return;
    const values = wheel.querySelectorAll('.tiempo-wheel-value');
    if (values.length < 3) return;
    const value = timerValues[field];
    const previous = value <= min ? max : value - 1;
    const next = value >= max ? min : value + 1;
    values[0].textContent = formatUnit(previous);
    values[1].textContent = formatUnit(value);
    values[2].textContent = formatUnit(next);
}

function updateTimerPresetButtons() {
    document.querySelectorAll('.tiempo-presets button').forEach(button => {
        const preset = Number(button.dataset.seconds);
        button.classList.toggle('selected', preset === getTimerSeconds());
    });
}

function setTimerPreset(seconds) {
    if (timerRunning) return;
    timerValues = {
        hours: Math.floor(seconds / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
        seconds: seconds % 60
    };
    timerRemaining = seconds;
    renderTimer();
}

function getTimerSeconds() {
    return timerValues.hours * 3600 + timerValues.minutes * 60 + timerValues.seconds;
}

function toggleTimer() {
    if (timerRunning) {
        clearInterval(timerInterval);
        timerRunning = false;
        timerEndAt = null;
        renderTimer();
    } else {
        if (timerRemaining <= 0) timerRemaining = getTimerSeconds();
        if (timerRemaining <= 0) return;
        timerRunning = true;
        timerEndAt = Date.now() + timerRemaining * 1000;
        renderTimer();
        timerInterval = setInterval(() => {
            timerRemaining -= 1;
            updateTimerUI();
            if (timerRemaining <= 0) {
                clearInterval(timerInterval);
                timerRunning = false;
                timerRemaining = 0;
                timerEndAt = null;
                renderTimer();
                if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
                mostrarAlertaWeb('El timer llegó a cero.', 'Tiempo cumplido');
                updateTimerUI();
            }
        }, 1000);
    }
    updateTimerUI();
}

function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    isTimerFocusMode = false;
    document.body.classList.remove('timer-focus-active');
    timerEndAt = null;
    timerValues = { hours: 0, minutes: 10, seconds: 0 };
    timerRemaining = 10 * 60;
    renderTimer();
}

function getTimerProgress() {
    const total = Math.max(1, getTimerSeconds());
    return Math.max(0, Math.min(1, timerRemaining / total));
}

function getTimerEndLabel() {
    return `Termina a las ${new Date(timerEndAt || Date.now() + timerRemaining * 1000).toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit'
    })}`;
}

function updateTimerUI() {
    const runningDisplay = document.getElementById('timer-running-display');
    if (runningDisplay) {
        const hours = Math.floor(timerRemaining / 3600);
        const minutes = Math.floor((timerRemaining % 3600) / 60);
        const seconds = timerRemaining % 60;
        runningDisplay.innerHTML = `${formatUnit(hours)}:${formatUnit(minutes)}<span class="reloj-sec">:${formatUnit(seconds)}</span>`;
        const ring = document.querySelector('.timer-progress-ring');
        if (ring) ring.style.setProperty('--timer-progress', getTimerProgress());
        const activeSegments = Math.ceil(getTimerProgress() * TIMER_SEGMENTS);
        document.querySelectorAll('.timer-segment').forEach((segment, index) => {
            segment.classList.toggle('active', index < activeSegments);
        });
        const finish = document.getElementById('timer-finish-time');
        if (finish) finish.textContent = getTimerEndLabel();
    }
    const parts = {
        hours: Math.floor(timerRemaining / 3600),
        minutes: Math.floor((timerRemaining % 3600) / 60),
        seconds: timerRemaining % 60
    };
    document.querySelectorAll('.tiempo-wheel').forEach(wheel => {
        const field = wheel.dataset.field;
        if (!field) return;
        const current = wheel.querySelector('.tiempo-wheel-value.current');
        const values = wheel.querySelectorAll('.tiempo-wheel-value');
        if (!current || values.length < 3) return;
        const limits = { hours: [0, 99], minutes: [0, 59], seconds: [0, 59] };
        const [min, max] = limits[field];
        const value = parts[field];
        const previous = value <= min ? max : value - 1;
        const next = value >= max ? min : value + 1;
        values[0].textContent = formatUnit(previous);
        current.textContent = formatUnit(value);
        values[2].textContent = formatUnit(next);
    });
    const button = document.getElementById('timer-main-btn');
    if (button) button.textContent = timerRunning ? 'Pausar' : 'Iniciar';
    const endLabel = document.getElementById('timer-end-label');
    if (endLabel) {
        endLabel.textContent = timerRunning
            ? getTimerEndLabel()
            : '';
    }
}

function toggleStopwatch() {
    if (stopwatchRunning) {
        clearInterval(stopwatchInterval);
        stopwatchRunning = false;
    } else {
        stopwatchRunning = true;
        stopwatchInterval = setInterval(() => {
            stopwatchCentiseconds += 1;
            updateStopwatchUI();
        }, 10);
    }
    updateStopwatchUI();
}

function resetStopwatch() {
    clearInterval(stopwatchInterval);
    stopwatchRunning = false;
    stopwatchCentiseconds = 0;
    stopwatchLaps = [];
    updateStopwatchUI();
}

function recordLap() {
    if (!stopwatchRunning) return;
    stopwatchLaps.unshift(formatStopwatch(stopwatchCentiseconds));
    updateStopwatchUI();
}

function formatStopwatch(totalCentiseconds) {
    const seconds = Math.floor(totalCentiseconds / 100);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${formatUnit(hours)}:${formatUnit(minutes % 60)}.${formatUnit(seconds % 60)}`;
}

function updateStopwatchUI() {
    const display = document.getElementById('stopwatch-display');
    if (display) {
        const seconds = Math.floor(stopwatchCentiseconds / 100);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        display.innerHTML = `${formatUnit(hours)}:${formatUnit(minutes % 60)}<span class="reloj-sec">:${formatUnit(seconds % 60)}</span>`;
    }
    const button = document.getElementById('stopwatch-main-btn');
    if (button) button.textContent = stopwatchRunning ? 'Pausar' : 'Iniciar';
    const lapButton = document.querySelector('#cronometro-container .tiempo-secondary-btn');
    if (lapButton) lapButton.disabled = !stopwatchRunning;
    const laps = document.getElementById('stopwatch-laps');
    if (laps) laps.innerHTML = stopwatchLaps.map((lap, index) => `<div><span>Vuelta ${stopwatchLaps.length - index}</span><strong>${lap}</strong></div>`).join('');
}

document.addEventListener('DOMContentLoaded', initReloj);

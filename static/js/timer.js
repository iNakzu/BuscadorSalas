let timerInterval = null;
let timerRunning = false;
let timerRemaining = 60 * 60;
let timerValues = { hours: 1, minutes: 0, seconds: 0 };
let timerEndAt = null;
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
                <div class="tiempo-primary-actions timer-running-actions" style="gap:20px;">
                    <button id="timer-main-btn" class="estudio-btn-glossy btn-pause" onclick="toggleTimer()" title="Pausar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    </button>
                    <button class="estudio-btn-glossy btn-reset" onclick="resetTimer()" title="Reiniciar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
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
            <div class="tiempo-primary-actions" style="gap:20px;">
                <button id="timer-main-btn" class="estudio-btn-glossy ${timerRunning ? 'btn-pause' : 'btn-start'}" onclick="toggleTimer()" title="${timerRunning ? 'Pausar' : 'Iniciar'}">
                    ${timerRunning ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>` : `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-left:2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`}
                </button>
                <button class="estudio-btn-glossy btn-reset" onclick="resetTimer()" title="Reiniciar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
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
    if (button) {
        button.innerHTML = timerRunning 
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>` 
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-left:2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        button.className = timerRunning ? 'estudio-btn-glossy btn-pause' : 'estudio-btn-glossy btn-start';
        button.title = timerRunning ? 'Pausar' : 'Iniciar';
    }
    const endLabel = document.getElementById('timer-end-label');
    if (endLabel) {
        endLabel.textContent = timerRunning
            ? getTimerEndLabel()
            : '';
    }
}

document.addEventListener('DOMContentLoaded', renderTimer);

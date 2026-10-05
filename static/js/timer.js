let timerInterval = null;
let timerRunning = false;
let timerPaused = false;
let timerValues = { hours: 1, minutes: 0, seconds: 0 };
let timerTargetTime = getDefaultTimerTime();
let timerClockDraftTime = timerTargetTime;
let timerEndAt = null;
let timerSelectedEndAt = getTimerTargetDate(timerTargetTime);
let timerPickerOpen = false;
let timerClockMode = 'hour';
let timerClockGestureMode = null;
let timerClockSuppressClick = false;
let timerRemaining = getSecondsUntilTimerTarget(timerTargetTime);
let timerTotalSeconds = timerRemaining;
let isTimerFocusMode = false;
const TIMER_SEGMENTS = 60;

function formatTimeInput(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getDefaultTimerTime(now = new Date()) {
    const target = new Date(now.getTime() + 60 * 60 * 1000);
    target.setSeconds(0, 0);
    return formatTimeInput(target);
}

function getTimerTargetDate(value, now = new Date()) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;

    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    return target;
}

function getSecondsUntilTimerTarget(value, now = new Date()) {
    const target = getTimerTargetDate(value, now);
    return target ? Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 1000)) : 0;
}

function formatClockTime(date) {
    return date.toLocaleTimeString('es-CL', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function formatTimeChoice(value) {
    const [rawHours, rawMinutes] = String(value || '00:00').split(':').map(Number);
    const period = rawHours >= 12 ? 'PM' : 'AM';
    const hours = rawHours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${String(rawMinutes).padStart(2, '0')} ${period}`;
}

function getCalendarDayOffset(date, now = new Date()) {
    const targetDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const currentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((targetDay - currentDay) / 86400000);
}

function getTimerEndLabel(date = null) {
    const endDate = date || (timerEndAt ? new Date(timerEndAt) : getTimerTargetDate(timerTargetTime));
    if (!endDate) return 'Elige una hora de término';
    const dayOffset = getCalendarDayOffset(endDate);
    const dayLabel = dayOffset === 1 ? 'Mañana · ' : dayOffset > 1 ? `En ${dayOffset} días · ` : '';
    return `${dayLabel}Termina a las ${formatClockTime(endDate)}`;
}

function formatTimerDuration(seconds) {
    const totalMinutes = Math.max(1, Math.ceil(seconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours && minutes) return `En ${hours} h ${minutes} min`;
    if (hours) return `En ${hours} h`;
    return `En ${minutes} min`;
}

function getTimerPreview() {
    const endDate = timerPaused ? new Date(Date.now() + timerRemaining * 1000) : timerSelectedEndAt;
    if (!endDate) return '';
    const seconds = timerPaused
        ? timerRemaining
        : Math.max(1, Math.ceil((endDate.getTime() - Date.now()) / 1000));
    return formatTimerDuration(seconds);
}

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
                        <div class="timer-finish-time" id="timer-finish-time">${getTimerEndLabel(new Date(timerEndAt))}</div>
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
    const preview = getTimerPreview();
    container.innerHTML = `
        <div class="tiempo-page timer-setup-page">
            <div class="tiempo-wheel-picker" aria-label="Duración del timer">
                ${renderWheel('hours', 'Horas', 0, 99)}
                <span class="tiempo-wheel-colon">:</span>
                ${renderWheel('minutes', 'Minutos', 0, 59)}
                <span class="tiempo-wheel-colon">:</span>
                ${renderWheel('seconds', 'Segundos', 0, 59)}
            </div>
            <div class="timer-target-card">
                <div class="timer-target-eyebrow">HORA DE TÉRMINO</div>
                <div class="timer-end-selector">
                    <button id="timer-time-trigger" class="timer-time-trigger" type="button" aria-haspopup="dialog" aria-expanded="${timerPickerOpen}" onclick="toggleTimerTimePicker()">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                        <span id="timer-time-display">${formatTimeChoice(timerTargetTime)}</span>
                        <svg class="timer-time-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
                    </button>
                    <div id="timer-time-picker" class="timer-time-picker" role="dialog" aria-label="Elige la hora de término" ${timerPickerOpen ? '' : 'hidden'} onkeydown="if(event.key === 'Escape') toggleTimerTimePicker(false)">
                        ${getTimerClockPickerMarkup()}
                    </div>
                </div>
                <div id="timer-end-duration" class="timer-target-duration">${preview}</div>
            </div>
            <div class="tiempo-primary-actions" style="gap:20px;">
                <button id="timer-main-btn" class="estudio-btn-glossy btn-start" onclick="toggleTimer()" title="Iniciar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-left:2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </button>
                <button class="estudio-btn-glossy btn-reset" onclick="resetTimer()" title="Reiniciar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                </button>
            </div>
        </div>
    `;
    bindTimerWheelGestures();
    updateTimerUI();
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

function getTimerSeconds() {
    return timerValues.hours * 3600 + timerValues.minutes * 60 + timerValues.seconds;
}

function setTimerValuesFromSeconds(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    timerValues = {
        hours: Math.min(99, Math.floor(total / 3600)),
        minutes: Math.floor((total % 3600) / 60),
        seconds: total % 60
    };
}

function scrollTimerWheel(event, field) {
    if (timerRunning) return;
    event.preventDefault();
    changeTimerValue(field, event.deltaY > 0 ? 1 : -1);
}

function bindTimerWheelGestures() {
    document.querySelectorAll('.tiempo-wheel').forEach(wheel => {
        let lastY = null;
        let dragged = false;
        let remainder = 0;
        wheel.addEventListener('pointerdown', event => {
            if (timerRunning) return;
            lastY = event.clientY;
            dragged = false;
            remainder = 0;
            if (wheel.setPointerCapture) wheel.setPointerCapture(event.pointerId);
            wheel.classList.add('is-dragging');
        });
        wheel.addEventListener('pointermove', event => {
            if (timerRunning || lastY === null) return;
            remainder += lastY - event.clientY;
            lastY = event.clientY;
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
    timerTotalSeconds = timerRemaining;
    timerPaused = false;
    timerSelectedEndAt = timerRemaining > 0 ? new Date(Date.now() + timerRemaining * 1000) : null;
    timerTargetTime = timerSelectedEndAt ? formatTimeInput(timerSelectedEndAt) : formatTimeInput(new Date());
    timerClockDraftTime = timerTargetTime;
    if (shouldRender) renderTimer();
    else updateTimerUI();
}

function updateTimerWheelDisplay(field, min, max) {
    const wheel = document.querySelector(`.tiempo-wheel[data-field="${field}"]`);
    if (!wheel) return;
    const values = wheel.querySelectorAll('.tiempo-wheel-value');
    if (values.length < 3) return;
    const value = timerValues[field];
    values[0].textContent = formatUnit(value <= min ? max : value - 1);
    values[1].textContent = formatUnit(value);
    values[2].textContent = formatUnit(value >= max ? min : value + 1);
}

function toggleTimerFocusMode() {
    isTimerFocusMode = !isTimerFocusMode;
    const page = document.querySelector('.timer-running-page');
    if (page) page.classList.toggle('timer-focus-mode', isTimerFocusMode);
    document.body.classList.toggle('timer-focus-active', isTimerFocusMode);
}

function setTimerTargetTime(value) {
    if (timerRunning || !getTimerTargetDate(value)) return;
    timerTargetTime = value;
    timerClockDraftTime = value;
    timerPaused = false;
    timerSelectedEndAt = getTimerTargetDate(timerTargetTime);
    timerRemaining = getSecondsUntilTimerTarget(timerTargetTime);
    timerTotalSeconds = timerRemaining;
    setTimerValuesFromSeconds(timerRemaining);
    updateTimerUI();
}

function toggleTimerTimePicker(force = null) {
    const wasOpen = timerPickerOpen;
    timerPickerOpen = force === null ? !timerPickerOpen : Boolean(force);
    if (timerPickerOpen && !wasOpen) {
        timerClockDraftTime = timerTargetTime;
        timerClockMode = 'hour';
    } else if (!timerPickerOpen) {
        timerClockDraftTime = timerTargetTime;
    }
    const picker = document.getElementById('timer-time-picker');
    const trigger = document.getElementById('timer-time-trigger');
    if (picker) picker.hidden = !timerPickerOpen;
    if (trigger) trigger.setAttribute('aria-expanded', String(timerPickerOpen));
    if (timerPickerOpen) renderTimerClockPicker();
}

function getClockSelectionFromAngle(degrees, mode) {
    const normalized = ((degrees % 360) + 360) % 360;
    if (mode === 'hour') return (Math.round(normalized / 30) % 12) || 12;
    return Math.round(normalized / 6) % 60;
}

function getClockHandPosition(mode) {
    const [hours, minutes] = timerClockDraftTime.split(':').map(Number);
    const value = mode === 'hour' ? hours % 12 : minutes;
    const angle = value * (mode === 'hour' ? 30 : 6) * Math.PI / 180;
    const radius = 96;
    return { x: 130 + Math.sin(angle) * radius, y: 130 - Math.cos(angle) * radius };
}

function renderTimerClockPicker() {
    const picker = document.getElementById('timer-time-picker');
    if (!picker) return;
    picker.innerHTML = getTimerClockPickerMarkup();
}

function getTimerClockPickerMarkup() {
    const [hours, minutes] = timerClockDraftTime.split(':').map(Number);
    const hour12 = hours % 12 || 12;
    const isPm = hours >= 12;
    const selectedHour = timerClockMode === 'hour' ? hour12 : null;
    const selectedMinute = timerClockMode === 'minute' ? minutes : null;
    const labels = timerClockMode === 'hour'
        ? Array.from({ length: 12 }, (_, index) => index + 1)
        : Array.from({ length: 12 }, (_, index) => index * 5);
    const selectedValue = timerClockMode === 'hour' ? selectedHour : selectedMinute;
    const radius = 96;
    const labelButtons = labels.map(value => {
        const angle = (value * (timerClockMode === 'hour' ? 30 : 6)) * Math.PI / 180;
        const x = 50 + Math.sin(angle) * radius / 260 * 100;
        const y = 50 - Math.cos(angle) * radius / 260 * 100;
        const label = timerClockMode === 'hour' ? String(value) : String(value).padStart(2, '0');
        return `<button type="button" class="timer-clock-number ${value === selectedValue ? 'selected' : ''}" data-value="${value}" style="--clock-x:${x}%;--clock-y:${y}%" aria-pressed="${value === selectedValue}" onclick="event.stopPropagation();chooseTimerClockValue('${timerClockMode}', ${value})" onpointerdown="event.stopPropagation()">${label}</button>`;
    }).join('');
    const ticks = Array.from({ length: timerClockMode === 'hour' ? 12 : 60 }, (_, index) => {
        const divisions = timerClockMode === 'hour' ? 12 : 60;
        const angle = index * 360 / divisions * Math.PI / 180;
        const major = timerClockMode === 'hour' || index % 5 === 0;
        const outer = 119;
        const inner = major ? 110 : 114;
        return `<line class="timer-clock-tick ${major ? 'major' : ''}" x1="${(130 + Math.sin(angle) * inner).toFixed(2)}" y1="${(130 - Math.cos(angle) * inner).toFixed(2)}" x2="${(130 + Math.sin(angle) * outer).toFixed(2)}" y2="${(130 - Math.cos(angle) * outer).toFixed(2)}"/>`;
    }).join('');
    const hand = getClockHandPosition(timerClockMode);
    return `
        <div class="timer-clock-heading">
            <div class="timer-clock-readout" aria-label="Hora seleccionada">
                <button id="timer-clock-hour" class="${timerClockMode === 'hour' ? 'active' : ''}" type="button" onclick="setTimerClockMode('hour')">${String(hour12).padStart(2, '0')}</button>
                <span>:</span>
                <button id="timer-clock-minute" class="${timerClockMode === 'minute' ? 'active' : ''}" type="button" onclick="setTimerClockMode('minute')">${String(minutes).padStart(2, '0')}</button>
            </div>
            <div class="timer-time-period" role="group" aria-label="Antes o después del mediodía">
                <button id="timer-period-am" class="${isPm ? '' : 'selected'}" type="button" onclick="setTimerPeriod('AM')">AM</button>
                <button id="timer-period-pm" class="${isPm ? 'selected' : ''}" type="button" onclick="setTimerPeriod('PM')">PM</button>
            </div>
        </div>
        <div class="timer-clock-instruction">${timerClockMode === 'hour' ? 'Selecciona una hora' : 'Selecciona los minutos'}</div>
        <div class="timer-clock-face" role="group" tabindex="0" aria-label="Esfera del reloj. Toca para seleccionar ${timerClockMode === 'hour' ? 'la hora' : 'los minutos'}" onkeydown="handleTimerClockKey(event)" onpointerdown="beginTimerClockGesture(event)" onpointermove="moveTimerClockGesture(event)" onpointerup="endTimerClockGesture(event)" onpointercancel="endTimerClockGesture(event)" onclick="selectTimerClockFace(event)">
            <svg class="timer-clock-svg" viewBox="0 0 260 260" aria-hidden="true">
                <circle class="timer-clock-dial" cx="130" cy="130" r="122"/>
                ${ticks}
                <line id="timer-clock-hand" class="timer-clock-hand" x1="130" y1="130" x2="${hand.x.toFixed(2)}" y2="${hand.y.toFixed(2)}"/>
                <circle id="timer-clock-selection" class="timer-clock-selection" cx="${hand.x.toFixed(2)}" cy="${hand.y.toFixed(2)}" r="17"/>
                <circle class="timer-clock-center" cx="130" cy="130" r="5"/>
            </svg>
            ${labelButtons}
        </div>
        <button class="timer-time-done" type="button" onclick="confirmTimerClockTime()">Listo</button>
    `;
}

function setTimerClockMode(mode) {
    if (!['hour', 'minute'].includes(mode)) return;
    timerClockMode = mode;
    renderTimerClockPicker();
}

function handleTimerClockKey(event) {
    const directions = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
    if (!directions[event.key]) return;
    event.preventDefault();
    const [hours, minutes] = timerClockDraftTime.split(':').map(Number);
    const current = timerClockMode === 'hour' ? (hours % 12 || 12) : minutes;
    const next = timerClockMode === 'hour'
        ? ((current - 1 + directions[event.key] + 12) % 12) + 1
        : (current + directions[event.key] + 60) % 60;
    applyTimerClockValue(timerClockMode, next);
}

function applyTimerClockValue(mode, value) {
    const [hours, minutes] = timerClockDraftTime.split(':').map(Number);
    if (mode === 'hour') {
        const hour12 = Number(value) % 12;
        const nextHours = hour12 + (hours >= 12 ? 12 : 0);
        timerClockDraftTime = `${String(nextHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } else {
        timerClockDraftTime = `${String(hours).padStart(2, '0')}:${String(Number(value)).padStart(2, '0')}`;
    }
    refreshTimerClockPickerUI();
}

function chooseTimerClockValue(mode, value) {
    applyTimerClockValue(mode, value);
    if (mode === 'hour') timerClockMode = 'minute';
    renderTimerClockPicker();
}

function getTimerClockModeValueAtPoint(event, mode) {
    const face = event.currentTarget.closest('.timer-clock-face');
    if (!face) return null;
    const rect = face.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    return getClockSelectionFromAngle(Math.atan2(dx, -dy) * 180 / Math.PI, mode);
}

function beginTimerClockGesture(event) {
    timerClockGestureMode = timerClockMode;
    timerClockSuppressClick = false;
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
    const value = getTimerClockModeValueAtPoint(event, timerClockGestureMode);
    if (value !== null) applyTimerClockValue(timerClockGestureMode, value);
    event.preventDefault();
}

function moveTimerClockGesture(event) {
    if (!timerClockGestureMode) return;
    const value = getTimerClockModeValueAtPoint(event, timerClockGestureMode);
    if (value !== null) applyTimerClockValue(timerClockGestureMode, value);
    timerClockSuppressClick = true;
}

function endTimerClockGesture(event) {
    if (!timerClockGestureMode) return;
    if (event.currentTarget.hasPointerCapture && event.currentTarget.hasPointerCapture(event.pointerId)
        && event.currentTarget.releasePointerCapture) event.currentTarget.releasePointerCapture(event.pointerId);
    if (timerClockGestureMode === 'hour') timerClockMode = 'minute';
    timerClockGestureMode = null;
    timerClockSuppressClick = true;
    setTimeout(() => { timerClockSuppressClick = false; }, 0);
    renderTimerClockPicker();
}

function selectTimerClockFace(event) {
    if (timerClockSuppressClick) return;
    const mode = timerClockMode;
    const value = getTimerClockModeValueAtPoint(event, mode);
    if (value !== null) chooseTimerClockValue(mode, value);
}

function setTimerPeriod(period) {
    if (timerRunning || !['AM', 'PM'].includes(period)) return;
    const [hours, minutes] = timerClockDraftTime.split(':').map(Number);
    const isPm = hours >= 12;
    if ((period === 'PM') === isPm) return;
    timerClockDraftTime = `${String((hours + 12) % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    refreshTimerClockPickerUI();
}

function confirmTimerClockTime() {
    const selectedTime = timerClockDraftTime;
    setTimerTargetTime(selectedTime);
    toggleTimerTimePicker(false);
}

function toggleTimer() {
    if (timerRunning) {
        timerRemaining = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
        timerTargetTime = formatTimeInput(new Date(Date.now() + timerRemaining * 1000));
        timerSelectedEndAt = new Date(Date.now() + timerRemaining * 1000);
        setTimerValuesFromSeconds(timerRemaining);
        clearInterval(timerInterval);
        timerRunning = false;
        timerPaused = timerRemaining > 0;
        timerEndAt = null;
        renderTimer();
        return;
    }

    let targetDate;
    if (timerPaused && timerRemaining > 0) {
        targetDate = new Date(Date.now() + timerRemaining * 1000);
        timerTargetTime = formatTimeInput(targetDate);
    } else {
        targetDate = timerSelectedEndAt;
        if (!targetDate || targetDate.getTime() <= Date.now()) return;
        timerRemaining = Math.max(1, Math.ceil((targetDate.getTime() - Date.now()) / 1000));
        timerTotalSeconds = timerRemaining;
    }

    timerPaused = false;
    timerPickerOpen = false;
    timerEndAt = targetDate.getTime();
    timerRunning = true;
    renderTimer();
    timerInterval = setInterval(() => {
        timerRemaining = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
        updateTimerUI();
        if (timerRemaining <= 0) {
            clearInterval(timerInterval);
            timerRunning = false;
            timerPaused = false;
            timerEndAt = null;
            timerTargetTime = getDefaultTimerTime();
            timerClockDraftTime = timerTargetTime;
            timerRemaining = getSecondsUntilTimerTarget(timerTargetTime);
            timerTotalSeconds = timerRemaining;
            timerSelectedEndAt = getTimerTargetDate(timerTargetTime);
            setTimerValuesFromSeconds(timerRemaining);
            renderTimer();
            if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
        }
    }, 1000);
}

function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    timerPaused = false;
    timerPickerOpen = false;
    isTimerFocusMode = false;
    document.body.classList.remove('timer-focus-active');
    timerEndAt = null;
    timerTargetTime = getDefaultTimerTime();
    timerClockDraftTime = timerTargetTime;
    timerRemaining = getSecondsUntilTimerTarget(timerTargetTime);
    timerTotalSeconds = timerRemaining;
    timerSelectedEndAt = getTimerTargetDate(timerTargetTime);
    setTimerValuesFromSeconds(timerRemaining);
    renderTimer();
}

function getTimerProgress() {
    return Math.max(0, Math.min(1, timerRemaining / Math.max(1, timerTotalSeconds)));
}

function updateTimerUI() {
    const runningDisplay = document.getElementById('timer-running-display');
    if (runningDisplay && timerRunning) {
        const hours = Math.floor(timerRemaining / 3600);
        const minutes = Math.floor((timerRemaining % 3600) / 60);
        const seconds = timerRemaining % 60;
        runningDisplay.innerHTML = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}<span class="reloj-sec">:${String(seconds).padStart(2, '0')}</span>`;
        const ring = document.querySelector('.timer-progress-ring');
        if (ring) ring.style.setProperty('--timer-progress', getTimerProgress());
        const activeSegments = Math.ceil(getTimerProgress() * TIMER_SEGMENTS);
        document.querySelectorAll('.timer-segment').forEach((segment, index) => {
            segment.classList.toggle('active', index < activeSegments);
        });
        const finish = document.getElementById('timer-finish-time');
        if (finish) finish.textContent = getTimerEndLabel(new Date(timerEndAt));
    }

    const duration = document.getElementById('timer-end-duration');
    if (duration && !timerRunning) duration.textContent = getTimerPreview();

    const timeDisplay = document.getElementById('timer-time-display');
    if (timeDisplay) timeDisplay.textContent = formatTimeChoice(timerTargetTime);
    refreshTimerClockPickerUI();
    const wheelParts = {
        hours: Math.floor(timerRemaining / 3600),
        minutes: Math.floor((timerRemaining % 3600) / 60),
        seconds: timerRemaining % 60
    };
    document.querySelectorAll('.tiempo-wheel').forEach(wheel => {
        const field = wheel.dataset.field;
        const limits = { hours: [0, 99], minutes: [0, 59], seconds: [0, 59] };
        if (field && limits[field]) {
            timerValues[field] = wheelParts[field];
            updateTimerWheelDisplay(field, ...limits[field]);
        }
    });

    const button = document.getElementById('timer-main-btn');
    if (button) {
        button.innerHTML = timerRunning
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-left:2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        button.className = timerRunning ? 'estudio-btn-glossy btn-pause' : 'estudio-btn-glossy btn-start';
        button.title = timerRunning ? 'Pausar' : 'Iniciar';
    }
}

function refreshTimerClockPickerUI() {
    if (!timerPickerOpen) return;
    const [targetHours, targetMinutes] = timerClockDraftTime.split(':').map(Number);
    const targetPeriod = targetHours >= 12 ? 'PM' : 'AM';
    const pickerHour = document.getElementById('timer-clock-hour');
    const pickerMinute = document.getElementById('timer-clock-minute');
    if (pickerHour) {
        pickerHour.textContent = String(targetHours % 12 || 12).padStart(2, '0');
        pickerHour.classList.toggle('active', timerClockMode === 'hour');
    }
    if (pickerMinute) {
        pickerMinute.textContent = String(targetMinutes).padStart(2, '0');
        pickerMinute.classList.toggle('active', timerClockMode === 'minute');
    }
    const periodAm = document.getElementById('timer-period-am');
    const periodPm = document.getElementById('timer-period-pm');
    if (periodAm) periodAm.classList.toggle('selected', targetPeriod === 'AM');
    if (periodPm) periodPm.classList.toggle('selected', targetPeriod === 'PM');
    const hand = getClockHandPosition(timerClockMode);
    const clockHand = document.getElementById('timer-clock-hand');
    const clockSelection = document.getElementById('timer-clock-selection');
    if (clockHand) {
        clockHand.setAttribute('x2', hand.x.toFixed(2));
        clockHand.setAttribute('y2', hand.y.toFixed(2));
    }
    if (clockSelection) {
        clockSelection.setAttribute('cx', hand.x.toFixed(2));
        clockSelection.setAttribute('cy', hand.y.toFixed(2));
    }
    document.querySelectorAll('.timer-clock-number').forEach(number => {
        const value = Number(number.dataset.value);
        const selected = timerClockMode === 'hour'
            ? value === (targetHours % 12 || 12)
            : value === targetMinutes;
        number.classList.toggle('selected', selected);
        number.setAttribute('aria-pressed', String(selected));
    });
}

document.addEventListener('DOMContentLoaded', renderTimer);

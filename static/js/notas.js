let NOTAS_DATA = {}; 
let PUBLIC_NOTAS_PROFILE_ID = '';
let PUBLIC_NOTAS_COURSES = [];
let PUBLIC_NOTAS_PAYLOAD = {};

function notasJsArg(value) {
    return escapeHtml(JSON.stringify(String(value == null ? '' : value)));
}

function normalizarNota(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const parsed = Number(String(value).trim().replace(',', '.'));
    if (!Number.isFinite(parsed)) return null;
    return Math.min(7, Math.max(1, parsed));
}


function initNotas() {
    try {
        const stored = localStorage.getItem('mi_notas_v1');
        if (stored) {
            const parsed = JSON.parse(stored);
            for (const k of Object.keys(parsed)) {
                if (!k.includes('|')) {
                    NOTAS_DATA['me|' + k] = parsed[k];
                } else {
                    NOTAS_DATA[k] = parsed[k];
                }
            }
        }
        NOTAS_DATA = limpiarRedundanciaNotas(NOTAS_DATA);
        localStorage.setItem('mi_notas_v1', JSON.stringify(NOTAS_DATA));

    } catch(e) { console.error(e); }
}

function saveNotas() {
    try {
        NOTAS_DATA = limpiarRedundanciaNotas(NOTAS_DATA);
        localStorage.setItem('mi_notas_v1', JSON.stringify(NOTAS_DATA));
        if (window.PortalStore) window.PortalStore.save('grades', NOTAS_DATA);
    } catch(e) { console.error(e); }
}

function limpiarRedundanciaNotas(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
    Object.values(payload).forEach(course => {
        if (!course || typeof course !== 'object' || Array.isArray(course)) return;
        delete course.eximGrade;
        if (Array.isArray(course.items)) {
            course.items.forEach(item => {
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                    delete item.id;
                    item.grade = normalizarNota(item.grade);
                }
            });
        }
        course.examGrade = normalizarNota(course.examGrade);
    });
    return payload;
}

function notasEmptySelectionHtml() {
    return '<div style="text-align: center; color: #64748b; padding: 40px; font-size: 14px;">Selecciona una asignatura arriba para configurar o ver tus notas.</div>';
}

function emptyPublicNotasData() {
    return {
        items: [
            { name: 'Solemne 1', weight: 30, grade: null },
            { name: 'Solemne 2', weight: 30, grade: null },
            { name: 'Controles', weight: 25, grade: null },
            { name: 'Tareas', weight: 15, grade: null }
        ],
        examGrade: null,
        examWeight: 30
    };
}

function assistantCourseSet(classes) {
    return new Set((Array.isArray(classes) ? classes : [])
        .filter(item => item && item.rol === 'assistant')
        .map(item => normStr(item.curso))
        .filter(Boolean));
}

function updateNotasDropdown() {
    const select = document.getElementById('notas-curso-select');
    if (!select) return;

    const sharedProfile = window.PortalCommunity && typeof window.PortalCommunity.getSelected === 'function'
        ? window.PortalCommunity.getSelected() : null;
    if (sharedProfile) {
        if (window.PortalCommunity.isAdmin && window.PortalCommunity.isAdmin()) return;
        const content = document.querySelector('#tab-notas .public-profile-content[data-module="grades"]');
        window.renderNotasPublicas(content, sharedProfile.modules && sharedProfile.modules.grades);
        return;
    }
    PUBLIC_NOTAS_PROFILE_ID = '';
    
    const userKey = 'me';
    const scheduleObj = typeof MI_HORARIO_DATA !== 'undefined' ? MI_HORARIO_DATA : null;
    const assistantCourses = assistantCourseSet(scheduleObj && scheduleObj.clases);
    
    let myRamos = [];
    if (scheduleObj && scheduleObj.clases) {
        const validClasses = scheduleObj.clases.filter(c => c.rol !== 'assistant' && !assistantCourses.has(normStr(c.curso)));
        myRamos = [...new Set(validClasses.map(c => normStr(c.curso)))].filter(Boolean).sort();
    }
    
    const currVal = select.value;
    let htmlMenu = `<div class="dropdown-item ${!currVal ? 'active' : ''}" data-val="" onclick="selectDropdownItem('dd-notas-curso', '', 'Selecciona una asignatura...', renderNotasBuilder)">Selecciona una asignatura...</div>`;
    let labelText = 'Selecciona una asignatura...';
    let isCurrValValid = false;

    myRamos.forEach(r => {
        const foundCourse = scheduleObj.clases.find(c => normStr(c.curso) === r);
        const originalCourse = foundCourse ? foundCourse.curso : r;
        const isActive = (currVal === originalCourse);
        if (isActive) { labelText = originalCourse; isCurrValValid = true; }
        htmlMenu += `<div class="dropdown-item ${isActive ? 'active' : ''}" data-val="${escapeHtml(originalCourse)}" onclick="selectDropdownItem('dd-notas-curso', ${notasJsArg(originalCourse)}, ${notasJsArg(originalCourse)}, renderNotasBuilder)">${escapeHtml(originalCourse)}</div>`;
    });
    
    for (const key of Object.keys(NOTAS_DATA)) {
        if (key.startsWith(userKey + '|')) {
            const r = key.split('|')[1];
            
            if (assistantCourses.has(normStr(r))) continue;

            if (!myRamos.includes(normStr(r))) {
                const data = NOTAS_DATA[key];
                let hasGrades = false;
                if (data && data.items) {
                    hasGrades = data.items.some(item => item.grade !== null && item.grade !== '');
                }
                if (data.examGrade) hasGrades = true;
                
                if (hasGrades) {
                    const isActive = (currVal === r);
                    if (isActive) { labelText = `${r} (Fuera de horario)`; isCurrValValid = true; }
                    htmlMenu += `<div class="dropdown-item ${isActive ? 'active' : ''}" data-val="${escapeHtml(r)}" onclick="selectDropdownItem('dd-notas-curso', ${notasJsArg(r)}, ${notasJsArg(`${r} (Fuera de horario)`)}, renderNotasBuilder)">${escapeHtml(r)} (Fuera de horario)</div>`;
                } else {
                    delete NOTAS_DATA[key];
                    saveNotas();
                }
            }
        }
    }
    
    const menuEl = document.querySelector('#dd-notas-curso .dropdown-menu');
    if (menuEl) menuEl.innerHTML = htmlMenu;
    
    const labelEl = document.getElementById('label-notas-curso');
    
    if (isCurrValValid) {
        select.value = currVal;
        if (labelEl) labelEl.textContent = labelText;
    } else {
        select.value = '';
        if (labelEl) labelEl.textContent = 'Selecciona una asignatura...';
        
        // Remove active class from all except empty
        if (menuEl) {
            menuEl.querySelectorAll('.dropdown-item').forEach(item => {
                item.classList.toggle('active', item.dataset.val === '');
            });
        }
    }
    
    renderNotasBuilder();
}

function renderNotasBuilder(options = {}) {
    const readOnly = Boolean(options.readOnly);
    const select = readOnly ? { value: options.course || '' } : document.getElementById('notas-curso-select');
    const container = options.container || (readOnly ? { innerHTML: '' } : document.getElementById('notas-builder-container'));
    if (!select || !container) return;

    const curso = select.value;
    const userKey = readOnly ? 'shared' : 'me';
    
    if (!curso) {
        container.innerHTML = notasEmptySelectionHtml();
        return;
    }
    
    const dbKey = userKey + '|' + curso;
    
    // Plantilla base simplificada
    if (!readOnly && !NOTAS_DATA[dbKey]) {
        NOTAS_DATA[dbKey] = {
            items: [
                { name: "Solemne 1", weight: 30, grade: null },
                { name: "Solemne 2", weight: 30, grade: null },
                { name: "Controles", weight: 25, grade: null },
                { name: "Tareas", weight: 15, grade: null }
            ],
            examGrade: null,
            examWeight: 30
        };
        saveNotas();
    }
    
    const data = readOnly
        ? JSON.parse(JSON.stringify(options.data || {}))
        : NOTAS_DATA[dbKey];
    limpiarRedundanciaNotas({ [dbKey]: data });
    const exim = 5.0;
    
    // Sanitizar posibles datos corruptos antiguos
    if (data.items) {
        data.items = data.items.map(item => ({
            name: item.name || "Evaluación",
            weight: item.weight || 0,
            grade: normalizarNota(item.grade)
        }));
    } else {
        data.items = [];
    }
    
    let itemsHtml = '';
    let totalWeightNP = 0; // Debe sumar 100%
    let currentWeightedSumNP = 0; // Sumatoria actual (ej: 0 a 100, bueno en base a notas de 1 a 7 es 1.0 a 7.0)
    let currentWeightEvaluatedNP = 0; // % que ya tiene nota puesta
    
    data.items.forEach((item, index) => {
        const w = parseFloat(item.weight) || 0;
        totalWeightNP += w;
        
        let valString = item.grade !== null ? String(item.grade).replace(',','.') : '';
        let gradeVal = parseFloat(valString);
        
        if (!isNaN(gradeVal) && valString !== '') {
            currentWeightedSumNP += gradeVal * (w / 100);
            currentWeightEvaluatedNP += w;
        }
        
        itemsHtml += `
            <div class="notas-item-row">
                <input type="text" class="notas-input-name" value="${escapeHtml(item.name)}" ${readOnly ? 'disabled' : `onchange="updateNotaItem(${notasJsArg(dbKey)}, ${index}, 'name', this.value)"`} placeholder="Nombre (ej: Controles)">
                <div style="display:flex; align-items:center; gap: 6px;">
                    <div class="notas-input-wrapper" style="width: 60px;">
                        <input type="number" class="notas-input-weight" value="${escapeHtml(item.weight)}" ${readOnly ? 'disabled' : `onchange="updateNotaItem(${notasJsArg(dbKey)}, ${index}, 'weight', this.value)"`} placeholder="%">
                        <span class="notas-percent-symbol">%</span>
                    </div>
                    <input type="number" step="0.1" min="1.0" max="7.0" class="notas-input-grade" style="width: 80px;" value="${escapeHtml(item.grade !== null ? item.grade : '')}" ${readOnly ? 'disabled' : `onchange="updateNotaItem(${notasJsArg(dbKey)}, ${index}, 'grade', this.value)"`} placeholder="Nota">
                </div>
            </div>
        `;
    });
    
    // Calculos
    let remainingWeightNP = 100 - currentWeightEvaluatedNP;
    
    // NP actual (sobre el % evaluado)
    let np_actual = currentWeightedSumNP;
    
    // NP real (asumiendo 1.0 en lo que falta, si remainingWeight == 0, esto es igual a np_actual)
    let np_final = currentWeightedSumNP; // sum(nota * peso/100)
    
    let survivalHtml = '';
    let statusClass = '';
    
    // Examen logic
    let examValString = data.examGrade !== null ? String(data.examGrade).replace(',','.') : '';
    let examGradeVal = parseFloat(examValString);
    let hasExamGrade = !isNaN(examGradeVal) && examValString !== '';
    
    let eW = (data.examWeight !== undefined ? parseFloat(data.examWeight) : 30) / 100;
    let npW = 1.0 - eW;
    let notaFinalCalculada = 0;
    
    let isEximido = false;
    if (Math.abs(totalWeightNP - 100) > 0.1) {
        survivalHtml = `<div class="notas-warning">Sumatoria incorrecta. Tus evaluaciones de Presentación suman ${totalWeightNP.toFixed(1)}%, deberían sumar 100%.</div>`;
        statusClass = 'is-invalid';
    } else {
        // Todo suma 100%
        if (Math.abs(remainingWeightNP) < 0.1) {
            // NP está 100% ingresada
            if (np_final >= exim && eW > 0) {
                isEximido = true;
                notaFinalCalculada = np_final;
                survivalHtml = `<div class="notas-success" style="background: rgba(234, 179, 8, 0.15); color: #facc15; border-color: rgba(234, 179, 8, 0.3);">¡Eximido! Tu Nota de Presentación (${np_final.toFixed(2)}) supera la nota de eximición (${exim.toFixed(2)}).</div>`;
                statusClass = 'is-passed';
            } else if (hasExamGrade) {
                notaFinalCalculada = (np_final * npW) + (examGradeVal * eW);
                let rounded100 = Math.round(notaFinalCalculada * 100);
                if (rounded100 >= 395) {
                    let displayGrade = rounded100 < 400 ? "4.00" : notaFinalCalculada.toFixed(2);
                    survivalHtml = `<div class="notas-success">Aprobado. Tu Nota Final es ${displayGrade}.</div>`;
                    statusClass = 'is-passed';
                } else {
                    survivalHtml = `<div class="notas-danger">Reprobado. Tu Nota Final es ${notaFinalCalculada.toFixed(2)}.</div>`;
                    statusClass = 'is-failed';
                }
            } else {
                // Falta el examen
                const requiredInExam = eW > 0 ? (3.945 - (np_final * npW)) / eW : 0;
                
                if (eW === 0) {
                    let rounded100 = Math.round(np_final * 100);
                    if (rounded100 >= 395) {
                        let displayGrade = rounded100 < 400 ? "4.00" : np_final.toFixed(2);
                        survivalHtml = `<div class="notas-success">Aprobado. Tu Nota Final es ${displayGrade}.</div>`;
                        statusClass = 'is-passed';
                    } else {
                        survivalHtml = `<div class="notas-danger">Reprobado. Tu Nota Final es ${np_final.toFixed(2)}.</div>`;
                        statusClass = 'is-failed';
                    }
                } else if (requiredInExam > 7.0) {
                    survivalHtml = `<div class="notas-danger">Imposible aprobar. Necesitas un ${requiredInExam.toFixed(2)} en el examen.</div>`;
                    statusClass = 'is-failed';
                } else if (requiredInExam <= 1.0) {
                     survivalHtml = `<div class="notas-success">Aprobado asegurado. Aún con un 1.0 en el examen, pasas el ramo.</div>`;
                     statusClass = 'is-passed';
                } else {
                    survivalHtml = `<div class="notas-info">Tu Nota de Presentación es ${np_final.toFixed(2)}. Necesitas un <strong>${(Math.ceil((requiredInExam - 0.00001) * 100) / 100).toFixed(2)}</strong> en el examen para pasar.</div>`;
                    statusClass = 'is-pending';
                }
            }
        } else {
            // NP incompleta
            if (currentWeightEvaluatedNP > 0) {
                const requiredInExam = eW > 0 ? (3.945 - (np_actual * npW)) / eW : 0;
                
                if (eW === 0) {
                    const reqAverage = (3.945 - currentWeightedSumNP) / (remainingWeightNP / 100);
                    if (reqAverage > 7.0) {
                        survivalHtml = `<div class="notas-danger">Es matemáticamente imposible pasar con lo que te falta.</div>`;
                    } else if (reqAverage <= 1.0) {
                        survivalHtml = `<div class="notas-success">Tienes la aprobación asegurada incluso con 1.0 en lo restante.</div>`;
                    } else {
                        survivalHtml = `<div class="notas-info">Evaluación en progreso (Falta ${remainingWeightNP.toFixed(0)}%).<br>Necesitas promediar un <strong>${reqAverage.toFixed(1)}</strong> en lo restante para pasar.</div>`;
                    }
                } else if (requiredInExam > 7.0) {
                    survivalHtml = `<div class="notas-danger">Si mantienes tu rendimiento actual (Nota de Presentación proyectada: ${np_actual.toFixed(2)}), es matemáticamente imposible pasar.</div>`;
                } else if (requiredInExam <= 1.0) {
                     survivalHtml = `<div class="notas-success">Si mantienes tu rendimiento actual (Nota de Presentación proyectada: ${np_actual.toFixed(2)}), tienes la aprobación asegurada.</div>`;
                } else {
                    survivalHtml = `<div class="notas-info">Evaluación en progreso (Falta ${remainingWeightNP.toFixed(0)}%).<br>Si mantienes tu rendimiento actual (Nota de Presentación proyectada: ${np_actual.toFixed(2)}), necesitarás un <strong>${(Math.ceil((requiredInExam - 0.00001) * 100) / 100).toFixed(2)}</strong> en el Examen.</div>`;
                }
            } else {
                survivalHtml = `<div class="notas-info">Ingresa tus primeras notas para calcular tu pronóstico.</div>`;
            }
            statusClass = 'is-pending';
        }
    }
    
    
    let examStyle = "margin-top: 16px; transition: all 0.3s;";
    let examLabel = "Examen";
    let inputDisabled = "";

    let examRowHtml = `
        <div class="notas-item-row" style="${examStyle}">
            <div style="color: #e2e8f0; font-size: 14px; font-weight: 600; flex-grow: 1; min-width: 60px;">${examLabel}</div>
                <div style="display:flex; align-items:center; gap: 6px;">

                    <div class="notas-input-wrapper" style="width: 60px;">
                        <input type="number" class="notas-input-weight" value="${escapeHtml(data.examWeight !== undefined ? data.examWeight : 30)}" ${readOnly ? 'disabled' : `onchange="updateGlobalNota(${notasJsArg(dbKey)}, 'examWeight', this.value)"`} placeholder="%">
                        <span class="notas-percent-symbol">%</span>
                    </div>
                    <input type="number" step="0.1" min="1.0" max="7.0" class="notas-input-grade" style="width: 80px;" value="${escapeHtml(data.examGrade !== null ? data.examGrade : '')}" ${readOnly ? 'disabled' : `onchange="updateGlobalNota(${notasJsArg(dbKey)}, 'examGrade', this.value)"`} placeholder="Nota">
                </div>
        </div>
    `;
    

    // --- MINI GRÁFICO TENDENCIA ---
    let trendGrades = [];
    data.items.forEach(i => {
        if (i.grade !== null && i.grade !== '') trendGrades.push(parseFloat(i.grade));
    });
    if (hasExamGrade && !isEximido) {
        trendGrades.push(examGradeVal);
    }
    
    let sparklineHtml = '';
    if (trendGrades.length >= 2) {
        const sw = 240; // Ampliado horizontalmente
        const sh = 40;  // Ampliado verticalmente para peaks notorios
        const padX = 6; // Padding para que no se corte en los bordes
        let pathD = '';
        let dotsHtml = '';
        
        trendGrades.forEach((g, idx) => {
            let x = padX + idx * ((sw - 2 * padX) / (trendGrades.length - 1));
            let y = sh - (((g - 1) / 6.0) * sh);
            if (idx === 0) pathD += `M ${x} ${y} `;
            else pathD += `L ${x} ${y} `;
            
            // Vértices marcados para CADA nota
            dotsHtml += `<circle cx="${x}" cy="${y}" r="3" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />`;
        });
        
        const y4 = sh - (((4.0 - 1) / 6.0) * sh);
        
        sparklineHtml = `
            <div class="sparkline-wrapper" title="Tendencia de tus notas" style="display: flex; align-items: center; max-width: 100%; overflow: hidden;">
                <svg viewBox="0 -4 ${sw} ${sh+8}" style="overflow: visible; width: 100%; max-width: ${sw}px; height: auto;">
                    <!-- Linea de aprobación 4.0 -->
                    <line x1="0" y1="${y4}" x2="${sw}" y2="${y4}" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1.5" stroke-dasharray="3 3" />
                    <!-- Línea principal -->
                    <path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    <!-- Vértices -->
                    ${dotsHtml}
                </svg>
            </div>
        `;
    }
    // ---------------------------------

    let summaryBg = "";
    
    const cardHtml = `
        <div class="notas-card ${statusClass}${readOnly ? ' notas-readonly' : ''}">
            <div class="notas-header-row" style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
                <div class="notas-summary" style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%; padding: 16px 20px; box-sizing: border-box; ${summaryBg} transition: all 0.3s;">
                    <!-- Columna Izquierda (Vacía para balancear) -->
                    <div class="notas-desktop-spacer" style="flex: 1;"></div>
                    
                    <!-- Columna Central (Notas juntas) -->
                    <div style="display: flex; align-items: flex-end; justify-content: center; gap: 16px; width: 100%; max-width: 340px;">
                        <div style="text-align: center; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; flex: 1; flex-basis: 0;">
                            <div class="notas-summary-title">Nota Presentación</div>
                            <div class="notas-summary-value" style="font-size: 36px; line-height: 1;">${currentWeightEvaluatedNP > 0 ? np_actual.toFixed(2) : '-'}</div>
                        </div>
                        
                        <div style="text-align: center; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; flex: 1; flex-basis: 0;">
                            <div class="notas-summary-title" style="color: #38bdf8;">Nota Final</div>
                            <div class="notas-summary-value" style="font-size: 36px; line-height: 1; color: #f8fafc;">${(hasExamGrade || isEximido) && Math.abs(remainingWeightNP) < 0.1 ? notaFinalCalculada.toFixed(2) : '-'}</div>
                        </div>
                    </div>
                    
                    <!-- Columna Derecha (Gráfico a la derecha) -->
                    <div class="notas-chart-container">
                        ${sparklineHtml}
                    </div>
                </div>
                
                <!-- Barra de Progreso Moderna -->
                <div style="margin-top: 36px; margin-bottom: 8px; position: relative; width: 100%;">
                    <!-- Background Track -->
                    <div style="width: 100%; height: 8px; background: rgba(15, 23, 42, 0.8); border-radius: 8px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);">
                        <!-- Fill -->
                        <div style="height: 100%; width: ${(Math.min(7.0, ((isEximido || (hasExamGrade && Math.abs(remainingWeightNP)<0.1)) ? notaFinalCalculada : np_actual)) / 7.0) * 100}%; background: ${(Math.round(((isEximido || (hasExamGrade && Math.abs(remainingWeightNP)<0.1)) ? notaFinalCalculada : np_actual) * 100) >= 395) ? 'linear-gradient(90deg, #059669, #10b981)' : 'linear-gradient(90deg, #be123c, #f43f5e)'}; border-radius: 8px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s;"></div>
                    </div>
                    
                    <!-- Marcador 4.0 -->
                    <div style="position: absolute; left: ${(3.95 / 7.0) * 100}%; top: -6px; bottom: -6px; width: 2px; background: rgba(255,255,255,0.6); z-index: 2; border-radius: 2px; box-shadow: 0 0 6px rgba(0,0,0,0.8);"></div>
                    <div style="position: absolute; left: ${(3.95 / 7.0) * 100}%; top: -22px; transform: translateX(-50%); font-size: 11px; color: #cbd5e1; font-weight: 700; letter-spacing: 0.5px;">4.0</div>
                    
                    <!-- Limites Visuales -->
                    <div style="position: absolute; left: 0; top: 12px; font-size: 10px; color: #64748b; font-weight: 600;">0.0</div>
                    <div style="position: absolute; right: 0; top: 12px; font-size: 10px; color: #64748b; font-weight: 600;">7.0</div>
                </div>
                
            </div>
            
            <div class="notas-items-list" style="max-width: 800px; margin: 0 auto;">
                ${itemsHtml}
                
                ${readOnly ? '' : `<div class="notas-add-row" style="display: flex; gap: 12px; justify-content: center; margin-bottom: 16px; margin-top: 8px;">
                    <button class="notas-btn-add" onclick="addNotaItem(${notasJsArg(dbKey)})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Añadir Evaluación Parcial
                    </button>
                </div>`}
                
                ${examRowHtml}
            </div>
            
            <div class="notas-survival-box">
                ${survivalHtml}
            </div>
            

        </div>
    `;
    if (readOnly) return cardHtml;
    container.innerHTML = cardHtml;
}

function renderPublicNotasCourse() {
    const container = document.querySelector('#tab-notas .public-profile-content[data-module="grades"]');
    const select = document.getElementById('notas-curso-select');
    if (!container || !select) return;
    const course = select.value;
    if (!course) {
        container.innerHTML = notasEmptySelectionHtml();
        return;
    }
    const entry = Object.entries(PUBLIC_NOTAS_PAYLOAD).find(([key]) => {
        const name = String(key).includes('|') ? String(key).split('|').slice(1).join('|') : String(key);
        return name.trim().toLocaleLowerCase() === course.trim().toLocaleLowerCase();
    });
    container.innerHTML = renderNotasBuilder({
        readOnly: true,
        course,
        data: entry ? entry[1] : emptyPublicNotasData(),
        container: { innerHTML: '' }
    });
}

window.selectNotasPerfilCourse = function (course) {
    const value = String(course || '');
    const select = document.getElementById('notas-curso-select');
    const dropdown = document.getElementById('dd-notas-curso');
    const label = document.getElementById('label-notas-curso');
    if (select) select.value = value;
    if (dropdown) dropdown.classList.remove('open');
    if (label) label.textContent = value || 'Selecciona una asignatura...';
    document.querySelectorAll('#dd-notas-curso .dropdown-item').forEach(item => {
        item.classList.toggle('active', item.dataset.val === value);
    });
    renderPublicNotasCourse();
};

window.renderNotasPublicas = function (container, payload) {
    if (!container) return;
    PUBLIC_NOTAS_PAYLOAD = limpiarRedundanciaNotas(payload);
    const profile = window.PortalCommunity && typeof window.PortalCommunity.getSelected === 'function'
        ? window.PortalCommunity.getSelected() : null;
    const profileId = String(profile && (profile.user_id || profile.id) || 'shared');
    if (profileId !== PUBLIC_NOTAS_PROFILE_ID) {
        PUBLIC_NOTAS_PROFILE_ID = profileId;
        const select = document.getElementById('notas-curso-select');
        if (select) select.value = '';
    }

    const schedule = profile && profile.modules && profile.modules.schedule;
    const classes = Array.isArray(schedule) ? schedule : schedule && Array.isArray(schedule.clases) ? schedule.clases : [];
    const assistantCourses = assistantCourseSet(classes);
    const byName = new Map();
    classes.forEach(item => {
        const course = String(item && item.curso || '').trim();
        if (course && !assistantCourses.has(normStr(course)) && !byName.has(course.toLocaleLowerCase())) byName.set(course.toLocaleLowerCase(), course);
    });
    Object.keys(PUBLIC_NOTAS_PAYLOAD).forEach(key => {
        const course = String(key).includes('|') ? String(key).split('|').slice(1).join('|').trim() : String(key).trim();
        if (course && !assistantCourses.has(normStr(course)) && !byName.has(course.toLocaleLowerCase())) byName.set(course.toLocaleLowerCase(), course);
    });
    PUBLIC_NOTAS_COURSES = [...byName.values()].sort((a, b) => a.localeCompare(b, 'es'));

    const select = document.getElementById('notas-curso-select');
    const menu = document.querySelector('#dd-notas-curso .dropdown-menu');
    const label = document.getElementById('label-notas-curso');
    const dropdown = document.getElementById('dd-notas-curso');
    const selected = select && PUBLIC_NOTAS_COURSES.includes(select.value) ? select.value : '';
    if (select) select.value = selected;
    if (label) label.textContent = selected || 'Selecciona una asignatura...';
    if (dropdown) dropdown.classList.remove('open');
    if (menu) {
        menu.innerHTML = `<div class="dropdown-item ${selected ? '' : 'active'}" data-val="" onclick="selectNotasPerfilCourse('')">Selecciona una asignatura...</div>` +
            PUBLIC_NOTAS_COURSES.map(course => `<div class="dropdown-item ${selected === course ? 'active' : ''}" data-val="${escapeHtml(course)}" onclick="selectNotasPerfilCourse(this.dataset.val)">${escapeHtml(course)}</div>`).join('');
    }
    renderPublicNotasCourse();
};






function updateNotaItem(dbKey, index, field, value) {
    if (!NOTAS_DATA[dbKey]) return;
    NOTAS_DATA[dbKey].items[index][field] = field === 'grade' ? normalizarNota(value) : value;
    saveNotas();
    renderNotasBuilder();
}

window.updateGlobalNota = function(dbKey, field, value) {
    if (!NOTAS_DATA[dbKey]) return;
    
    if (field === 'examGrade') {
        NOTAS_DATA[dbKey][field] = normalizarNota(value);
    } else if (value === '') {
        NOTAS_DATA[dbKey][field] = null;
    } else {
        let parsed = parseFloat(value);
        if (!isNaN(parsed)) {
            NOTAS_DATA[dbKey][field] = parsed;
        } else {
            NOTAS_DATA[dbKey][field] = null;
        }
    }
    
    saveNotas();
    renderNotasBuilder();
};


function addNotaItem(dbKey) {
    if (!NOTAS_DATA[dbKey]) return;
    NOTAS_DATA[dbKey].items.push({ name: "Nueva Evaluación", weight: 0, grade: null });
    saveNotas();
    renderNotasBuilder();
}

document.addEventListener('DOMContentLoaded', () => {
    initNotas();
    if (window.PortalStore) window.PortalStore.register('grades', 'mi_notas_v1', {});
    const oldCambiarTab = window.cambiarTab;
    if (typeof oldCambiarTab === 'function') {
        window.cambiarTab = function(tabId, btnContext) {
            oldCambiarTab(tabId, btnContext);
            if (tabId === 'tab-notas') {
                updateNotasDropdown();
                renderNotasBuilder();
            }
        };
    }
});

document.addEventListener('portal:remote-state', event => {
    if (event.detail.module !== 'grades') return;
    const payload = event.detail.payload || {};
    const original = JSON.stringify(payload);
    NOTAS_DATA = limpiarRedundanciaNotas(payload);
    if (JSON.stringify(NOTAS_DATA) !== original) saveNotas();
    updateNotasDropdown();
});

document.addEventListener('portal:public-profile-changed', () => {
    updateNotasDropdown();
});

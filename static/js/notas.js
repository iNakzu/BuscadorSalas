let NOTAS_DATA = {}; 

function initNotas() {
    try {
        const stored = localStorage.getItem('mi_notas_v1');
        if (stored) {
            const parsed = JSON.parse(stored);
            for (const k of Object.keys(parsed)) {
                if (!k.includes('|')) {
                    NOTAS_DATA['nakzu|' + k] = parsed[k];
                } else {
                    NOTAS_DATA[k] = parsed[k];
                }
            }
        }
    } catch(e) { console.error(e); }
}

function saveNotas() {
    try {
        localStorage.setItem('mi_notas_v1', JSON.stringify(NOTAS_DATA));
    } catch(e) { console.error(e); }
}

function updateNotasDropdown() {
    const select = document.getElementById('notas-curso-select');
    const friendSelect = document.getElementById('notas-friend-select');
    if (!select) return;
    
    let friendId = friendSelect ? friendSelect.value : 'nakzu';
    
    let scheduleObj = null;
    if (friendId === 'nakzu' && typeof MI_HORARIO_DATA !== 'undefined') {
        scheduleObj = MI_HORARIO_DATA;
    } else if (typeof HORARIOS_GUARDADOS !== 'undefined' && HORARIOS_GUARDADOS[friendId]) {
        scheduleObj = HORARIOS_GUARDADOS[friendId];
    }
    
    let myRamos = [];
    if (scheduleObj && scheduleObj.clases) {
        const validClasses = scheduleObj.clases.filter(c => c.rol !== 'assistant');
        myRamos = [...new Set(validClasses.map(c => normStr(c.curso)))].filter(Boolean).sort();
    }
    
    const currVal = select.value;
    let html = '<option value="">Selecciona una asignatura de tu horario...</option>';
    myRamos.forEach(r => {
        const foundCourse = scheduleObj.clases.find(c => normStr(c.curso) === r);
        const originalCourse = foundCourse ? foundCourse.curso : r;
        html += `<option value="${originalCourse}">${escapeHtml(originalCourse)}</option>`;
    });
    
    for (const key of Object.keys(NOTAS_DATA)) {
        if (key.startsWith(friendId + '|')) {
            const r = key.split('|')[1];
            if (!myRamos.includes(normStr(r))) {
                const data = NOTAS_DATA[key];
                let hasGrades = false;
                if (data && data.items) {
                    hasGrades = data.items.some(item => item.grade !== null && item.grade !== '');
                }
                if (data.examGrade) hasGrades = true;
                
                if (hasGrades) {
                    html += `<option value="${r}">${escapeHtml(r)} (Fuera de horario)</option>`;
                } else {
                    delete NOTAS_DATA[key];
                    saveNotas();
                }
            }
        }
    }
    
    select.innerHTML = html;
    
    let isCurrValValid = false;
    for(let i=0; i<select.options.length; i++) {
        if(select.options[i].value === currVal && currVal !== "") {
            isCurrValValid = true; break;
        }
    }
    
    if (isCurrValValid) {
        select.value = currVal;
    } else {
        select.value = "";
    }
    renderNotasBuilder();
}

function updateGlobalNota(dbKey, field, value) {
    if (!NOTAS_DATA[dbKey]) return;
    NOTAS_DATA[dbKey][field] = value;
    saveNotas();
    renderNotasBuilder();
}

function renderNotasBuilder() {
    const select = document.getElementById('notas-curso-select');
    const container = document.getElementById('notas-builder-container');
    const friendSelect = document.getElementById('notas-friend-select');
    if (!select || !container) return;
    
    const curso = select.value;
    const friendId = friendSelect ? friendSelect.value : 'nakzu';
    
    if (!curso) {
        container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 40px; font-size: 14px;">Selecciona una asignatura arriba para configurar o ver tus notas.</div>`;
        return;
    }
    
    const dbKey = friendId + '|' + curso;
    
    // Plantilla base simplificada
    if (!NOTAS_DATA[dbKey]) {
        NOTAS_DATA[dbKey] = {
            items: [
                { id: Date.now(), name: "Solemne 1", weight: 30, grade: null },
                { id: Date.now()+1, name: "Solemne 2", weight: 30, grade: null },
                { id: Date.now()+2, name: "Controles", weight: 25, grade: null },
                { id: Date.now()+3, name: "Tareas", weight: 15, grade: null }
            ],
            examGrade: null,
            examWeight: 30
        };
        saveNotas();
    }
    
    const data = NOTAS_DATA[dbKey];
    
    // Sanitizar posibles datos corruptos antiguos
    if (data.items) {
        data.items = data.items.map(item => ({
            id: item.id || Date.now() + Math.random(),
            name: item.name || "Evaluación",
            weight: item.weight || 0,
            grade: item.grade || null
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
                <input type="text" class="notas-input-name" value="${escapeHtml(item.name)}" onchange="updateNotaItem('${dbKey}', ${index}, 'name', this.value)" placeholder="Nombre (ej: Controles)">
                <div style="display:flex; align-items:center; gap: 6px;">
                    <div class="notas-input-wrapper" style="width: 60px;">
                        <input type="number" class="notas-input-weight" value="${item.weight}" onchange="updateNotaItem('${dbKey}', ${index}, 'weight', this.value)" placeholder="%">
                        <span class="notas-percent-symbol">%</span>
                    </div>
                    <input type="number" step="0.1" min="1.0" max="7.0" class="notas-input-grade" style="width: 80px;" value="${item.grade !== null ? item.grade : ''}" onchange="updateNotaItem('${dbKey}', ${index}, 'grade', this.value)" placeholder="Nota">
                    
                    <button class="notas-btn-del" onclick="deleteNotaItem('${dbKey}', ${index})" title="Eliminar ítem">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
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
    
    if (Math.abs(totalWeightNP - 100) > 0.1) {
        survivalHtml = `<div class="notas-warning">Sumatoria incorrecta. Tus evaluaciones de Presentación suman ${totalWeightNP.toFixed(1)}%, deberían sumar 100%.</div>`;
        statusClass = 'is-invalid';
    } else {
        // Todo suma 100%
        if (Math.abs(remainingWeightNP) < 0.1) {
            // NP está 100% ingresada
            if (hasExamGrade) {
                notaFinalCalculada = (np_final * npW) + (examGradeVal * eW);
                if (notaFinalCalculada >= 3.95) {
                    survivalHtml = `<div class="notas-success">Aprobado. Tu Nota Final es ${notaFinalCalculada.toFixed(1)}.</div>`;
                    statusClass = 'is-passed';
                } else {
                    survivalHtml = `<div class="notas-danger">Reprobado. Tu Nota Final es ${notaFinalCalculada.toFixed(1)}.</div>`;
                    statusClass = 'is-failed';
                }
            } else {
                // Falta el examen
                const requiredInExam = eW > 0 ? (4.0 - (np_final * npW)) / eW : 0;
                
                if (eW === 0) {
                    if (np_final >= 3.95) {
                        survivalHtml = `<div class="notas-success">Aprobado. Tu Nota Final es ${np_final.toFixed(1)}.</div>`;
                        statusClass = 'is-passed';
                    } else {
                        survivalHtml = `<div class="notas-danger">Reprobado. Tu Nota Final es ${np_final.toFixed(1)}.</div>`;
                        statusClass = 'is-failed';
                    }
                } else if (requiredInExam > 7.0) {
                    survivalHtml = `<div class="notas-danger">Imposible aprobar. Necesitas un ${requiredInExam.toFixed(1)} en el examen.</div>`;
                    statusClass = 'is-failed';
                } else if (requiredInExam <= 1.0) {
                     survivalHtml = `<div class="notas-success">Aprobado asegurado. Aún con un 1.0 en el examen, pasas el ramo.</div>`;
                     statusClass = 'is-passed';
                } else {
                    survivalHtml = `<div class="notas-info">Tu NP es ${np_final.toFixed(1)}. Necesitas un <strong>${requiredInExam.toFixed(1)}</strong> en el examen para pasar.</div>`;
                    statusClass = 'is-pending';
                }
            }
        } else {
            // NP incompleta
            if (currentWeightEvaluatedNP > 0) {
                const requiredInExam = eW > 0 ? (4.0 - (np_actual * npW)) / eW : 0;
                
                if (eW === 0) {
                    const reqAverage = (4.0 - currentWeightedSumNP) / (remainingWeightNP / 100);
                    if (reqAverage > 7.0) {
                        survivalHtml = `<div class="notas-danger">Es matemáticamente imposible pasar con lo que te falta.</div>`;
                    } else if (reqAverage <= 1.0) {
                        survivalHtml = `<div class="notas-success">Tienes la aprobación asegurada incluso con 1.0 en lo restante.</div>`;
                    } else {
                        survivalHtml = `<div class="notas-info">Evaluación en progreso (Falta ${remainingWeightNP.toFixed(0)}%).<br>Necesitas promediar un <strong>${reqAverage.toFixed(1)}</strong> en lo restante para pasar.</div>`;
                    }
                } else if (requiredInExam > 7.0) {
                    survivalHtml = `<div class="notas-danger">Si mantienes tu rendimiento actual (NP proyectada: ${np_actual.toFixed(2)}), es matemáticamente imposible pasar.</div>`;
                } else if (requiredInExam <= 1.0) {
                     survivalHtml = `<div class="notas-success">Si mantienes tu rendimiento actual (NP proyectada: ${np_actual.toFixed(2)}), tienes la aprobación asegurada.</div>`;
                } else {
                    survivalHtml = `<div class="notas-info">Evaluación en progreso (Falta ${remainingWeightNP.toFixed(0)}%).<br>Si mantienes tu rendimiento actual (NP proyectada: ${np_actual.toFixed(2)}), necesitarás un <strong>${requiredInExam.toFixed(1)}</strong> en el Examen.</div>`;
                }
            } else {
                survivalHtml = `<div class="notas-info">Ingresa tus primeras notas para calcular tu pronóstico.</div>`;
            }
            statusClass = 'is-pending';
        }
    }
    
    let examRowHtml = `
        <div class="notas-item-row" style="margin-top: 16px;">
            <div style="color: #e2e8f0; font-size: 14px; font-weight: 600; flex-grow: 1; min-width: 120px;">Examen</div>
                <div style="display:flex; align-items:center; gap: 6px;">
                    <div class="notas-input-wrapper" style="width: 60px;">
                        <input type="number" class="notas-input-weight" value="${data.examWeight !== undefined ? data.examWeight : 30}" onchange="updateGlobalNota('${dbKey}', 'examWeight', this.value)" placeholder="%">
                        <span class="notas-percent-symbol">%</span>
                    </div>
                    <input type="number" step="0.1" min="1.0" max="7.0" class="notas-input-grade" style="width: 80px;" value="${data.examGrade !== null ? data.examGrade : ''}" onchange="updateGlobalNota('${dbKey}', 'examGrade', this.value)" placeholder="Nota">
                    <div style="width: 28px; height: 28px;"></div>
                </div>
        </div>
    `;
    
    let summaryBg = "";
    
    container.innerHTML = `
        <div class="notas-card ${statusClass}">
            <div class="notas-header-row" style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
                <div class="notas-summary" style="display: flex; justify-content: center; align-items: center; gap: 24px; ${summaryBg} transition: all 0.3s;">
                    <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                        <div class="notas-summary-title">Nota Presentación</div>
                        <div class="notas-summary-value" style="font-size: 36px;">${currentWeightEvaluatedNP > 0 ? np_actual.toFixed(2) : '-'}</div>
                    </div>
                    
                    <div style="width: 1px; height: 60px; background: rgba(255,255,255,0.1);"></div>
                    
                    <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                        <div class="notas-summary-title" style="color: #38bdf8;">Nota Final</div>
                        <div class="notas-summary-value" style="font-size: 36px; color: #f8fafc;">${hasExamGrade && Math.abs(remainingWeightNP) < 0.1 ? notaFinalCalculada.toFixed(2) : '-'}</div>
                    </div>
                </div>
            </div>
            
            <div class="notas-items-list">
                ${itemsHtml}
                
                <div class="notas-add-row" style="display: flex; gap: 12px; justify-content: center; margin-bottom: 16px; margin-top: 8px;">
                    <button class="notas-btn-add" onclick="addNotaItem('${dbKey}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Añadir Evaluación Parcial
                    </button>
                </div>
                
                ${examRowHtml}
            </div>
            
            <div class="notas-survival-box">
                ${survivalHtml}
        </div>
    `;
}

function updateNotaItem(dbKey, index, field, value) {
    if (!NOTAS_DATA[dbKey]) return;
    if (field === 'weight') {
        NOTAS_DATA[dbKey].items[index].weight = parseFloat(value) || 0;
    } else if (field === 'grade' || field === 'name') {
        NOTAS_DATA[dbKey].items[index][field] = value;
    } else {
        const parsed = parseFloat(value);
        NOTAS_DATA[dbKey].items[index][field] = !isNaN(parsed) ? parsed : 0;
    }
    saveNotas();
    renderNotasBuilder();
}

function addNotaItem(dbKey) {
    if (!NOTAS_DATA[dbKey]) return;
    NOTAS_DATA[dbKey].items.push({ id: Date.now(), name: "Nueva Evaluación", weight: 0, grade: null });
    saveNotas();
    renderNotasBuilder();
}

function deleteNotaItem(dbKey, index) {
    if (!NOTAS_DATA[dbKey]) return;
    NOTAS_DATA[dbKey].items.splice(index, 1);
    saveNotas();
    renderNotasBuilder();
}

function resetAllNotas() {
    NOTAS_DATA = {};
    saveNotas();
    renderNotasBuilder();
    alert('Caché de notas reiniciada correctamente.');
}

document.addEventListener('DOMContentLoaded', () => {
    initNotas();
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

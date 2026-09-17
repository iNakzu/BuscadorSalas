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
            examWeight: 30,
            eximGrade: 5.0
        };
        saveNotas();
    }
    
    const data = NOTAS_DATA[dbKey];
    const exim = 5.0;
    
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
                if (notaFinalCalculada >= 3.95) {
                    survivalHtml = `<div class="notas-success">Aprobado. Tu Nota Final es ${notaFinalCalculada.toFixed(2)}.</div>`;
                    statusClass = 'is-passed';
                } else {
                    survivalHtml = `<div class="notas-danger">Reprobado. Tu Nota Final es ${notaFinalCalculada.toFixed(2)}.</div>`;
                    statusClass = 'is-failed';
                }
            } else {
                // Falta el examen
                const requiredInExam = eW > 0 ? (4.0 - (np_final * npW)) / eW : 0;
                
                if (eW === 0) {
                    if (np_final >= 3.95) {
                        survivalHtml = `<div class="notas-success">Aprobado. Tu Nota Final es ${np_final.toFixed(2)}.</div>`;
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
                    survivalHtml = `<div class="notas-info">Tu NP es ${np_final.toFixed(2)}. Necesitas un <strong>${requiredInExam.toFixed(2)}</strong> en el examen para pasar.</div>`;
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
                    survivalHtml = `<div class="notas-info">Evaluación en progreso (Falta ${remainingWeightNP.toFixed(0)}%).<br>Si mantienes tu rendimiento actual (NP proyectada: ${np_actual.toFixed(2)}), necesitarás un <strong>${requiredInExam.toFixed(2)}</strong> en el Examen.</div>`;
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
    if (isEximido) {
        examStyle += " background: rgba(234, 179, 8, 0.15); border-color: rgba(234, 179, 8, 0.4); opacity: 0.8;";
        examLabel = "Examen (Eximido)";
        inputDisabled = "disabled";
    }

    let examRowHtml = `
        <div class="notas-item-row" style="${examStyle}">
            <div style="color: ${isEximido ? '#facc15' : '#e2e8f0'}; font-size: 14px; font-weight: 600; flex-grow: 1; min-width: 120px;">${examLabel}</div>
                <div style="display:flex; align-items:center; gap: 6px;">

                    <div class="notas-input-wrapper" style="width: 60px;">
                        <input type="number" class="notas-input-weight" value="${data.examWeight !== undefined ? data.examWeight : 30}" onchange="updateGlobalNota('${dbKey}', 'examWeight', this.value)" placeholder="%" ${inputDisabled}>
                        <span class="notas-percent-symbol">%</span>
                    </div>
                    <input type="number" step="0.1" min="1.0" max="7.0" class="notas-input-grade" style="width: 80px; ${isEximido ? 'visibility: hidden;' : ''}" value="${data.examGrade !== null ? data.examGrade : ''}" onchange="updateGlobalNota('${dbKey}', 'examGrade', this.value)" placeholder="Nota" ${inputDisabled}>
                    <div style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: ${isEximido ? '#facc15' : '#64748b'};" title="El examen final no se puede eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
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
        const sw = 120;
        const sh = 20;
        let pathD = '';
        trendGrades.forEach((g, idx) => {
            let x = idx * (sw / (trendGrades.length - 1));
            let y = sh - (((g - 1) / 6.0) * sh);
            if (idx === 0) pathD += `M ${x} ${y} `;
            else pathD += `L ${x} ${y} `;
        });
        
        let lastG = trendGrades[trendGrades.length - 1];
        let lastX = sw;
        let lastY = sh - (((lastG - 1) / 6.0) * sh);
        
        sparklineHtml = `
            <div style="display: flex; align-items: center; justify-content: center; margin-top: 4px;" title="Tendencia de tus notas">
                <svg width="${sw}" height="${sh}" viewBox="0 -4 ${sw} ${sh+8}" style="overflow: visible;">
                    <path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="${lastX}" cy="${lastY}" r="3" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
                </svg>
            </div>
        `;
    }
    // ---------------------------------

    let summaryBg = "";
    
    container.innerHTML = `
        <div class="notas-card ${statusClass}">
            <div class="notas-header-row" style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
                <div class="notas-summary" style="display: flex; justify-content: center; align-items: center; gap: 24px; ${summaryBg} transition: all 0.3s;">
                    <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                        <div class="notas-summary-title">Nota Presentación</div>
                        <div class="notas-summary-value" style="font-size: 36px;">${currentWeightEvaluatedNP > 0 ? np_actual.toFixed(2) : '-'}</div>
                    </div>
                    
                    
                    
                    <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                        <div class="notas-summary-title" style="color: #38bdf8;">Nota Final</div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 16px;">
                            <div class="notas-summary-value" style="font-size: 36px; color: #f8fafc;">${(hasExamGrade || isEximido) && Math.abs(remainingWeightNP) < 0.1 ? notaFinalCalculada.toFixed(2) : '-'}</div>
                            ${sparklineHtml}
                        </div>
                    </div>
                </div>
                
                <!-- Barra de Progreso Moderna -->
                <div style="margin-top: 36px; margin-bottom: 8px; position: relative; width: 100%;">
                    <!-- Background Track -->
                    <div style="width: 100%; height: 8px; background: rgba(15, 23, 42, 0.8); border-radius: 8px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);">
                        <!-- Fill -->
                        <div style="height: 100%; width: ${(Math.min(7.0, ((isEximido || (hasExamGrade && Math.abs(remainingWeightNP)<0.1)) ? notaFinalCalculada : np_actual)) / 7.0) * 100}%; background: ${(((isEximido || (hasExamGrade && Math.abs(remainingWeightNP)<0.1)) ? notaFinalCalculada : np_actual) >= 3.95) ? 'linear-gradient(90deg, #059669, #10b981)' : 'linear-gradient(90deg, #be123c, #f43f5e)'}; border-radius: 8px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s;"></div>
                    </div>
                    
                    <!-- Marcador 4.0 -->
                    <div style="position: absolute; left: ${(3.95 / 7.0) * 100}%; top: -6px; bottom: -6px; width: 2px; background: rgba(255,255,255,0.6); z-index: 2; border-radius: 2px; box-shadow: 0 0 6px rgba(0,0,0,0.8);"></div>
                    <div style="position: absolute; left: ${(3.95 / 7.0) * 100}%; top: -22px; transform: translateX(-50%); font-size: 11px; color: #cbd5e1; font-weight: 700; letter-spacing: 0.5px;">4.0</div>
                    
                    <!-- Limites Visuales -->
                    <div style="position: absolute; left: 0; top: 12px; font-size: 10px; color: #64748b; font-weight: 600;">0.0</div>
                    <div style="position: absolute; right: 0; top: 12px; font-size: 10px; color: #64748b; font-weight: 600;">7.0</div>
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

// Function to capture the card simply and robustly
window.capturarNotas = function() {
    if (typeof html2canvas === 'undefined') {
        alert("El módulo de captura aún está cargando o fue bloqueado por el navegador.");
        return;
    }
    const target = document.querySelector('.notas-card');
    if (!target) return;
    
    // Fix: render inputs onto canvas by passing their value to an attribute
    const inputs = target.querySelectorAll('input');
    inputs.forEach(inp => { inp.setAttribute('data-val', inp.value); });
    
    html2canvas(target, { backgroundColor: '#0f172a', scale: 2 }).then(canvas => {
        let a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = 'Mis_Notas_UDP.png';
        a.click();
    }).catch(err => {
        console.error("Error al capturar la imagen:", err);
        alert("Hubo un error al generar la imagen.");
    });
};

window.autocompletarParaAprobar = function() {
    const friendId = document.getElementById('notas-friend-select').value;
    const cursoSelect = document.getElementById('notas-curso-select').value;
    if (!cursoSelect) {
        alert("Selecciona una asignatura primero.");
        return;
    }
    const dbKey = `${friendId}|${cursoSelect}`;
    if (!NOTAS_DATA[dbKey]) return;
    const data = NOTAS_DATA[dbKey];
    
    const eW = parseFloat(data.examWeight !== undefined ? data.examWeight : 30) / 100;
    const npW = 1.0 - eW;
    
    let currentFinalPoints = 0;
    let missingFinalWeight = 0;
    
    data.items.forEach(i => {
        const itemW = (parseFloat(i.weight) || 0) / 100;
        const globalW = itemW * npW;
        if (i.grade !== null && i.grade !== '') {
            currentFinalPoints += parseFloat(i.grade) * globalW;
        } else {
            missingFinalWeight += globalW;
        }
    });
    
    if (data.examGrade !== null && data.examGrade !== '') {
        currentFinalPoints += parseFloat(data.examGrade) * eW;
    } else {
        missingFinalWeight += eW;
    }
    
    if (missingFinalWeight <= 0) {
        alert("Ya ingresaste todas tus notas. Borra alguna para simular.");
        return;
    }
    
    let requiredGrade = (3.95 - currentFinalPoints) / missingFinalWeight;
    if (requiredGrade < 1.0) requiredGrade = 1.0;
    
    // Redondear siempre hacia arriba en el segundo decimal para evitar quedar corto (ej. 3.94)
    requiredGrade = Math.ceil(requiredGrade * 100) / 100;
    
    const gradeStr = requiredGrade.toFixed(2);
    
    data.items.forEach(i => {
        if (i.grade === null || i.grade === '') {
            i.grade = gradeStr;
        }
    });
    
    if (data.examGrade === null || data.examGrade === '') {
        data.examGrade = gradeStr;
    }
    
    saveNotas();
    renderNotasBuilder();
};

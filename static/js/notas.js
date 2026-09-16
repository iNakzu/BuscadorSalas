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
    if (field === 'hasExam') {
        NOTAS_DATA[dbKey].hasExam = value;
    } else {
        NOTAS_DATA[dbKey][field] = parseFloat(value) || 0;
    }
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
    
    // Init data if not exists
    if (!NOTAS_DATA[dbKey]) {
        NOTAS_DATA[dbKey] = {
            items: [
                { id: Date.now(), name: "Solemne 1", weight: 35, grade: null, dropLowest: 0, isExcluding: false, minGradeReq: 4.0, showSettings: false },
                { id: Date.now()+1, name: "Solemne 2", weight: 35, grade: null, dropLowest: 0, isExcluding: false, minGradeReq: 4.0, showSettings: false },
                { id: Date.now()+2, name: "Controles", weight: 30, grade: null, dropLowest: 0, isExcluding: false, minGradeReq: 4.0, showSettings: false }
            ],
            passingGrade: 4.0,
            hasExam: false,
            examWeight: 30,
            eximicionGrade: 5.0,
            examMinReq: 3.5
        };
        saveNotas();
    }
    
    const data = NOTAS_DATA[dbKey];
    
    // Retro-compatibilidad de campos nuevos
    if (data.hasExam === undefined) data.hasExam = false;
    if (data.examWeight === undefined) data.examWeight = 30;
    if (data.eximicionGrade === undefined) data.eximicionGrade = 5.0;
    if (data.examMinReq === undefined) data.examMinReq = 3.5;
    
    let itemsHtml = '';
    let totalWeight = 0;
    let currentWeightedSum = 0;
    let currentWeightEvaluated = 0;
    let failedDirectly = false;
    let directFailReason = '';
    
    data.items.forEach((item, index) => {
        const w = parseFloat(item.weight) || 0;
        totalWeight += w;
        
        let displayGrade = '-';
        if (item.grade !== null && item.grade !== '') {
            const rawStr = String(item.grade).replace(',', '.'); // Allow both formats
            // Convert e.g. "5.0 4.0" to multiple, or "5.0-4.0", basically split by comma or space
            let rawArr = String(item.grade).split(/[\s\-]+/).map(s => parseFloat(s.replace(',', '.'))).filter(n => !isNaN(n));
            
            if (rawArr.length > 0) {
                const dropN = parseInt(item.dropLowest) || 0;
                let validGrades = [...rawArr].sort((a,b) => a - b);
                let droppedCount = 0;
                if (dropN > 0 && dropN < validGrades.length) {
                    droppedCount = dropN;
                    validGrades = validGrades.slice(dropN);
                }
                
                const avg = validGrades.reduce((a,b) => a+b, 0) / validGrades.length;
                displayGrade = avg.toFixed(1);
                
                if (item.isExcluding) {
                    const req = parseFloat(item.minGradeReq) || 4.0;
                    if (avg < req) {
                        failedDirectly = true;
                        directFailReason = `Reprobaste por regla de ${item.name} (Nota: ${avg.toFixed(1)} < Mínimo ${req.toFixed(1)})`;
                    }
                }
                
                currentWeightedSum += avg * (w / 100);
                currentWeightEvaluated += w;
            }
        }
        
        itemsHtml += `
            <div class="notas-item-row" style="flex-direction: column; align-items: stretch; gap: 8px;">
                <div style="display:flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <input type="text" class="notas-input-name" value="${escapeHtml(item.name)}" onchange="updateNotaItem('${dbKey}', ${index}, 'name', this.value)" placeholder="Nombre (ej: Controles)">
                    <div style="display:flex; align-items:center; gap: 6px;">
                        <div class="notas-input-wrapper" style="width: 60px;">
                            <input type="number" class="notas-input-weight" value="${item.weight}" onchange="updateNotaItem('${dbKey}', ${index}, 'weight', this.value)" placeholder="%">
                            <span class="notas-percent-symbol">%</span>
                        </div>
                        <input type="text" class="notas-input-grade" style="width: 80px;" value="${item.grade !== null ? item.grade : ''}" onchange="updateNotaItem('${dbKey}', ${index}, 'grade', this.value)" placeholder="Ej: 5.0 6.2">
                        
                        <button class="notas-btn-del" onclick="updateNotaItem('${dbKey}', ${index}, 'showSettings', !${item.showSettings ? 'true' : 'false'})" title="Configuración Avanzada" style="color: #94a3b8;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </button>
                        <button class="notas-btn-del" onclick="deleteNotaItem('${dbKey}', ${index})" title="Eliminar ítem">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
                ${item.showSettings ? `
                <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: 6px; font-size: 12px; display: flex; flex-direction: column; gap: 8px;">
                    <label style="display:flex; align-items:center; gap:8px; color: #94a3b8;">
                        <input type="checkbox" onchange="updateNotaItem('${dbKey}', ${index}, 'isExcluding', this.checked)" ${item.isExcluding ? 'checked' : ''}> 
                        Regla estricta de aprobación: requiere nota >= <input type="number" step="0.1" style="width: 50px; background: rgba(30,41,59,0.8); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 2px 4px; border-radius: 4px;" value="${item.minGradeReq}" onchange="updateNotaItem('${dbKey}', ${index}, 'minGradeReq', this.value)">
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; color: #94a3b8;">
                        Borrar la(s) <input type="number" style="width: 40px; background: rgba(30,41,59,0.8); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 2px 4px; border-radius: 4px; text-align: center;" value="${item.dropLowest || 0}" onchange="updateNotaItem('${dbKey}', ${index}, 'dropLowest', this.value)"> peor(es) nota(s) si se ingresan varias.
                    </label>
                </div>
                ` : ''}
            </div>
        `;
    });
    
    const targetTotalWeight = data.hasExam ? (100 - (parseFloat(data.examWeight) || 30)) : 100;
    let accumulatedScore = currentWeightedSum;
    let remainingWeight = targetTotalWeight - currentWeightEvaluated;
    
    let survivalHtml = '';
    let statusClass = '';
    
    let np_actual = currentWeightEvaluated > 0 ? (currentWeightedSum / (currentWeightEvaluated / 100)) : 0;
    let titleStr = data.hasExam ? "Nota de Presentación Parcial" : "Nota Acumulada Parcial";
    
    if (failedDirectly) {
        survivalHtml = `<div class="notas-danger">💀 ${escapeHtml(directFailReason)}</div>`;
        statusClass = 'is-failed';
    } else if (Math.abs(totalWeight - targetTotalWeight) > 0.1) {
        survivalHtml = `<div class="notas-warning">⚠️ Sumatoria de porcentajes incorrecta. Tus evaluaciones suman ${totalWeight}%, deberían sumar ${targetTotalWeight}%${data.hasExam ? ' (sin contar el examen)' : ''}.</div>`;
        statusClass = 'is-invalid';
    } else if (Math.abs(remainingWeight) < 0.1) {
        let np = currentWeightedSum / (targetTotalWeight / 100);
        titleStr = data.hasExam ? "Nota de Presentación (NP)" : "Nota Final";
        
        if (!data.hasExam) {
            if (np >= data.passingGrade) {
                survivalHtml = `<div class="notas-success">🎉 ¡Aprobaste el ramo con un ${np.toFixed(1)}!</div>`;
                statusClass = 'is-passed';
            } else {
                survivalHtml = `<div class="notas-danger">💀 Reprobaste el ramo con un ${np.toFixed(1)}.</div>`;
                statusClass = 'is-failed';
            }
        } else {
            const pExim = parseFloat(data.eximicionGrade) || 5.0;
            const pMinEx = parseFloat(data.examMinReq) || 3.5;
            const examW = parseFloat(data.examWeight) || 30;
            
            if (np >= pExim) {
                survivalHtml = `<div class="notas-success">🎉 ¡EXIMIDO! Tu Nota de Presentación es ${np.toFixed(1)} (>= ${pExim.toFixed(1)}).</div>`;
                statusClass = 'is-passed';
            } else if (np < pMinEx) {
                survivalHtml = `<div class="notas-danger">💀 Reprobaste sin derecho a examen. Tu NP es ${np.toFixed(1)} (Necesitabas ${pMinEx.toFixed(1)}).</div>`;
                statusClass = 'is-failed';
            } else {
                const requiredInExam = (data.passingGrade - currentWeightedSum) / (examW / 100);
                if (requiredInExam > 7.0) {
                    survivalHtml = `<div class="notas-danger">💀 Imposible pasar. Tu NP es ${np.toFixed(1)}, necesitarías un ${requiredInExam.toFixed(1)} en el examen.</div>`;
                    statusClass = 'is-failed';
                } else if (requiredInExam <= 1.0) {
                     survivalHtml = `<div class="notas-success">🎉 ¡Ya pasaste el ramo! Tu NP es ${np.toFixed(1)}. Aunque saques un 1.0 en el examen, apruebas.</div>`;
                     statusClass = 'is-passed';
                } else {
                    survivalHtml = `<div class="notas-info">📚 Vas a examen (Vale ${examW}%). Tu NP es ${np.toFixed(1)}. Necesitas un <strong>${requiredInExam.toFixed(1)}</strong> en el examen para aprobar.</div>`;
                    statusClass = 'is-pending';
                }
            }
        }
    } else {
        // En progreso
        let np = currentWeightEvaluated > 0 ? (currentWeightedSum / (currentWeightEvaluated / 100)) : 0;
        if (!data.hasExam) {
            const requiredWeighted = data.passingGrade - currentWeightedSum;
            const requiredAverage = requiredWeighted / (remainingWeight / 100);
            if (requiredAverage > 7.0) {
                survivalHtml = `<div class="notas-danger">💀 Imposible pasar. Necesitas promediar ${requiredAverage.toFixed(1)} en el ${remainingWeight.toFixed(0)}% restante.</div>`;
                statusClass = 'is-failed';
            } else if (requiredAverage <= 1.0) {
                survivalHtml = `<div class="notas-success">🎉 ¡Ya pasaste! Incluso con puros 1.0 en el ${remainingWeight.toFixed(0)}% restante apruebas.</div>`;
                statusClass = 'is-passed';
            } else {
                survivalHtml = `<div class="notas-info">📌 Necesitas promediar un <strong>${requiredAverage.toFixed(1)}</strong> en el ${remainingWeight.toFixed(0)}% restante para pasar.</div>`;
                statusClass = 'is-pending';
            }
        } else {
            const pExim = parseFloat(data.eximicionGrade) || 5.0;
            const pMinEx = parseFloat(data.examMinReq) || 3.5;
            const reqWeightExim = pExim * (targetTotalWeight / 100) - currentWeightedSum;
            const reqAvgExim = reqWeightExim / (remainingWeight / 100);
            
            const reqWeightExam = pMinEx * (targetTotalWeight / 100) - currentWeightedSum;
            const reqAvgExam = reqWeightExam / (remainingWeight / 100);
            
            if (reqAvgExam > 7.0) {
                survivalHtml = `<div class="notas-danger">💀 Ya reprobaste. Es imposible llegar al ${pMinEx.toFixed(1)} para dar examen.</div>`;
                statusClass = 'is-failed';
            } else {
                let txtExim = reqAvgExim <= 7.0 ? `Para eximirte (NP ${pExim.toFixed(1)}) necesitas promediar <strong>${Math.max(1.0, reqAvgExim).toFixed(1)}</strong>.` : `Ya no puedes eximirte.`;
                let txtExamen = `Para dar examen (NP ${pMinEx.toFixed(1)}) necesitas promediar <strong>${Math.max(1.0, reqAvgExam).toFixed(1)}</strong>.`;
                survivalHtml = `<div class="notas-info">📚 Te falta evaluar el ${remainingWeight.toFixed(0)}% de tu Nota de Presentación.<br><br>👉 ${txtExamen}<br>👉 ${txtExim}</div>`;
                statusClass = 'is-pending';
            }
        }
    }
    
    container.innerHTML = `
        <div class="notas-card ${statusClass}">
            <div class="notas-header-row">
                <div class="notas-summary">
                    <div class="notas-summary-title">${titleStr}</div>
                    <div class="notas-summary-value">${currentWeightEvaluated > 0 ? np_actual.toFixed(2) : '-'}</div>
                    <div class="notas-summary-subtitle">Tu nota equivalente en el ${currentWeightEvaluated}% evaluado</div>
                </div>
            </div>
            
            <div class="notas-global-settings" style="background: rgba(15,23,42,0.4); padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.05); font-size: 13px;">
               <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight: 500; color: #e2e8f0;">
                  <input type="checkbox" onchange="updateGlobalNota('${dbKey}', 'hasExam', this.checked)" ${data.hasExam ? 'checked' : ''}>
                  ¿Este ramo tiene Examen Final?
               </label>
               ${data.hasExam ? `
               <div style="display:flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; align-items: center;">
                   <label style="display:flex; align-items:center; gap:6px; color: #94a3b8;">Peso del Examen: <input type="number" style="width: 50px; background: rgba(30,41,59,0.8); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 4px 6px; border-radius: 4px;" value="${data.examWeight}" onchange="updateGlobalNota('${dbKey}', 'examWeight', this.value)">%</label>
                   <label style="display:flex; align-items:center; gap:6px; color: #94a3b8;">Nota Eximición: <input type="number" step="0.1" style="width: 50px; background: rgba(30,41,59,0.8); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 4px 6px; border-radius: 4px;" value="${data.eximicionGrade}" onchange="updateGlobalNota('${dbKey}', 'eximicionGrade', this.value)"></label>
                   <label style="display:flex; align-items:center; gap:6px; color: #94a3b8;">NP Mínima Examen: <input type="number" step="0.1" style="width: 50px; background: rgba(30,41,59,0.8); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 4px 6px; border-radius: 4px;" value="${data.examMinReq}" onchange="updateGlobalNota('${dbKey}', 'examMinReq', this.value)"></label>
               </div>
               ` : ''}
            </div>
            
            <div class="notas-items-list">
                ${itemsHtml}
            </div>
            
            <div class="notas-add-row" style="display: flex; gap: 12px; justify-content: center; margin-bottom: 24px; flex-wrap: wrap;">
                <button class="notas-btn-add" onclick="addNotaItem('${dbKey}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Añadir Ítem
                </button>
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
    } else if (field === 'isExcluding' || field === 'showSettings') {
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
    NOTAS_DATA[dbKey].items.push({ id: Date.now(), name: "Nuevo ítem", weight: 0, grade: null, dropLowest: 0, isExcluding: false, minGradeReq: 4.0, showSettings: false });
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

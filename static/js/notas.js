let NOTAS_DATA = {}; // { "Mecánica": { items: [{name:"Solemne 1", weight:30, grade:5.5}], passingGrade: 4.0 } }

function initNotas() {
    try {
        const stored = localStorage.getItem('mi_notas_v1');
        if (stored) {
            const parsed = JSON.parse(stored);
            // Migración: si hay llaves sin prefijo (ej: "Mecánica" en vez de "nakzu|Mecánica"), envolverlas
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
        // Filtrar ramos donde el usuario NO es ayudante/profesor
        const validClasses = scheduleObj.clases.filter(c => c.rol !== 'assistant');
        myRamos = [...new Set(validClasses.map(c => normStr(c.curso)))].filter(Boolean).sort();
    }
    
    const currVal = select.value;
    let html = '<option value="">Selecciona una asignatura de tu horario...</option>';
    myRamos.forEach(r => {
        // Find original casing if possible
        const foundCourse = scheduleObj.clases.find(c => normStr(c.curso) === r);
        const originalCourse = foundCourse ? foundCourse.curso : r;
        html += `<option value="${originalCourse}">${escapeHtml(originalCourse)}</option>`;
    });
    select.innerHTML = html;
    
    // Check if the previously selected option is still valid
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

function renderNotasBuilder() {
    const select = document.getElementById('notas-curso-select');
    const container = document.getElementById('notas-builder-container');
    if (!select || !container) return;
    
    const curso = select.value;
    const friendSelect = document.getElementById('notas-friend-select');
    const friendId = friendSelect ? friendSelect.value : 'nakzu';
    
    if (!curso) {
        container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 40px; font-size: 14px;">Selecciona una asignatura arriba para configurar o ver tus notas.</div>`;
        return;
    }
    
    const dbKey = friendId + '|' + curso;
    
    // Inicializar datos si no existen
    if (!NOTAS_DATA[dbKey]) {
        NOTAS_DATA[dbKey] = {
            items: [
                { id: Date.now(), name: "Solemne 1", weight: 30, grade: null },
                { id: Date.now()+1, name: "Solemne 2", weight: 30, grade: null },
                { id: Date.now()+2, name: "Controles", weight: 40, grade: null }
            ],
            passingGrade: 4.0
        };
        saveNotas();
    }
    
    const data = NOTAS_DATA[dbKey];
    let itemsHtml = '';
    let totalWeight = 0;
    let currentWeightedSum = 0;
    let currentWeightEvaluated = 0;
    
    data.items.forEach((item, index) => {
        totalWeight += parseFloat(item.weight) || 0;
        if (item.grade !== null && item.grade !== '') {
            const g = parseFloat(item.grade);
            if (!isNaN(g)) {
                currentWeightedSum += g * (parseFloat(item.weight) || 0) / 100;
                currentWeightEvaluated += (parseFloat(item.weight) || 0);
            }
        }
        
        itemsHtml += `
            <div class="notas-item-row">
                <input type="text" class="notas-input-name" value="${escapeHtml(item.name)}" onchange="updateNotaItem('${dbKey}', ${index}, 'name', this.value)" placeholder="Nombre (ej: Solemne 1)">
                <div style="display:flex; align-items:center; gap: 8px;">
                    <div class="notas-input-wrapper">
                        <input type="number" class="notas-input-weight" value="${item.weight}" onchange="updateNotaItem('${dbKey}', ${index}, 'weight', this.value)" placeholder="%">
                        <span class="notas-percent-symbol">%</span>
                    </div>
                    <input type="number" step="0.1" min="1.0" max="7.0" class="notas-input-grade" value="${item.grade !== null ? item.grade : ''}" onchange="updateNotaItem('${dbKey}', ${index}, 'grade', this.value)" placeholder="Nota">
                    <button class="notas-btn-del" onclick="deleteNotaItem('${dbKey}', ${index})" title="Eliminar ítem">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>
        `;
    });
    
    // Cálculos de supervivencia
    let accumulatedScore = currentWeightedSum; // ej: 3.0 * 30% = 0.9
    let remainingWeight = totalWeight - currentWeightEvaluated;
    
    let survivalHtml = '';
    let statusClass = '';
    
    if (totalWeight !== 100) {
        survivalHtml = `<div class="notas-warning">⚠️ La suma de porcentajes es ${totalWeight}%, debe ser 100%.</div>`;
        statusClass = 'is-invalid';
    } else if (remainingWeight === 0) {
        if (currentWeightedSum >= data.passingGrade) {
            survivalHtml = `<div class="notas-success">🎉 ¡Aprobaste con un ${currentWeightedSum.toFixed(1)}! (Nota mínima requerida: ${data.passingGrade})</div>`;
            statusClass = 'is-passed';
        } else {
            survivalHtml = `<div class="notas-danger">💀 Reprobaste con un ${currentWeightedSum.toFixed(1)}. (Nota mínima requerida: ${data.passingGrade})</div>`;
            statusClass = 'is-failed';
        }
    } else {
        const requiredWeighted = data.passingGrade - currentWeightedSum;
        const requiredAverageInRemaining = requiredWeighted / (remainingWeight / 100);
        
        if (requiredAverageInRemaining > 7.0) {
            survivalHtml = `<div class="notas-danger">💀 Imposible pasar. Necesitas un ${requiredAverageInRemaining.toFixed(1)} en el ${remainingWeight}% restante (máximo es 7.0).</div>`;
            statusClass = 'is-failed';
        } else if (requiredAverageInRemaining <= 1.0) {
            survivalHtml = `<div class="notas-success">🎉 ¡Ya pasaste! Incluso con un 1.0 en el ${remainingWeight}% restante tu nota final será mayor a ${data.passingGrade}.</div>`;
            statusClass = 'is-passed';
        } else {
            survivalHtml = `<div class="notas-info">📌 Necesitas promediar un <strong>${requiredAverageInRemaining.toFixed(1)}</strong> en el ${remainingWeight}% restante para pasar (con un ${data.passingGrade}).</div>`;
            statusClass = 'is-pending';
        }
    }
    
    container.innerHTML = `
        <div class="notas-card ${statusClass}">
            <div class="notas-header-row">
                <div class="notas-summary">
                    <div class="notas-summary-title">Nota Acumulada</div>
                    <div class="notas-summary-value">${currentWeightEvaluated > 0 ? accumulatedScore.toFixed(2) : '-'}</div>
                    <div class="notas-summary-subtitle">Calculado sobre el ${currentWeightEvaluated}% evaluado</div>
                </div>
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

function updateNotaItem(curso, index, field, value) {
    if (!NOTAS_DATA[curso]) return;
    if (field === 'weight') {
        NOTAS_DATA[curso].items[index].weight = parseFloat(value) || 0;
    } else if (field === 'grade') {
        const parsed = parseFloat(value);
        NOTAS_DATA[curso].items[index].grade = !isNaN(parsed) ? parsed : null;
    } else {
        NOTAS_DATA[curso].items[index][field] = value;
    }
    saveNotas();
    renderNotasBuilder();
}

function addNotaItem(curso) {
    if (!NOTAS_DATA[curso]) return;
    NOTAS_DATA[curso].items.push({ id: Date.now(), name: "Nuevo ítem", weight: 0, grade: null });
    saveNotas();
    renderNotasBuilder();
}

function deleteNotaItem(dbKey, index) {
    if (!NOTAS_DATA[dbKey]) return;
    NOTAS_DATA[dbKey].items.splice(index, 1);
    saveNotas();
    renderNotasBuilder();
}

function resetNotaCurso(dbKey) {
    if (!NOTAS_DATA[dbKey]) return;
    delete NOTAS_DATA[dbKey];
    saveNotas();
    renderNotasBuilder(); // lo recreará con valores por defecto
}

function resetAllNotas() {
    NOTAS_DATA = {};
    saveNotas();
    renderNotasBuilder(); // actualizará UI a vacío
    alert('Caché de notas reiniciada correctamente.');
}

// Inicializar cuando el DOM cargue
document.addEventListener('DOMContentLoaded', () => {
    initNotas();
    
    // Sobrescribir cambiarTab para actualizar notas al entrar a la pestaña si es necesario
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

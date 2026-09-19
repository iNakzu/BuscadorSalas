let kanbanTasks = JSON.parse(localStorage.getItem('kanban_tasks')) || [];

function initKanban() {
    renderKanban();
}

function saveKanban() {
    localStorage.setItem('kanban_tasks', JSON.stringify(kanbanTasks));
}

function renderKanban() {
    const board = document.getElementById('kanban-board');
    if (!board) return;

    const cols = [
        { id: 'todo', title: 'Pendiente', color: '#f59e0b' },
        { id: 'doing', title: 'Haciendo', color: '#3b82f6' },
        { id: 'done', title: 'Terminado', color: '#10b981' }
    ];

    let html = '<div class="kanban-grid">';

    cols.forEach(col => {
        const colTasks = kanbanTasks.filter(t => t.status === col.id);
        
        html += `
            <div class="kanban-col">
                <div class="kanban-col-header" style="border-top: 3px solid ${col.color}">
                    <span>${col.title}</span>
                    <span class="kanban-count">${colTasks.length}</span>
                </div>
                <div class="kanban-task-list">
                    ${colTasks.map(t => `
                        <div class="kanban-task-card">
                            <div class="kanban-task-title">${escapeHtml(t.title)}</div>
                            ${t.desc ? `<div class="kanban-task-desc">${escapeHtml(t.desc)}</div>` : ''}
                            <div class="kanban-task-actions">
                                ${col.id !== 'todo' ? `<button onclick="moveTask('${t.id}', 'todo')" title="Mover a Pendiente">←</button>` : '<span></span>'}
                                <button onclick="deleteTask('${t.id}')" style="color: #ef4444;" title="Eliminar">🗑️</button>
                                ${col.id === 'todo' ? `<button onclick="moveTask('${t.id}', 'doing')" title="Mover a Haciendo">→</button>` : ''}
                                ${col.id === 'doing' ? `<button onclick="moveTask('${t.id}', 'done')" title="Mover a Terminado">→</button>` : ''}
                                ${col.id === 'done' ? '<span></span>' : ''}
                            </div>
                        </div>
                    `).join('')}
                    ${colTasks.length === 0 ? `<div class="empty-state" style="font-size:12px; padding: 20px 0;">No hay tareas</div>` : ''}
                </div>
            </div>
        `;
    });

    html += '</div>';
    board.innerHTML = html;
}

function abrirModalNuevaTarea() {
    const title = prompt("Título de la nueva tarea:");
    if (!title || !title.trim()) return;
    
    const desc = prompt("Descripción (Opcional):");
    
    kanbanTasks.push({
        id: 'task_' + Date.now(),
        title: title.trim(),
        desc: desc ? desc.trim() : '',
        status: 'todo',
        created_at: new Date().toISOString()
    });
    
    saveKanban();
    renderKanban();
}

function moveTask(id, newStatus) {
    const task = kanbanTasks.find(t => t.id === id);
    if (task) {
        task.status = newStatus;
        saveKanban();
        renderKanban();
    }
}

function deleteTask(id) {
    if (confirm("¿Estás seguro de eliminar esta tarea?")) {
        kanbanTasks = kanbanTasks.filter(t => t.id !== id);
        saveKanban();
        renderKanban();
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', initKanban);

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
                                <button onclick="deleteTask('${t.id}')" style="color: #ef4444;" title="Eliminar">×</button>
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
    let modal = document.getElementById('kanban-web-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'kanban-web-modal';
        modal.className = 'riff-web-modal';
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.innerHTML = `<form class="riff-modal-card" onsubmit="guardarTareaKanban(event)"><div class="riff-modal-header"><div><span class="section-kicker">Organización</span><h2>Nueva tarea</h2></div><button type="button" class="riff-modal-close" onclick="cerrarModalKanban()">×</button></div><label>Título<input name="title" required placeholder="Ej. Practicar sweep picking"></label><label>Descripción<textarea name="desc" rows="3" placeholder="Qué quieres conseguir..."></textarea></label><div class="riff-modal-actions"><button type="button" class="riff-modal-secondary" onclick="cerrarModalKanban()">Cancelar</button><button class="riff-modal-primary" type="submit">Agregar tarea</button></div></form>`;
    modal.querySelector('input').focus();
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
    const modal = document.getElementById('kanban-web-modal') || document.createElement('div');
    modal.id = 'kanban-web-modal';
    modal.className = 'riff-web-modal';
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    modal.innerHTML = `<div class="riff-modal-card riff-confirm-card"><div class="riff-modal-header"><div><span class="section-kicker">Confirmación</span><h2>Eliminar tarea</h2></div><button type="button" class="riff-modal-close" onclick="cerrarModalKanban()">×</button></div><p>¿Quieres eliminar esta tarea del tablero?</p><div class="riff-modal-actions"><button class="riff-modal-secondary" onclick="cerrarModalKanban()">Cancelar</button><button class="riff-modal-danger" onclick="confirmarEliminarTarea('${id}')">Eliminar</button></div></div>`;
}

function guardarTareaKanban(event) {
    event.preventDefault();
    const data = new FormData(event.target);
    kanbanTasks.push({ id: 'task_' + Date.now(), title: data.get('title').trim(), desc: data.get('desc').trim(), status: 'todo', created_at: new Date().toISOString() });
    saveKanban();
    cerrarModalKanban();
    renderKanban();
}

function confirmarEliminarTarea(id) {
        kanbanTasks = kanbanTasks.filter(t => t.id !== id);
        saveKanban();
        cerrarModalKanban();
        renderKanban();
}

function cerrarModalKanban() {
    const modal = document.getElementById('kanban-web-modal');
    if (modal) modal.style.display = 'none';
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

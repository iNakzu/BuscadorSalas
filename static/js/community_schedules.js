(function () {
    let loadInProgress = false;
    let reloadPending = false;
    let activeAuthUserId = '';
    let loadedUsers = [];
    let selectedUserId = '';
    let selectedProfileRecord = null;
    let serverDirectoryMode = false;
    let adminDirectoryMode = false;
    let profileSearchHasMore = false;
    let profileSearchOffset = 0;
    let visibleProfilePage = 0;
    let profileSearchError = '';
    let profileSearchTimer = null;
    let profileSearchRequest = 0;
    let selectionRequest = 0;
    let profileDialog = null;
    let profileDialogTrigger = null;
    const profileModulesCache = new Map();
    const MAX_VISIBLE_PROFILES = 40;
    const MAX_CACHED_PROFILES = 20;

    const sections = [
        { id: 'tab-mihorario', module: 'schedule', label: 'Horario', native: true },
        { id: 'tab-solemnes', module: 'exams', label: 'Solemnes', native: true },
        { id: 'tab-notas', module: 'grades', label: 'Notas' },
        { id: 'tab-agenda', module: 'agenda', label: 'Agenda' },
        { id: 'tab-progreso', module: 'curriculum', label: 'Malla' }
    ];

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    function initials(name) {
        const words = String(name || 'Estudiante').trim().split(/\s+/).filter(Boolean);
        if (words.length < 2) return Array.from(words[0] || 'ES').slice(0, 2).join('').toUpperCase();
        const firstSurname = words.length >= 3 ? words[words.length - 2] : words[1];
        return `${Array.from(words[0])[0]}${Array.from(firstSurname)[0]}`.toUpperCase();
    }

    function cleanClasses(payload) {
        const classes = Array.isArray(payload) ? payload : payload && payload.clases;
        return Array.isArray(classes)
            ? classes.filter(item => item && Number(item.dia) >= 1 && Number(item.dia) <= 5)
            : [];
    }

    function modulesFor(user) {
        if (user && user.modules && typeof user.modules === 'object') return user.modules;
        return { schedule: user && user.payload ? user.payload : { clases: [] }, grades: {}, agenda: [], curriculum: {} };
    }

    function selectedProfile() {
        if (selectedProfileRecord && String(selectedProfileRecord.user_id || '') === selectedUserId) return selectedProfileRecord;
        return loadedUsers.find(item => String(item.user_id || '') === selectedUserId) || null;
    }

    function hasAdminRole() {
        const user = window.PortalAuth && window.PortalAuth.user;
        return Boolean(user && user.app_metadata && user.app_metadata.portal_role === 'admin');
    }

    function saveAdminModule(module, payload) {
        const profile = selectedProfile();
        const auth = window.PortalAuth;
        if (!hasAdminRole() || !profile || !auth || !auth.client) return;
        const button = document.querySelector(`.public-profile-content[data-module="${module}"] .admin-profile-save`);
        if (module === 'schedule') {
            const occupied = new Set();
            for (const item of payload && Array.isArray(payload.clases) ? payload.clases : []) {
                if (item.dia == null || item.bloqueNum == null) continue;
                const key = `${item.dia}:${item.bloqueNum}`;
                if (occupied.has(key)) {
                    if (button) button.textContent = 'Deja una sola clase por bloque';
                    return;
                }
                occupied.add(key);
            }
        }
        if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = 'Guardando…'; }
        auth.client.rpc('admin_update_profile_module', {
            p_user_id: String(profile.user_id), p_module_key: module, p_payload: payload
        }).then(({ error }) => {
            if (error) throw error;
            profile.modules[module] = payload;
            profileModulesCache.set(String(profile.user_id), profile.modules);
            if (button) { button.textContent = 'Guardado'; setTimeout(() => { if (button.isConnected) button.textContent = 'Guardar cambios'; }, 1300); }
        }).catch(error => {
            console.error('No se pudieron guardar los cambios del perfil', error);
            if (button) button.textContent = 'No se pudo guardar';
        }).finally(() => { if (button) button.disabled = false; });
    }

    function adminInput(value, label, attrs = '') {
        return `<label class="admin-profile-field"><span>${escapeHtml(label)}</span><input ${attrs} value="${escapeHtml(value == null ? '' : value)}"></label>`;
    }

    function adminEditorMarkup(module, payload) {
        if (module === 'schedule') {
            const classes = Array.isArray(payload && payload.clases) ? payload.clases : [];
            const rows = classes.map((item, index) => `<article class="admin-profile-item"><div class="admin-profile-item-heading"><strong>${escapeHtml(item.curso || `Clase ${index + 1}`)}</strong><button type="button" data-admin-action="delete-class" data-index="${index}" aria-label="Eliminar clase">Eliminar</button></div><div class="admin-profile-fields">${adminInput(item.curso, 'Asignatura', `data-admin-field="schedule" data-index="${index}" data-field="curso"`)}${adminInput(item.dia, 'Día (1–5)', `type="number" min="1" max="5" data-admin-field="schedule" data-index="${index}" data-field="dia"`)}${adminInput(item.bloqueNum, 'Bloque (1–7)', `type="number" min="1" max="7" data-admin-field="schedule" data-index="${index}" data-field="bloqueNum"`)}${adminInput(item.tipo, 'Tipo', `data-admin-field="schedule" data-index="${index}" data-field="tipo"`)}${adminInput(item.rol, 'Rol', `data-admin-field="schedule" data-index="${index}" data-field="rol"`)}${adminInput(item.sala, 'Sala', `data-admin-field="schedule" data-index="${index}" data-field="sala"`)}${adminInput(item.seccion, 'Sección', `data-admin-field="schedule" data-index="${index}" data-field="seccion"`)}${adminInput(item.profesor, 'Profesor', `data-admin-field="schedule" data-index="${index}" data-field="profesor"`)}</div></article>`).join('');
            return `${rows || '<p class="public-profile-empty">Este perfil no tiene clases registradas.</p>'}<button type="button" data-admin-action="add-class">Añadir clase</button>`;
        }
        if (module === 'agenda') {
            const events = Array.isArray(payload) ? payload : [];
            const rows = events.map((item, index) => `<article class="admin-profile-item"><div class="admin-profile-item-heading"><strong>${escapeHtml(item.ramo || item.titulo || `Evento ${index + 1}`)}</strong><button type="button" data-admin-action="delete-agenda" data-index="${index}">Eliminar</button></div><div class="admin-profile-fields">${adminInput(item.ramo || item.titulo, 'Asignatura o título', `data-admin-field="agenda" data-index="${index}" data-field="ramo"`)}${adminInput(item.tipo, 'Tipo', `data-admin-field="agenda" data-index="${index}" data-field="tipo"`)}${adminInput(item.fecha, 'Fecha y hora', `data-admin-field="agenda" data-index="${index}" data-field="fecha"`)}${adminInput(item.notas, 'Notas', `data-admin-field="agenda" data-index="${index}" data-field="notas"`)}</div></article>`).join('');
            return `${rows || '<p class="public-profile-empty">Este perfil no tiene eventos registrados.</p>'}<button type="button" data-admin-action="add-agenda">Añadir evento</button>`;
        }
        if (module === 'grades') {
            const data = payload && typeof payload === 'object' ? payload : {};
            const courses = Object.entries(data).map(([course, grades]) => {
                const items = Array.isArray(grades && grades.items) ? grades.items : [];
                const entries = items.map((item, index) => `<div class="admin-profile-fields admin-profile-grade-row">${adminInput(item.name, 'Evaluación', `data-admin-field="grade-item" data-course="${escapeHtml(course)}" data-index="${index}" data-field="name"`)}${adminInput(item.weight, 'Peso %', `type="number" data-admin-field="grade-item" data-course="${escapeHtml(course)}" data-index="${index}" data-field="weight"`)}${adminInput(item.grade, 'Nota', `type="number" min="1" max="7" step="0.1" data-admin-field="grade-item" data-course="${escapeHtml(course)}" data-index="${index}" data-field="grade"`)}</div>`).join('');
                return `<article class="admin-profile-item"><div class="admin-profile-item-heading">${adminInput(course.includes('|') ? course.split('|').slice(1).join('|') : course, 'Asignatura', `data-admin-field="grade-course-name" data-course="${escapeHtml(course)}"`)}<button type="button" data-admin-action="add-grade" data-course="${escapeHtml(course)}">Añadir nota</button></div>${entries}${adminInput(grades && grades.examGrade, 'Nota de examen', `type="number" min="1" max="7" step="0.1" data-admin-field="grade-course" data-course="${escapeHtml(course)}" data-field="examGrade"`)}${adminInput(grades && grades.examWeight, 'Peso del examen %', `type="number" data-admin-field="grade-course" data-course="${escapeHtml(course)}" data-field="examWeight"`)}</article>`;
            }).join('');
            return `${courses || '<p class="public-profile-empty">Este perfil no tiene notas registradas.</p>'}<button type="button" data-admin-action="add-grade-course">Añadir asignatura</button>`;
        }
        const progress = payload && typeof payload === 'object' ? payload : {};
        const states = Object.entries(progress).filter(([key]) => !key.startsWith('__'));
        return `<p>Selecciona el estado de cada ramo para actualizar su avance.</p><div class="admin-profile-curriculum">${states.map(([key, value]) => `<button type="button" data-admin-action="toggle-curriculum" data-course="${escapeHtml(key)}"><span>${escapeHtml(key)}</span><strong>${Number(value) === 2 ? 'Aprobado' : Number(value) === 1 ? 'Cursando' : 'Pendiente'} · Cambiar</strong></button>`).join('') || '<p class="public-profile-empty">Esta malla no tiene estados guardados.</p>'}</div>`;
    }

    function renderAdminModule(container, module, payload) {
        if (!container) return;
        container.innerHTML = `<div class="admin-profile-editor"><div class="admin-profile-editor-heading"><strong>Perfil de ${escapeHtml((selectedProfile() || {}).display_name || 'Estudiante')}</strong><span>Los cambios se guardan en su cuenta.</span></div>${adminEditorMarkup(module, payload)}<button type="button" class="admin-profile-save">Guardar cambios</button></div>`;
    }

    function updateAdminDraft(field) {
        const profile = selectedProfile();
        if (!profile || !profile.modules) return;
        const { adminField, index, field: key, course } = field.dataset;
        const value = field.type === 'number' ? (field.value === '' ? null : Number(field.value)) : field.value;
        if (adminField === 'schedule') profile.modules.schedule.clases[Number(index)][key] = value;
        if (adminField === 'schedule' && key === 'bloqueNum') {
            const block = Number(value) - 1;
            const starts = ['08:30', '10:00', '11:30', '13:00', '14:30', '16:00', '17:30'];
            const ends = ['09:50', '11:20', '12:50', '14:20', '15:50', '17:20', '18:50'];
            if (starts[block]) {
                profile.modules.schedule.clases[Number(index)].horaInicio = starts[block];
                profile.modules.schedule.clases[Number(index)].horaFin = ends[block];
            }
        }
        if (adminField === 'schedule' && key === 'dia') {
            const names = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
            profile.modules.schedule.clases[Number(index)].diaNombre = names[Number(value)] || '';
        }
        if (adminField === 'agenda') profile.modules.agenda[Number(index)][key] = value;
        if (adminField === 'grade-item') profile.modules.grades[course].items[Number(index)][key] = value;
        if (adminField === 'grade-course') profile.modules.grades[course][key] = value;
        if (adminField === 'grade-course-name' && value.trim()) {
            const prefix = String(course).includes('|') ? String(course).split('|')[0] + '|' : '';
            const nextCourse = prefix + value.trim();
            if (nextCourse !== course) {
                profile.modules.grades[nextCourse] = profile.modules.grades[course];
                delete profile.modules.grades[course];
                const content = field.closest('.public-profile-content');
                if (content) content.querySelectorAll('[data-course]').forEach(element => {
                    if (element.dataset.course === course) element.dataset.course = nextCourse;
                });
            }
        }
        const content = field.closest('.public-profile-content');
        if (content) content.dataset.dirty = 'true';
    }

    function handleAdminContentAction(event) {
        const button = event.target.closest('[data-admin-action], .admin-profile-save');
        if (!button) return;
        const content = button.closest('.public-profile-content');
        const profile = selectedProfile();
        if (!content || !profile || !hasAdminRole()) return;
        const module = content.dataset.module;
        const payload = profile.modules && profile.modules[module];
        if (button.matches('.admin-profile-save')) { saveAdminModule(module, payload); return; }
        const action = button.dataset.adminAction;
        const index = Number(button.dataset.index);
        if (action === 'add-class') payload.clases.push({ id: `admin-${Date.now()}`, dia: 1, bloqueNum: 1, horaInicio: '08:30', horaFin: '09:50', curso: '', tipo: 'Cátedra', sala: '', profesor: '', seccion: '', rol: 'student' });
        if (action === 'delete-class') payload.clases.splice(index, 1);
        if (action === 'add-agenda') payload.push({ id: `admin-${Date.now()}`, ramo: '', tipo: 'Solemne', fecha: '', notas: '', completado: false });
        if (action === 'delete-agenda') payload.splice(index, 1);
        if (action === 'add-grade-course') payload[`me|Nueva asignatura ${Object.keys(payload).length + 1}`] = { items: [], examGrade: null, examWeight: 30 };
        if (action === 'add-grade') payload[button.dataset.course].items.push({ name: 'Nueva evaluación', weight: 0, grade: null });
        if (action === 'toggle-curriculum') {
            const key = button.dataset.course;
            payload[key] = ((Number(payload[key]) || 0) + 1) % 3;
        }
        renderAdminModule(content, module, payload);
        content.dataset.dirty = 'true';
    }

    function ownDisplayName() {
        const user = window.PortalAuth && window.PortalAuth.user;
        const metadata = user && user.user_metadata || {};
        const name = [metadata.given_name, metadata.family_name].filter(Boolean).join(' ').trim()
            || String(metadata.full_name || metadata.name || '').trim()
            || (user && user.email ? user.email.split('@')[0] : 'Tu cuenta');
        return name;
    }

    function profileChoice(user, isCurrent = false) {
        const name = isCurrent ? ownDisplayName() : (user.display_name || 'Estudiante');
        const id = isCurrent ? '' : String(user.user_id || '');
        const selected = isCurrent ? !selectedUserId : selectedUserId === id;
        const subtitle = isCurrent ? 'Tu cuenta' : 'Perfil compartido';
        return `<button class="public-profile-option${selected ? ' is-selected' : ''}" type="button" aria-pressed="${selected}" data-profile-id="${escapeHtml(id)}"><span class="public-profile-option-avatar${isCurrent ? ' is-own' : ''}" aria-hidden="true">${escapeHtml(initials(name))}</span><span class="public-profile-option-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(subtitle)}</small></span>${selected ? '<svg class="public-profile-option-check" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</button>`;
    }

    function normalizeSearch(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
    }

    function renderProfileDialog(query = '', loading = false) {
        const normalizedQuery = normalizeSearch(query);
        const matches = loadedUsers.filter(user => normalizeSearch(user.display_name || 'Estudiante').includes(normalizedQuery));
        const pageStart = visibleProfilePage * MAX_VISIBLE_PROFILES;
        const visible = matches.slice(pageStart, pageStart + MAX_VISIBLE_PROFILES);
        const count = loadedUsers.length;
        const countLabel = serverDirectoryMode
            ? (profileSearchHasMore ? `${count}+ perfiles` : `${count} ${count === 1 ? 'perfil' : 'perfiles'}`)
            : (count ? `${count} ${count === 1 ? 'persona' : 'personas'}` : 'Sin perfiles compartidos');
        const resultLabel = loading ? 'Buscando perfiles…'
            : (profileSearchError || (profileSearchHasMore
                ? `Mostrando ${pageStart + 1}–${pageStart + visible.length} de más de ${count}`
                : (matches.length ? `Mostrando ${pageStart + 1}–${pageStart + visible.length} de ${matches.length}` : '0 resultados')));
        const hasPrevious = visibleProfilePage > 0;
        const hasNext = matches.length > pageStart + visible.length || profileSearchHasMore;
        const pagination = hasPrevious || hasNext ? `<nav class="public-profile-pagination" aria-label="Páginas de perfiles">${hasPrevious ? '<button class="public-profile-page" data-direction="previous" type="button">Anterior</button>' : '<span></span>'}${hasNext ? '<button class="public-profile-page" data-direction="next" type="button">Siguiente</button>' : ''}</nav>` : '';
        const ownProfile = profileChoice(null, true);
        const emptyMessage = count === 0 && !normalizedQuery
            ? 'No hay más usuarios registrados.'
            : 'No encontramos perfiles con ese nombre.';
        const sharedProfiles = `${visible.map(user => profileChoice(user)).join('')}${!visible.length && !loading && !profileSearchError ? `<div class="public-profile-search-empty">${emptyMessage}</div>` : ''}`;
        return `<div class="public-profile-dialog-shell"><header class="public-profile-dialog-header"><div><span class="public-profile-dialog-eyebrow">PERFILES COMPARTIDOS</span><h2 id="public-profile-dialog-title">Cambiar perfil</h2><p>Busca una persona para ver su información.</p></div><button class="public-profile-dialog-close" type="button" aria-label="Cerrar"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></header><label class="public-profile-search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 4 4"></path></svg><input class="public-profile-search-input" type="text" inputmode="search" autocomplete="off" placeholder="Buscar por nombre" aria-label="Buscar perfiles por nombre" value="${escapeHtml(query)}"></label><div class="public-profile-result-count" aria-live="polite">${escapeHtml(resultLabel)}</div><div class="public-profile-dialog-results"><section class="public-profile-account"><h3>Tu cuenta</h3>${ownProfile}</section><section class="public-profile-shared"><div class="public-profile-shared-heading"><h3>Personas</h3><span>${escapeHtml(countLabel)}</span></div><div class="public-profile-dialog-options" aria-label="Perfiles compartidos">${sharedProfiles}</div></section></div>${pagination}</div>`;
    }

    function renderInlineDirectory(container, query = '', loading = false) {
        if (!container) return;
        const template = document.createElement('template');
        template.innerHTML = renderProfileDialog(query, loading);
        const shell = template.content.querySelector('.public-profile-dialog-shell');
        const header = shell && shell.querySelector('.public-profile-dialog-header');
        if (header) header.remove();
        container.innerHTML = shell ? shell.innerHTML : '';
    }

    function renderProfileTarget(target, query = '', loading = false) {
        if (!target) return;
        if (target.id === 'profile-community-directory') renderInlineDirectory(target, query, loading);
        else target.innerHTML = renderProfileDialog(query, loading);
    }

    function targetIsVisible(target) {
        return Boolean(target && (target.open || target.id === 'profile-community-directory'));
    }

    function installInlineDirectory() {
        const directory = document.getElementById('profile-community-directory');
        if (!directory) return;
        renderInlineDirectory(directory, '', serverDirectoryMode);
        directory.addEventListener('input', event => {
            if (!event.target.matches('.public-profile-search-input')) return;
            const query = event.target.value;
            const caret = event.target.selectionStart;
            visibleProfilePage = 0;
            if (profileSearchTimer) clearTimeout(profileSearchTimer);
            renderInlineDirectory(directory, query, serverDirectoryMode);
            const input = directory.querySelector('.public-profile-search-input');
            input.focus();
            input.setSelectionRange(caret, caret);
            if (serverDirectoryMode) profileSearchTimer = setTimeout(() => searchProfileDirectory(query, directory, false), 220);
        });
        directory.addEventListener('click', event => {
            const pageButton = event.target.closest('.public-profile-page');
            if (pageButton) {
                event.preventDefault();
                changeProfilePage(directory, pageButton.dataset.direction);
                return;
            }
            const option = event.target.closest('.public-profile-option');
            if (option) applySelection(option.dataset.profileId || '');
        });
        directory.addEventListener('change', event => { if (event.target.matches('[data-admin-field]')) updateAdminDraft(event.target); });
    }

    function pickerMarkup() {
        return `<div class="public-profile-picker"><button class="public-profile-trigger public-profile-trigger--unified" type="button" aria-haspopup="dialog"><span class="public-profile-trigger-avatar" aria-hidden="true"></span><span class="public-profile-trigger-copy"><small></small><strong></strong></span><span class="public-profile-trigger-chevron" aria-hidden="true">›</span></button></div>`;
    }

    function wirePicker(toolbar) {
        const trigger = toolbar.querySelector('.public-profile-trigger');
        if (!trigger) return;
        trigger.addEventListener('click', () => openProfileDialog(trigger));
    }

    function ensureProfileDialog() {
        if (profileDialog) return profileDialog;
        profileDialog = document.createElement('dialog');
        profileDialog.className = 'public-profile-dialog';
        profileDialog.setAttribute('aria-labelledby', 'public-profile-dialog-title');
        profileDialog.setAttribute('aria-modal', 'true');
        profileDialog.addEventListener('input', event => {
            if (!event.target.matches('.public-profile-search-input')) return;
            const query = event.target.value;
            const caret = event.target.selectionStart;
            visibleProfilePage = 0;
            if (profileSearchTimer) clearTimeout(profileSearchTimer);
            profileDialog.innerHTML = renderProfileDialog(query, serverDirectoryMode);
            const input = profileDialog.querySelector('.public-profile-search-input');
            input.focus();
            input.setSelectionRange(caret, caret);
            if (serverDirectoryMode) profileSearchTimer = setTimeout(() => searchProfileDirectory(query, profileDialog, false), 220);
        });
        profileDialog.addEventListener('click', event => {
            if (event.target === profileDialog || event.target.closest('.public-profile-dialog-close')) {
                closeProfileDialog();
                return;
            }
            const pageButton = event.target.closest('.public-profile-page');
            if (pageButton) {
                event.preventDefault();
                event.stopPropagation();
                changeProfilePage(profileDialog, pageButton.dataset.direction);
                return;
            }
            const option = event.target.closest('.public-profile-option');
            if (!option) return;
            applySelection(option.dataset.profileId || '');
            closeProfileDialog();
        });
        profileDialog.addEventListener('change', event => { if (event.target.matches('[data-admin-field]')) updateAdminDraft(event.target); });
        profileDialog.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown' && event.target.matches('.public-profile-search-input')) {
                event.preventDefault();
                const firstOption = profileDialog.querySelector('.public-profile-option');
                if (firstOption) firstOption.focus();
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                const options = [...profileDialog.querySelectorAll('.public-profile-option')];
                const index = options.indexOf(document.activeElement);
                if (index < 0) return;
                event.preventDefault();
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                const nextOption = options[(index + delta + options.length) % options.length];
                if (nextOption) nextOption.focus();
            }
        });
        profileDialog.addEventListener('close', () => {
            const trigger = profileDialogTrigger;
            profileDialogTrigger = null;
            if (trigger && trigger.isConnected) trigger.focus();
        });
        document.body.appendChild(profileDialog);
        return profileDialog;
    }

    function openProfileDialog(trigger) {
        const dialog = ensureProfileDialog();
        profileDialogTrigger = trigger;
        visibleProfilePage = 0;
        profileSearchOffset = 0;
        if (profileSearchTimer) clearTimeout(profileSearchTimer);
        dialog.innerHTML = renderProfileDialog('', serverDirectoryMode);
        if (!dialog.open) dialog.showModal();
        const input = dialog.querySelector('.public-profile-search-input');
        const compactViewport = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
        const focusTarget = compactViewport ? dialog.querySelector('.public-profile-dialog-close') : input;
        if (focusTarget) focusTarget.focus();
        if (serverDirectoryMode) searchProfileDirectory('', dialog, false);
    }

    function closeProfileDialog() {
        if (profileDialog && profileDialog.open) profileDialog.close();
    }

    function profileDialogFocusState(dialog) {
        const active = document.activeElement;
        if (!dialog || !active || !dialog.contains(active)) return '';
        if (active.matches('.public-profile-search-input')) return 'search';
        if (active.matches('.public-profile-dialog-close')) return 'close';
        return '';
    }

    function restoreProfileDialogFocus(dialog, state, query = '') {
        if (!dialog || !state) return;
        const target = dialog.querySelector(state === 'search' ? '.public-profile-search-input' : '.public-profile-dialog-close');
        if (!target) return;
        target.focus();
        if (state === 'search') target.setSelectionRange(query.length, query.length);
    }

    function focusProfilePageButton(dialog, direction) {
        const target = dialog.querySelector(`.public-profile-page[data-direction="${direction}"]`)
            || dialog.querySelector('.public-profile-page');
        if (target) target.focus();
    }

    async function searchProfileDirectory(query, dialog, append) {
        const auth = window.PortalAuth;
        if (!auth || !auth.client || !serverDirectoryMode) return false;
        const request = ++profileSearchRequest;
        const offset = append ? profileSearchOffset : 0;
        profileSearchError = '';
        let response;
        try {
            response = await auth.client.rpc(adminDirectoryMode ? 'admin_search_profiles' : 'search_shared_profiles', {
                p_query: String(query || '').trim(),
                p_limit: MAX_VISIBLE_PROFILES + 1,
                p_offset: offset
            });
        } catch (error) {
            response = { error };
        }
        if (request !== profileSearchRequest) return;
        if (response.error) {
            console.error('No se pudieron buscar los perfiles compartidos', response.error);
            profileSearchError = 'No se pudo completar la búsqueda. Intenta otra vez.';
            if (targetIsVisible(dialog)) {
                const focusState = profileDialogFocusState(dialog);
                const input = dialog.querySelector('.public-profile-search-input');
                const currentQuery = input ? input.value : query;
                renderProfileTarget(dialog, currentQuery);
                if (dialog.id !== 'profile-community-directory') restoreProfileDialogFocus(dialog, focusState, currentQuery);
            }
            return false;
        }
        const rows = Array.isArray(response.data) ? response.data : [];
        profileSearchHasMore = rows.length > MAX_VISIBLE_PROFILES;
        const page = rows.slice(0, MAX_VISIBLE_PROFILES).map(user => ({
            user_id: String(user.user_id || ''),
            display_name: user.display_name || 'Estudiante'
        }));
        loadedUsers = append ? [...loadedUsers, ...page] : page;
        if (!append) visibleProfilePage = 0;
        profileSearchOffset = offset + page.length;
        if (targetIsVisible(dialog)) {
            const focusState = profileDialogFocusState(dialog);
            const input = dialog.querySelector('.public-profile-search-input');
            const currentQuery = input ? input.value : query;
            renderProfileTarget(dialog, currentQuery);
            if (dialog.id !== 'profile-community-directory') restoreProfileDialogFocus(dialog, focusState, currentQuery);
        }
        syncSelectors();
        return true;
    }

    function changeProfilePage(dialog, direction) {
        const input = dialog.querySelector('.public-profile-search-input');
        const query = input ? input.value : '';
        const matches = loadedUsers.filter(user => normalizeSearch(user.display_name || '').includes(normalizeSearch(query)));
        if (direction === 'previous') {
            visibleProfilePage = Math.max(0, visibleProfilePage - 1);
            renderProfileTarget(dialog, query);
            if (dialog.id !== 'profile-community-directory') focusProfilePageButton(dialog, direction);
            return;
        }
        const nextPageStart = (visibleProfilePage + 1) * MAX_VISIBLE_PROFILES;
        if (nextPageStart < matches.length) {
            visibleProfilePage += 1;
            renderProfileTarget(dialog, query);
            if (dialog.id !== 'profile-community-directory') focusProfilePageButton(dialog, direction);
        } else if (serverDirectoryMode && profileSearchHasMore) {
            renderProfileTarget(dialog, query, true);
            searchProfileDirectory(query, dialog, true).then(success => {
                if (success) visibleProfilePage += 1;
                renderProfileTarget(dialog, query);
                if (dialog.id !== 'profile-community-directory') focusProfilePageButton(dialog, direction);
            });
        }
    }

    async function fetchProfileModules(profile) {
        if (!profile || !serverDirectoryMode) return profile;
        const id = String(profile.user_id || '');
        if (profileModulesCache.has(id)) {
            const modules = profileModulesCache.get(id);
            profileModulesCache.delete(id);
            profileModulesCache.set(id, modules);
            return { ...profile, modules };
        }
        const auth = window.PortalAuth;
        if (!auth || !auth.client) return profile;
        let response;
        try {
            response = await auth.client.rpc(hasAdminRole() ? 'admin_get_profile_information' : 'get_shared_profile_information', { p_user_id: id });
        } catch (error) {
            console.error('No se pudo cargar el perfil compartido', error);
            return null;
        }
        if (response.error || !response.data) {
            if (response.error) console.error('No se pudo cargar el perfil compartido', response.error);
            return null;
        }
        profileModulesCache.set(id, response.data);
        if (profileModulesCache.size > MAX_CACHED_PROFILES) {
            profileModulesCache.delete(profileModulesCache.keys().next().value);
        }
        return { ...profile, modules: response.data };
    }

    function installToolbars() {
        sections.forEach(config => {
            const section = document.getElementById(config.id);
            if (!section || section.querySelector('.public-profile-toolbar')) return;
            const toolbar = document.createElement('div');
            toolbar.className = 'public-profile-toolbar';
            toolbar.dataset.module = config.module;
            toolbar.classList.add('public-profile-toolbar--unified');
            toolbar.innerHTML = pickerMarkup();
            wirePicker(toolbar);
            section.insertBefore(toolbar, section.firstChild);
            if (!config.native || config.module === 'schedule') {
                const content = document.createElement('div');
                content.className = 'public-profile-content';
                content.dataset.module = config.module;
                content.hidden = true;
                if (config.module === 'grades') {
                    const builder = section.querySelector('#notas-builder-container');
                    section.insertBefore(content, builder ? builder.nextSibling : toolbar.nextSibling);
                } else {
                    section.insertBefore(content, toolbar.nextSibling);
                }
                content.addEventListener('change', event => { if (event.target.matches('[data-admin-field]')) updateAdminDraft(event.target); });
                content.addEventListener('click', handleAdminContentAction);
            }
        });
        syncSelectors();
    }

    function syncSelectors() {
        const profile = selectedProfile();
        const name = profile ? (profile.display_name || 'Estudiante') : ownDisplayName();
        document.querySelectorAll('.public-profile-picker').forEach(picker => {
            const trigger = picker.querySelector('.public-profile-trigger');
            if (trigger) {
                trigger.querySelector('.public-profile-trigger-avatar').textContent = initials(name);
                trigger.querySelector('.public-profile-trigger-copy strong').textContent = name;
                trigger.querySelector('.public-profile-trigger-copy small').textContent = 'Mi perfil';
                trigger.setAttribute('aria-label', profile ? `Viendo el perfil de ${name}. Cambiar persona` : `Viendo tu perfil, ${name}. Cambiar persona`);
            }
        });
        const directory = document.getElementById('profile-community-directory');
        if (directory) {
            const input = directory.querySelector('.public-profile-search-input');
            const preserveInput = input && document.activeElement === input;
            const query = input ? input.value : '';
            const caret = preserveInput ? input.selectionStart : null;
            renderInlineDirectory(directory, query);
            if (preserveInput) {
                const nextInput = directory.querySelector('.public-profile-search-input');
                if (nextInput) {
                    nextInput.focus();
                    nextInput.setSelectionRange(caret, caret);
                }
            }
        }
    }

    function emptyState(message) {
        return `<div class="public-profile-empty">${escapeHtml(message)}</div>`;
    }

    function renderGrades(payload) {
        const entries = payload && typeof payload === 'object' && !Array.isArray(payload) ? Object.entries(payload) : [];
        if (!entries.length) return emptyState('Esta persona todavía no ha registrado notas.');
        return `<div class="public-info-grid">${entries.map(([key, data]) => {
            const course = key.includes('|') ? key.split('|').slice(1).join('|') : key;
            const items = data && Array.isArray(data.items) ? data.items : [];
            const rows = items.map(item => `<div class="public-grade-row"><span>${escapeHtml(item.name || 'Evaluación')} · ${Number(item.weight) || 0}%</span><strong>${item.grade === null || item.grade === '' || item.grade === undefined ? '—' : escapeHtml(item.grade)}</strong></div>`).join('');
            const exam = data && data.examGrade !== null && data.examGrade !== '' && data.examGrade !== undefined
                ? `<div class="public-grade-row"><span>Examen · ${Number(data.examWeight) || 0}%</span><strong>${escapeHtml(data.examGrade)}</strong></div>` : '';
            return `<article class="public-info-card"><h3>${escapeHtml(course)}</h3>${rows || '<p>Sin evaluaciones registradas.</p>'}${exam}</article>`;
        }).join('')}</div>`;
    }

    function renderAgenda(payload) {
        const events = Array.isArray(payload) ? payload.slice().sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || ''))) : [];
        if (!events.length) return emptyState('Esta persona todavía no ha agregado eventos a su agenda.');
        return `<div class="public-agenda-list">${events.map(event => `<article class="public-agenda-item"><time>${escapeHtml(event.fecha || 'Sin fecha')}</time><div><strong>${escapeHtml(event.ramo || event.titulo || 'Evento')}</strong><span>${escapeHtml(event.tipo || 'Actividad')}${event.notas ? ` · ${escapeHtml(event.notas)}` : ''}</span></div></article>`).join('')}</div>`;
    }

    function renderCurriculum(payload) {
        return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    }

    function renderGenericViews(profile) {
        const modules = modulesFor(profile);
        document.querySelectorAll('.public-profile-content').forEach(content => {
            const module = content.dataset.module;
            content.hidden = !profile;
            if (!profile) { content.innerHTML = ''; return; }
            if (hasAdminRole()) {
                if (module === 'curriculum' && typeof window.renderMallaPublica === 'function') {
                    window.renderMallaPublica(content, modules.curriculum || {}, { editable: true });
                    return;
                }
                renderAdminModule(content, module, modules[module] || (module === 'schedule' ? { clases: [] } : module === 'agenda' ? [] : {}));
                return;
            }
            if (module === 'schedule') { content.hidden = true; return; }
            if (module === 'grades') {
                if (typeof window.renderNotasPublicas === 'function') window.renderNotasPublicas(content, modules.grades);
                else content.innerHTML = renderGrades(modules.grades);
            }
            if (module === 'agenda') {
                if (typeof window.renderAgendaPublica === 'function') window.renderAgendaPublica(content, modules.agenda);
                else content.innerHTML = renderAgenda(modules.agenda);
            }
            if (module === 'curriculum') {
                if (typeof window.renderMallaPublica === 'function') window.renderMallaPublica(content, renderCurriculum(modules.curriculum));
                else content.innerHTML = emptyState('No se pudo cargar la malla curricular.');
            }
        });
    }

    async function applySelection(userId) {
        const requestedId = String(userId || '');
        const found = loadedUsers.find(user => String(user.user_id || '') === requestedId)
            || (selectedProfileRecord && String(selectedProfileRecord.user_id || '') === requestedId ? selectedProfileRecord : null);
        selectedUserId = requestedId && found ? requestedId : '';
        selectedProfileRecord = selectedUserId ? found : null;
        const request = ++selectionRequest;
        let profile = selectedProfile();
        syncSelectors();
        if (profile && serverDirectoryMode) {
            profile = await fetchProfileModules(profile);
            if (request !== selectionRequest) return;
            selectedProfileRecord = profile;
            if (!profile) {
                selectedUserId = '';
                syncSelectors();
            }
        }
        sections.forEach(config => {
            const section = document.getElementById(config.id);
            if (section) {
                section.classList.toggle('public-profile-active', Boolean(profile));
                section.classList.toggle('public-profile-admin-edit', Boolean(profile && hasAdminRole()));
            }
        });
        renderGenericViews(profile);

        if (typeof window.mostrarHorarioPerfilEnMiHorario === 'function') {
            if (profile) {
                window.mostrarHorarioPerfilEnMiHorario(cleanClasses(modulesFor(profile).schedule));
            } else if (typeof window.cerrarHorarioPerfilEnMiHorario === 'function') {
                window.cerrarHorarioPerfilEnMiHorario();
            }
        }
        if (typeof window.renderSolemnes === 'function') window.renderSolemnes();
        if (document.dispatchEvent && typeof CustomEvent !== 'undefined') {
            document.dispatchEvent(new CustomEvent('portal:public-profile-changed', { detail: { profile } }));
        }
    }

    async function loadSharedInformation() {
        const auth = window.PortalAuth;
        if (!auth || !auth.user || !auth.client) {
            if (activeAuthUserId || selectedUserId) {
                activeAuthUserId = '';
                loadedUsers = [];
                selectedUserId = '';
                selectedProfileRecord = null;
                profileModulesCache.clear();
                serverDirectoryMode = false;
                await applySelection('');
            }
            return;
        }
        const authUserId = String(auth.user.id || '');
        adminDirectoryMode = hasAdminRole();
        if (activeAuthUserId && activeAuthUserId !== authUserId) {
            loadedUsers = [];
            selectedUserId = '';
            selectedProfileRecord = null;
            profileModulesCache.clear();
            serverDirectoryMode = false;
        }
        activeAuthUserId = authUserId;
        if (loadInProgress) { reloadPending = true; return; }
        loadInProgress = true;
        try {
            const directory = await auth.client.rpc(adminDirectoryMode ? 'admin_search_profiles' : 'search_shared_profiles', {
                p_query: '',
                p_limit: MAX_VISIBLE_PROFILES + 1,
                p_offset: 0
            });
            if (!directory.error) {
                serverDirectoryMode = true;
                const rows = Array.isArray(directory.data) ? directory.data : [];
                profileSearchHasMore = rows.length > MAX_VISIBLE_PROFILES;
                loadedUsers = rows.slice(0, MAX_VISIBLE_PROFILES).map(user => ({
                    user_id: String(user.user_id || ''),
                    display_name: user.display_name || 'Estudiante'
                }));
                profileSearchOffset = loadedUsers.length;
                if (selectedUserId && !selectedProfileRecord && !loadedUsers.some(user => user.user_id === selectedUserId)) {
                    selectedUserId = '';
                }
                syncSelectors();
                if (selectedUserId) await applySelection(selectedUserId);
                return;
            }

            serverDirectoryMode = false;
            let response = await auth.client.rpc('get_shared_information');
            let legacyMode = false;
            if (response.error) {
                const legacy = await auth.client.rpc('get_shared_schedules');
                if (legacy.error) throw response.error;
                response = legacy;
                legacyMode = true;
            }
            loadedUsers = (response.data || []).map(user => legacyMode
                ? { ...user, modules: modulesFor(user) }
                : user
            );
            selectedProfileRecord = selectedUserId ? loadedUsers.find(user => String(user.user_id) === selectedUserId) || null : null;
            if (selectedUserId && !selectedProfileRecord) await applySelection('');
            syncSelectors();
        } catch (error) {
            console.error('No se pudo cargar la información compartida', error);
            loadedUsers = [];
            selectedProfileRecord = null;
            if (selectedUserId) await applySelection('');
            else syncSelectors();
        } finally {
            loadInProgress = false;
            if (reloadPending) { reloadPending = false; loadSharedInformation(); }
        }
    }

    window.PortalCommunity = {
        select: applySelection,
        getSelected: selectedProfile,
        getUsers: () => loadedUsers.slice(),
        isAdmin: hasAdminRole,
        saveSelectedModule: module => {
            const profile = selectedProfile();
            if (profile && profile.modules && profile.modules[module]) saveAdminModule(module, profile.modules[module]);
        },
        toggleCurriculum: courseId => {
            const profile = selectedProfile();
            if (!hasAdminRole() || !profile || !profile.modules) return;
            const progress = profile.modules.curriculum || (profile.modules.curriculum = {});
            const careerId = progress.__careerId || 'ingenieria-civil-en-informatica-y-telecomunicaciones';
            const key = `${careerId}:${String(courseId || '')}`;
            progress[key] = ((Number(progress[key]) || 0) + 1) % 3;
            const content = document.querySelector('#tab-progreso .public-profile-content[data-module="curriculum"]');
            if (content && typeof window.renderMallaPublica === 'function') window.renderMallaPublica(content, progress, { editable: true });
        }
    };
    window.cargarHorariosComunidad = loadSharedInformation;
    document.addEventListener('portal:section-entered', event => {
        if (!sections.some(section => section.id === event.detail.panelId) || !selectedUserId || hasAdminRole()) return;
        applySelection('');
    });
    document.addEventListener('portal:auth-changed', loadSharedInformation);
    document.addEventListener('portal:personal-store-ready', loadSharedInformation);
    document.addEventListener('DOMContentLoaded', () => {
        installToolbars();
        installInlineDirectory();
        if (window.PortalAuth && window.PortalAuth.user) loadSharedInformation();
    });
})();

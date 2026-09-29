(function () {
    let loadInProgress = false;
    let reloadPending = false;
    let activeAuthUserId = '';
    let loadedUsers = [];
    let selectedUserId = '';
    let selectedProfileRecord = null;
    let serverDirectoryMode = false;
    let profileSearchHasMore = false;
    let profileSearchOffset = 0;
    let visibleProfilePage = 0;
    let profileSearchError = '';
    let profileSearchTimer = null;
    let profileSearchRequest = 0;
    let selectionRequest = 0;
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
        return `${Array.from(words[0])[0]}${Array.from(words[words.length - 1])[0]}`.toUpperCase();
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
        return `<button class="public-profile-option${selected ? ' is-selected' : ''}" type="button" role="option" aria-selected="${selected}" data-profile-id="${escapeHtml(id)}"><span class="public-profile-option-avatar${isCurrent ? ' is-own' : ''}" aria-hidden="true">${escapeHtml(initials(name))}</span><span class="public-profile-option-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(subtitle)}</small></span>${selected ? '<svg class="public-profile-option-check" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</button>`;
    }

    function normalizeSearch(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
    }

    function renderProfileMenu(query = '', loading = false) {
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
        const listContent = `${profileChoice(null, true)}${visible.map(user => profileChoice(user)).join('')}${!visible.length && !loading ? '<div class="public-profile-search-empty">No encontramos perfiles con ese nombre.</div>' : ''}`;
        const hasPrevious = visibleProfilePage > 0;
        const hasNext = matches.length > pageStart + visible.length || profileSearchHasMore;
        const pagination = hasPrevious || hasNext ? `<div class="public-profile-pagination">${hasPrevious ? '<button class="public-profile-page" data-direction="previous" type="button">Anterior</button>' : '<span></span>'}${hasNext ? '<button class="public-profile-page" data-direction="next" type="button">Siguiente</button>' : ''}</div>` : '';
        return `<div class="public-profile-menu-heading"><span>Cambiar perfil</span><span>${escapeHtml(countLabel)}</span></div><label class="public-profile-search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 4 4"></path></svg><input class="public-profile-search-input" type="search" autocomplete="off" placeholder="Buscar por nombre" aria-label="Buscar perfiles por nombre" value="${escapeHtml(query)}"></label><div class="public-profile-result-count" aria-live="polite">${escapeHtml(resultLabel)}</div><div class="public-profile-menu-options" role="listbox" aria-label="Perfiles">${listContent}</div>${pagination}`;
    }

    function pickerMarkup() {
        return `<div class="public-profile-picker"><button class="public-profile-trigger" type="button" aria-haspopup="dialog" aria-expanded="false"><span class="public-profile-trigger-avatar" aria-hidden="true"></span><span class="public-profile-trigger-copy"><small>Viendo</small><strong></strong></span><svg class="public-profile-trigger-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="public-profile-menu" role="dialog" aria-label="Cambiar perfil" hidden></div></div>`;
    }

    function wirePicker(toolbar) {
        const trigger = toolbar.querySelector('.public-profile-trigger');
        const menu = toolbar.querySelector('.public-profile-menu');
        if (!trigger || !menu) return;
        trigger.addEventListener('click', () => {
            const opening = trigger.getAttribute('aria-expanded') !== 'true';
            closeProfileMenus();
            trigger.setAttribute('aria-expanded', String(opening));
            menu.hidden = !opening;
            if (opening) {
                visibleProfilePage = 0;
                menu.innerHTML = renderProfileMenu('', serverDirectoryMode);
                menu.querySelector('.public-profile-search-input').focus();
                if (serverDirectoryMode) searchProfileDirectory('', menu, false);
            }
        });
        menu.addEventListener('input', event => {
            if (!event.target.matches('.public-profile-search-input')) return;
            const query = event.target.value;
            const caret = event.target.selectionStart;
            visibleProfilePage = 0;
            if (profileSearchTimer) clearTimeout(profileSearchTimer);
            if (serverDirectoryMode) {
                menu.innerHTML = renderProfileMenu(query, true);
                const input = menu.querySelector('.public-profile-search-input');
                input.focus();
                input.setSelectionRange(caret, caret);
                profileSearchTimer = setTimeout(() => searchProfileDirectory(query, menu, false), 220);
            } else {
                menu.innerHTML = renderProfileMenu(query);
                const input = menu.querySelector('.public-profile-search-input');
                input.focus();
                input.setSelectionRange(caret, caret);
            }
        });
        menu.addEventListener('click', event => {
            const pageButton = event.target.closest('.public-profile-page');
            if (pageButton) {
                event.preventDefault();
                event.stopPropagation();
                changeProfilePage(menu, pageButton.dataset.direction);
                return;
            }
            const option = event.target.closest('.public-profile-option');
            if (!option) return;
            applySelection(option.dataset.profileId || '');
            closeProfileMenus();
            trigger.focus();
        });
        menu.addEventListener('keydown', event => {
            if (event.key === 'Escape') { closeProfileMenus(); trigger.focus(); }
            if (event.key === 'ArrowDown' && event.target.matches('.public-profile-search-input')) {
                event.preventDefault();
                const firstOption = menu.querySelector('.public-profile-option');
                if (firstOption) firstOption.focus();
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                const options = [...menu.querySelectorAll('.public-profile-option')];
                const index = options.indexOf(document.activeElement);
                if (index < 0) return;
                event.preventDefault();
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                const nextOption = options[(index + delta + options.length) % options.length];
                if (nextOption) nextOption.focus();
            }
        });
    }

    async function searchProfileDirectory(query, menu, append) {
        const auth = window.PortalAuth;
        if (!auth || !auth.client || !serverDirectoryMode) return false;
        const request = ++profileSearchRequest;
        const offset = append ? profileSearchOffset : 0;
        profileSearchError = '';
        let response;
        try {
            response = await auth.client.rpc('search_shared_profiles', {
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
            if (menu && !menu.hidden) {
                const input = menu.querySelector('.public-profile-search-input');
                const currentQuery = input ? input.value : query;
                menu.innerHTML = renderProfileMenu(currentQuery);
                const newInput = menu.querySelector('.public-profile-search-input');
                if (newInput) { newInput.focus(); newInput.setSelectionRange(currentQuery.length, currentQuery.length); }
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
        if (menu && !menu.hidden) {
            const input = menu.querySelector('.public-profile-search-input');
            const currentQuery = input ? input.value : query;
            menu.innerHTML = renderProfileMenu(currentQuery);
            const newInput = menu.querySelector('.public-profile-search-input');
            if (newInput) { newInput.focus(); newInput.setSelectionRange(currentQuery.length, currentQuery.length); }
        }
        syncSelectors();
        return true;
    }

    function changeProfilePage(menu, direction) {
        const input = menu.querySelector('.public-profile-search-input');
        const query = input ? input.value : '';
        const matches = loadedUsers.filter(user => normalizeSearch(user.display_name || '').includes(normalizeSearch(query)));
        if (direction === 'previous') {
            visibleProfilePage = Math.max(0, visibleProfilePage - 1);
            menu.innerHTML = renderProfileMenu(query);
            menu.querySelector('.public-profile-search-input').focus();
            return;
        }
        const nextPageStart = (visibleProfilePage + 1) * MAX_VISIBLE_PROFILES;
        if (nextPageStart < matches.length) {
            visibleProfilePage += 1;
            menu.innerHTML = renderProfileMenu(query);
            menu.querySelector('.public-profile-search-input').focus();
        } else if (serverDirectoryMode && profileSearchHasMore) {
            menu.innerHTML = renderProfileMenu(query, true);
            searchProfileDirectory(query, menu, true).then(success => {
                if (success) visibleProfilePage += 1;
                menu.innerHTML = renderProfileMenu(query);
                const newInput = menu.querySelector('.public-profile-search-input');
                if (newInput) newInput.focus();
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
            response = await auth.client.rpc('get_shared_profile_information', { p_user_id: id });
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
            if (config.module === 'curriculum') {
                toolbar.classList.add('public-profile-toolbar--malla');
                toolbar.innerHTML = `<div class="public-profile-toolbar-copy"><span>Tu espacio</span><strong>Malla curricular</strong></div>${pickerMarkup()}`;
                wirePicker(toolbar);
            } else if (config.module === 'agenda') {
                toolbar.classList.add('public-profile-toolbar--compact');
                toolbar.innerHTML = pickerMarkup();
                wirePicker(toolbar);
            } else {
                toolbar.innerHTML = `<div class="public-profile-toolbar-copy"><span>Información de</span><strong>${config.label}</strong></div>${pickerMarkup()}`;
                wirePicker(toolbar);
            }
            section.insertBefore(toolbar, section.firstChild);
            if (!config.native) {
                const content = document.createElement('div');
                content.className = 'public-profile-content';
                content.dataset.module = config.module;
                content.hidden = true;
                section.insertBefore(content, toolbar.nextSibling);
            }
        });
        syncSelectors();
    }

    function syncSelectors() {
        const profile = selectedProfile();
        const name = profile ? (profile.display_name || 'Estudiante') : ownDisplayName();
        document.querySelectorAll('.public-profile-picker').forEach(picker => {
            const trigger = picker.querySelector('.public-profile-trigger');
            const menu = picker.querySelector('.public-profile-menu');
            if (trigger) {
                trigger.querySelector('.public-profile-trigger-avatar').textContent = initials(name);
                trigger.querySelector('.public-profile-trigger-copy strong').textContent = name;
                trigger.querySelector('.public-profile-trigger-copy small').textContent = profile ? 'Perfil compartido' : 'Tu perfil';
                trigger.setAttribute('aria-label', profile ? `Viendo el perfil de ${name}. Cambiar persona` : `Viendo tu perfil, ${name}. Cambiar persona`);
            }
        });
    }

    function closeProfileMenus() {
        document.querySelectorAll('.public-profile-picker').forEach(picker => {
            const trigger = picker.querySelector('.public-profile-trigger');
            const menu = picker.querySelector('.public-profile-menu');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
            if (menu) menu.hidden = true;
        });
    }

    document.addEventListener('click', event => {
        if (!event.target.closest('.public-profile-picker')) closeProfileMenus();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeProfileMenus();
    });

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
            if (section) section.classList.toggle('public-profile-active', Boolean(profile));
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
            const directory = await auth.client.rpc('search_shared_profiles', {
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
        getUsers: () => loadedUsers.slice()
    };
    window.cargarHorariosComunidad = loadSharedInformation;
    document.addEventListener('portal:auth-changed', loadSharedInformation);
    document.addEventListener('portal:personal-store-ready', loadSharedInformation);
    document.addEventListener('DOMContentLoaded', () => {
        installToolbars();
        if (window.PortalAuth && window.PortalAuth.user) loadSharedInformation();
    });
})();

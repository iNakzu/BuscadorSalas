(function () {
    let loadInProgress = false;
    let reloadPending = false;
    let loadedUsers = [];
    let selectedUserId = '';
    let applyingSelection = false;

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
        return loadedUsers.find(item => String(item.user_id || '') === selectedUserId) || null;
    }

    function shortName(name) {
        const words = String(name || 'Estudiante').trim().split(/\s+/).filter(Boolean);
        return words.length > 1 ? `${words[0]} ${words[words.length - 1]}` : (words[0] || 'Estudiante');
    }

    function renderUser(user) {
        const name = user.display_name || 'Estudiante';
        const modules = modulesFor(user);
        const classes = cleanClasses(modules.schedule);
        const agenda = Array.isArray(modules.agenda) ? modules.agenda : [];
        const searchText = `${name} ${classes.map(item => `${item.curso || ''} ${item.sala || ''}`).join(' ')} ${agenda.map(item => item.ramo || '').join(' ')}`.toLocaleLowerCase('es');
        const selected = String(user.user_id || '') === selectedUserId;
        return `<article class="community-user-card" data-user-id="${escapeHtml(user.user_id || '')}" data-search="${escapeHtml(searchText)}">
          <div class="community-user-header"><div class="community-user-identity"><span class="community-avatar" aria-hidden="true">${escapeHtml(initials(name))}</span><h3><span class="community-name-full">${escapeHtml(name)}</span><span class="community-name-first">${escapeHtml(shortName(name))}</span></h3></div><button class="community-view-schedule" type="button" aria-label="Ver información de ${escapeHtml(name)}" aria-expanded="${selected}" onclick="verInformacionPublica(this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span class="community-view-label">${selected ? 'Viendo información' : 'Ver información'}</span></button></div>
        </article>`;
    }

    function selectorOptions() {
        return `<option value="">Mi información</option>${loadedUsers.map(user =>
            `<option value="${escapeHtml(user.user_id || '')}">${escapeHtml(user.display_name || 'Estudiante')}</option>`
        ).join('')}`;
    }

    function installToolbars() {
        sections.forEach(config => {
            const section = document.getElementById(config.id);
            if (!section || section.querySelector('.public-profile-toolbar')) return;
            const toolbar = document.createElement('div');
            toolbar.className = 'public-profile-toolbar';
            toolbar.dataset.module = config.module;
            toolbar.innerHTML = `<div class="public-profile-toolbar-copy"><span>Información de</span><strong>${config.label}</strong></div><label><span class="sr-only">Persona</span><select class="public-profile-select" aria-label="Elegir persona" onchange="PortalCommunity.select(this.value)">${selectorOptions()}</select></label>`;
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
        document.querySelectorAll('.public-profile-select').forEach(select => {
            select.innerHTML = selectorOptions();
            select.value = loadedUsers.some(user => String(user.user_id) === selectedUserId) ? selectedUserId : '';
        });
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
            if (module === 'grades') content.innerHTML = renderGrades(modules.grades);
            if (module === 'agenda') content.innerHTML = renderAgenda(modules.agenda);
            if (module === 'curriculum') {
                if (typeof window.renderMallaPublica === 'function') window.renderMallaPublica(content, renderCurriculum(modules.curriculum));
                else content.innerHTML = emptyState('No se pudo cargar la malla curricular.');
            }
        });
    }

    function applySelection(userId) {
        const previous = selectedUserId;
        selectedUserId = loadedUsers.some(user => String(user.user_id || '') === String(userId || '')) ? String(userId) : '';
        const profile = selectedProfile();
        syncSelectors();
        sections.forEach(config => {
            const section = document.getElementById(config.id);
            if (section) section.classList.toggle('public-profile-active', Boolean(profile));
        });
        renderGenericViews(profile);

        applyingSelection = true;
        try {
            if (profile && typeof window.mostrarHorarioAmigoEnMiHorario === 'function') {
                window.mostrarHorarioAmigoEnMiHorario({ nombre: profile.display_name || 'Estudiante', clases: cleanClasses(modulesFor(profile).schedule) });
            } else if (previous && typeof window.cerrarComparacionHorario === 'function') {
                window.cerrarComparacionHorario();
            }
            if (typeof window.renderSolemnes === 'function') window.renderSolemnes();
        } finally {
            applyingSelection = false;
        }

        document.querySelectorAll('.community-view-schedule').forEach(button => {
            const card = button.closest('.community-user-card');
            const active = Boolean(card && card.dataset.userId === selectedUserId);
            button.setAttribute('aria-expanded', String(active));
            const label = button.querySelector('.community-view-label');
            if (label) label.textContent = active ? 'Viendo información' : 'Ver información';
        });
        if (document.dispatchEvent && typeof CustomEvent !== 'undefined') {
            document.dispatchEvent(new CustomEvent('portal:public-profile-changed', { detail: { profile } }));
        }
    }

    window.verInformacionPublica = function (button) {
        const card = button && button.closest('.community-user-card');
        if (card) applySelection(card.dataset.userId);
    };
    window.verHorarioAmigo = window.verInformacionPublica;

    function filterSchedules(value) {
        const query = String(value || '').trim().toLocaleLowerCase('es');
        document.querySelectorAll('.community-user-card').forEach(card => {
            card.hidden = Boolean(query) && !card.dataset.search.includes(query);
        });
    }
    window.filtrarHorariosComunidad = filterSchedules;

    function renderDirectory() {
        const list = document.getElementById('community-schedules-list');
        if (!list) return;
        list.innerHTML = loadedUsers.map(renderUser).join('');
        const search = document.getElementById('community-schedules-search');
        filterSchedules(search ? search.value : '');
        syncSelectors();
    }

    async function loadSharedInformation() {
        const auth = window.PortalAuth;
        const status = document.getElementById('community-schedules-status');
        const list = document.getElementById('community-schedules-list');
        if (!status || !list || !auth || !auth.user || !auth.client) return;
        if (loadInProgress) { reloadPending = true; return; }
        loadInProgress = true;
        status.hidden = false;
        status.textContent = 'Cargando información compartida...';
        try {
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
            if (selectedUserId && !loadedUsers.some(user => String(user.user_id) === selectedUserId)) applySelection('');
            renderDirectory();
            status.textContent = legacyMode
                ? 'Aplica la nueva migración de Supabase para compartir notas, agenda y malla.'
                : loadedUsers.length
                ? `${loadedUsers.length} usuario${loadedUsers.length === 1 ? '' : 's'} comparte${loadedUsers.length === 1 ? '' : 'n'} su información.`
                : 'Todavía no hay información compartida por otros usuarios.';
        } catch (error) {
            console.error('No se pudo cargar la información compartida', error);
            loadedUsers = [];
            list.innerHTML = '';
            syncSelectors();
            status.textContent = 'La información compartida estará disponible al aplicar la migración de Supabase.';
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
    document.addEventListener('portal:community-schedule-closed', () => {
        if (!applyingSelection && selectedUserId) applySelection('');
    });
    document.addEventListener('portal:auth-changed', loadSharedInformation);
    document.addEventListener('portal:personal-store-ready', loadSharedInformation);
    document.addEventListener('DOMContentLoaded', () => {
        installToolbars();
        if (window.PortalAuth && window.PortalAuth.user) loadSharedInformation();
    });
})();

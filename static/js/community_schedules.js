(function () {
    let loadInProgress = false;
    let reloadPending = false;
    let loadedUsers = [];

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
        return Array.isArray(classes) ? classes.filter(item => item && Number(item.dia) >= 1 && Number(item.dia) <= 5) : [];
    }

    function renderUser(user) {
        const name = user.display_name || 'Estudiante';
        const nameParts = String(name).trim().split(/\s+/).filter(Boolean);
        const shortName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}` : (nameParts[0] || 'Estudiante');
        const classes = cleanClasses(user.payload);
        const searchText = `${name} ${classes.map(item => `${item.curso || ''} ${item.sala || ''}`).join(' ')}`.toLocaleLowerCase('es');
        return `<article class="community-user-card" data-user-id="${escapeHtml(user.user_id || '')}" data-search="${escapeHtml(searchText)}">
          <div class="community-user-header"><div class="community-user-identity"><span class="community-avatar" aria-hidden="true">${escapeHtml(initials(name))}</span><h3><span class="community-name-full">${escapeHtml(name)}</span><span class="community-name-first">${escapeHtml(shortName)}</span></h3></div><button class="community-view-schedule" type="button" aria-label="Ver horario de ${escapeHtml(name)}" aria-expanded="false" onclick="verHorarioAmigo(this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span class="community-view-label">Ver horario</span></button></div>
        </article>`;
    }

    window.verHorarioAmigo = function (button) {
        const card = button && button.closest('.community-user-card');
        if (!card) return;
        const user = loadedUsers.find(item => String(item.user_id || '') === card.dataset.userId);
        if (!user || typeof window.mostrarHorarioAmigoEnMiHorario !== 'function') return;
        const name = user.display_name || 'Estudiante';
        window.mostrarHorarioAmigoEnMiHorario({ nombre: name, clases: cleanClasses(user.payload) });
        document.querySelectorAll('.community-view-schedule').forEach(item => {
            item.setAttribute('aria-expanded', String(item === button));
        });
        button.setAttribute('aria-label', `Viendo horario de ${name}`);
        const label = button.querySelector('.community-view-label');
        if (label) label.textContent = 'Viendo horario';
    };

    function filterSchedules(value) {
        const query = String(value || '').trim().toLocaleLowerCase('es');
        document.querySelectorAll('.community-user-card').forEach(card => {
            card.hidden = Boolean(query) && !card.dataset.search.includes(query);
        });
    }

    window.filtrarHorariosComunidad = filterSchedules;

    async function loadSharedSchedules() {
        const auth = window.PortalAuth;
        const status = document.getElementById('community-schedules-status');
        const list = document.getElementById('community-schedules-list');
        if (!status || !list || !auth || !auth.user || !auth.client) return;
        if (loadInProgress) { reloadPending = true; return; }
        loadInProgress = true;
        status.hidden = false;
        status.textContent = 'Cargando horarios compartidos...';
        try {
            const { data: users, error } = await auth.client.rpc('get_shared_schedules');
            if (error) throw error;
            loadedUsers = users || [];
            list.innerHTML = loadedUsers.map(renderUser).join('');
            const search = document.getElementById('community-schedules-search');
            filterSchedules(search ? search.value : '');
            status.textContent = loadedUsers.length
                ? `${loadedUsers.length} usuario${loadedUsers.length === 1 ? '' : 's'} comparte${loadedUsers.length === 1 ? '' : 'n'} su horario.`
                : 'Todavía no hay otros horarios compartidos.';
        } catch (error) {
            console.error('No se pudieron cargar los horarios compartidos', error);
            list.innerHTML = '';
            status.textContent = 'Los horarios compartidos estarán disponibles cuando se configure la base de datos de Supabase.';
        } finally {
            loadInProgress = false;
            if (reloadPending) {
                reloadPending = false;
                loadSharedSchedules();
            }
        }
    }

    window.cargarHorariosComunidad = loadSharedSchedules;
    document.addEventListener('portal:auth-changed', loadSharedSchedules);
    document.addEventListener('portal:personal-store-ready', loadSharedSchedules);
    document.addEventListener('DOMContentLoaded', () => {
        if (window.PortalAuth && window.PortalAuth.user) loadSharedSchedules();
    });
})();

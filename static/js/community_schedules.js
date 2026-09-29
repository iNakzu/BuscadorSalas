(function () {
    const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    let loadInProgress = false;
    let reloadPending = false;

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

    function toMinutes(value) {
        const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
        return match ? Number(match[1]) * 60 + Number(match[2]) : null;
    }

    function formatTime(minutes) {
        return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    }

    function cleanClasses(payload) {
        const classes = Array.isArray(payload) ? payload : payload && payload.clases;
        return Array.isArray(classes) ? classes.filter(item => item && Number(item.dia) >= 1 && Number(item.dia) <= 5) : [];
    }

    function renderUser(user) {
        const name = user.display_name || 'Estudiante';
        const firstName = String(name).trim().split(/\s+/)[0] || 'Estudiante';
        const classes = cleanClasses(user.payload).slice().sort((a, b) =>
            Number(a.dia) - Number(b.dia) || (toMinutes(a.horaInicio) || 0) - (toMinutes(b.horaInicio) || 0)
        );
        let dayHtml = '';
        for (let day = 1; day <= 5; day += 1) {
            const dayClasses = classes.filter(item => Number(item.dia) === day);
            if (!dayClasses.length) continue;
            const classHtml = dayClasses.map(item => {
                const course = escapeHtml(item.curso || item.nombre || 'Clase');
                const room = escapeHtml(item.sala || 'Sala no indicada');
                const start = escapeHtml(item.horaInicio || '');
                const end = escapeHtml(item.horaFin || '');
                return `<div class="community-class"><strong>${course}</strong><span>${start}${end ? `–${end}` : ''} · ${room}</span></div>`;
            }).join('');
            const windows = [];
            for (let i = 0; i < dayClasses.length - 1; i += 1) {
                const end = toMinutes(dayClasses[i].horaFin);
                const nextStart = toMinutes(dayClasses[i + 1].horaInicio);
                if (end !== null && nextStart !== null && nextStart - end >= 20) {
                    windows.push(`${formatTime(end)}–${formatTime(nextStart)}`);
                }
            }
            const windowsHtml = windows.length
                ? `<p class="community-windows"><span>Ventanas:</span> ${windows.map(escapeHtml).join(' · ')}</p>`
                : '';
            dayHtml += `<section class="community-day"><h4>${days[day]}</h4>${classHtml}${windowsHtml}</section>`;
        }
        const scheduleHtml = dayHtml || '<p class="community-empty-schedule">Todavía no ha agregado clases a su horario.</p>';
        const searchText = `${name} ${classes.map(item => `${item.curso || ''} ${item.sala || ''}`).join(' ')}`.toLocaleLowerCase('es');
        return `<article class="community-user-card" data-search="${escapeHtml(searchText)}">
          <header class="community-user-header"><div class="community-user-identity"><span class="community-avatar" aria-hidden="true">${escapeHtml(initials(name))}</span><h3><span class="community-name-full">${escapeHtml(name)}</span><span class="community-name-first">${escapeHtml(firstName)}</span></h3></div><button class="community-view-schedule" type="button" aria-label="Ver horario de ${escapeHtml(name)}" aria-expanded="false" onclick="verHorarioAmigo(this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span class="community-view-label">Ver horario</span></button></header>
          <div class="community-week" hidden>${scheduleHtml}</div>
        </article>`;
    }

    window.verHorarioAmigo = function (button) {
        const card = button && button.closest('.community-user-card');
        const schedule = card && card.querySelector('.community-week');
        if (!schedule) return;
        schedule.hidden = !schedule.hidden;
        button.setAttribute('aria-expanded', String(!schedule.hidden));
        button.setAttribute('aria-label', `${schedule.hidden ? 'Ver' : 'Ocultar'} horario de ${card.querySelector('.community-name-full').textContent}`);
        const label = button.querySelector('.community-view-label');
        if (label) label.textContent = schedule.hidden ? 'Ver horario' : 'Ocultar horario';
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
            list.innerHTML = (users || []).map(renderUser).join('');
            const search = document.getElementById('community-schedules-search');
            filterSchedules(search ? search.value : '');
            status.textContent = (users || []).length
                ? `${users.length} usuario${users.length === 1 ? '' : 's'} comparte${users.length === 1 ? '' : 'n'} su horario.`
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

(function () {
    const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
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

    function chileNow() {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/Santiago', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(new Date());
        const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
        const day = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 }[values.weekday] || 0;
        return { day, minutes: Number(values.hour) * 60 + Number(values.minute) };
    }

    function currentScheduleStatus(classes) {
        const now = chileNow();
        if (!now.day) return 'Sin clases programadas hoy';
        const today = classes.filter(item => Number(item.dia) === now.day)
            .slice().sort((a, b) => (toMinutes(a.horaInicio) || 0) - (toMinutes(b.horaInicio) || 0));
        if (!today.length) return 'Sin clases programadas hoy';
        for (let i = 0; i < today.length; i += 1) {
            const start = toMinutes(today[i].horaInicio);
            const end = toMinutes(today[i].horaFin);
            if (start === null || end === null) continue;
            if (now.minutes < start) {
                if (i > 0) {
                    const previousEnd = toMinutes(today[i - 1].horaFin);
                    if (previousEnd !== null && now.minutes >= previousEnd) return `En ventana hasta ${formatTime(start)}`;
                }
                return `Próxima clase ${formatTime(start)} · ${today[i].curso || 'Clase'}`;
            }
            if (now.minutes < end) {
                const room = today[i].sala ? ` · sala ${today[i].sala}` : '';
                return `En clase${room} (hasta ${formatTime(end)})`;
            }
        }
        return 'Sin más clases hoy';
    }

    function updateCurrentStatuses() {
        document.querySelectorAll('.community-current-status').forEach(element => {
            const user = loadedUsers.find(item => item.user_id === element.dataset.userId);
            if (user) element.textContent = `Según el horario de hoy: ${currentScheduleStatus(cleanClasses(user.payload))}`;
        });
    }

    function renderUser(user) {
        const name = user.display_name || 'Estudiante';
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
          <header class="community-user-header"><span class="community-avatar" aria-hidden="true">${escapeHtml(initials(name))}</span><h3>${escapeHtml(name)}</h3></header>
          <p class="community-current-status" data-user-id="${escapeHtml(user.user_id)}">Según el horario de hoy: ${escapeHtml(currentScheduleStatus(classes))}</p>
          <div class="community-week">${scheduleHtml}</div>
        </article>`;
    }

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
    if (typeof window.setInterval === 'function') window.setInterval(updateCurrentStatuses, 60000);
    document.addEventListener('DOMContentLoaded', () => {
        if (window.PortalAuth && window.PortalAuth.user) loadSharedSchedules();
    });
})();

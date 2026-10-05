(function () {
    const careerInput = document.getElementById('profile-career-input');
    const careerMenu = document.getElementById('profile-career-options');
    const careerToggle = document.getElementById('profile-career-toggle');
    const careerSave = document.getElementById('profile-career-save');
    const sharingToggle = document.getElementById('profile-sharing-toggle');
    const sharingStatus = document.getElementById('profile-sharing-status');
    const feedback = document.getElementById('profile-feedback');
    const MAX_OPTIONS = 30;
    let careers = [];
    let menuOptions = [];
    let activeOption = -1;

    if (!careerInput || !careerMenu || !careerToggle || !careerSave || !sharingToggle) return;

    function auth() { return window.PortalAuth; }
    function normalize(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
    }
    function setFeedback(message, state = '') {
        feedback.textContent = message || '';
        feedback.dataset.state = state;
    }
    function setCareerMenuOpen(open) {
        careerMenu.hidden = !open;
        careerInput.setAttribute('aria-expanded', String(open));
        careerToggle.setAttribute('aria-expanded', String(open));
        careerToggle.classList.toggle('is-open', open);
        document.getElementById('profile-career-combobox').classList.toggle('is-open', open);
        if (!open) {
            activeOption = -1;
            careerInput.removeAttribute('aria-activedescendant');
        }
    }
    function renderCareerOptions() {
        const query = normalize(careerInput.value);
        const matches = careers.filter(item => !query || normalize(`${item.name} ${item.faculty}`).includes(query)).slice(0, MAX_OPTIONS);
        careerMenu.replaceChildren();
        menuOptions = [];
        activeOption = -1;
        matches.forEach((item, index) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'profile-combobox-option';
            option.id = `profile-career-option-${index}`;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', 'false');
            const name = document.createElement('strong');
            name.textContent = item.name;
            const faculty = document.createElement('small');
            faculty.textContent = item.faculty;
            option.append(name, faculty);
            option.addEventListener('click', () => {
                careerInput.value = item.name;
                setCareerMenuOpen(false);
                careerInput.focus();
            });
            careerMenu.appendChild(option);
            menuOptions.push(option);
        });
        if (!matches.length) {
            const empty = document.createElement('p');
            empty.className = 'profile-combobox-empty';
            empty.textContent = careerInput.value.trim() ? 'No aparece en la lista. Puedes guardar el texto que escribiste.' : 'Escribe para buscar una carrera.';
            careerMenu.appendChild(empty);
        }
    }
    async function loadCareers() {
        try {
            const response = await fetch('/static/data/udp-careers.json', { cache: 'force-cache', credentials: 'same-origin' });
            if (!response.ok) throw new Error('No se pudo cargar el catálogo.');
            const result = await response.json();
            careers = Array.isArray(result)
                ? result.filter(item => item && typeof item.name === 'string' && typeof item.faculty === 'string'
                    && normalize(item.name).startsWith('ingenieria civil'))
                : [];
        } catch (_) {
            careers = [];
        }
    }
    async function load() {
        const currentAuth = auth();
        const user = currentAuth && currentAuth.user;
        if (!user) return;
        const metadata = user.user_metadata || {};
        careerInput.value = typeof metadata.career === 'string' ? metadata.career : '';
        const name = [metadata.given_name, metadata.family_name].filter(Boolean).join(' ').trim()
            || String(metadata.full_name || metadata.name || user.email || 'Estudiante');
        const avatarWords = name.split(/\s+/).filter(Boolean);
        const firstSurname = avatarWords.length >= 3 ? avatarWords[avatarWords.length - 2] : avatarWords[1];
        const initials = avatarWords.length > 1
            ? `${Array.from(avatarWords[0])[0]}${Array.from(firstSurname)[0]}`
            : Array.from(avatarWords[0] || 'ES').slice(0, 2).join('');
        document.getElementById('profile-hero-name').textContent = name;
        document.getElementById('profile-hero-email').textContent = user.email || '';
        document.getElementById('profile-hero-avatar').textContent = initials.toLocaleUpperCase('es');
        sharingToggle.disabled = true;
        sharingStatus.textContent = 'Cargando privacidad…';
        try {
            const { data, error } = await currentAuth.client.from('profiles')
                .select('share_information').eq('id', user.id).maybeSingle();
            if (error) throw error;
            sharingToggle.checked = Boolean(data && data.share_information);
            sharingStatus.textContent = sharingToggle.checked
                ? 'Tu información académica está visible para las cuentas registradas.'
                : 'Tu información académica está oculta para la comunidad.';
            sharingStatus.dataset.state = 'ready';
        } catch (error) {
            console.warn('No se pudo cargar la preferencia de privacidad del perfil.');
            sharingStatus.textContent = 'No se pudo cargar esta preferencia. Inténtalo de nuevo.';
            sharingStatus.dataset.state = 'error';
        } finally {
            sharingToggle.disabled = false;
        }
    }
    async function saveCareer() {
        const currentAuth = auth();
        if (!currentAuth || !currentAuth.user) return;
        const career = careerInput.value.trim().slice(0, 120);
        careerSave.disabled = true;
        setFeedback('Guardando carrera…');
        try {
            await currentAuth.updateUserMetadata({ career: career || null });
            setFeedback(career ? 'Carrera guardada en tu perfil.' : 'Carrera eliminada de tu perfil.', 'success');
        } catch (error) {
            console.error('No se pudo guardar la carrera del perfil.', error);
            setFeedback('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.', 'error');
        } finally {
            careerSave.disabled = false;
        }
    }
    async function saveSharing() {
        const currentAuth = auth();
        if (!currentAuth || !currentAuth.user || sharingToggle.disabled) return;
        const nextValue = sharingToggle.checked;
        sharingToggle.disabled = true;
        sharingStatus.textContent = 'Guardando preferencia…';
        try {
            const { data, error } = await currentAuth.client.from('profiles')
                .update({ share_information: nextValue }).eq('id', currentAuth.user.id).select('id').maybeSingle();
            if (error) throw error;
            if (!data) throw new Error('No se encontró el perfil de tu cuenta.');
            sharingStatus.textContent = nextValue
                ? 'Tu información académica está visible para las cuentas registradas.'
                : 'Tu información académica está oculta para la comunidad.';
            sharingStatus.dataset.state = 'ready';
            document.dispatchEvent(new CustomEvent('portal:profile-sharing-changed', { detail: { shareInformation: nextValue } }));
        } catch (error) {
            sharingToggle.checked = !nextValue;
            sharingStatus.textContent = 'No se pudo guardar. Inténtalo de nuevo.';
            sharingStatus.dataset.state = 'error';
            console.error('No se pudo guardar la privacidad del perfil.', error);
        } finally {
            sharingToggle.disabled = false;
        }
    }

    careerInput.addEventListener('focus', () => { renderCareerOptions(); setCareerMenuOpen(true); });
    careerInput.addEventListener('input', () => { renderCareerOptions(); setCareerMenuOpen(true); });
    careerInput.addEventListener('keydown', event => {
        if (event.key === 'Escape') { setCareerMenuOpen(false); return; }
        if (event.key === 'ArrowDown' && menuOptions.length) {
            event.preventDefault();
            activeOption = (activeOption + 1) % menuOptions.length;
        } else if (event.key === 'ArrowUp' && menuOptions.length) {
            event.preventDefault();
            activeOption = (activeOption - 1 + menuOptions.length) % menuOptions.length;
        } else if (event.key === 'Enter' && activeOption >= 0 && menuOptions[activeOption]) {
            event.preventDefault();
            menuOptions[activeOption].click();
            return;
        } else return;
        menuOptions.forEach((option, index) => option.setAttribute('aria-selected', String(index === activeOption)));
        const active = menuOptions[activeOption];
        if (active) {
            careerInput.setAttribute('aria-activedescendant', active.id);
            active.scrollIntoView({ block: 'nearest' });
        }
    });
    careerToggle.addEventListener('click', () => {
        const opening = careerMenu.hidden;
        if (opening) { renderCareerOptions(); careerInput.focus(); }
        setCareerMenuOpen(opening);
    });
    careerSave.addEventListener('click', saveCareer);
    sharingToggle.addEventListener('change', saveSharing);
    document.addEventListener('click', event => {
        if (!event.target.closest('#profile-career-combobox')) setCareerMenuOpen(false);
    });
    document.addEventListener('portal:auth-changed', () => load());
    document.addEventListener('DOMContentLoaded', async () => { await loadCareers(); await load(); });
    window.PortalProfile = { load };
})();

(function () {
    const careerInput = document.getElementById('profile-career-input');
    const careerMenu = document.getElementById('profile-career-options');
    const careerToggle = document.getElementById('profile-career-toggle');
    const careerSave = document.getElementById('profile-career-save');
    const careerSaveLabel = careerSave && careerSave.querySelector('.profile-primary-button-label');
    const careerSaveCheck = careerSave && careerSave.querySelector('.profile-career-save-check');
    const careerSaveSpinner = careerSave && careerSave.querySelector('.profile-career-save-spinner');
    const careerSaveError = careerSave && careerSave.querySelector('.profile-career-save-error');
    const sharingToggle = document.getElementById('profile-sharing-toggle');
    const sharingStatus = document.getElementById('profile-sharing-status');
    const feedback = document.getElementById('profile-feedback');
    const MAX_OPTIONS = 30;
    let careerSaveResetTimer = 0;
    let savedCareerId = null;
    let suppressCareerFocusOpen = false;
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
    function resetCareerSaveButton() {
        careerSaveLabel.textContent = 'Guardar carrera';
        careerSave.dataset.state = '';
        careerSave.removeAttribute('aria-busy');
        careerSaveCheck.hidden = false;
        careerSaveSpinner.hidden = true;
        careerSaveError.hidden = true;
    }
    function setCareerSaveButton(message, state, resetAfter = 0) {
        if (careerSaveResetTimer) clearTimeout(careerSaveResetTimer);
        careerSaveLabel.textContent = message;
        careerSave.dataset.state = state;
        careerSave.setAttribute('aria-busy', String(state === 'loading'));
        careerSaveCheck.hidden = state === 'loading' || state === 'error';
        careerSaveSpinner.hidden = state !== 'loading';
        careerSaveError.hidden = state !== 'error';
        if (resetAfter) careerSaveResetTimer = setTimeout(resetCareerSaveButton, resetAfter);
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
    function clearSavedCareerForSearch() {
        const savedCareer = careers.find(item => item.id === savedCareerId);
        if (savedCareer && careerInput.value.trim() === savedCareer.name) careerInput.value = '';
    }
    function renderCareerOptions() {
        const query = normalize(careerInput.value);
        const matches = careers.filter(item => !query || normalize(`${item.name} ${item.faculty || ''} ${item.school || ''}`).includes(query)).slice(0, MAX_OPTIONS);
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
            faculty.textContent = item.school
                ? `${item.faculty} · ${item.school}`
                : `Plan de ${item.durationYears || 1} año · sin escuela`;
            option.append(name, faculty);
            option.addEventListener('click', () => {
                careerInput.value = item.name;
                setCareerMenuOpen(false);
                suppressCareerFocusOpen = true;
                careerInput.focus();
                queueMicrotask(() => { suppressCareerFocusOpen = false; });
            });
            careerMenu.appendChild(option);
            menuOptions.push(option);
        });
        if (!matches.length) {
            const empty = document.createElement('p');
            empty.className = 'profile-combobox-empty';
            empty.textContent = careerInput.value.trim() ? 'Selecciona una de las carreras disponibles.' : 'Escribe para buscar una carrera.';
            careerMenu.appendChild(empty);
        }
    }
    async function loadCareers() {
        try {
            const response = await fetch('/static/data/udp-careers.json?v=20261005-career-curriculum-catalog-1', { cache: 'force-cache', credentials: 'same-origin' });
            if (!response.ok) throw new Error('No se pudo cargar el catálogo.');
            const result = await response.json();
            careers = Array.isArray(result) ? result.filter(item => item && typeof item.id === 'string'
                && typeof item.name === 'string' && typeof item.curriculumFile === 'string') : [];
        } catch (_) {
            careers = [];
        }
    }
    async function load() {
        const currentAuth = auth();
        const user = currentAuth && currentAuth.user;
        if (!user) { savedCareerId = null; return; }
        const metadata = user.user_metadata || {};
        const savedCareer = careers.find(item => item.id === metadata.careerId)
            || careers.find(item => item.name === metadata.career);
        savedCareerId = savedCareer ? savedCareer.id : null;
        careerInput.value = savedCareer ? savedCareer.name : (typeof metadata.career === 'string' ? metadata.career : '');
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
        const career = careers.find(item => item.name === careerInput.value.trim());
        if (!career) {
            setCareerSaveButton('Selecciona una carrera válida', 'error', 2400);
            return;
        }
        careerSave.disabled = true;
        setCareerSaveButton('Guardando…', 'loading');
        try {
            await currentAuth.updateUserMetadata({ career: career.name, careerId: career.id });
            savedCareerId = career.id;
            setCareerSaveButton('Carrera guardada', 'success', 2000);
            document.dispatchEvent(new CustomEvent('portal:career-changed', { detail: { careerId: career.id } }));
        } catch (error) {
            console.error('No se pudo guardar la carrera del perfil.', error);
            setCareerSaveButton('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.', 'error', 3200);
        } finally {
            careerSave.disabled = false;
        }
    }

    function getCareerId() {
        const metadata = auth() && auth().user && auth().user.user_metadata || {};
        if (typeof metadata.careerId === 'string' && metadata.careerId) return metadata.careerId;
        const saved = careers.find(item => item.name === metadata.career);
        return saved ? saved.id : null;
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

    careerInput.addEventListener('focus', () => {
        if (suppressCareerFocusOpen) return;
        clearSavedCareerForSearch();
        renderCareerOptions();
        setCareerMenuOpen(true);
    });
    careerInput.addEventListener('click', () => {
        clearSavedCareerForSearch();
        renderCareerOptions();
        setCareerMenuOpen(true);
    });
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
        if (opening) {
            clearSavedCareerForSearch();
            renderCareerOptions();
            careerInput.focus();
        }
        setCareerMenuOpen(opening);
    });
    careerSave.addEventListener('click', saveCareer);
    sharingToggle.addEventListener('change', saveSharing);
    document.addEventListener('click', event => {
        if (!event.target.closest('#profile-career-combobox')) setCareerMenuOpen(false);
    });
    document.addEventListener('portal:auth-changed', () => load());
    document.addEventListener('DOMContentLoaded', async () => { await loadCareers(); await load(); });
    window.PortalProfile = { load, getCareerId, requireCareer: () => setFeedback('Selecciona y guarda tu carrera para abrir su malla.', 'error') };
})();

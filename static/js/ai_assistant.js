function assistantIsListLine(line) {
    return /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line);
}

function parseAssistantListBlock(lines, startIndex) {
    const ordered = /^\s*\d+[.)]\s+/.test(lines[startIndex] || '');
    const items = [];
    let index = startIndex;
    while (index < lines.length) {
        const line = lines[index] || '';
        if (assistantIsListLine(line)) {
            if (/^\s*\d+[.)]\s+/.test(line) !== ordered) break;
            items.push(line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, ''));
            index++;
            continue;
        }
        if (!line.trim()) {
            let next = index + 1;
            while (next < lines.length && !lines[next].trim()) next++;
            if (next < lines.length && assistantIsListLine(lines[next]) && /^\s*\d+[.)]\s+/.test(lines[next]) === ordered) {
                index = next;
                continue;
            }
        }
        break;
    }
    return { ordered, items, nextIndex: index };
}

(function () {
    const $ = (id) => document.getElementById(id);
    const toggle = $('ai-assistant-toggle');
    const panel = $('ai-chat-window');
    const area = $('ai-messages-area');
    const input = $('ai-chat-input');
    const send = $('ai-send');
    const fileInput = $('ai-file-input');
    const lightbox = $('ai-image-lightbox');
    const lightboxImage = $('ai-lightbox-img');
    if (!toggle || !panel || !area || !input || !send) return;

    let history = [];
    let image = null;
    let imageUrl = '';
    let busy = false;
    let keyboardBaselineHeight = null;

    function setOpen(open) {
        panel.hidden = !open;
        panel.setAttribute('aria-hidden', String(!open));
        toggle.setAttribute('aria-expanded', String(open));
        if (open) input.focus();
        else if (document.activeElement === input) input.blur();
        syncKeyboardLayout();
    }

    function syncKeyboardLayout() {
        if (!panel || !input) return;
        const viewport = window.visualViewport;
        const visibleHeight = viewport ? viewport.height : window.innerHeight;
        if (document.activeElement !== input || panel.hidden) {
            keyboardBaselineHeight = null;
            panel.classList.remove('ai-keyboard-open');
            panel.style.removeProperty('--ai-keyboard-panel-height');
            panel.style.removeProperty('--ai-keyboard-bottom');
            panel.style.removeProperty('--ai-keyboard-top');
            return;
        }
        if (keyboardBaselineHeight === null) keyboardBaselineHeight = window.innerHeight;
        const keyboardHeight = keyboardBaselineHeight - visibleHeight;
        if (keyboardHeight < 120) {
            panel.classList.remove('ai-keyboard-open');
            panel.style.removeProperty('--ai-keyboard-panel-height');
            panel.style.removeProperty('--ai-keyboard-bottom');
            panel.style.removeProperty('--ai-keyboard-top');
            return;
        }
        const panelHeight = Math.max(180, Math.min(720, visibleHeight * 0.88, visibleHeight - 32));
        const viewportTop = viewport ? viewport.offsetTop : 0;
        const panelTop = viewportTop + Math.max(16, (visibleHeight - panelHeight) / 2);
        panel.classList.add('ai-keyboard-open');
        panel.style.setProperty('--ai-keyboard-panel-height', `${panelHeight}px`);
        panel.style.setProperty('--ai-keyboard-top', `${panelTop}px`);
    }

    function bindHeaderAction(id, action) {
        const button = $(id);
        let touchHandled = false;
        button.addEventListener('pointerdown', event => {
            if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
            event.preventDefault();
            touchHandled = true;
            action();
            window.setTimeout(() => { touchHandled = false; }, 400);
        });
        button.addEventListener('click', event => {
            if (touchHandled) {
                event.preventDefault();
                touchHandled = false;
                return;
            }
            action();
        });
    }

    function readableLatex(source) {
        const symbols = {
            alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', theta: 'θ', lambda: 'λ',
            mu: 'μ', pi: 'π', sigma: 'σ', omega: 'ω', times: '×', cdot: '·',
            pm: '±', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', approx: '≈',
            infinity: '∞', sum: '∑', int: '∫', sqrt: '√'
        };
        let text = String(source).replace(/\\(?:left|right|displaystyle|textstyle)\b/g, '');
        for (let i = 0; i < 5; i++) {
            text = text
                .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
                .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
                .replace(/\\text\{([^{}]*)\}/g, '$1');
        }
        text = text
            .replace(/\\([A-Za-z]+)/g, (match, command) => symbols[command] || command)
            .replace(/\^\{([^{}]+)\}/g, '^($1)')
            .replace(/_\{([^{}]+)\}/g, '_($1)')
            .replace(/[{}]/g, '')
            .replace(/\\,/g, ' ')
            .replace(/\\%/g, '%')
            .replace(/\s+/g, ' ')
            .trim();
        return text || String(source);
    }

    function appendMath(parent, source, displayMode) {
        const math = document.createElement(displayMode ? 'div' : 'span');
        math.className = displayMode ? 'ai-math-block' : 'ai-math-inline';
        const formula = String(source).trim().slice(0, 2500);
        try {
            if (!window.katex || typeof window.katex.render !== 'function') throw new Error('KaTeX no disponible');
            window.katex.render(formula, math, {
                displayMode,
                throwOnError: true,
                trust: false,
                maxExpand: 100,
                maxSize: 24,
                strict: 'ignore',
                output: 'htmlAndMathml'
            });
        } catch (_error) {
            math.classList.add('ai-math-render-fallback');
            math.textContent = readableLatex(formula);
        }
        parent.appendChild(math);
    }

    function appendInline(parent, source, depth = 0) {
        if (depth > 8) {
            parent.appendChild(document.createTextNode(source));
            return;
        }
        const pattern = /(`+)([\s\S]*?)\1|(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\\(?:frac|sqrt|sum|prod|int|lim|alpha|beta|gamma|theta|lambda|mu|pi|sigma|omega|cdot|times|pm|leq|geq|neq|approx|infty)(?:\{[^{}\n]+\}){0,2})|(\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|\*[^*\n]+?\*|_[^_\n]+?_)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;
        let cursor = 0;
        let match;
        while ((match = pattern.exec(source))) {
            if (match.index > cursor) parent.appendChild(document.createTextNode(source.slice(cursor, match.index)));
            if (match[1]) {
                const code = document.createElement('code');
                code.textContent = match[2];
                parent.appendChild(code);
            } else if (match[3]) {
                const token = match[3];
                let formula = token;
                let displayMode = false;
                if (token.startsWith('$$') && token.endsWith('$$')) {
                    formula = token.slice(2, -2);
                    displayMode = true;
                } else if (token.startsWith('\\[') && token.endsWith('\\]')) {
                    formula = token.slice(2, -2);
                    displayMode = true;
                } else if (token.startsWith('\\(') && token.endsWith('\\)')) {
                    formula = token.slice(2, -2);
                } else if (token.startsWith('\\')) {
                    formula = token;
                } else {
                    formula = token.slice(1, -1);
                }
                appendMath(parent, formula, displayMode);
            } else if (match[4]) {
                const token = match[4];
                const marker = token.startsWith('**') || token.startsWith('__') ? 2 : (token.startsWith('~~') ? 2 : 1);
                const tag = token.startsWith('~~') ? 'del' : (marker === 2 ? 'strong' : 'em');
                const formatted = document.createElement(tag);
                appendInline(formatted, token.slice(marker, -marker), depth + 1);
                parent.appendChild(formatted);
            } else if (match[5]) {
                const linkMatch = match[5].match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
                try {
                    const url = new URL(linkMatch[2]);
                    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Protocolo no permitido');
                    const link = document.createElement('a');
                    link.href = url.href;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    appendInline(link, linkMatch[1], depth + 1);
                    parent.appendChild(link);
                } catch (_error) {
                    parent.appendChild(document.createTextNode(match[5]));
                }
            }
            cursor = pattern.lastIndex;
        }
        if (cursor < source.length) parent.appendChild(document.createTextNode(source.slice(cursor)));
    }

    function parseTableCells(line) {
        return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
    }

    function isListLine(line) { return assistantIsListLine(line); }

    function isBlockStart(lines, index) {
        const line = lines[index] || '';
        return /^\s{0,3}(?:#{1,6}\s|```|~~~|>|(?:[-*_]\s*){3,}$)/.test(line)
            || isListLine(line)
            || /^\s*\$\$/.test(line)
            || /^\s*\\\[/.test(line)
            || (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1]));
    }

    function renderAssistantMessage(element, source) {
        const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
        element.replaceChildren();
        let index = 0;
        while (index < lines.length) {
            const line = lines[index];
            const trimmed = line.trim();
            if (!trimmed) { index++; continue; }

            const fence = trimmed.match(/^(`{3,}|~{3,})\s*([\w.+#-]*)\s*$/);
            if (fence) {
                const closing = new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`);
                const codeLines = [];
                index++;
                while (index < lines.length && !closing.test(lines[index])) codeLines.push(lines[index++]);
                if (index < lines.length) index++;
                const wrapper = document.createElement('div');
                wrapper.className = 'ai-code-block';
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                const rawCode = codeLines.join('\n');
                code.className = 'hljs';
                try {
                    if (!window.hljs) throw new Error('Resaltador no disponible');
                    const language = fence[2].toLowerCase();
                    const highlighted = language && window.hljs.getLanguage(language)
                        ? window.hljs.highlight(rawCode, { language, ignoreIllegals: true })
                        : window.hljs.highlightAuto(rawCode);
                    code.innerHTML = highlighted.value;
                } catch (_error) {
                    code.textContent = rawCode;
                }
                pre.appendChild(code);
                wrapper.appendChild(pre);
                element.appendChild(wrapper);
                continue;
            }

            const displayMath = trimmed.match(/^\$\$([\s\S]*?)\$\$$/);
            if (displayMath) {
                appendMath(element, displayMath[1], true);
                index++;
                continue;
            }
            const bracketDisplayMath = trimmed.match(/^\\\[([\s\S]*?)\\\]$/);
            if (bracketDisplayMath) {
                appendMath(element, bracketDisplayMath[1], true);
                index++;
                continue;
            }
            if (trimmed === '$$' || trimmed === '\\[') {
                const close = trimmed === '$$' ? '$$' : '\\]';
                const formulaLines = [];
                index++;
                while (index < lines.length && lines[index].trim() !== close) formulaLines.push(lines[index++]);
                if (index < lines.length) index++;
                appendMath(element, formulaLines.join('\n'), true);
                continue;
            }

            const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
            if (heading) {
                const title = document.createElement(`h${Math.min(heading[1].length, 4)}`);
                appendInline(title, heading[2]);
                element.appendChild(title);
                index++;
                continue;
            }
            if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
                element.appendChild(document.createElement('hr'));
                index++;
                continue;
            }

            if (/^\s*>/.test(line)) {
                const quote = document.createElement('blockquote');
                while (index < lines.length && /^\s*>/.test(lines[index])) {
                    const paragraph = document.createElement('p');
                    appendInline(paragraph, lines[index++].replace(/^\s*>\s?/, ''));
                    quote.appendChild(paragraph);
                }
                element.appendChild(quote);
                continue;
            }

            if (isListLine(line)) {
                const block = parseAssistantListBlock(lines, index);
                const list = document.createElement(block.ordered ? 'ol' : 'ul');
                block.items.forEach(item => {
                    const li = document.createElement('li');
                    appendInline(li, item);
                    list.appendChild(li);
                });
                index = block.nextIndex;
                element.appendChild(list);
                continue;
            }

            if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
                const headers = parseTableCells(line);
                const alignments = parseTableCells(lines[index + 1]).map(cell => cell.startsWith(':') && cell.endsWith(':') ? 'center' : (cell.endsWith(':') ? 'right' : 'left'));
                const wrap = document.createElement('div');
                wrap.className = 'ai-table-wrap';
                const table = document.createElement('table');
                const thead = document.createElement('thead');
                const headRow = document.createElement('tr');
                headers.forEach((text, cellIndex) => {
                    const cell = document.createElement('th');
                    cell.style.textAlign = alignments[cellIndex] || 'left';
                    appendInline(cell, text);
                    headRow.appendChild(cell);
                });
                thead.appendChild(headRow);
                table.appendChild(thead);
                const tbody = document.createElement('tbody');
                index += 2;
                while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
                    const row = document.createElement('tr');
                    parseTableCells(lines[index++]).forEach((text, cellIndex) => {
                        const cell = document.createElement('td');
                        cell.style.textAlign = alignments[cellIndex] || 'left';
                        appendInline(cell, text);
                        row.appendChild(cell);
                    });
                    tbody.appendChild(row);
                }
                table.appendChild(tbody);
                wrap.appendChild(table);
                element.appendChild(wrap);
                continue;
            }

            const paragraphLines = [line];
            index++;
            while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) paragraphLines.push(lines[index++]);
            const paragraph = document.createElement('p');
            appendInline(paragraph, paragraphLines.join('\n'));
            element.appendChild(paragraph);
        }
    }

    function addMessage(role, text, isError) {
        const bubble = document.createElement('div');
        bubble.className = `ai-msg ${role}${isError ? ' error' : ''}`;
        if (role === 'bot' && !isError) renderAssistantMessage(bubble, text);
        else bubble.textContent = text;
        area.appendChild(bubble);
        area.scrollTop = area.scrollHeight;
        return bubble;
    }

    function addUserTurn(text, imageFile) {
        const turn = document.createElement('div');
        turn.className = 'ai-user-turn';
        if (imageFile) {
            const src = URL.createObjectURL(imageFile);
            const imageButton = document.createElement('button');
            imageButton.type = 'button';
            imageButton.className = 'ai-user-image';
            imageButton.setAttribute('aria-label', 'Ampliar imagen adjunta');
            const img = document.createElement('img');
            img.className = 'ai-msg-img';
            img.src = src;
            img.alt = 'Imagen adjunta';
            imageButton.appendChild(img);
            imageButton.addEventListener('click', () => openLightbox(src));
            turn.appendChild(imageButton);
        }
        if (text) {
            const bubble = document.createElement('div');
            bubble.className = 'ai-msg user';
            bubble.textContent = text;
            turn.appendChild(bubble);
        }
        area.appendChild(turn);
        area.scrollTop = area.scrollHeight;
    }

    function openLightbox(src) {
        if (!lightbox || !lightboxImage || !src) return;
        lightboxImage.src = src;
        lightbox.hidden = false;
        lightbox.setAttribute('aria-hidden', 'false');
        lightbox.classList.add('open');
        $('ai-lightbox-close').focus();
    }

    function closeLightbox() {
        if (!lightbox || !lightboxImage) return;
        lightbox.classList.remove('open');
        lightbox.hidden = true;
        lightbox.setAttribute('aria-hidden', 'true');
        lightboxImage.removeAttribute('src');
    }

    function resizeInput() {
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    }

    function readLocal(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (_error) { return fallback; }
    }

    function getAcademicContext() {
        const schedule = readLocal('mi_horario_custom_v1', {});
        const classes = Array.isArray(schedule) ? schedule : (Array.isArray(schedule.clases) ? schedule.clases : []);
        const storedGrades = readLocal('mi_notas_v1', {});
        const grades = storedGrades && typeof storedGrades === 'object'
            ? Object.fromEntries(Object.entries(storedGrades).filter(([key]) => key.startsWith('me|')))
            : {};
        const agenda = readLocal('mi_agenda_v1', []);
        return {
            horario: classes.slice(0, 40).map(item => ({
                asignatura: item.cursoDisplay || item.curso || '', dia: item.diaNombre || item.dia || '',
                hora: item.horaInicio || '', termino: item.horaFin || '', sala: item.sala || '',
                seccion: item.seccion || '', tipo: item.tipo || '', rol: item.rol || ''
            })),
            notas: grades && typeof grades === 'object' ? grades : {},
            agenda: Array.isArray(agenda) ? agenda.filter(event => !event.perfil || event.perfil === 'me').slice(0, 60) : []
        };
    }

    function updateImagePreview(file) {
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        imageUrl = URL.createObjectURL(file);
        $('ai-preview-img').src = imageUrl;
        $('ai-preview-filename').textContent = file.name;
        $('ai-attachment-preview').hidden = false;
    }

    function clearImage() {
        image = null;
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        imageUrl = '';
        $('ai-preview-img').removeAttribute('src');
        $('ai-attachment-preview').hidden = true;
        if (fileInput) fileInput.value = '';
    }

    async function selectImage(file) {
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
            addMessage('bot', 'Adjunta una imagen JPG, PNG o WebP de hasta 4 MB.', true);
            fileInput.value = '';
            return;
        }
        image = { data: await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
            reader.onerror = reject;
            reader.readAsDataURL(file);
        }), mimeType: file.type, file };
        updateImagePreview(file);
    }

    async function sendMessage() {
        const message = input.value.trim();
        if (busy || (!message && !image)) return;
        const context = getAcademicContext();
        const sentImage = image;
        const sentName = $('ai-preview-filename').textContent;
        addUserTurn(message, sentImage && sentImage.file);
        input.value = '';
        resizeInput();
        clearImage();
        const waiting = document.createElement('div');
        waiting.className = 'ai-msg bot ai-typing-indicator';
        waiting.setAttribute('role', 'status');
        waiting.setAttribute('aria-label', 'La IA está pensando');
        const dots = document.createElement('span');
        dots.className = 'ai-thinking-dots';
        dots.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            dot.className = 'ai-thinking-dot';
            dots.appendChild(dot);
        }
        waiting.appendChild(dots);
        area.appendChild(waiting);
        area.scrollTop = area.scrollHeight;
        busy = true;
        send.disabled = true;
        try {
            const response = await fetch('/api/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message || 'Analiza esta imagen.',
                    history: history.slice(-10),
                    image: sentImage ? { data: sentImage.data, mimeType: sentImage.mimeType } : null,
                    context
                })
            });
            const data = await response.json();
            waiting.remove();
            if (!response.ok) throw new Error(data.error || 'No se pudo obtener una respuesta.');
            const answer = String(data.answer || '').slice(0, 12000);
            addMessage('bot', answer);
            const userTurn = message || `[Imagen adjunta: ${sentName}]`;
            history.push({ role: 'user', text: userTurn }, { role: 'model', text: answer });
            history = history.slice(-10);
        } catch (error) {
            waiting.remove();
            addMessage('bot', error.message || 'No se pudo comunicar con el asistente. Inténtalo nuevamente.', true);
        } finally {
            busy = false;
            send.disabled = false;
            input.focus();
        }
    }

    toggle.addEventListener('click', () => setOpen(panel.hidden));
    bindHeaderAction('ai-close', () => setOpen(false));
    $('ai-attach').addEventListener('click', () => fileInput.click());
    $('ai-remove-image').addEventListener('click', clearImage);
    fileInput.addEventListener('change', event => selectImage(event.target.files && event.target.files[0]).catch(() => addMessage('bot', 'No se pudo leer la imagen.', true)));
    send.addEventListener('click', sendMessage);
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
    });
    input.addEventListener('input', resizeInput);
    input.addEventListener('focus', () => {
        if (keyboardBaselineHeight === null) keyboardBaselineHeight = window.innerHeight;
        window.requestAnimationFrame(syncKeyboardLayout);
    });
    input.addEventListener('blur', syncKeyboardLayout);
    window.addEventListener('resize', syncKeyboardLayout);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncKeyboardLayout, { passive: true });
        window.visualViewport.addEventListener('scroll', syncKeyboardLayout, { passive: true });
    }
    $('ai-lightbox-close').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });
    input.addEventListener('paste', event => {
        const items = Array.from((event.clipboardData || {}).items || []);
        const imageItem = items.find(item => item.kind === 'file' && item.type.startsWith('image/'));
        if (!imageItem) return;
        const pasted = imageItem.getAsFile();
        if (pasted) {
            event.preventDefault();
            selectImage(pasted).catch(() => addMessage('bot', 'No se pudo leer la imagen.', true));
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (lightbox && !lightbox.hidden) closeLightbox();
        else if (!panel.hidden) setOpen(false);
    });
})();

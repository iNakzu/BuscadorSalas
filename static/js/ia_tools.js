// Lógica para Corrector Ortotipográfico
async function corregirTexto() {
    const input = document.getElementById('corrector-input').value.trim();
    if (!input) return;
    
    document.getElementById('corrector-loading').style.display = 'block';
    document.getElementById('corrector-output-container').style.display = 'none';
    document.getElementById('btn-corregir').disabled = true;
    
    const prompt = `Corrige la ortografía, puntuación, mayúsculas y tildes del siguiente texto. ES CRÍTICO que NO cambies las palabras originales, el estilo, el tono ni la intención del mensaje. Simplemente aplica correcciones ortotipográficas (comas, puntos, tildes). No agregues NINGUNA introducción ni comentario extra. Devuelve ÚNICAMENTE el texto corregido:\n\n${input}`;
    
    try {
        const response = await fetch('/api/tutor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensaje: prompt, historial: [] })
        });
        
        const data = await response.json();
        document.getElementById('corrector-loading').style.display = 'none';
        document.getElementById('btn-corregir').disabled = false;
        
        if (data.respuesta) {
            document.getElementById('corrector-output').innerText = data.respuesta;
            document.getElementById('corrector-output-container').style.display = 'block';
        } else {
            alert('Error al corregir el texto.');
        }
    } catch (e) {
        document.getElementById('corrector-loading').style.display = 'none';
        document.getElementById('btn-corregir').disabled = false;
        alert('Error de conexión.');
    }
}

function copiarCorreccion() {
    const text = document.getElementById('corrector-output').innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('Texto copiado al portapapeles');
    });
}

// Lógica para Chat Global IA
let chatGlobalHistorial = [];

function escapeHtml(unsafe) {
    if(!unsafe) return "";
    return unsafe.toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function renderMarkdownChat(texto) {
    if (!texto) return "";
    let html = escapeHtml(texto);
    
    html = html.replace(/^### (.*$)/gim, '<h3 style="color:#38bdf8; margin-top:10px; margin-bottom:5px; font-size:14px;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="color:#38bdf8; margin-top:10px; margin-bottom:5px; font-size:15px;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="color:#38bdf8; margin-top:10px; margin-bottom:5px; font-size:16px;">$1</h1>');
    
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fff;">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em style="color:#cbd5e1;">$1</em>');
    html = html.replace(/^\s*[-*]\s+(.*)/gim, '<li style="margin-left:15px; margin-bottom:4px;">$1</li>');
    html = html.replace(/\n/g, '<br>');
    
    html = html.replace(/<\/h1><br>/g, '</h1>');
    html = html.replace(/<\/h2><br>/g, '</h2>');
    html = html.replace(/<\/h3><br>/g, '</h3>');
    html = html.replace(/<\/li><br>/g, '</li>');
    html = html.replace(/<br><li/g, '<li');
    html = html.replace(/(<br>){2,}/g, '<br><br>'); 
    
    return html;
}

function appendChatGlobalMsg(role, text) {
    const container = document.getElementById('chatglobal-messages');
    const wrapper = document.createElement('div');
    
    if (role === 'user') {
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'flex-end';
        wrapper.style.width = '100%';
        
        const bubble = document.createElement('div');
        bubble.style.background = '#e2e8f0';
        bubble.style.color = '#0f172a';
        bubble.style.padding = '12px 16px';
        bubble.style.borderRadius = '18px 18px 4px 18px';
        bubble.style.fontSize = '15px';
        bubble.style.lineHeight = '1.5';
        bubble.style.maxWidth = '85%';
        bubble.innerText = text;
        
        wrapper.appendChild(bubble);
    } else {
        wrapper.style.display = 'flex';
        wrapper.style.gap = '12px';
        wrapper.style.alignItems = 'flex-start';
        wrapper.style.width = '100%';
        
        const avatar = document.createElement('div');
        avatar.style.width = '32px';
        avatar.style.height = '32px';
        avatar.style.borderRadius = '50%';
        avatar.style.background = 'linear-gradient(135deg, #38bdf8, #8b5cf6)';
        avatar.style.display = 'flex';
        avatar.style.alignItems = 'center';
        avatar.style.justifyContent = 'center';
        avatar.style.flexShrink = '0';
        avatar.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>';
        
        const bubble = document.createElement('div');
        bubble.style.background = 'rgba(30, 41, 59, 0.7)';
        bubble.style.border = '1px solid rgba(255,255,255,0.05)';
        bubble.style.padding = '14px 18px';
        bubble.style.borderRadius = '4px 18px 18px 18px';
        bubble.style.color = '#e2e8f0';
        bubble.style.fontSize = '15px';
        bubble.style.lineHeight = '1.5';
        bubble.style.maxWidth = '90%';
        bubble.innerHTML = (typeof simpleMarkdown === "function") ? simpleMarkdown(text) : renderMarkdownChat(text);
        if (typeof renderMathOnElement === "function") renderMathOnElement(bubble);
        
        wrapper.appendChild(avatar);
        wrapper.appendChild(bubble);
    }
    
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

async function enviarChatGlobal() {
    const inputEl = document.getElementById('chatglobal-input');
    const mensaje = inputEl.value.trim();
    if (!mensaje) return;
    
    inputEl.value = '';
    appendChatGlobalMsg('user', mensaje);
    
    // Recopilar TODO el contexto de localStorage y variables hardcodeadas globales
    let amigosPerfiles = 'Vacío';
    try {
        if (typeof HORARIOS_GUARDADOS !== 'undefined') {
            const temp = {};
            for (let persona in HORARIOS_GUARDADOS) {
                temp[persona] = HORARIOS_GUARDADOS[persona].clases.map(c => ({
                    dia: c.diaNombre, hora: c.bloqueLabel, curso: c.curso
                }));
            }
            amigosPerfiles = JSON.stringify(temp);
        }
    } catch(e) { }

    const contextoTotal = {
        malla_aprobados: localStorage.getItem('malla_udp') || 'Ninguno',
        horarios_hardcodeados_todos: amigosPerfiles,
        evaluaciones_notas: localStorage.getItem('agendaData') || 'Vacío',
        tareas_kanban: localStorage.getItem('kanban_board') || 'Vacío',
        gastos: localStorage.getItem('mis_gastos') || 'Vacío',
        apuntes_voz: localStorage.getItem('apuntes_voz') || 'Vacío'
    };
    
    // Añadir mensaje de loading
    const container = document.getElementById('chatglobal-messages');
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'chatglobal-loading';
    loadingDiv.style.display = 'flex';
    loadingDiv.style.gap = '12px';
    loadingDiv.style.alignItems = 'flex-start';
    
    const avatar = document.createElement('div');
    avatar.style.width = '32px';
    avatar.style.height = '32px';
    avatar.style.borderRadius = '50%';
    avatar.style.background = 'linear-gradient(135deg, #38bdf8, #8b5cf6)';
    avatar.style.display = 'flex';
    avatar.style.alignItems = 'center';
    avatar.style.justifyContent = 'center';
    avatar.style.flexShrink = '0';
    avatar.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>';
    
    const bubble = document.createElement('div');
    bubble.style.background = 'rgba(30, 41, 59, 0.7)';
    bubble.style.border = '1px solid rgba(255,255,255,0.05)';
    bubble.style.padding = '14px 18px';
    bubble.style.borderRadius = '4px 18px 18px 18px';
    bubble.style.color = '#94a3b8';
    bubble.style.fontSize = '15px';
    bubble.innerHTML = '<span style="animation: pulse-red 1.5s infinite;">Pensando...</span>';
    
    loadingDiv.appendChild(avatar);
    loadingDiv.appendChild(bubble);
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;
    
    try {
        const response = await fetch('/api/tutor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                mensaje: "El usuario dice: " + mensaje + "\\n\\n[INSTRUCCIÓN INTERNA OCULTA PARA IA]: Eres el Tutor Omnisciente de esta plataforma. Utiliza los datos del contexto JSON adjunto para responder con total precisión sobre la vida académica del usuario. Usa markdown para formatear.", 
                historial: chatGlobalHistorial,
                contexto_local: contextoTotal
            })
        });
        
        const data = await response.json();
        loadingDiv.remove();
        
        if (data.respuesta) {
            appendChatGlobalMsg('bot', data.respuesta);
            chatGlobalHistorial.push({"role": "user", "parts": [{"text": mensaje}]});
            chatGlobalHistorial.push({"role": "model", "parts": [{"text": data.respuesta}]});
        } else {
            appendChatGlobalMsg('bot', 'Error de conexión con el Tutor IA.');
        }
    } catch (e) {
        loadingDiv.remove();
        appendChatGlobalMsg('bot', 'Error de red.');
    }
}

// Allow Enter to send message
document.getElementById('chatglobal-input') && document.getElementById('chatglobal-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarChatGlobal();
    }
});

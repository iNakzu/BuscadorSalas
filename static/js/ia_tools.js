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
    const msgDiv = document.createElement('div');
    
    if (role === 'user') {
        msgDiv.className = 'chat-user-msg';
        msgDiv.style.alignSelf = 'flex-end';
        msgDiv.style.maxWidth = '85%';
        msgDiv.style.background = '#38bdf8';
        msgDiv.style.color = '#0f172a';
        msgDiv.style.padding = '10px 14px';
        msgDiv.style.borderRadius = '14px 14px 0 14px';
        msgDiv.innerText = text;
    } else {
        msgDiv.className = 'chat-bot-msg';
        msgDiv.style.alignSelf = 'flex-start';
        msgDiv.style.maxWidth = '90%';
        msgDiv.innerHTML = renderMarkdownChat(text);
    }
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

async function enviarChatGlobal() {
    const inputEl = document.getElementById('chatglobal-input');
    const mensaje = inputEl.value.trim();
    if (!mensaje) return;
    
    inputEl.value = '';
    appendChatGlobalMsg('user', mensaje);
    
    // Recopilar TODO el contexto de localStorage
    const contextoTotal = {
        malla_aprobados: localStorage.getItem('malla_udp') || 'Ninguno',
        horario_clases: localStorage.getItem('horarioData') || 'Vacío',
        evaluaciones_notas: localStorage.getItem('agendaData') || 'Vacío',
        tareas_kanban: localStorage.getItem('kanban_board') || 'Vacío',
        gastos: localStorage.getItem('mis_gastos') || 'Vacío',
        apuntes_voz: localStorage.getItem('apuntes_voz') || 'Vacío'
    };
    
    // Añadir mensaje de loading
    const container = document.getElementById('chatglobal-messages');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-bot-msg';
    loadingDiv.style.alignSelf = 'flex-start';
    loadingDiv.innerHTML = '<span style="color:#38bdf8;">Analizando todos tus datos...</span>';
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
document.getElementById('chatglobal-input')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarChatGlobal();
    }
});

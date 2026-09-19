let mediaRecorder;
let audioChunks = [];
let isRecordingVoz = false;
let vozTimerInterval;
let vozSeconds = 0;
let misApuntes = JSON.parse(localStorage.getItem('mis_apuntes')) || [];

function initNotasVoz() {
    renderApuntesVoz();
}

function saveApuntes() {
    localStorage.setItem('mis_apuntes', JSON.stringify(misApuntes));
}

async function toggleVozRecording() {
    if (!isRecordingVoz) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = procesarAudioGrabado;
            
            audioChunks = [];
            mediaRecorder.start();
            isRecordingVoz = true;
            
            // UI Updates
            const btn = document.getElementById('btn-record-voz');
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12"></rect></svg><span>Detener y Procesar</span>';
            btn.style.background = 'rgba(255, 255, 255, 0.1)';
            btn.style.color = '#fff';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            
            document.getElementById('voz-recording-indicator').style.display = 'flex';
            
            vozSeconds = 0;
            updateVozTimer();
            vozTimerInterval = setInterval(() => {
                vozSeconds++;
                updateVozTimer();
            }, 1000);
            
        } catch (err) {
            alert('Error al acceder al micrófono: ' + err);
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecordingVoz = false;
        
        clearInterval(vozTimerInterval);
        
        // UI Updates
        const btn = document.getElementById('btn-record-voz');
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="10"></circle></svg><span>Iniciar Grabación</span>';
        btn.style.background = 'rgba(239, 68, 68, 0.15)';
        btn.style.color = '#ef4444';
        btn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        
        document.getElementById('voz-recording-indicator').style.display = 'none';
        document.getElementById('voz-loading').style.display = 'block';
    }
}

function updateVozTimer() {
    const min = Math.floor(vozSeconds / 60).toString().padStart(2, '0');
    const sec = (vozSeconds % 60).toString().padStart(2, '0');
    document.getElementById('voz-timer').innerText = `${min}:${sec}`;
}

async function procesarAudioGrabado() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    
    // Convert Blob to Base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async function() {
        const base64data = reader.result.split(',')[1];
        
        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioBase64: base64data,
                    mimeType: 'audio/webm'
                })
            });
            
            const data = await response.json();
            
            document.getElementById('voz-loading').style.display = 'none';
            
            if (data.error) {
                alert('Error de IA: ' + data.error);
                return;
            }
            
            misApuntes.unshift({
                id: 'apunte_' + Date.now(),
                fecha: Date.now(),
                texto: data.texto,
                duracion: vozSeconds
            });
            
            saveApuntes();
            renderApuntesVoz();
            
        } catch (err) {
            document.getElementById('voz-loading').style.display = 'none';
            alert('Error de conexión con el servidor.');
        }
    }
}

function renderApuntesVoz() {
    const container = document.getElementById('voz-results-container');
    if (!container) return;
    
    if (misApuntes.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 30px;">Aún no has grabado ningún apunte. Empieza a grabar una clase para ver la magia.</div>';
        return;
    }
    
    let html = '';
    misApuntes.forEach(ap => {
        const d = new Date(ap.fecha);
        const dateStr = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
        
        html += `
            <div class="control-card" style="position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 12px;">
                    <div>
                        <div style="color: #38bdf8; font-weight: 700; font-size: 14px;">Apunte Generado por IA</div>
                        <div style="color: #94a3b8; font-size: 11px; text-transform: capitalize;">${dateStr} • Duración: ${ap.duracion} segs</div>
                    </div>
                    <button onclick="borrarApunte('${ap.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;" title="Eliminar apunte">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
                <div class="chat-bot-msg" style="background: transparent; border: none; padding: 0; color: #e2e8f0; font-size: 13px; max-width: 100%;">
                    ${formatApunteText(ap.texto)}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function borrarApunte(id) {
    if(confirm('¿Eliminar este apunte permanentemente?')) {
        misApuntes = misApuntes.filter(a => a.id !== id);
        saveApuntes();
        renderApuntesVoz();
    }
}

function formatApunteText(texto) {
    let html = escapeHtml(texto);
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

document.addEventListener('DOMContentLoaded', initNotasVoz);

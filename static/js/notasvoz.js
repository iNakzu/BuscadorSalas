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
            // Verificar si el navegador soporta getUserMedia o si el contexto no es seguro
            if (!navigator.mediaDevices && !navigator.getUserMedia && !navigator.webkitGetUserMedia && !navigator.mozGetUserMedia) {
                if (window.location.protocol !== 'https:') {
                    mostrarAlertaWeb('El navegador bloquea el micrófono por seguridad al estar en HTTP.\n\nPor favor ingresa a través de:\nhttps://144.22.33.41', 'Micrófono bloqueado', 'error');
                } else {
                    mostrarAlertaWeb('Tu navegador no tiene habilitada la API de micrófono o está restringida.', 'Micrófono no disponible', 'error');
                }
                return;
            }

            // Polyfill para compatibilidad universal (Safari iOS, Chrome Android, navegadores antiguos)
            const getUserMediaFn = (constraints) => {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    return navigator.mediaDevices.getUserMedia(constraints);
                }
                const legacyFn = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
                if (legacyFn) {
                    return new Promise((resolve, reject) => {
                        legacyFn.call(navigator, constraints, resolve, reject);
                    });
                }
                return Promise.reject(new Error('getUserMedia no está disponible en este navegador'));
            };

            const stream = await getUserMediaFn({ audio: true });

            // Detectar el mejor formato soportado por el navegador (audio/webm en Chrome/Firefox, audio/mp4 en Safari)
            let chosenMimeType = '';
            const testTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus'];
            for (let t of testTypes) {
                if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)) {
                    chosenMimeType = t;
                    break;
                }
            }

            const options = chosenMimeType ? { mimeType: chosenMimeType } : {};
            mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorder._chosenMime = chosenMimeType || 'audio/webm';
            
            mediaRecorder.ondataavailable = event => {
                if (event.data && event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = procesarAudioGrabado;
            
            audioChunks = [];
            mediaRecorder.start(250); // Emitir chunks cada 250ms
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
            console.error('Error al acceder al micrófono:', err);
            if (window.location.protocol !== 'https:') {
                mostrarAlertaWeb('El navegador exige conexión segura HTTPS para acceder al micrófono.\n\nAsegúrate de ingresar usando:\nhttps://144.22.33.41', 'Conexión no segura', 'error');
            } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                mostrarAlertaWeb('Permiso de micrófono denegado. Por favor toca el candado o icono del sitio en la barra del navegador y activa el permiso de micrófono.', 'Permiso denegado', 'error');
            } else {
                mostrarAlertaWeb('Error al acceder al micrófono: ' + (err.message || err), 'Error de micrófono', 'error');
            }
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecordingVoz = false;
        
        clearInterval(vozTimerInterval);
        
        // UI Updates
        const btn = document.getElementById('btn-record-voz');
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="10"></circle></svg><span>Grabar Micrófono</span>';
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
    const mime = (mediaRecorder && mediaRecorder._chosenMime) ? mediaRecorder._chosenMime : 'audio/webm';
    const audioBlob = new Blob(audioChunks, { type: mime });
    
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
                    mimeType: mime
                })
            });
            
            const data = await response.json();
            
            document.getElementById('voz-loading').style.display = 'none';
            
            if (data.error) {
                mostrarAlertaWeb('Error de IA: ' + data.error, 'Error de IA', 'error');
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
            mostrarAlertaWeb('Error de conexión con el servidor.', 'Error de conexión', 'error');
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
            <div class="control-card" style="position: relative; margin-bottom: 0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 12px;">
                    <div>
                        <div style="color: #38bdf8; font-weight: 700; font-size: 14px; text-transform: capitalize;">${dateStr}</div>
                        <div style="color: #94a3b8; font-size: 11px;">${ap.duracion === 'Archivo' ? 'Archivo adjunto' : 'Grabación: ' + ap.duracion + ' segs'}</div>
                    </div>
                    <button onclick="borrarApunte('${ap.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;" title="Eliminar apunte">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
                <div id="content-${ap.id}" class="chat-bot-msg" style="background: transparent; border: none; padding: 0; color: #e2e8f0; font-size: 13px; max-width: 100%; max-height: 120px; overflow: hidden; position: relative; transition: max-height 0.3s ease;">
                    ${formatApunteText(ap.texto)}
                    <div id="gradient-${ap.id}" style="position: absolute; bottom: 0; left: 0; width: 100%; height: 60px; background: linear-gradient(transparent, #0f172a); pointer-events: none;"></div>
                </div>
                <button id="btn-${ap.id}" onclick="toggleApunte('${ap.id}')" style="width: 100%; margin-top: 12px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; justify-content: center; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    Ver transcripción completa
                </button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function toggleApunte(id) {
    const content = document.getElementById('content-' + id);
    const gradient = document.getElementById('gradient-' + id);
    const btn = document.getElementById('btn-' + id);
    
    if (content.style.maxHeight === '120px' || content.style.maxHeight === '') {
        content.style.maxHeight = 'none'; // sufficiently large for animation
        gradient.style.display = 'none';
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg> Ocultar transcripción';
    } else {
        content.style.maxHeight = '120px';
        gradient.style.display = 'block';
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg> Ver transcripción completa';
    }
}

function borrarApunte(id) {
    confirmarWeb('¿Eliminar este apunte permanentemente?', () => {
        misApuntes = misApuntes.filter(a => a.id !== id);
        saveApuntes();
        renderApuntesVoz();
    }, 'Eliminar apunte');
}

function formatApunteText(texto) {
    if (!texto) return "";
    let html = escapeHtml(texto);
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 style="color:#38bdf8; margin-top:15px; margin-bottom:8px; font-size:15px;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="color:#38bdf8; margin-top:18px; margin-bottom:10px; font-size:17px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="color:#38bdf8; margin-top:20px; margin-bottom:12px; font-size:20px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:6px;">$1</h1>');
    
    // Bold and Italics
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fff;">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em style="color:#cbd5e1;">$1</em>');
    
    // Lists (Bullet points)
    html = html.replace(/^\s*[-*]\s+(.*)/gim, '<li style="margin-bottom:6px; margin-left:20px; color:#e2e8f0; line-height: 1.5;">$1</li>');
    
    // Newlines
    html = html.replace(/\n/g, '<br>');
    
    // Cleanup empty breaks around block elements
    html = html.replace(/<\/h1><br>/g, '</h1>');
    html = html.replace(/<\/h2><br>/g, '</h2>');
    html = html.replace(/<\/h3><br>/g, '</h3>');
    html = html.replace(/<\/li><br>/g, '</li>');
    html = html.replace(/<br><li/g, '<li');
    html = html.replace(/(<br>){2,}/g, '<br><br>'); // Max two breaks
    
    return html;
}

document.addEventListener('DOMContentLoaded', initNotasVoz);


async function handleAudioUpload(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;
    
    // Check file size (limit to 10MB approx)
    if (file.size > 15 * 1024 * 1024) {
        mostrarAlertaWeb("El archivo es muy pesado. Intenta con un audio de máximo 15MB.", 'Archivo demasiado pesado', 'error');
        return;
    }
    
    document.getElementById('voz-loading').style.display = 'block';
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async function() {
        const base64data = reader.result.split(',')[1];
        const mimeType = file.type || 'audio/mp3';
        
        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioBase64: base64data,
                    mimeType: mimeType
                })
            });
            
            const data = await response.json();
            
            document.getElementById('voz-loading').style.display = 'none';
            inputElement.value = ''; // reset
            
            if (data.error) {
                mostrarAlertaWeb('Error de IA: ' + data.error, 'Error de IA', 'error');
                return;
            }
            
            misApuntes.unshift({
                id: 'apunte_' + Date.now(),
                fecha: Date.now(),
                texto: data.texto,
                duracion: 'Archivo'
            });
            
            saveApuntes();
            renderApuntesVoz();
            
        } catch (err) {
            document.getElementById('voz-loading').style.display = 'none';
            inputElement.value = '';
            mostrarAlertaWeb('Error de conexión con el servidor.', 'Error de conexión', 'error');
        }
    }
}

// Lógica para Corrector Ortotipográfico
async function corregirTexto() {
    const input = document.getElementById('corrector-input').value.trim();
    if (!input) return;
    
    document.getElementById('corrector-output-container').style.display = 'none';
    const btn = document.getElementById('btn-corregir');
    btn.disabled = true;
    btn.style.opacity = '0.7';
    document.getElementById('btn-corregir-text').innerText = 'Buscando todas las faltas ortográficas...';
    document.getElementById('btn-corregir-icon').innerHTML = '<line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>';
    document.getElementById('btn-corregir-icon').classList.add('ai-spin');
    
    const prompt = `Corrige la ortografía, puntuación, mayúsculas y tildes del siguiente texto. ES CRÍTICO que NO cambies las palabras originales, el estilo, el tono ni la intención del mensaje.
Debes devolver tu respuesta EXACTAMENTE con este formato (incluyendo las etiquetas entre corchetes):

[TEXTO CORREGIDO]
(el texto corregido aquí, sin comillas extra ni introducciones)

[EXPLICACION]
(lista una por una absolutamente TODAS las faltas ortográficas y gramaticales que encontraste, usando viñetas cortas, y explica por qué se corrigieron para que el estudiante aprenda)

Texto a corregir:
${input}`;
    
    try {
        const response = await fetch('/api/tutor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensaje: prompt, historial: [] })
        });
        
        const data = await response.json();
        const btn = document.getElementById('btn-corregir');
        btn.disabled = false;
        btn.style.opacity = '1';
        document.getElementById('btn-corregir-text').innerText = 'Corregir Texto';
        document.getElementById('btn-corregir-icon').classList.remove('ai-spin');
        document.getElementById('btn-corregir-icon').innerHTML = '<path d="M4 6h16"></path><path d="M4 12h8"></path><path d="M4 18h4"></path><path d="m14 15 2 2 4-4"></path>';
        
        if (data.respuesta) {
            let textoBot = data.respuesta;
            let textoCorregido = textoBot;
            let explicacion = "";
            
            if (textoBot.includes("[EXPLICACION]")) {
                const parts = textoBot.split("[EXPLICACION]");
                textoCorregido = parts[0].replace("[TEXTO CORREGIDO]", "").trim();
                explicacion = parts[1].trim();
            } else if (textoBot.includes("[EXPLICACIÓN]")) {
                const parts = textoBot.split("[EXPLICACIÓN]");
                textoCorregido = parts[0].replace("[TEXTO CORREGIDO]", "").trim();
                explicacion = parts[1].trim();
            } else {
                textoCorregido = textoBot.replace("[TEXTO CORREGIDO]", "").trim();
            }
            
            document.getElementById('corrector-output').innerText = textoCorregido;
            
            if (explicacion) {
                const renderFn = typeof simpleMarkdown === "function" ? simpleMarkdown : (typeof renderMarkdownChat === "function" ? renderMarkdownChat : null);
                if (renderFn) {
                    document.getElementById('corrector-explicacion').innerHTML = renderFn(explicacion);
                } else {
                    document.getElementById('corrector-explicacion').innerText = explicacion;
                }
                document.getElementById('corrector-explicacion-container').style.display = 'block';
            } else {
                document.getElementById('corrector-explicacion-container').style.display = 'none';
            }
            
            document.getElementById('corrector-output-container').style.display = 'block';
        } else {
            mostrarAlertaWeb('Error al corregir el texto.', 'No se pudo corregir', 'error');
        }
    } catch (e) {
        const errBtn = document.getElementById('btn-corregir');
        errBtn.disabled = false;
        errBtn.style.opacity = '1';
        document.getElementById('btn-corregir-text').innerText = 'Corregir Texto';
        document.getElementById('btn-corregir-icon').classList.remove('ai-spin');
        document.getElementById('btn-corregir-icon').innerHTML = '<path d="M4 6h16"></path><path d="M4 12h8"></path><path d="M4 18h4"></path><path d="m14 15 2 2 4-4"></path>';
        document.getElementById('btn-corregir').disabled = false;
        mostrarAlertaWeb('Error de conexión.', 'Error de conexión', 'error');
    }
}

function copiarCorreccion() {
    const text = document.getElementById('corrector-output').innerText;
    navigator.clipboard.writeText(text).then(() => {
        mostrarAlertaWeb('Texto copiado al portapapeles', 'Texto copiado');
    });
}

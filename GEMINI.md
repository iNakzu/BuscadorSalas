# Contexto de Arquitectura y Datos del Buscador de Salas

Este archivo contiene las reglas y el contexto general del proyecto para que la IA (Gemini / Antigravity) no invente información ni asuma arquitecturas equivocadas en futuras iteraciones.

## 1. Datos Hardcodeados (Fijos)
Actualmente, las siguientes estructuras están escritas a mano (hardcodeadas) en el código y no provienen de una base de datos externa ni de una API:

- **La Malla Curricular (MALLA_ICIT):** Definida tanto en `flask_app.py` (backend) como en `static/js/progreso.js` (frontend, a través de `MALLA_MOCK`). Si se modifica la malla, hay que actualizar ambos archivos manualmente.
- **Horarios y Perfiles de Amigos:** Toda la información sobre "Nakzu", "Cata", etc., está simulada y quemada en `static/js/datos_prueba_amigos.js`. No existe un sistema real de autenticación ni de base de datos de usuarios (todavía).
- **Calendario de Solemnes:** Definido estáticamente en `static/js/solemnes_data.js`.
- **Mapeo de Edificios:** La traducción de letras a nombres reales (ej. "V" a "Vergara 432") está hardcodeada en `flask_app.py`.

## 2. Datos Dinámicos (Externos o Locales)
- **Base de Datos Principal de Salas y Profesores:** El motor de la app en `flask_app.py` hace `fetch` en tiempo real del JSON oficial de la EIT: `https://salas.docencia-eit.cl/data.json`.
- **Datos Personales del Usuario:** Las Notas, la Agenda, los Ramos aprobados en la Malla Interactiva y el estado del Modo Estudio (Pomodoro) se guardan estrictamente en el `localStorage` del navegador web del usuario.

## 3. Filosofía de Diseño UI
- Toda nueva interfaz o sección debe respetar el estilo "Glassmorphism" (cristalizado), usando los fondos transparentes (`rgba(30, 41, 59, 0.6)`), bordes sutiles y acentos en cyan o morado neón, imitando la filosofía de iOS/Tailwind oscuro. 
- **Regla Estricta:** NO SE DEBEN USAR EMOJIS en la interfaz, a menos que sea explícitamente requerido, para mantener una estética limpia y futurista.

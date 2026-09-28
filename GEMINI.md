# Contexto de Arquitectura y Datos del Buscador de Salas

Este archivo contiene las reglas y el contexto general del proyecto para que la IA (Gemini / Antigravity) no invente información ni asuma arquitecturas equivocadas en futuras iteraciones.

## 1. Datos Hardcodeados (Fijos)
Actualmente, las siguientes estructuras están escritas a mano (hardcodeadas) en el código y no provienen de una base de datos externa ni de una API:

- **La Malla Curricular (MALLA_ICIT):** Definida en `app/services/schedule.py` y en `static/js/progreso.js` (frontend, a través de `MALLA_MOCK`). Si se modifica la malla, hay que actualizar ambos archivos manualmente.
- **Calendario de Solemnes:** Definido estáticamente en `static/js/solemnes_data.js`.
- **Mapeo de Edificios:** La traducción de letras a nombres reales (ej. "V" a "Vergara 432") está hardcodeada en `app/services/schedule.py`.

## 2. Datos Dinámicos (Externos o Locales)
- **Base de Datos Principal de Salas y Profesores:** `app/services/schedule.py` obtiene el JSON oficial de la EIT: `https://salas.docencia-eit.cl/data.json`.
- **Datos Personales del Usuario:** Horario, notas, agenda y malla se guardan primero en `localStorage` y se sincronizan con Supabase al iniciar sesión. Estudio y timer permanecen locales.

## 3. Filosofía de Diseño UI
- Toda nueva interfaz o sección debe respetar el estilo "Glassmorphism" (cristalizado), usando los fondos transparentes (`rgba(30, 41, 59, 0.6)`), bordes sutiles y acentos en cyan o morado neón, imitando la filosofía de iOS/Tailwind oscuro. 
- **Regla Estricta sobre Iconografía:** NO SE DEBEN USAR EMOJIS (🎨, 📚, ✨) bajo ninguna circunstancia. En su lugar, se deben usar **símbolos modernos, limpios y minimalistas** (como SVGs al estilo Lucide/Feather, o glifos tipográficos elegantes como ➔, ✦, ⚲) para mantener una estética seria, pulcra y futurista.

## 4. Evolución de la Arquitectura (Hacia la Escalabilidad)
A medida que el proyecto crece, se deben seguir estos nuevos estándares de desarrollo para evitar el "código espagueti":

- **Frontend Modular (Plantillas):** Queda prohibido seguir concentrando todo el HTML en un monolítico `index.html`. El frontend debe dividirse usando **partials de Jinja2** o un bundler frontend. Las secciones (`tab-salas`, `tab-notas`, etc.) deben vivir en archivos independientes dentro de `templates/views/` o `templates/components/` y ser inyectadas dinámicamente.
- **CSS Puro (Vanilla) como Estándar:** Mantener el uso de CSS nativo (sin frameworks como Tailwind o Bootstrap). Los estilos deben organizarse semánticamente y aprovechar variables nativas de CSS (`--var-name`) para mantener la coherencia del diseño Glassmorphism.
- **Backend Escalable (Flask Blueprints):** Mantener el patrón *Application Factory* de Flask existente. Las rutas de la API, las vistas HTML y la lógica de negocio deben permanecer separadas en `app/blueprints/` y `app/services/`.
- **Archivos Estáticos Modulares:** El JavaScript también debe modularizarse (ES6 Modules) si es posible, separando el estado global (`state`), las peticiones a la API y la manipulación del DOM, en lugar de tener variables globales cruzadas entre 15 archivos `.js`.

## 5. Prevención de Errores Críticos (502 Bad Gateway)
- **Verificación Local Obligatoria:** ANTES de hacer cualquier `git push` o commit que altere el backend (`app/`, `flask_app.py`, etc.), debes ejecutar una prueba local (ej. `curl -s http://127.0.0.1:5000/`) para garantizar que la aplicación responde un código 200. Jamás envíes un commit a producción a ciegas.
- **Despliegues sin Caídas (Zero-Downtime):** El sistema de despliegue en GitHub Actions usaba `systemctl restart`, lo cual mataba a Gunicorn y provocaba 502s temporales. Esto ha sido cambiado a `systemctl reload`. Nunca cambies esto de vuelta a `restart` en el `deploy.yml`.

## 6. Flujo de Experiencia de Usuario (UX) y Popups
- **Cero Popups para Acciones Frecuentes:** Queda estrictamente prohibido usar popups nativos, alertas (`alert()`, `confirm()`), tooltips molestos de HTML o modales de confirmación para acciones destructivas del día a día (ej. borrar un gasto, borrar un hábito, eliminar una tarea). El flujo de la aplicación debe ser instantáneo y sin fricción.
- **Uso de Modales:** Los popups modales que interrumpen la pantalla (`ui_feedback.js`) están reservados **únicamente** para acciones críticas, complejas o configuraciones (ej. reiniciar la web cache). Todo lo demás debe manejarse de forma fluida, o a lo mucho usando "cápsulas" (banners en línea) que no bloqueen la interfaz.

## 7. Estado vigente de la V1

La especificación actual está en [docs/V1_PRODUCT_AND_ARCHITECTURE.md](docs/V1_PRODUCT_AND_ARCHITECTURE.md) y reemplaza las descripciones históricas de módulos y almacenamiento de este archivo. No se deben reintroducir perfiles ficticios, chat/IA ni módulos fuera del alcance V1. Los datos personales de horario, notas, agenda y progreso se guardan localmente y se sincronizan con Supabase bajo RLS.

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
- **Regla Estricta sobre Iconografía:** NO SE DEBEN USAR EMOJIS (🎨, 📚, ✨) bajo ninguna circunstancia. En su lugar, se deben usar **símbolos modernos, limpios y minimalistas** (como SVGs al estilo Lucide/Feather, o glifos tipográficos elegantes como ➔, ✦, ⚲) para mantener una estética seria, pulcra y futurista.

## 4. Evolución de la Arquitectura (Hacia la Escalabilidad)
A medida que el proyecto crece, se deben seguir estos nuevos estándares de desarrollo para evitar el "código espagueti":

- **Frontend Modular (Plantillas):** Queda prohibido seguir concentrando todo el HTML en un monolítico `index.html`. El frontend debe dividirse usando **partials de Jinja2** o un bundler frontend. Las secciones (`tab-salas`, `tab-notas`, etc.) deben vivir en archivos independientes dentro de `templates/views/` o `templates/components/` y ser inyectadas dinámicamente.
- **Tailwind CSS como Estándar:** Toda refactorización de estilos y nuevos desarrollos deben utilizar utilidades de **Tailwind CSS**. El CSS puro (vanilla) debe reducirse al mínimo, reservándose únicamente para abstraer componentes reutilizables complejos (ej. `.glass-card`) usando la directiva `@apply`, o para animaciones muy específicas que Tailwind no cubra fácilmente de forma nativa.
- **Backend Escalable (Flask Blueprints):** El monolito `flask_app.py` debe desglosarse. Se exige adoptar el patrón *Application Factory* de Flask. Las rutas de la API, las vistas HTML y la lógica de negocio (procesamiento del `data.json`, IA, etc.) deben separarse en **Blueprints** y módulos dentro de un paquete estructurado (ej. `app/routes/`, `app/services/`, `app/utils/`).
- **Archivos Estáticos Modulares:** El JavaScript también debe modularizarse (ES6 Modules) si es posible, separando el estado global (`state`), las peticiones a la API y la manipulación del DOM, en lugar de tener variables globales cruzadas entre 15 archivos `.js`.

## 5. Prevención de Errores Críticos (502 Bad Gateway)
- **Verificación Local Obligatoria:** ANTES de hacer cualquier `git push` o commit que altere el backend (`app/`, `flask_app.py`, etc.), debes ejecutar una prueba local (ej. `curl -s http://127.0.0.1:5000/`) para garantizar que la aplicación responde un código 200. Jamás envíes un commit a producción a ciegas.
- **Despliegues sin Caídas (Zero-Downtime):** El sistema de despliegue en GitHub Actions usaba `systemctl restart`, lo cual mataba a Gunicorn y provocaba 502s temporales. Esto ha sido cambiado a `systemctl reload`. Nunca cambies esto de vuelta a `restart` en el `deploy.yml`.

# Revisión funcional y oportunidades de mejora

**Portal académico — documento para evaluación universitaria**
**Fecha:** 16 de octubre de 2026
**Base revisada:** `main` de producción, commit funcional `25d1afa`.

## Objetivo y alcance

Este informe identifica oportunidades concretas para mejorar la experiencia y la confiabilidad del portal. Se revisaron el código de las vistas, servicios y pruebas automatizadas relacionadas con horarios, importación desde fotos, búsquedas, solemnes, mallas, notas, agenda, perfiles, privacidad, comunidad, administración, asistente, PWA, notificaciones y experiencia adaptable. No se usaron cuentas de estudiantes ni se modificaron datos de Supabase.

Es una revisión funcional del código disponible, no una certificación de seguridad, accesibilidad ni calidad institucional. Las recomendaciones que cambian permisos o el tratamiento de datos requieren validación de las áreas responsables de la universidad.

## Síntesis ejecutiva

El portal ya resuelve un conjunto amplio de tareas académicas: busca salas, ramos y docentes desde el feed institucional; permite importar y editar horarios; mantiene módulos personales sincronizados; presenta mallas por carrera y solemnes; y admite recordatorios push. Las principales oportunidades se concentran en cuatro aspectos: que el usuario pueda revisar un horario reconocido antes de reemplazar el suyo, que la interfaz indique cuándo los datos personales no se sincronizaron, que se explicite y limite la información compartida con la comunidad y los servicios de IA, y que las fuentes académicas muestren su vigencia.

Durante esta revisión se corrigieron tres defectos: un reinicio de datos que podía borrar la copia local antes de confirmar la operación remota, una falla temporal de malla que quedaba cacheada como un resultado vacío y el envío de notas y agenda al asistente junto con el horario. Se comprobó además que la versión actual de `main` ya renueva el feed oficial al vencer su caché y no desplaza automáticamente la vista del horario. Las correcciones de esta revisión incluyen pruebas de regresión y se publican junto con este informe.

## Cobertura funcional revisada

| Área | Funcionamiento observado | Resultado de la revisión |
|---|---|---|
| Horario personal y compartido | Edición por bloque; sincronización de datos personales; importación con Gemini; validación de choques y bloques dobles | No se observó una vista previa de confirmación antes de que la importación reemplace el horario existente; se recomienda agregarla |
| Búsqueda de salas, ramos y profesores | Consulta el JSON oficial; divide resultados agrupados por sala y sección; filtra por día y bloque | La API conoce origen y hora de sincronización, pero las vistas no comunican al usuario si están viendo datos de respaldo antiguos |
| Solemnes | Datos por día y bloque; búsqueda; resaltado basado en carrera y horario del perfil seleccionado; resaltado inicialmente apagado | El calendario está versionado como archivo estático; falta un flujo visible de vigencia y validación institucional |
| Mallas y horarios por semestre | Catálogos separados por carrera; requisitos y avance; acceso vinculado al inicio de sesión y a la carrera | Se detectó y corrigió que una falla temporal quedara cacheada como “malla no disponible” durante toda la sesión |
| Notas y agenda | Notas con límites 1–7; eventos vinculados a ramo u opción “Otro”; datos locales y sincronización; colores por ramo | Los guardados remotos fallidos quedan sólo en consola, sin indicar al estudiante si el cambio llegó a la nube |
| Perfil, comunidad y administración | Preferencia de compartir información; directorio autenticado; selección de perfil; edición administrativa | La preferencia actual es global para horario, notas, agenda y progreso: no hay permisos separados por módulo |
| Asistente inteligente | Envía preguntas a Gemini; permite adjuntar imágenes; admite contexto de horario | La implementación leía y enviaba también notas y agenda aunque la función solicitada era consultar el horario; corregido localmente |
| PWA y notificaciones | Service worker guarda recursos de la aplicación y excluye API y autenticación; push se entrega desde el servidor | Los recordatorios vigentes son genéricos y sólo se programan diez minutos antes de clases y eventos |
| Rendimiento y accesibilidad | Scripts de las vistas se cargan desde la página principal; existen roles ARIA en diálogos y estados | El resaltador de código de 1,2 MB se descarga aunque no se use el asistente; los diálogos centrales declaran accesibilidad ARIA pero no gestionan el foco |

## Hallazgos y propuestas priorizadas

### 1. Revisar el horario reconocido antes de reemplazar el horario guardado

**Prioridad: alta.**

**Problema y usuarios afectados.** Un estudiante puede perder su horario existente si Gemini interpreta mal una foto. Esto afecta especialmente imágenes recortadas, clases de más de un bloque y horarios que incluyen textos o líneas superpuestas.

**Comportamiento actual y evidencia.** `static/js/horario.js`, funciones `importarHorarioDesdeFoto()` y `cargarHorarioImportado()`: al recibir clases válidas, la aplicación las convierte a bloques y asigna inmediatamente `MI_HORARIO_DATA.clases = imported`; después persiste y sincroniza. Se valida que no haya dos clases en el mismo bloque, pero no hay una etapa de revisión previa a sustituir la lista actual.

**Propuesta y ejemplo.** Mostrar un resumen editable con días, ramos, horas, tipo, sala, sección y bloques dobles. El estudiante confirma “Reemplazar mi horario” o vuelve a cargar la foto; los errores de reconocimiento no alteran los datos existentes.

**Alcance y dependencias.** Cambio de interfaz y estado temporal; no requiere migración de base de datos ni un proveedor adicional. Debe conservar el comportamiento de detección de bloques dobles y la sincronización actual después de la confirmación.

**Riesgo y validación.** Riesgo bajo-medio: un estado temporal mal gestionado podría guardar dos veces o perder la revisión. Probar confirmación, cancelación, duplicados, bloque doble, foto inválida, cierre del diálogo y recarga antes de confirmar; comprobar que el horario anterior permanece intacto en todos los casos de cancelación y error.

### 2. Informar el estado real de sincronización y reintentar sin perder cambios

**Prioridad: alta.**

**Problema y usuarios afectados.** Si una persona edita notas, agenda u horario sin conexión o durante una falla de Supabase, puede creer que el cambio quedó disponible en todos sus dispositivos cuando sólo se guardó localmente.

**Comportamiento actual y evidencia.** `static/js/personal_store.js`, `save()`, guarda primero en `localStorage` y captura errores de la escritura remota con `console.error`. `static/js/notas.js` y `static/js/agenda.js` llaman a ese guardado sin mostrar su resultado.

**Propuesta y ejemplo.** Mostrar estados breves por módulo: “Guardando”, “Sincronizado” o “Guardado en este dispositivo; se sincronizará al volver la conexión”. Mantener una cola local de reintentos con control de versiones para que un dato viejo no reemplace una edición reciente.

**Alcance y dependencias.** Cambios en el almacén local, eventos de estado y componentes de interfaz. No requiere una tabla nueva si la cola se guarda localmente; una cola duradera entre dispositivos requeriría diseño adicional.

**Riesgo y validación.** Riesgo medio por conflictos entre ediciones de varios dispositivos. Probar cortes de red al guardar, reintento, cierre y reapertura del navegador, dos dispositivos y confirmación tardía del servidor.

### 3. Limitar y explicar qué información se comparte con la comunidad y la IA

**Prioridad: alta; requiere validación de privacidad.**

**Problema y usuarios afectados.** La persona necesita entender qué datos personales salen de su dispositivo y quién puede consultarlos.

**Comportamiento actual y evidencia.** La preferencia `share_information` expone conjuntamente horario, notas, agenda y progreso de malla a cuentas autenticadas autorizadas, según `docs/V1_PRODUCT_AND_ARCHITECTURE.md` y las funciones SQL de `supabase/migrations/202609290002_public_information.sql`. Además, `static/js/ai_assistant.js`, `getAcademicContext()`, leía horario, notas y agenda y enviaba ese contexto junto con cada pregunta a `/api/chat`. En esta publicación se limita el contexto automático del asistente al horario; el envío de adjuntos que la persona selecciona sigue siendo parte de la función de chat.

**Propuesta y ejemplo.** Evaluar permisos independientes para horario, notas, agenda y progreso, con una descripción visible de quién puede ver cada módulo. Para el asistente, informar antes de la primera consulta que el horario se procesa con Gemini y evitar incluir otros módulos personales salvo autorización explícita.

**Alcance y dependencias.** La separación comunitaria requiere decisión institucional, migración de base de datos y actualización de funciones RPC y políticas de acceso. La explicación del contexto del asistente requiere cambios de interfaz y pruebas del payload; no necesita compartir más datos.

**Riesgo y validación.** Riesgo alto si permisos y consultas no se actualizan de forma consistente. Probar con dos cuentas qué datos puede consultar cada perfil y revisar el contenido enviado al proveedor de IA. No desplegar cambios de privacidad sin revisión institucional.

### 4. Mostrar la fecha y el origen de los datos de salas y clases

**Prioridad: alta.**

**Problema y usuarios afectados.** Un estudiante puede tomar una decisión basándose en sala, sección o profesor que ya cambió en la fuente institucional.

**Comportamiento actual y evidencia.** `app/services/schedule.py`, `DataManager.get_status()`, expone `source` y `last_synced`; cuando falla la fuente remota, puede usar el archivo local de respaldo. `static/js/app.js` consume resultados de búsqueda, pero no muestra la antigüedad u origen junto a ellos.

**Propuesta y ejemplo.** Mostrar “Datos actualizados a las 10:30” y, si se usa respaldo, “Mostrando última copia disponible”. En la búsqueda de sala, incluir una acción para reintentar cuando vuelva el servicio.

**Alcance y dependencias.** Añadir el estado del feed a respuestas o a una consulta común y mostrarlo en salas, ramos, profesores y horarios por semestre. No requiere cambios de base de datos.

**Riesgo y validación.** Riesgo bajo; hay que evitar que una respuesta lenta de estado retrase la búsqueda. Probar fuente remota disponible, copia local, error de red y respuesta inválida, verificando hora, origen y continuidad del servicio.

### 5. Ampliar los recordatorios de clases con reglas claras

**Prioridad: media-alta.**

**Problema y usuarios afectados.** Los recordatorios actuales no cubren varios momentos útiles que los estudiantes han solicitado: inicio de clase, fin de clase, ventanas y cierre de la jornada.

**Comportamiento actual y evidencia.** `app/services/push_notifications.py`, `deliver_due()`, envía un mensaje genérico diez minutos antes de una clase o evento. El almacén `push_classes` conserva día y hora de inicio, pero no término, ramo ni tipo.

**Propuesta y ejemplo.** Definir un catálogo pequeño y configurable, por ejemplo “Tu laboratorio de Álgebra Lineal comienza en 10 min” y “Terminó tu clase; tienes 10 min libres”. Suprimir avisos redundantes en bloques consecutivos y respetar horario local de Santiago.

**Alcance y dependencias.** Requiere sincronizar datos mínimos adicionales (término, ramo y tipo), ampliar el esquema SQLite del servicio push y revisar el planificador del servidor. No requiere otra API de terceros.

**Riesgo y validación.** Riesgo medio de duplicados o avisos fuera de hora por cambios de horario. Probar cambios de zona/horario de verano, clases consecutivas, agenda sin hora, múltiples dispositivos, app cerrada y cancelación de eventos.

### 6. Mantener un calendario de solemnes verificable y vigente

**Prioridad: media-alta.**

**Problema y usuarios afectados.** Si cambia el calendario del periodo, un archivo antiguo puede producir búsquedas o resaltados incorrectos para todas las carreras.

**Comportamiento actual y evidencia.** `static/js/solemnes_data.js` contiene días, bloques y nombres; `static/js/solemnes.js` cruza esos nombres con la carrera y horario del perfil. El conjunto no muestra metadatos de vigencia o fuente dentro del calendario.

**Propuesta y ejemplo.** Mantener junto al calendario periodo académico, fecha de publicación, fuente oficial y fecha de revisión. Antes de activar una nueva versión, validar nombres, escuelas y horarios con el área responsable.

**Alcance y dependencias.** Puede mantenerse en JSON versionado sin una nueva base de datos; si la universidad requiere actualización sin despliegue, se necesitaría una fuente administrable con permisos.

**Riesgo y validación.** Riesgo medio porque un dato mal publicado afecta a toda la comunidad. Validar cada bloque contra la fuente oficial y probar coincidencias ambiguas entre carreras y perfiles sin carrera.

### 7. Reducir la carga inicial en móviles y computadores modestos

**Prioridad: media.**

**Problema y usuarios afectados.** La descarga inicial puede ser costosa para teléfonos con conexión lenta, memoria limitada o computadores antiguos.

**Comportamiento actual y evidencia.** `templates/index.html` carga las vistas y el asistente en cada apertura. `static/js/vendor/highlight-full.min.js` ocupa 1.208.701 bytes y se incluye aunque el asistente esté cerrado; varios scripts específicos de agenda, notas, malla y solemnidades también se descargan al entrar.

**Propuesta y ejemplo.** Cargar el asistente, KaTeX y el resaltador de código sólo cuando la persona abra el asistente; considerar dividir los scripts de vistas que no se usan en la primera pantalla. Mantener disponibles las funciones principales sin depender de esas cargas opcionales.

**Alcance y dependencias.** Optimización de carga frontend; no requiere base de datos ni servicios adicionales. Medir primero el peso transferido y el tiempo hasta interacción en un teléfono de referencia.

**Riesgo y validación.** Riesgo bajo-medio por dependencias que actualmente se inicializan en orden. Comparar carga inicial con caché fría y caliente; probar asistente, fórmulas y código, además de salas, horario, notas y agenda en navegadores móviles.

### 8. Completar el manejo de foco y teclado en los diálogos

**Prioridad: media.**

**Problema y usuarios afectados.** Una persona que navega con teclado o lector de pantalla puede perder la ubicación cuando se abre un aviso o modal.

**Comportamiento actual y evidencia.** `static/js/ui_feedback.js` crea diálogos con `role="dialog"`, `aria-modal="true"` y título accesible, pero no coloca el foco dentro, no lo mantiene dentro del diálogo ni lo devuelve al control que lo abrió. Los selectores personalizados incluyen roles y estados ARIA, pero eso no sustituye una prueba de navegación completa.

**Propuesta y ejemplo.** Al abrir un diálogo, enfocar su título o acción principal; mantener Tab/Mayús+Tab dentro; permitir Escape cuando corresponda; al cerrar, devolver el foco al elemento que lo abrió.

**Alcance y dependencias.** Corregir primero el componente central y luego revisar modales de horario, agenda y asistente. No requiere base de datos ni servicios externos.

**Riesgo y validación.** Riesgo bajo, aunque el manejo de Escape debe respetar diálogos destructivos. Validar sólo teclado y lector de pantalla en móvil y escritorio, incluyendo cierre, confirmación y retorno del foco.

## Correcciones incluidas en esta publicación

1. **Reinicio ante error de Supabase.** `static/js/personal_store.js`: espera confirmación de `reset_my_personal_data` antes de borrar la copia local. Si la llamada falla, conserva los datos del dispositivo. `tests/personal-store-reset.test.cjs` comprueba tanto el fallo como el reinicio confirmado.
2. **Reintento de malla tras una falla temporal.** `static/js/progreso.js`: una respuesta HTTP fallida ya no queda almacenada como una malla vacía durante toda la sesión; la siguiente consulta vuelve a intentarlo. `tests/progreso-career-gates.test.cjs` comprueba la recuperación.
3. **Contexto personal mínimo para el asistente.** `static/js/ai_assistant.js`: el contexto automático enviado al servicio de IA contiene sólo el horario y excluye notas y agenda. `tests/ai-academic-context.test.cjs` verifica las fuentes que lee el asistente.
4. **Actualización de recursos.** Se versionaron los scripts modificados en `templates/index.html` y se incrementó el caché del service worker para que los navegadores reciban esta versión.

La renovación del feed oficial cuando vence el caché y la ausencia de desplazamiento automático al abrir “Mi horario” ya están presentes en `main`; se verificaron y no se duplicaron en esta publicación.

Los seis cambios permanecen **sólo en esta copia local**; no se publicaron ni se subieron a Git.

## Verificación

- **88 pruebas Python** y **21 pruebas JavaScript** pasaron en la rama `main`, incluidas las nuevas pruebas de regresión para el reinicio remoto, el reintento de malla y el contexto del asistente.
- `git diff --check` pasó antes de crear la publicación.
- El despliegue automático de GitHub Actions (`38844990270`) terminó correctamente. El 16 de octubre de 2026, `https://horarios.dev/api/status` respondió HTTP 200 y reportó la fuente institucional en línea (1.315 clases y 85 salas).

## Límites y pasos recomendados

La revisión de código no sustituye una evaluación institucional. No se probaron permisos entre dos cuentas autenticadas, la exactitud académica del calendario con responsables de la universidad, carga representativa, lectores de pantalla en dispositivos reales ni recuperación push en todos los navegadores. La versión funcional revisada es `25d1afa`; la revisión de este informe se publica por separado. Cualquier validación posterior debe comparar el commit desplegado con el entorno de producción.

Antes de un piloto universitario, se recomienda: (1) validar este informe con responsables académicos y de privacidad; (2) decidir los permisos por módulo y la política del asistente; (3) revisar fuentes y vigencia de JSON y calendario; (4) ejecutar las pruebas completas; y (5) preparar una rama limpia, revisión institucional y plan de reversión antes del despliegue.

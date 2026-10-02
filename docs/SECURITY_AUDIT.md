# Auditoría de seguridad

Revisión realizada el 2 de octubre de 2026 en el código de `release/v1-core`, el checkout de producción `main` y el servicio activo en `horarios.dev`. Esto reduce riesgos comprobables; no equivale a una certificación ni garantiza que el sistema esté libre de vulnerabilidades.

## Cambios aplicados

- Se reemplazaron los límites de solicitudes en memoria por contadores SQLite atómicos compartidos entre workers de Gunicorn y reinicios. Cada usuario queda identificado por un hash; el archivo se crea con permisos privados. El límite de importación Gemini es cuatro intentos por usuario cada 60 segundos; la sincronización pública admite un intento cada 20 segundos.
- Se escaparon datos variables del feed académico, la agenda, el horario compartido y las notas antes de insertarlos en HTML, incluidos textos y argumentos de control en atributos. Las URLs versionadas de esos scripts cambiaron para que los navegadores recojan las correcciones.
- El endpoint de sincronización sólo admite `POST`; la importación Gemini valida el token de Supabase, el tipo y la firma de imagen, y limita su tamaño. Los errores de solemnidades ya no muestran detalles internos.
- Nginx limita cada IP a 15 solicitudes por segundo a `/api/`, permite una ráfaga de 60 y devuelve `429` al excederla; `/api/sync` conserva su enfriamiento global y Gemini su límite por usuario.
- El service worker no guarda páginas con parámetros de consulta —incluidos callbacks PKCE—, respuestas `/api/` ni rutas de autenticación; se incrementó su versión de caché.
- Si una sesión pasa a `SIGNED_OUT` mientras hay un usuario autenticado, la página ahora se recarga para ocultar cualquier módulo personal que estuviera abierto; no se borran datos locales.
- Nginx oculta su versión, evita registrar argumentos de URL y envía HSTS, `nosniff`, `DENY`, `strict-origin` y CSP con `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` y `form-action 'self'`.
- Se eliminó la clave Flask débil de respaldo, se fijó la versión e integridad SRI del SDK de Supabase, se fijaron los commits de las acciones de GitHub y se elevó el mínimo de `urllib3`.

## Datos y controles comprobados

La política compartida actual es intencional: usuarios autenticados que sean miembros permitidos pueden ver el horario, las notas, la agenda y el progreso de malla de otros perfiles con `share_information=true`. La migración devuelve sólo esos módulos y no expone el correo del perfil. Las tablas personales tienen RLS por `auth.uid()` y las funciones RPC validan la membresía. No se cambiaron las políticas ni se borraron datos.

En producción, las peticiones anónimas a `profiles`, `user_module_state` y las funciones de lectura compartida recibieron `401`. La página y `/api/status` respondieron `200`; `GET /api/sync` respondió `405`; la importación sin sesión respondió `401`; el límite compartido de sincronización dio `200` y luego `429`. Los payloads malformados y excesivos de `/api/sync_horario` respondieron `400` y `413`.

Una búsqueda de patrones de alta confianza no encontró credenciales en los archivos versionados ni en el historial Git alcanzable de ambos checkouts. `.env` no está versionado y tiene modo `600`. No se imprimieron valores de credenciales. No se encontraron mapas de fuente en los recursos estáticos y el análisis de dependencias no reportó vulnerabilidades conocidas.

HTTPS de `horarios.dev` y la redirección desde HTTP respondieron correctamente. El certificado de dominio vence el 30 de diciembre de 2026; el certificado para la IP vence el 5 de octubre de 2026. Ninguno estaba vencido. La simulación de renovación de Certbot para ambos certificados terminó correctamente. La renovación automática está habilitada con `snap.certbot.renew.timer`, programado dos veces al día, y el hook de despliegue valida y recarga Nginx tras una renovación. Let’s Encrypt ofrece certificados de IP de vida corta; el de esta máquina usa el perfil `shortlived` y requiere renovaciones frecuentes ([documentación oficial](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability), [soporte de Certbot](https://letsencrypt.org/2026/03/11/shorter-certs-certbot/)).

## Verificación ejecutada

- 32 pruebas Python, todas las pruebas Node, la sintaxis JavaScript, el YAML del workflow y `git diff --check` pasaron en el checkout de producción `main`.
- `pip-audit` no encontró vulnerabilidades conocidas y `pip check` no encontró dependencias incompatibles.
- `nginx -t` pasó con la configuración activa; el servicio usa límites SQLite en `/var/lib/buscadorsalas/rate_limits.sqlite3` y `UMask=0077`.
- En la VM envié 80 solicitudes ligeras a `/api/status` en una ráfaga local: 67 respondieron `200` y 13 `429`; tras seis segundos, una solicitud normal volvió a responder `200`.
- La web sirvió los scripts corregidos con URL versionada y las cabeceras nuevas.

## Límites y pasos pendientes

- No pude probar escrituras cruzadas con dos usuarios autenticados. El cliente usa PKCE y persistencia de sesión; la política se revisó en SQL y el acceso anónimo fue rechazado. Dejé una prueba de humo con `ROLLBACK` en `supabase/tests/rls_cross_account.sql`: ejecútala desde SQL Editor con dos UUID de cuentas UDP (sin compartirlos aquí); las lecturas y escrituras cruzadas deben dar cero filas afectadas. Hace falta ejecutar esa comprobación para validar RLS en la instancia real.
- La configuración pública de Auth indica que Google está habilitado, y una solicitud de autorización redirigió a Google aceptando `https://horarios.dev/` como retorno. El usuario comprobó que un correo fuera de `mail.udp.cl` no puede crear cuenta, lo cual coincide con la regla `public.hook_restrict_signup` definida en SQL. No pude consultar el estado del hook en el panel porque el CLI no tiene una sesión administrativa; mantuve la regla y no cambié los permisos de la base. No compartas tokens para hacer esta comprobación.
- Las personas detrás de una misma IP pública comparten el límite de Nginx. El umbral es alto para uso normal, pero una ráfaga conjunta puede recibir `429` temporalmente.
- El navegador guarda la sesión de Supabase y los datos personales sincronizados en `localStorage`; otro proceso o usuario con acceso al mismo perfil del navegador puede leerlos. Además, datos locales antiguos sin `portal:legacy-owner` no permiten identificar a su dueño y podrían migrarse a la primera cuenta que inicie sesión en ese perfil. No uses perfiles compartidos del navegador para cuentas distintas si contienen datos locales previos.
- CSP restringe marcos, objetos, `base-uri` y formularios, pero todavía no restringe `script-src`: la interfaz existente usa scripts y manejadores inline. Las inserciones dinámicas de texto deben seguir escapándose.
- Los límites Gemini restringen el abuso por cuenta; no sustituyen los límites/cuotas del proveedor. Confirma también un límite de gasto o cuota en Google AI Studio/Cloud.
- Los cambios de auditoría están publicados en `main`; los despliegues automáticos terminaron correctamente. Tras corregir el virtual host de Nginx, `nginx -t` y la recarga también terminaron correctamente.

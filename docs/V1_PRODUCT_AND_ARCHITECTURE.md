# V1 académica: producto, arquitectura y lanzamiento

## Objetivo

La primera versión publicable resuelve consultas académicas frecuentes y organización personal con una superficie pequeña y estable. Es una base para agregar cuentas, datos relacionales y colaboración sin arrastrar experimentos del prototipo.

## Alcance

Funciones públicas, sin inicio de sesión:

- Salas disponibles por día y bloque.
- Búsqueda por profesor y por ramo.
- Ramos y clases por semestre.
- Horario semanal de una sala.
- Calendario de solemnes.
- Modo estudio y timer, guardados sólo en el dispositivo.

Funciones personales, con Google OAuth:

- Horario personal, compartido por defecto con las cuentas autenticadas que pueden registrarse.
- Notas.
- Agenda.
- Malla interactiva y progreso.

El horario compartido sólo expone nombre visible, asignatura, día, hora y sala mediante `public.get_shared_schedules()`; no expone correo, notas, agenda, progreso, profesor, sección ni rol. `profiles.share_schedule` controla la visibilidad y se crea en `true`. No hay un control de visibilidad en la interfaz; se puede ocultar manualmente desde SQL con `UPDATE public.profiles SET share_schedule = false WHERE id = '<auth-user-uuid>';`. La tabla base conserva RLS sólo para el dueño y la función filtra cuentas ocultas, valida que quien consulta y el dueño sean miembros UDP/autorizados, y devuelve sólo los campos permitidos. El hook Before User Created debe quedar habilitado para limitar el registro a cuentas UDP y correos autorizados.

Quedan fuera de V1: chat o tutor de IA, perfiles de amigos, mensajería, reloj mundial, cronómetro, Kanban, gastos, compras, notas de voz, hábitos, guitarra, transporte, clima y corrector.

## Arquitectura

`app/__init__.py` crea la aplicación Flask. `app/blueprints/web.py` sirve la interfaz y configuración pública, `app/blueprints/academic_api.py` expone las consultas académicas y `app/services/schedule.py` contiene el procesamiento de horarios. `flask_app.py` conserva el entrypoint usado por Gunicorn.

Las vistas viven en `templates/views/` y los elementos compartidos en `templates/components/`. El frontend sigue siendo JavaScript y CSS nativos. El servicio de horarios descarga la fuente EIT, escribe su caché en `SCHEDULE_CACHE_FILE` y usa el `data.json` versionado como respaldo de sólo lectura.

Supabase entrega Google OAuth y persistencia. El navegador sólo recibe la URL y la clave publicable/anon; nunca se expone `service_role`. La tabla `user_module_state` guarda un documento JSON por usuario y módulo. RLS limita cada fila a `auth.uid()`. Los cambios se guardan primero en `localStorage` y luego se sincronizan, así que la interfaz sigue siendo útil durante cortes breves.

### Datos personales guardados

- `profiles`: ID de Supabase Auth, correo, nombre y apellido, y fechas de creación/actualización. La aplicación genera un avatar visual con las iniciales; esta tabla no guarda fotos ni enlaces a avatares.
- `user_module_state`: horario personal, notas, agenda y progreso de malla en un JSON por módulo, junto con la versión del esquema y las fechas de actualización. Cada persona sólo puede leer y modificar sus propias filas.
- `email_allowlist`: correo y motivo para autorizar cuentas fuera de `@mail.udp.cl`. Sólo el hook de registro puede leer esta lista.

Los horarios públicos, ramos y salas siguen usando la fuente académica/cache del servidor; no se duplican en estas tablas personales.

## Acceso

El hook `public.hook_restrict_signup` acepta correos `@mail.udp.cl` y direcciones incluidas manualmente en `public.email_allowlist`. El filtro del navegador mejora la experiencia, pero el hook es la barrera autoritativa.

Para agregar un correo externo autorizado:

```sql
insert into public.email_allowlist (email, reason)
values ('persona@example.com', 'Piloto V1');
```

## Configuración de Supabase y Google

1. Crear un proyecto con Data API habilitada, exposición automática de tablas nuevas deshabilitada y RLS automático habilitado. La migración concede permisos explícitos sólo a `authenticated` para las tablas personales; RLS limita cada fila al usuario propietario.
2. Aplicar `supabase/migrations/202609280001_v1_personal_data.sql` con `supabase db push` o el SQL Editor.
3. En Authentication > Hooks, seleccionar `public.hook_restrict_signup` como **Before User Created**.
4. Crear un cliente OAuth web en Google. El origen autorizado es `https://portal.144-22-33-41.sslip.io`; para preview, agregar `https://v1.144-22-33-41.sslip.io`.
5. Copiar desde Supabase la URL callback exacta `https://<project-ref>.supabase.co/auth/v1/callback` a las redirect URIs de Google y habilitar Google en Authentication > Providers.
6. En Supabase URL Configuration, usar el dominio estable como Site URL y agregar el dominio preview a Redirect URLs.
7. Copiar `.env.example` a `.env` en cada despliegue y completar `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SECRET_KEY`. La clave anon/publicable es apta para el navegador porque RLS protege los datos.

## Importación de horario desde una foto

La sección Horarios ofrece un botón de importación para fotos JPG, PNG, WebP y HEIC de hasta 9 MB. El endpoint `POST /api/import_schedule` valida el token de sesión de Supabase, limita intentos por usuario y envía la imagen en memoria a Gemini `gemini-3.5-flash-lite` con una respuesta JSON estructurada. Si el modelo está saturado, aplica reintentos con espera creciente y luego prueba `gemini-3.5-flash`. El navegador muestra un resumen para revisar; sólo al confirmar se reemplaza el horario local y sincronizado. El portal no persiste la imagen.

Configurar `GEMINI_API_KEY` en el archivo de entorno del servicio del servidor; nunca incluirla en JavaScript, HTML o Git. `GEMINI_MODEL` permite cambiar el modelo y por defecto usa `gemini-3.5-flash-lite`. La imagen se procesa mediante Google Gemini; en el nivel gratuito Google puede usar solicitudes para mejorar sus productos. El modelo extrae ramo, día, horas, sección, profesor, sala y tipo de clase. La validación conserva datos inciertos para revisión y no inventa campos que no logra leer. Profesor y sección se guardan en el horario propio, pero no se exponen en el directorio comunitario.

## PWA y HTTPS

La PWA usa un origen estable con certificado Let's Encrypt. El service worker sólo guarda la shell y recursos estáticos; excluye `/api/`, autenticación y datos personales. Cambios publicados se incorporan al abrir de nuevo la app o cuando el navegador actualiza el service worker.

Producción usa `portal.144-22-33-41.sslip.io` y puerto interno 5000. Preview usa `v1.144-22-33-41.sslip.io` y puerto 5001. Ambos dominios apuntan a la misma VM, pero a servicios y worktrees separados.

## Entrega

- Desarrollo: `release/v1-core`.
- Respaldo del prototipo: `archive/full-portal-2026-09-28` y tag `prototype-full-2026-09-28`.
- Preview: despliegue automático de `release/v1-core`.
- Producción: sólo después de aceptar el preview, fusionar a `main` y crear `v1.0.0`.

Validación mínima antes de publicar:

```bash
python -m unittest discover -s tests
curl --fail http://127.0.0.1:5001/api/status
```

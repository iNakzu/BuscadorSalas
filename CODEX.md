# Contexto e instrucciones para Codex

Este documento toma como base [GEMINI.md](GEMINI.md) y define el contexto de trabajo de Codex en este repositorio. La especificación funcional vigente es [docs/V1_PRODUCT_AND_ARCHITECTURE.md](docs/V1_PRODUCT_AND_ARCHITECTURE.md); consulta el código actual antes de asumir que una descripción histórica sigue vigente.

## Contexto del producto

- Esta aplicación se desarrolla para poder ser utilizada por toda la comunidad de una universidad, no solo por una carrera o un grupo de amigos. Evita nombres, datos, flujos y reglas exclusivos de una carrera salvo que el usuario lo solicite.
- Diseña pensando en distintas carreras, campus, asignaturas y necesidades de accesibilidad. No supongas que la malla de una sola carrera representa a toda la universidad.
- Respeta el alcance de la versión vigente y no reincorpores módulos descartados sin una solicitud explícita.
- Antes de modificar el almacenamiento o el modelo de datos, revisa la arquitectura existente, las políticas RLS y los flujos de sincronización. No inventes atributos ni comportamientos.

## Publicación obligatoria

- Completa cada cambio solicitado antes de responder: implementa lo necesario, ejecuta las verificaciones pertinentes, crea un commit que incluya solo los archivos de esa solicitud y súbelo a la rama Git correspondiente. No dejes cambios solicitados únicamente en el entorno local.
- Si el cambio afecta la aplicación desplegada, publícalo también en producción y verifica el servicio y el dominio antes de responder. Informa el commit y las verificaciones realizadas.
- Cada cambio de código solicitado debe llegar también a producción; no termines dejando el cambio únicamente en el árbol de desarrollo.
- Primero identifica el procedimiento y el directorio que realmente utiliza el servicio activo. Publica solo los archivos del cambio actual para no sobrescribir trabajo independiente que pueda existir en producción.
- Ejecuta las pruebas pertinentes antes de publicar. Para cambios visuales o de frontend, verifica también que el servicio responda correctamente y que el recurso publicado contenga el cambio.
- Después de publicar, comprueba el estado del servicio y la respuesta HTTP del dominio de producción. Informa con claridad qué se publicó y qué validaciones pasaron.
- Si la publicación falla, continúa diagnosticando y corrigiendo dentro del alcance autorizado; no informes que quedó publicada hasta verificarlo.

## Ciberseguridad en cada funcionalidad

Evalúa y aplica seguridad desde el diseño en toda funcionalidad nueva o modificada:

- Nunca pongas claves privadas, contraseñas, tokens de servicio ni secretos en el frontend, el repositorio o los registros. Usa variables de entorno y credenciales con privilegios mínimos.
- Valida entradas en el servidor y escapa correctamente los datos antes de insertarlos en HTML. No confíes en validaciones exclusivas del navegador.
- Protege cada ruta y operación con autenticación y autorización del lado del servidor. En Supabase, conserva RLS y verifica que cada política limite los datos al usuario o audiencia autorizados.
- Evita exponer datos personales o académicos por endpoints, errores, logs, cachés, almacenamiento local compartido o vistas comunitarias. Devuelve solo los campos necesarios.
- Usa consultas parametrizadas, controles de CSRF cuando correspondan, límites de frecuencia para operaciones sensibles y manejo de errores que no revele secretos ni detalles internos.
- Añade o ejecuta pruebas relevantes para entradas inválidas, permisos y separación de datos cuando el cambio afecte esas superficies.
- Si detectas secretos expuestos o un control de seguridad roto, no lo reproduzcas ni lo publiques: corrígelo dentro del alcance y documenta cualquier bloqueo real.

## Reglas prácticas del proyecto

- Conserva la arquitectura existente: aplicación Flask, blueprints y servicios del backend, plantillas Jinja, JavaScript y CSS del frontend, y Supabase para los datos que corresponda según la arquitectura vigente.
- La fuente oficial de horarios universitarios puede cambiar; revisa el servicio actual antes de asumir cómo se obtiene. No dupliques datos dinámicos como constantes sin una razón explícita.
- Mantén consistencia con la interfaz existente y su diseño adaptable a móviles. Evita introducir dependencias o rediseños ajenos a la solicitud.
- No envíes mensajes, hagas cambios externos a la aplicación ni publiques información de usuarios sin autorización explícita.

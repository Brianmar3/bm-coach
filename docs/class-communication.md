# Reacciones y opiniones de clases

## Comportamiento

- En el centro de notificaciones de BM Training, el entrenador puede reaccionar a cada `CLASS_RESPONSE` con Recibido, Gracias por avisar o Nos vemos. Es una respuesta a esa confirmación concreta, incluso si el alumno después cambia su confirmación. No cambia asistencia ni respuesta.
- La reacción queda en la notificación original. El alumno recibe una única entrada en su centro existente (`StudentNotification`, tipo `FEEDBACK`, clave `class-reaction:<notificationId>`). Cambiar la reacción actualiza el mismo mensaje; no genera push, conversaciones, respuestas en cadena ni vuelve a marcarlo como no leído.
- Los botones están en el centro de notificaciones dentro de la aplicación; no se agregan acciones al aviso del sistema operativo Android.
- En el portal de clases, incluida la tarjeta compacta, se ofrece una invitación contextual para la clase asistida finalizada más reciente aún no respondida u omitida. La fecha y clase se muestran explícitamente. Después de responder no se ofrece nuevamente esa clase; Omitir también persiste. No se encadenan invitaciones después de enviar/omitir durante la misma visita.
- Sólo se admiten ocurrencias concretas con `actualAttendance=PRESENT`, no canceladas y cuyo horario finalizó en Argentina. Confirmar GOING no habilita la opinión. No se infieren asistencias ni se vinculan registros históricos sin una ocurrencia identificable.
- Opinión privada e identificada: el alumno ve esta aclaración antes de enviar. Sólo el entrenador autorizado de su workspace puede leerlas en Clases → Opiniones.
- El panel incluye fecha, clase, conteo y distribución por clase, alumno y comentario opcional; filtros de fecha y nombre de clase, y páginas de 30 opiniones. Si una clase ocupa varias páginas, sus conteos siempre representan todas sus respuestas, no sólo la página visible.

## Persistencia y migración

No se crean tablas. Se agregan seis columnas opcionales a modelos existentes:

- `TrainerNotification`: `reaction`, `reactedAt`.
- `ClassOccurrenceAttendance`: `classRating`, `classComment`, `classFeedbackAt`, `classFeedbackSkippedAt`.

La restricción única existente `(occurrenceId, studentId)` y una actualización condicional que exige no haber respondido/omitido impiden duplicados, también con envíos simultáneos. Se conserva explícitamente `updatedAt` y se compara su valor anterior al guardar: ese timestamp interviene en el orden histórico de asistencias sin `checkedInAt`, por lo que una opinión no debe alterarlo. Las restricciones SQL limitan reacciones, valoraciones y comentarios a 1000 caracteres. Las columnas de asistencia y confirmación no se escriben desde estas operaciones.

Migración: `prisma/migrations/20261103190000_class_communication/migration.sql`. Es aditiva: los registros previos conservan su estado y reciben valores nulos en los campos nuevos. Fue probada en PostgreSQL en memoria. Sólo se regeneró el cliente Prisma local; no se aplicó a una base real.

Antes de publicar: revisar y autorizar la migración, comprobar las migraciones pendientes del entorno y aplicar únicamente las que formen parte del despliegue aprobado. Hay otros trabajos locales pendientes; no aplicar automáticamente todas sus migraciones. La migración de esta mejora debe estar aplicada antes de ejecutar la versión nueva, porque las consultas de notificaciones leen `reaction`. No requiere cron, push ni variables de entorno nuevas.

## Archivos de esta mejora

- `prisma/schema.prisma` (sólo los seis campos indicados; se preservan cambios locales anteriores).
- `prisma/migrations/20261103190000_class_communication/migration.sql`.
- `lib/class-communication.ts` y `lib/class-communication-service.ts`.
- `app/api/admin/notifications/route.ts` y `app/api/admin/notifications/[id]/reaction/route.ts`.
- `app/api/portal/clases/opiniones/route.ts` y `app/api/clases/opiniones/route.ts`.
- `componentes/admin-notification-center.tsx` y `componentes/class-confirmation-reactions.tsx`.
- `componentes/portal-classes.tsx` y `componentes/class-feedback-invitation.tsx`.
- `app/clases/page.tsx` y `componentes/class-opinions-panel.tsx`.
- `tests/class-communication.test.mjs` y este documento.

## Verificación

Pruebas dirigidas: `node --test --test-concurrency=1 --experimental-strip-types tests/class-communication.test.mjs tests/notification-popover.test.ts tests/notification-clear-all.test.ts tests/trainer-notification-destination.test.ts tests/student-notification-destination.test.ts tests/portal-class-schedule.test.ts`. Ejecutar antes o después del build, no simultáneamente, para limitar la memoria del compilador y PostgreSQL en memoria.

Se verifican permisos/origen, identidad del alumno, workspaces, clases futuras/en curso/canceladas, confirmación sin asistencia, ausencias, duplicados simultáneos, omisión persistente, cambio de reacción en una única notificación, panel y filtros, y componentes React a 390/1280 px. La migración se ejecuta sólo en PGlite en memoria. Las pruebas no envían push ni modifican datos reales. La instalación y el uso físico en Android requieren comprobación posterior al despliegue autorizado.

Resultado final: 85 pruebas relacionadas aprobadas; lint sin errores ni advertencias; build de producción local aprobado. Incluye regresión que conserva el orden y la sesión efectiva de asistencias antiguas al registrar una opinión.

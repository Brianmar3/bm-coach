# Resumen comercial del Master

Destinatario fijo: `briiianm36@gmail.com`. El sistema queda apagado por defecto. No se envió ningún correo ni se aplicaron cambios a una base remota durante la implementación.

## Funcionamiento

- Vercel invoca `GET /api/cron/master-memberships` con `0 11 * * *`: 08:00 en Argentina (UTC−3).
- Reutiliza `nextDueAt` y `effectiveTrainerSubscriptionStatus`; no cambia planes, cobros, vencimientos, estados, permisos o pantallas.
- Avisa exactamente a 7 y 3 días y el día del vencimiento, según el calendario argentino y la fecha vigente. Excluye vencimientos pasados y suscripciones canceladas o suspendidas.
- Las renovaciones quedan registradas por un trigger PostgreSQL, dentro de la misma transacción comercial. Cubre registrar pago, ampliar fecha y reactivar con ampliación. Sólo captura membresías activas con vencimiento futuro cuando aumenta el vencimiento previo o avanza el último pago. No interpreta altas, cambios de notas, operaciones idénticas, suspensiones o cancelaciones como renovaciones. No importa pagos históricos.
- El resumen reúne los avisos de vencimiento y cada evento pendiente de renovación o suspensión registrado hasta las 08:00. Los eventos posteriores se guardan para el día siguiente. Una suspensión se registra al entrar en ese estado, incluso sin una membresía asignada. Suspender el acceso y la membresía juntos genera un único evento. No se importan suspensiones históricas ni se incluyen invitaciones.
- El día sin novedades se registra como `SKIPPED`, sin contactar Resend. No se vuelve a abrir ese resumen si llegan cambios durante el día.
- HTML negro, blanco y dorado, con alternativa de texto. Incluye entrenador, plan, vencimiento, estado, motivo y enlaces privados al Master. Los eventos se asignan al resumen de forma atómica.

## Variables en Vercel Production

| Variable | Valor |
| --- | --- |
| `MASTER_EMAIL_ENABLED` | `false` inicialmente; `true` sólo al autorizar activación |
| `RESEND_API_KEY` | Clave privada de Resend con permiso para enviar desde el dominio verificado |
| `MASTER_EMAIL_FROM` | Dirección sin nombre ni corchetes, por ejemplo `master@tu-dominio.com` |
| `MASTER_APP_URL` | Origen HTTPS canónico de BM Training, por ejemplo `https://tu-dominio.com` |
| `CRON_SECRET` | Secreto aleatorio de al menos 32 caracteres; reutilizar el existente si cumple el requisito |
| `DATABASE_URL` | Conexión PostgreSQL existente, sin cambios |

`VERCEL_ENV=production` lo provee Vercel; local y Preview no envían aunque se habilite la bandera. Ninguna variable privada lleva `NEXT_PUBLIC_`. El correo destinatario no requiere configuración.

`onboarding@resend.dev` sirve para una prueba controlada únicamente si el destinatario fijo coincide con el correo de la cuenta Resend que emitió la clave. Para operación, usá una dirección de un dominio propio verificado. Mantené el cron apagado mientras preparás el remitente. Una eventual prueba de entrega con datos ficticios se hace por separado, con autorización explícita, sin consumir el resumen diario. [Restricciones de envío de prueba](https://resend.com/docs/api-reference/errors#validation-error-4).

## Activación (requiere autorización para producción)

1. Verificar el dominio remitente en Resend y configurar sus registros DNS. Crear la clave de envío y cargar las variables de Production con la bandera apagada.
2. Usar Vercel Pro o Enterprise si se requiere precisión de minuto. [Hobby ejecuta dentro de la hora programada](https://vercel.com/docs/cron-jobs/usage-and-pricing), por lo que no cumple las 08:00 puntuales. Los cron no garantizan el instante de llegada a Gmail.
3. Confirmar que la migración inicial está aplicada y que `20261108150000_master_suspension_events` es la única pendiente. Ensayarla en una base aislada. Primero publicar esta versión con el cliente Prisma regenerado (npm run build) y la bandera apagada, para que todas las rutas del Master adquieran el bloqueo de entrenador antes de escribir. Con autorización, aplicar la migración mediante Prisma y verificar los dos triggers de suspensión y el trigger de renovación existente. Los scripts que escriban estados deben seguir el mismo orden: bloquear la fila del entrenador con FOR NO KEY UPDATE antes de leer o modificar la membresía.
4. Confirmar en Vercel → Settings → Cron Jobs que figure `/api/cron/master-memberships` con `0 11 * * *`.
5. Activar `MASTER_EMAIL_ENABLED=true` en Production y redesplegar. No hace falta abrir el Master ni dejar una sesión iniciada. Las renovaciones se incluyen en el resumen diario, no generan correos inmediatos.
6. En la primera jornada con novedades, verificar el registro `SENT`, el ID de Resend y la entrega en su panel. `SENT` significa aceptado por Resend, no garantiza llegada a la bandeja principal. Revisar rebotes y spam en Resend/Gmail.

## Fiabilidad y operación

`master_email_digests` conserva un resumen único por fecha argentina, el contenido inmutable, estado, primer intento, lease, ID del proveedor y fecha de aceptación. `master_email_attempts` conserva cada intento y códigos sanitizados. `master_membership_renewals` conserva eventos y la asignación al resumen. Se guardan datos comerciales privados; restringir el acceso operativo a estas tablas igual que al resto de la base.

La creación del resumen y la asignación de eventos son atómicas. Un bloqueo transaccional PostgreSQL serializa las ejecuciones. El envío no mantiene abierta la transacción: utiliza un lease de 120 segundos, mayor que el límite de 60 segundos del endpoint, y un token que impide confirmaciones de otro proceso. Las peticiones a Resend tienen un timeout de 10 segundos y hasta tres intentos ante red, 409, 429 o 5xx.

Todos los reintentos usan `bm-master/<digestId>` y el mismo payload guardado. Resend [conserva las claves de idempotencia durante 24 horas](https://resend.com/docs/dashboard/emails/idempotency-keys). Por eso el sistema nunca reenvía automáticamente un lote de otro día ni uno con más de 23 horas desde el primer intento. Si la aceptación quedó incierta, prioriza evitar duplicados: pasa a `REVIEW` y lo informa en los logs del cron. Una falla entre aceptación y confirmación en la base deja el lease; una nueva ejecución después de 120 segundos recupera el mismo ID de Resend dentro de la ventana segura.

Vercel [no reintenta automáticamente un cron fallido](https://vercel.com/docs/cron-jobs/manage-cron-jobs). El sistema realiza sus tres intentos dentro de la invocación. Si persiste una incidencia, los logs `master_memberships_email_failed` y `master_memberships_email_review_required` requieren intervención. Con autorización de envío real, puede repetirse el endpoint ese mismo día después de las 08:00, con `Authorization: Bearer <CRON_SECRET>`; no eliminar registros ni cambiar IDs para forzar reenvíos.

Ante `REVIEW`, consultar primero el historial de Resend con el ID de proveedor o la clave del resumen. Si se confirma aceptación, reconciliar el registro con ese ID y `SENT`; si se confirma que no se envió, decidir explícitamente el reenvío, respetando el límite de un correo diario. No resetear lotes ambiguos ni liberar sus renovaciones automáticamente. Los intentos `STARTED` sin finalizar permiten identificar interrupciones de proceso.

Para pausar, establecer `MASTER_EMAIL_ENABLED=false` y redesplegar. La captura de renovaciones y suspensiones continúa y sus eventos pendientes se incluyen al reactivar. No borrar la migración ni el trigger durante una pausa.

## Validación local sin envío

`npm run test:master-email` ejecuta reglas, seguridad, plantilla, transporte simulado y servicio contra PostgreSQL aislado en memoria (PGlite). Las pruebas aplican el SQL real y ejercitan captura transaccional, rollback, concurrencia, corte horario, ausencia de novedades, reintentos, fallo después de aceptación y bloqueo de envíos ambiguos antiguos. Nunca leen `DATABASE_URL` ni llaman a Resend.

La comprobación HTTP local con base ficticia debe devolver 401 sin secreto, 200 `DISABLED` con secreto válido y bandera apagada, y 405 para POST. El build regenera el cliente Prisma, sin aplicar migraciones.

# Resumen comercial del Master

Destinatario fijo: `briiianm36@gmail.com`. El sistema queda apagado por defecto. No se envió ningún correo ni se aplicaron cambios a una base remota durante la implementación.

## Funcionamiento

- Vercel invoca `GET /api/cron/master-memberships` con `0 11 * * *`: 08:00 en Argentina (UTC−3).
- Reutiliza `nextDueAt` y `effectiveTrainerSubscriptionStatus`; no cambia planes, cobros, vencimientos, estados, permisos o pantallas.
- Actualizado 06/11/2026: resumen diario de vencimientos en los próximos siete días calendario argentinos, hoy y todos los vencidos pendientes. Incluye membresías suspendidas y cuentas profesionales suspendidas aunque no tengan fecha. Excluye suscripciones canceladas; una cuenta suspendida continúa siendo una alerta de acceso independiente. Incluye invitaciones de entrenadores creadas por propietarios, aún sin aceptar, desde dos días antes hasta siete días después del vencimiento. Excluye invitaciones usadas/canceladas y no toca invitaciones de alumnos.
- Las renovaciones quedan registradas por un trigger PostgreSQL, dentro de la misma transacción comercial. Cubre registrar pago, ampliar fecha y reactivar con ampliación. Sólo captura membresías activas con vencimiento futuro cuando aumenta el vencimiento previo o avanza el último pago. No interpreta altas, cambios de notas, operaciones idénticas, suspensiones o cancelaciones como renovaciones. No importa pagos históricos.
- El correo reúne alertas actuales y renovaciones pendientes registradas hasta las 08:00. Las posteriores se guardan para el día siguiente. Si hubo una interrupción del cron, las renovaciones sin asignar permanecen pendientes; las alertas de vencimiento se calculan para el día de ejecución, sin inventar alertas históricas.
- El día sin novedades se registra como `SKIPPED`, sin contactar Resend. No se vuelve a abrir ese resumen si llegan cambios durante el día.
- HTML negro, blanco y dorado, con alternativa de texto. Incluye entrenador, plan, vencimiento, estado, motivo, enlace HTTPS a `/master` y enlaces directos privados al entrenador o a la vista de invitaciones. Varias renovaciones del mismo entrenador se agrupan por la última; todos sus eventos se asignan al resumen de forma atómica.

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
3. Verificar la rama, el endpoint y el historial de Prisma en Neon Production. Ensayar la migración del commit en una rama aislada y revisar una opción de restauración. Con autorización, ejecutar `npx prisma migrate deploy` desde un checkout limpio del commit de correo únicamente si `20261027110000_master_membership_email` es la única pendiente. Verificar las tres tablas, el trigger y el historial tras aplicarla. La migración está envuelta en una transacción. `db push` omite el trigger.
4. Desplegar la aplicación con el cliente Prisma regenerado (`npm run build`). Confirmar en Vercel → Settings → Cron Jobs que figure `/api/cron/master-memberships` con `0 11 * * *`.
5. Activar `MASTER_EMAIL_ENABLED=true` en Production y redesplegar. No hace falta abrir el Master ni dejar una sesión iniciada. Las renovaciones se incluyen en el resumen diario, no generan correos inmediatos.
6. En la primera jornada con novedades, verificar el registro `SENT`, el ID de Resend y la entrega en su panel. `SENT` significa aceptado por Resend, no garantiza llegada a la bandeja principal. Revisar rebotes y spam en Resend/Gmail.

## Fiabilidad y operación

`master_email_digests` conserva un resumen único por fecha argentina, el contenido inmutable, estado, primer intento, lease, ID del proveedor y fecha de aceptación. `master_email_attempts` conserva cada intento y códigos sanitizados. `master_membership_renewals` conserva eventos y la asignación al resumen. Se guardan datos comerciales privados; restringir el acceso operativo a estas tablas igual que al resto de la base.

La creación del resumen y la asignación de renovaciones son atómicas. Un bloqueo transaccional PostgreSQL serializa las ejecuciones. El envío no mantiene abierta la transacción: utiliza un lease de 120 segundos, mayor que el límite de 60 segundos del endpoint, y un token que impide confirmaciones de otro proceso. Las peticiones a Resend tienen un timeout de 10 segundos y hasta tres intentos ante red, 409, 429 o 5xx.

Todos los reintentos usan `bm-master/<digestId>` y el mismo payload guardado. Resend [conserva las claves de idempotencia durante 24 horas](https://resend.com/docs/dashboard/emails/idempotency-keys). Por eso el sistema nunca reenvía automáticamente un lote de otro día ni uno con más de 23 horas desde el primer intento. Si la aceptación quedó incierta, prioriza evitar duplicados: pasa a `REVIEW` y lo informa en los logs del cron. Una falla entre aceptación y confirmación en la base deja el lease; una nueva ejecución después de 120 segundos recupera el mismo ID de Resend dentro de la ventana segura.

Vercel [no reintenta automáticamente un cron fallido](https://vercel.com/docs/cron-jobs/manage-cron-jobs). El sistema realiza sus tres intentos dentro de la invocación. Si persiste una incidencia, los logs `master_memberships_email_failed` y `master_memberships_email_review_required` requieren intervención. Con autorización de envío real, puede repetirse el endpoint ese mismo día después de las 08:00, con `Authorization: Bearer <CRON_SECRET>`; no eliminar registros ni cambiar IDs para forzar reenvíos.

Ante `REVIEW`, consultar primero el historial de Resend con el ID de proveedor o la clave del resumen. Si se confirma aceptación, reconciliar el registro con ese ID y `SENT`; si se confirma que no se envió, decidir explícitamente el reenvío, respetando el límite de un correo diario. No resetear lotes ambiguos ni liberar sus renovaciones automáticamente. Los intentos `STARTED` sin finalizar permiten identificar interrupciones de proceso.

Para pausar, establecer `MASTER_EMAIL_ENABLED=false` y redesplegar. La captura de renovaciones continúa y sus eventos pendientes se incluyen al reactivar. No borrar la migración ni el trigger durante una pausa.

## Validación local sin envío

`npm run test:master-email` ejecuta reglas, seguridad, plantilla, transporte simulado y servicio contra PostgreSQL aislado en memoria (PGlite). Las pruebas aplican el SQL real y ejercitan captura transaccional, rollback, concurrencia, corte horario, ausencia de novedades, reintentos, fallo después de aceptación y bloqueo de envíos ambiguos antiguos. Nunca leen `DATABASE_URL` ni llaman a Resend.

La comprobación HTTP local con base ficticia debe devolver 401 sin secreto, 200 `DISABLED` con secreto válido y bandera apagada, y 405 para POST. El build regenera el cliente Prisma, sin aplicar migraciones.

## Diagnóstico 08/11/2026

Consulta de solo lectura en Neon Production (rama `br-plain-smoke-avc7nu90`, endpoint `ep-crimson-voice-avwm5uvh`): 55 migraciones aplicadas y ninguna inconclusa. La migración del Master, sus tres tablas y el trigger están ausentes. Las dos migraciones locales pendientes son la del Master y la de reintentos de alumnos. Este candidato incluye únicamente la primera. La configuración remota de Vercel y la titularidad del remitente de Resend quedan por verificar. No se ejecutaron migraciones ni envíos.

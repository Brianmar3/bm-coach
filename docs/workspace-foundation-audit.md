# Workspace Foundation — auditoría del 14/09/2026

Estado: implementación de aislamiento terminada en código; validación de datos reales pendiente porque la migración y el backfill siguen sin ejecutarse. No habilitar multi-trainer ni declarar la foundation operativa hasta completar la secuencia de staging indicada al final.

## Estado anterior

La primera etapa sólo tenía `User`, `Workspace`, `WorkspaceMembership` y `workspaceId` nullable en `StudentRecord` y `CoachSettingsRecord`. Alumnos, pagos, evaluaciones, búsqueda, ranking y parte de notificaciones ya tenían guardas iniciales. Rutinas, biblioteca, clases, dashboard, resumen mensual, eventos y Push todavía conservaban raíces globales o consultas agregadas sin scope.

La migración `20260909120000_workspace_foundation` estaba pendiente en Neon y el backfill no se había ejecutado. Esto volvió seguro completar esa misma migración sin reescribir una migración aplicada.

## Cambios de schema y migración

Se agregó ownership nullable a las raíces operativas:

- `MonthlySummary`, `TrainerPushSubscription`, `TrainerNotification`.
- `PaymentRecord`, `EventRecord`, `CoachEvent`, `RoutineRecord`, `EvaluationRecord`.
- `TrainingRoutine`, `TrainingLibraryFolder`, `TrainingLibraryTag`, `TrainingBlockTemplate`.
- `WeeklyClassSchedule`, `ClassOccurrence`, `ClassSession`.

`TrainingRoutine` y la biblioteca incorporan `WorkspaceContentScope` con `GLOBAL` y `WORKSPACE`. Las claves únicas de resumen mensual, suscripciones Push, eventos de notificación, carpetas y tags ahora incluyen `workspaceId`. Se agregaron índices y foreign keys para las nuevas relaciones.

Las columnas permanecen nullable para permitir una migración expansiva seguida por backfill. La regla de aplicación y el verificador consideran inválido cualquier contenido `WORKSPACE` u otra raíz operativa que conserve `NULL` después del backfill.

## Resolución central y reglas de acceso

`lib/workspace-access.ts` concentra autorización de membership, comparación de ownership y visibilidad `GLOBAL`/`WORKSPACE`. `lib/trainer-workspace.ts` resuelve el workspace desde la sesión administrativa existente y el owner inicial, y expone guardas para alumno, rutina, horario y ocurrencia.

Ninguna ruta nueva acepta `workspaceId` del cliente. Los IDs enviados se vuelven a consultar y validar en backend. Una entidad ajena responde como no disponible según la convención existente, sin confirmar ownership de otro tenant.

La sesión administrativa actual sigue siendo el token legado y sólo se vincula al owner de `bm-fuerza-funcional`. No se implementaron login individual de Trainer B, signup, invitaciones ni roles avanzados.

## Rutinas, biblioteca y seguimiento

- Listados y lecturas permiten contenido `GLOBAL` o contenido privado del workspace actual.
- Edición, activación, archivo, borrado, ejercicios, versiones y deduplicación sólo operan sobre contenido `WORKSPACE` propio.
- La duplicación permite una fuente global o propia y siempre crea una copia privada en el workspace actual.
- Una rutina privada ajena no puede leerse, copiarse, modificarse ni asignarse.
- Las asignaciones validan simultáneamente rutina y alumnos del mismo workspace.
- La rutina activa del portal incluye `workspaceId`; sesiones e historial de seguimiento filtran por alumno y rutina del mismo workspace.
- Carpetas, tags y bloques privados se crean con workspace; las búsquedas muestran globales y propios; los globales no se modifican desde APIs de trainer.
- El catálogo usado por propuestas de rutina sólo toma ejercicios globales/propios y registros rápidos de alumnos propios.

## Horarios, clases, confirmaciones y asistencias

- Horarios recurrentes, altas, cambios, archivo y borrado se filtran por workspace.
- La generación de ocurrencias requiere workspace y lo persiste incluso para instancias derivadas.
- Agenda, semana, resumen de asistencia, clases del dashboard y opciones de alta sólo consultan horarios y ocurrencias propios.
- Las asignaciones y el horario principal exigen alumno y schedule del mismo workspace.
- Confirmación y asistencia conservan la regla `student + fecha → turno efectivo`, limitada a ocurrencias del workspace del alumno.
- Las mutaciones de asistencia validan occurrence, schedule y student en backend.

## Dashboard, resúmenes, eventos y almacenamiento legado

El dashboard filtra alumnos, pagos, evaluaciones, puntos, rutinas, clases, asistencias, sesiones y eventos por workspace antes de calcular KPIs.

El resumen mensual recibe el workspace resuelto por sesión. Borrador, cierre, snapshot, CSV y datos imprimibles usan la clave `workspaceId + year + month`; pagos, obligaciones, membresías, asistencias, evaluaciones, entrenamientos y eventos se filtran por la relación con alumnos del mismo workspace.

Los eventos del entrenador y su publicación a alumnos tienen ownership explícito. Las colecciones JSON legadas de pagos, eventos, evaluaciones y rutinas reciben o filtran `workspaceId`, evitando reemplazos globales desde `/api/store`.

## Push y centro de notificaciones

- Suscripciones Push del entrenador son únicas por `workspaceId + endpoint`.
- El despacho sólo carga dispositivos activos del workspace de la notificación.
- Notificaciones por asistencia, entrenamiento y puntos guardan el workspace derivado del alumno u ocurrencia.
- Inbox, unread count, marcar como leído y clear-all filtran directamente por `TrainerNotification.workspaceId`; `ownerKey` queda sólo como compatibilidad histórica y ya no autoriza acceso.
- Las APIs de suscripción, baja, diagnóstico y prueba validan el workspace actual.
- Las notificaciones de eventos a alumnos sólo seleccionan destinatarios del workspace del evento.

## SELF_SERVICE y PERSONAL

El backfill crea un workspace `PERSONAL` determinista por cada alumno `SELF_SERVICE`, conserva IDs y datos y no lo asigna al workspace profesional. Rutina activa, creación de rutina, sesiones, progreso y páginas autogestionadas usan el workspace de la credencial del alumno.

El verificador exige un solo alumno SELF_SERVICE por workspace PERSONAL, tipos correctos, ausencia de PERSONAL compartidos y ninguna relación cruzada con rutinas o clases.

## Backfill

El script continúa siendo transaccional e idempotente en sus upserts y actualizaciones de `NULL`. Además de alumnos y configuración, cubre todas las nuevas raíces operativas.

Las rutinas existentes derivan workspace desde sus asignaciones cuando hay una única procedencia; una rutina con alumnos de más de un workspace aborta. Las colecciones JSON históricas de rutinas, pagos, evaluaciones y clases también derivan ownership de sus referencias de alumno y abortan ante procedencias múltiples. Las ocurrencias derivan del horario. Las notificaciones derivan de alumno/ocurrencia y abortan si ambas procedencias difieren. Las raíces sin referencia de alumno se asignan al workspace inicial.

Antes de confirmar la transacción, el backfill rechaza cruces en asignaciones de rutina, asignaciones y horario principal de clases, respuestas/asistencias por ocurrencia y sesiones de entrenamiento. No contiene borrado de datos y no se ejecutó en esta tarea.

## Verificador

`scripts/verify-workspace-foundation.mjs` es de solo lectura y comprueba:

- owner y membership inicial;
- coached students y settings sin workspace;
- SELF_SERVICE/PERSONAL incorrectos o compartidos;
- todas las raíces operativas con `workspaceId IS NULL`;
- contenido privado sin workspace;
- cruces rutina/alumno, schedule/alumno, horario principal, occurrence/schedule, attendance/occurrence/alumno, workout/rutina/alumno y notification/destinatario.

Resultado contra Neon: `P2021`, `public.workspaces` no existe. Esto confirma que la migración sigue sin aplicar y evita afirmar que los datos reales ya pasaron las invariantes. El intento fue de solo lectura y no modificó producción.

## Pruebas y validaciones

- Tests focalizados de foundation, A/B, rutinas, duplicados, biblioteca, clases, resumen mensual, pagos, search, ranking, notificaciones y Push: **143/143**.
- `workspace-foundation.test.ts`: **12/12**. Incluye Trainer A/B, contenido global/privado, memberships suspendidas, SELF_SERVICE/PERSONAL, migración, backfill y contratos de endpoints críticos.
- Pretest completo del repositorio: **74/74**.
- Suite principal completa: **614/617**. Quedan tres fallos visuales/UX ajenos a Workspace Foundation en `block-timer.test.ts`, `portal-class-schedule.test.ts` y `portal-home-motion.test.ts`; los archivos de implementación implicados no fueron modificados en este trabajo.
- `npm run lint`: aprobado.
- `npx next build`: aprobado, incluida la comprobación TypeScript.
- `npx prisma validate`: aprobado.
- `git diff --check`: aprobado; sólo informa normalización futura LF/CRLF.

## Riesgos y pendientes antes de desplegar

La implementación está lista para ensayar la migración pendiente, pero la foundation no puede declararse operativa mientras el verificador no corra sobre datos migrados.

Secuencia requerida en una base de staging o clon:

1. Tomar inventarios y backup.
2. Aplicar `20260909120000_workspace_foundation`.
3. Ejecutar el backfill con `--apply` y las variables explícitas del owner.
4. Ejecutar el verificador hasta obtener cero raíces huérfanas y cero relaciones cross-workspace.
5. Comparar conteos y flujos críticos antes/después.
6. Repetir la secuencia controlada en Neon y recién después habilitar código dependiente de la foundation.

No se ejecutó `migrate deploy`, `migrate reset`, backfill, commit ni push. Tampoco se implementaron registro de entrenadores, SaaS, pagos comerciales, trials, branding por tenant, invitaciones o staff avanzado.

## MIGRATION REHEARSAL — 14/09/2026

**Resultado: ensayo controlado aprobado en `workspace-staging`.**

### Entorno y límites

- Configuración local aislada de staging, no versionada.
- Los endpoints de staging y producción se comprobaron como distintos antes de acceder a datos.
- Los endpoints, autoridades y URLs no coinciden; staging quedó confirmada antes del primer acceso a datos.
- No se mostró la URL completa, usuario ni contraseña.
- No se cambió ninguna variable de Vercel ni se ejecutó ningún comando contra producción.
- No se usó `prisma migrate reset` ni `prisma db push`.

### Inventario BEFORE y AFTER

Los reportes completos quedaron en `docs/workspace-foundation-rehearsal-before.json` y `docs/workspace-foundation-rehearsal-after.json`.

| Entidad | BEFORE | AFTER | Diferencia |
| --- | ---: | ---: | ---: |
| Alumnos | 64 | 64 | 0 |
| SELF_SERVICE | 1 | 1 | 0 |
| Rutinas relacionales | 17 | 17 | 0 |
| Plantillas de bloque | 14 | 14 | 0 |
| Asignaciones de rutina | 12 | 12 | 0 |
| Sesiones de entrenamiento | 24 | 24 | 0 |
| Evaluaciones físicas | 4 | 4 | 0 |
| Pagos normalizados | 112 | 112 | 0 |
| Horarios | 28 | 28 | 0 |
| Asignaciones de horario | 139 | 139 | 0 |
| Ocurrencias | 337 | 337 | 0 |
| Respuestas/asistencia por ocurrencia | 702 | 702 | 0 |
| Confirmaciones | 146 | 146 | 0 |
| Asistencias históricas | 721 | 721 | 0 |
| Notificaciones de alumnos | 609 | 609 | 0 |
| Notificaciones del entrenador | 193 | 193 | 0 |
| Notificaciones de logros | 355 | 355 | 0 |
| Push subscriptions de alumnos | 16 | 16 | 0 |
| Push subscriptions del entrenador | 7 | 7 | 0 |
| Settings | 1 | 1 | 0 |
| Resúmenes mensuales | 1 | 1 | 0 |
| Users | tabla ausente | 1 | +1 esperado |
| Workspaces | tabla ausente | 2 | +2 esperados |
| Memberships | tabla ausente | 1 | +1 esperado |

No desapareció ni se duplicó ninguna entidad de negocio. Las únicas altas son las estructuras esperadas de foundation.

### Migración e inspección

- `prisma migrate status` inicial: 44 migraciones encontradas y sólo `20260909120000_workspace_foundation` pendiente.
- `prisma migrate deploy`: aplicado correctamente en staging.
- Estado final: database schema up to date.
- Inspección posterior: existen `users`, `workspaces` y `workspace_memberships`; no falta ningún `workspaceId` o `scope` previsto.
- `WorkspaceContentScope` contiene `GLOBAL` y `WORKSPACE`.
- Se verificaron los índices workspace/scope, claves únicas y claves foráneas de la migración.

### Backfill e idempotencia

El primer intento excedió el timeout interactivo predeterminado de Prisma de 5 segundos y PostgreSQL revirtió la transacción completa. Un inventario inmediato confirmó 0 users, 0 workspaces, 0 memberships y todos los conteos de negocio intactos. Se configuró en `scripts/backfill-initial-workspace.mjs` un `maxWait` de 10 segundos y un timeout transaccional de 120 segundos.

Primera pasada efectiva:

- workspace BM creado: `bm-fuerza-funcional`;
- owner y membership OWNER creados: 1;
- alumnos gestionados asignados: 63;
- alumnos SELF_SERVICE asignados a PERSONAL: 1;
- settings asignados: 1;
- rutinas: 17;
- carpetas: 15;
- plantillas: 14;
- schedules: 28;
- occurrences: 337;
- monthly summaries: 1;
- trainer push subscriptions: 7;
- trainer notifications: 193;
- restantes raíces legacy vacías: 0 actualizaciones.

Segunda pasada:

- mismo workspace y mismo owner;
- 0 alumnos, 0 SELF_SERVICE y 0 settings actualizados;
- 0 actualizaciones en todas las raíces operativas;
- workspaces, users y memberships permanecieron en 2, 1 y 1.

La segunda pasada confirma idempotencia: no duplicó workspaces, memberships ni ownership.

### Verifier, BM y SELF_SERVICE

`scripts/verify-workspace-foundation.mjs` finalizó correctamente:

- workspace BM y owner membership: OK;
- 63 alumnos gestionados en BM y 0 alumnos sin workspace;
- 0 SELF_SERVICE sin workspace o asignados a BM;
- settings y todas las raíces operativas asignadas;
- 0 contenidos privados sin workspace;
- 0 relaciones cross-workspace;
- aislamiento completo: OK.

El único SELF_SERVICE conserva datos de perfil y credencial, tiene un workspace PERSONAL exclusivo y no comparte workspace. Conserva 0 asignaciones de rutina y 0 sesiones, coherentes con los conteos originales sin pérdida global.

### Trainer A / Trainer B

Se ejecutó un fixture real dentro de una transacción con rollback obligatorio. Desde Workspace A, las consultas sobre registros temporales de Workspace B devolvieron 0 para alumnos, edición de alumno, rutinas, asignaciones, pagos, evaluaciones, schedules, notifications y search. Después del rollback quedaron 0 registros del fixture.

Los tests de contrato confirman además la convención existente de recurso no disponible para ownership ajeno y que contenido privado sólo es visible en su workspace.

### Smoke tests

Una instancia local temporal se ejecutó con la conexión fijada exclusivamente a staging. Respondieron HTTP 200:

- login administrativo;
- dashboard;
- alumnos;
- seguimiento;
- rutinas;
- biblioteca;
- clases;
- asistencias;
- pagos;
- resumen mensual;
- evaluaciones;
- ranking;
- notifications;
- search;
- diagnóstico Push.

La instancia se cerró al finalizar. El inventario posterior a los smoke tests siguió sin diferencias de negocio.

### Tests y validaciones

- Tests focalizados de workspace, SELF_SERVICE y módulos relacionados: **142/142**.
- `workspace-foundation.test.ts`: **12/12**.
- Pretest completo: **74/74**.
- Suite principal: **614/617**. Los únicos fallos son los tres visuales previos conocidos en `block-timer.test.ts`, `portal-class-schedule.test.ts` y `portal-home-motion.test.ts`.
- `npm run lint`: aprobado.
- `npm run build`: aprobado desde `.next` limpio, incluida la comprobación TypeScript.
- `npx prisma validate`: aprobado.
- `git diff --check`: aprobado; sólo avisos de normalización futura LF/CRLF.

### Readiness

**READY FOR CONTROLLED PRODUCTION MIGRATION.**

El resultado autoriza preparar una ejecución productiva controlada con inventario y backup previos, ventana definida, `migrate deploy`, backfill con el timeout verificado, segunda pasada idempotente, verifier e inventario posterior. Este ensayo no aplicó migraciones, backfills ni cambios manuales en producción. No se hizo commit ni push.

## PRODUCTION MIGRATION — 14/09/2026

**Resultado: detenida en el gate de compatibilidad, antes de acceder o escribir datos productivos.**

### Confirmación de destinos

- Las conexiones locales de production y staging se identificaron como endpoints distintos.
- Production y staging tienen hosts, autoridades y URLs distintos.
- Los archivos de configuración local de production y staging quedaron diferenciados y fuera del control de versiones.
- `pre-workspace-foundation-backup` fue confirmada manualmente por el operador, con parent `production` y creada inmediatamente antes del intento productivo.
- El backup queda reservado como rollback point; no se cargó su URL, no se conectó y no se modificó.

### Gate de backup

Gate satisfecho mediante verificación manual explícita del operador. Las tres branches quedaron diferenciadas: `production` es el único destino autorizado, `workspace-staging` queda fuera de esta ejecución y `pre-workspace-foundation-backup` permanece intacta.

### Gate de compatibilidad

**NO backward-compatible con la versión de aplicación anterior a Workspace Foundation durante el intervalo solicitado.**

Aunque las columnas `workspaceId` nuevas son nullable y los campos `scope` tienen default, la migración reemplaza constraints que el cliente Prisma y el código anterior todavía utilizan:

- elimina `trainer_push_subscriptions_endpoint_key`, mientras la app anterior ejecuta `trainerPushSubscription.upsert({ where: { endpoint } })`;
- elimina `trainer_notifications_eventKey_key`, mientras la app anterior depende de `eventKey` global para deduplicar notificaciones;
- elimina `monthly_summaries_year_month_key`, mientras la app anterior usa `findUnique`, `upsert` y `update` con `year_month`;
- elimina los índices únicos globales de `training_library_folders.normalizedName` y `training_library_tags.normalizedName`, cambiando la semántica de deduplicación anterior.

Además, una app anterior a foundation sigue creando o actualizando alumnos, rutinas, clases, resúmenes, notificaciones, Push y colecciones legacy sin `workspaceId`. Si permaneciera desplegada después del backfill, podría introducir nuevas raíces con ownership nulo y hacer que el verifier deje de mantenerse en cero.

Por lo tanto, ejecutar `migration → backfill → verifier` y dejar luego la versión anterior activa hasta un deploy posterior no conserva el contrato operativo exigido.

### Secuencia segura requerida

Se necesita una ventana única que incluya control de escrituras de la app y el deploy del código Workspace Foundation, o una estrategia expand/contract previa:

1. impedir escrituras reales durante la transición;
2. conservar temporalmente los constraints únicos legacy o desplegar primero una versión puente capaz de operar antes y después del cambio;
3. ejecutar inventario, migración aditiva, backfill doble y verifier;
4. desplegar inmediatamente el código Workspace Foundation dentro de la misma ventana;
5. ejecutar inventory AFTER y smoke tests antes de reabrir escrituras;
6. retirar constraints legacy en una migración contract posterior, cuando ya no exista ningún cliente anterior.

La tarea actual prohíbe cambiar Vercel y desplegar la aplicación, por lo que no permite completar esa secuencia de manera segura.

### Acciones no ejecutadas

- inventario o snapshot lógico de producción;
- `prisma migrate status` contra producción;
- `prisma migrate deploy`;
- inspección post-migration;
- backfill, verifier o inventario AFTER;
- smoke tests productivos;
- cambios en Neon, backup, Vercel o sus variables;
- commit, push o deploy de aplicación.

No se mostró ninguna credencial ni URL completa.

### Readiness

**PRODUCTION MIGRATION STOPPED — MANUAL REVIEW REQUIRED.**

Para reanudar, primero debe aprobarse y preparar la secuencia de transición descrita arriba, incluyendo el control de escrituras y el deploy coordinado de la app. No corresponde ejecutar la migración actual dejando activa la versión previa durante un intervalo abierto.

## EXPAND / CONTRACT DEPLOYMENT PLAN

### Auditoría de la migración original

La migración original mezclaba operaciones aditivas con cinco retiros incompatibles. No contenía `DROP CONSTRAINT`, `ALTER COLUMN ... SET NOT NULL`, eliminación de campos, `DELETE`, `TRUNCATE` ni `DROP TABLE`.

**A. Operaciones EXPAND-safe que permanecen en la migración activa:**

- creación de los enums `UserStatus`, `WorkspaceType`, `WorkspaceStatus`, `WorkspaceRole`, `WorkspaceMembershipStatus` y `WorkspaceContentScope`;
- creación de `users`, `workspaces` y `workspace_memberships`, con sus claves primarias, defaults e índices;
- agregado nullable de `workspaceId` a las 17 raíces de ownership;
- agregado de `scope NOT NULL DEFAULT 'WORKSPACE'` a rutinas, carpetas, tags y plantillas. El default conserva las escrituras de la app anterior;
- índices ordinarios por workspace y scope;
- uniques nuevos por workspace para Push, notifications, carpetas, tags y resumen mensual;
- FKs nuevas sobre columnas nullable. No invalidan filas anteriores y conservan sus valores nulos hasta el backfill.

**B. Operaciones reservadas para CONTRACT:**

- `SET NOT NULL` sobre los 17 `workspaceId`, después de demostrar cero nulos;
- retiro de los cinco índices únicos legacy;
- actualización simultánea del schema Prisma para hacer requeridos esos campos;
- retiro de cualquier control operativo transitorio de despliegue.

**C. Operaciones que hacían incompatible la migración original:**

- `DROP INDEX "trainer_push_subscriptions_endpoint_key"` rompía el `upsert` legacy por `endpoint`;
- `DROP INDEX "trainer_notifications_eventKey_key"` retiraba la deduplicación global que usa la app anterior;
- `DROP INDEX "training_library_folders_normalizedName_key"` y `DROP INDEX "training_library_tags_normalizedName_key"` cambiaban el contrato de nombres normalizados de la biblioteca;
- `DROP INDEX "monthly_summaries_year_month_key"` rompía `findUnique`, `upsert` y `update` legacy por `year_month`.

Esas cinco sentencias fueron removidas de la migración activa EXPAND y viven únicamente en `prisma/pending-contract/workspace_foundation/migration.sql`.

### Compatibilidad transitoria

Durante EXPAND conviven cada unique legacy y su unique nuevo por workspace. La app anterior puede seguir usando `endpoint`, `eventKey`, `normalizedName` y `year_month`; la app nueva usa las claves compuestas y escribe `workspaceId` en alumnos, rutinas, clases, pagos, evaluaciones, biblioteca, Push, notifications y resúmenes.

La resolución administrativa es fail-closed: la app workspace-aware exige una membresía OWNER activa del workspace BM. Antes de que termine el backfill no habilita lecturas o escrituras administrativas sin ownership. Los registros `GLOBAL` pueden mantener `workspaceId = NULL`; los registros privados sólo se leen dentro del workspace. El backfill se ejecuta en una transacción y sólo modifica raíces con `workspaceId = NULL`, por lo que una segunda ejecución produce cero cambios y nunca reemplaza ownership existente.

Los uniques globales conservados implican una restricción temporal deliberada: hasta CONTRACT no se habilita onboarding de otro workspace que necesite reutilizar el mismo nombre normalizado de biblioteca o el mismo par año/mes de resumen. Esto mantiene compatibles ambos clientes sin relajar deduplicación. El ensayo debe tratar cualquier intento de alta multi-workspace con esas claves durante EXPAND como bloqueado operacionalmente.

Push conserva `endpoint` global y agrega `(workspaceId, endpoint)`. Notifications conserva `eventKey` global y agrega `(workspaceId, eventKey)`; inbox, unread, clear-all y diagnostics resuelven el workspace antes de consultar o actualizar. Resumen mensual conserva `year_month` y agrega `(workspaceId, year, month)`; sus cálculos de cobrado, esperado, cierres, movimientos, CSV e impresión reciben el workspace. Library conserva los uniques globales de carpetas y tags, agrega sus variantes por workspace y usa `GLOBAL` o `WORKSPACE` para visibilidad.

No se habilita una lectura general de filas privadas con ownership nulo. La única tolerancia a `workspaceId = NULL` es para contenido con `scope = GLOBAL`. Esto evita una mezcla accidental entre Trainer A y Trainer B. La disponibilidad durante el corte se resuelve con una pausa breve de escrituras, no relajando el aislamiento.

### Separación física de las fases

`prisma/migrations/20260909120000_workspace_foundation/migration.sql` contiene sólo EXPAND. CONTRACT se conserva fuera de la cadena automática, en `prisma/pending-contract/workspace_foundation/migration.sql`; por eso un `prisma migrate deploy` no puede aplicar ambas fases juntas. CONTRACT incluye un bloque de preflight que aborta antes del primer cambio si falta un índice final o si cualquiera de las 17 raíces conserva un `workspaceId` nulo.

El verificador exige una fase explícita:

- `--phase=expand`: columnas presentes y nullable en schema, cinco índices legacy presentes, cinco uniques por workspace presentes y cero ownership pendiente después del backfill;
- `--phase=contract`: columnas `NOT NULL`, índices legacy ausentes, uniques por workspace presentes y los mismos controles de datos, SELF_SERVICE y relaciones cross-workspace en cero.

### Estrategia limpia para staging y repositorio

`workspace-staging` recibió el archivo anterior, con un checksum y efectos distintos. No debe reutilizarse para validar la nueva historia ni repararse a mano. Para rehearsal 2 se crea una branch nueva desde un baseline production-like anterior a Workspace Foundation, o se recrea `workspace-staging` desde `production` si la política de Neon lo permite. Después se aplica la cadena actual desde cero. La branch vieja puede conservarse temporalmente como evidencia del rehearsal 1 y eliminarse sólo por una tarea autorizada aparte.

En el repositorio, la migración todavía no fue aplicada en producción ni publicada mediante commit, por lo que corregirla antes de su primera aplicación productiva evita introducir una migración compensatoria. El checksum aplicado en el staging anterior queda deliberadamente descartado al recrear esa branch. CONTRACT se promoverá más adelante a una nueva migración timestamped; nunca se editará EXPAND después de que llegue a producción.

### Rehearsal 2 requerido

1. Crear un baseline staging nuevo, production-like, y confirmar que su endpoint difiere de production y backups.
2. Guardar inventory BEFORE y ejecutar `prisma migrate status`.
3. Construir la app vieja desde la revisión pre-Foundation `c16b401d292210bb9be51862abe1619638dbb819` en un worktree aislado y probarla contra el schema base.
4. Aplicar únicamente EXPAND con `prisma migrate deploy`.
5. Volver a probar esa misma revisión legacy contra EXPAND, incluidos Push, notifications, library y resumen mensual.
6. Construir y desplegar localmente la app workspace-aware contra staging; mantener escrituras pausadas durante el corte.
7. Ejecutar el backfill, una segunda pasada idempotente y `workspace:verify:expand`.
8. Guardar inventory AFTER, comparar entidades y ejecutar smoke tests de Trainer A/B y SELF_SERVICE.
9. Copiar CONTRACT a una migración temporal sólo en el entorno de rehearsal, actualizar el schema Prisma requerido y aplicarla.
10. Ejecutar `workspace:verify:contract`, inventario final, smoke tests y las suites focalizadas y generales.

El rehearsal falla ante drift, checksum inesperado, pérdida o duplicación, nulos, ownership ambiguo, relaciones cross-workspace, cambios inexplicables de inventario o regresión de deduplicación.

### Secuencia productiva propuesta y rollback points

1. Confirmar production, backup inmediato y endpoints separados; guardar inventory BEFORE.
2. Aplicar EXPAND. Si falla, detenerse y restaurar desde el backup según el procedimiento operativo.
3. Mantener la app vieja activa mientras se validan sus flujos críticos sobre EXPAND.
4. Iniciar una pausa controlada de escrituras y drenar requests de la app vieja.
5. Desplegar la app workspace-aware. Mientras falta foundation, sus rutas administrativas fallan cerradas.
6. Ejecutar backfill 1, backfill 2, verifier EXPAND e inventory AFTER antes de reabrir escrituras.
7. Ejecutar smoke tests seguros y reabrir tráfico sólo con todos los gates en verde.
8. Mantener EXPAND durante un período de observación. El rollback de app conserva compatibilidad porque los índices legacy siguen presentes y `workspaceId` sigue nullable.
9. En una ventana posterior, confirmar otro backup, inventario, cero nulos y ausencia de clientes viejos. Promover y aplicar CONTRACT.
10. Ejecutar verifier CONTRACT, inventario y smoke tests finales. Después de CONTRACT, el rollback de aplicación sólo puede ir a una versión workspace-aware compatible con campos requeridos.

### Gate para promover CONTRACT

CONTRACT queda bloqueado hasta reunir conjuntamente: app compatible estable, cero instancias del cliente viejo, backfill doble con segunda pasada en cero, verifier EXPAND en verde, inventario conservado, smoke tests aprobados, monitoreo sin nuevas filas nulas, backup fresco confirmado y aprobación explícita de la ventana CONTRACT. La presencia de un solo nulo o la ausencia de un unique por workspace hace abortar el SQL antes de modificar el schema.

Esta preparación no ejecutó consultas ni escrituras contra production o Neon, no cambió Vercel y no hizo commit, push ni deploy.

## EXPAND/CONTRACT REHEARSAL 2 — 15/09/2026

**Resultado: detenido durante backfill 1; CONTRACT no fue ejecutado.**

### Staging-v2 y baseline

- Destino exclusivo: `workspace-staging-v2`, mediante configuración local no versionada.
- Su endpoint se confirmó distinto de production y del staging anterior.
- La branch de backup ya confirmada permaneció fuera de la ejecución.
- `prisma migrate status` encontró 44 migraciones y `20260909120000_workspace_foundation` pendiente.
- `docs/workspace-foundation-rehearsal2-before.json` confirmó ausencia de `users`, `workspaces` y `workspace_memberships`, con los conteos productivos actuales.
- Frente al rehearsal 1, el baseline nuevo contiene actividad posterior esperable: 115 pagos, 341 ocurrencias, 714 respuestas/asistencias por ocurrencia, 732 asistencias históricas, 622 notifications de alumnos, 198 notifications de entrenador y 359 notifications de logros.

### EXPAND

`prisma migrate deploy` aplicó únicamente `20260909120000_workspace_foundation`. El estado posterior quedó al día. La inspección estructural confirmó:

- tablas Foundation presentes;
- 17 columnas `workspaceId` presentes y nullable;
- enum `WorkspaceContentScope` con `GLOBAL` y `WORKSPACE`;
- índices nuevos por workspace presentes;
- cinco uniques legacy presentes;
- 19 FKs nuevas presentes.

### Compatibilidad legacy

Se preparó un snapshot temporal del commit `c16b401d292210bb9be51862abe1619638dbb819` sin cambiar el checkout principal. Su build terminó correctamente y 51/51 tests focalizados de Push/notifications, clear-all, biblioteca y resumen mensual pasaron.

Un chequeo SQL de sólo planificación (`EXPLAIN`, sin ejecutar inserts) confirmó que EXPAND acepta:

- upsert legacy de Push por `endpoint`;
- upsert legacy de resumen por `(year, month)`;
- inserts legacy de notifications, folders y tags sin `workspaceId`;
- los cinco uniques legacy y las 17 columnas nullable.

### App workspace-aware y pausa requerida

Los tests de Foundation y transición finalizaron 22/22. La app actual resuelve membership, escribe `workspaceId`, filtra por workspace y no requiere CONTRACT.

En producción, la pausa debe bloquear mutaciones de alumnos, rutinas y asignaciones, biblioteca, clases/agenda/ocurrencias, confirmaciones y asistencias, pagos, evaluaciones, resumen mensual, eventos, notifications, Push y cron jobs. Debe comenzar antes de drenar la app legacy y terminar sólo después de backfill doble, verifier EXPAND, inventario y smoke tests.

### Backfill 1 — bloqueo

El primer intento fue rechazado localmente antes de mutar la base porque la preparación del snapshot legacy había dejado cargado un cliente Prisma antiguo. Se regeneró el cliente actual y se verificó que contiene Workspace Foundation.

El intento efectivo inició la transacción, pero PostgreSQL/Prisma la cerró al alcanzar el timeout configurado de 120 segundos mientras `backfillOperationalRoots` validaba `trainingRoutineAssignment`. Error: `P2028`, transacción expirada a los 120181 ms.

La transacción fue revertida. `docs/workspace-foundation-rehearsal2-interrupted.json` confirma:

- cero users, cero workspaces y cero memberships;
- todos los conteos de negocio idénticos al inventory BEFORE;
- SELF_SERVICE permanece en 1;
- confirmaciones permanecen en 151.

No se amplió el timeout ni se reintentó el backfill porque el rehearsal exige detenerse ante una etapa fallida.

### Etapas no ejecutadas

- backfill 2;
- verifier EXPAND;
- inventario intermedio post-backfill;
- CONTRACT gate y CONTRACT;
- verifier final e inventory AFTER;
- fixture Trainer A/B y validación final SELF_SERVICE;
- smoke tests de la app nueva;
- suite final, lint, build, Prisma validate y diff-check posteriores al rehearsal.

No hubo acceso a production, al staging anterior o al backup. No se modificó Neon desde la consola, Vercel ni variables productivas. No se hizo commit ni push.

### Readiness

**NOT READY FOR PRODUCTION — BLOCKERS REMAIN.**

El bloqueo es concreto: el backfill completo excede el límite transaccional de 120 segundos con el baseline productivo actual. Antes de un nuevo rehearsal se debe optimizar la fase de validación/backfill o aprobar un timeout mayor con margen medido, manteniendo atomicidad; después hay que recrear staging-v2 desde production porque EXPAND ya quedó aplicado en esta branch.

## BACKFILL PERFORMANCE / TRANSACTION FIX — 15/09/2026

### Causa de P2028

El backfill anterior abría una única interactive transaction alrededor de todo `runWorkspaceFoundation`: inventarios inicial y final, creación de workspace/user/membership, PERSONAL, alumnos, settings, todas las raíces operativas y cinco validaciones globales de relaciones.

El error se manifestó al comenzar `trainingRoutineAssignment.findMany`, pero esa consulta no fue la causa primaria medida por posición. Antes de alcanzarla, el flujo había ejecutado secuencialmente hasta:

- 17 updates individuales de `training_routines`;
- 341 updates individuales de `class_occurrences`;
- 198 updates individuales de `trainer_notifications`;
- updates individuales adicionales para cualquier raíz JSON legacy.

Con el baseline de rehearsal 2, sólo esas tres colecciones sumaban 556 round trips de escritura dentro de la misma transacción remota. La consulta de assignments fue la primera que intentó ejecutarse después de que el reloj global alcanzó 120181 ms. PostgreSQL/Prisma revirtió correctamente todo el trabajo.

### Nueva estrategia por fases

El backfill se divide en diez checkpoints:

1. workspace BM, user y membership;
2. workspaces PERSONAL;
3. alumnos gestionados y settings;
4. rutinas y biblioteca;
5. schedules y occurrences;
6. raíces JSON legacy;
7. ownership restante de eventos;
8. notifications, Push y resúmenes;
9. validación cross-workspace;
10. conteos finales de ownership.

Las fases mutables usan interactive transactions independientes con `maxWait` de 10 segundos y `timeout` de 30 segundos. Los inventarios y la validación global se ejecutan fuera de una transacción. Un fallo detiene el script, conserva las fases ya confirmadas y permite que una nueva ejecución continúe únicamente sobre filas cuyo `workspaceId` sigue nulo.

### Batches y queries

El tamaño fijo es 100 IDs. Rutinas, occurrences, notifications y raíces JSON se agrupan primero por workspace y se escriben con `updateMany({ id: { in: batch }, workspaceId: null })`. Para los volúmenes observados, 17 rutinas pasan de 17 updates a 1, 341 occurrences de 341 a 4 y 198 notifications de 198 a 2. El test de 205 registros confirma lotes `100/100/5`.

La validación final reemplaza cinco `findMany` con relaciones anidadas y materialización completa por cinco consultas SQL de `COUNT(*)`, ejecutadas concurrentemente fuera de cualquier transacción. Las precondiciones específicas de rutina y notification se evalúan antes de escribir su fase.

Se mantuvo la semántica anterior: BM profesional, PERSONAL exclusivo, `scope = WORKSPACE`, inferencia desde alumnos sólo cuando es inequívoca, rechazo cross-workspace, no reemplazo de ownership existente y asignación inicial de las raíces que ya seguían esa regla.

### Medición e idempotencia

Cada checkpoint registra únicamente nombre, `inspected`, `updated`, `skipped` y `durationMs`. No registra emails, contraseñas, tokens o endpoints Push. La segunda ejecución encuentra los upserts existentes y cada `updateMany` exige `workspaceId: null`, por lo que reporta cero cambios relevantes.

Los 30 segundos son un límite por fase corta y no un aumento del timeout global; el proceso completo puede durar más sin retener una única transacción. Los tiempos reales deberán registrarse en rehearsal 3. Cada fase debería quedar holgadamente debajo de 30 segundos con los conteos actuales; cualquier fase que se acerque al límite vuelve a bloquear readiness.

No se agregó `--dry-run`: simular de forma exacta las fases dependientes requeriría duplicar la lógica de ownership en memoria y podría divergir del camino real. El inventario BEFORE más los contadores `inspected/updated/skipped` de una ejecución idempotente brindan una medición más confiable sin una segunda semántica.

### Fallos parciales y rerun

Workspace, membership, PERSONAL y alumnos pueden quedar confirmados aunque una fase operativa posterior falle. Esto es seguro porque cada fase es idempotente y nunca modifica ownership no nulo. Al reejecutar, los upserts reutilizan BM/PERSONAL y las fases completadas informan cero; las siguientes procesan sólo lo pendiente. Un conflicto o cruce no se corrige automáticamente: detiene la fase y requiere revisión.

La suite `workspace-foundation-backfill.test.ts` cubre estado legacy, segunda ejecución, interrupción y reanudación, no duplicación de PERSONAL/BM, ownership por assignments, rechazo cross-workspace, persistencia de fases confirmadas, finalización posterior y verifier lógico en cero.

### Readiness para rehearsal 3

El código queda preparado para un rehearsal nuevo. `workspace-staging-v2` no debe reutilizarse porque ya tiene EXPAND aplicado. El operador debe crear manualmente `workspace-staging-v3` desde production actual, guardar su conexión en una configuración local no versionada y volver a confirmar los endpoints antes de cualquier escritura. Rehearsal 3 debe ejecutar la secuencia completa desde baseline, capturar los diez tiempos y exigir segunda pasada con cero cambios antes de considerar CONTRACT.

Esta corrección fue exclusivamente local. No se conectó a production, backups, `workspace-staging`, `workspace-staging-v2`, Neon o Vercel; no se ejecutaron migraciones, backfills remotos, commits ni push.

## EXPAND/CONTRACT REHEARSAL 3 — 15/09/2026

**Resultado: detenido al invocar CONTRACT; el SQL CONTRACT no fue ejecutado y staging-v3 permanece en EXPAND consistente.**

### Staging-v3 y baseline

- Destino exclusivo: `workspace-staging-v3`, creado desde `production` y configurado localmente.
- El endpoint se diferenció de production, staging anterior y staging-v2. La branch `pre-workspace-foundation-backup`, confirmada manualmente como branch separada con parent `production`, permaneció fuera de la ejecución.
- `prisma migrate status` encontró 44 migraciones y únicamente `20260909120000_workspace_foundation` pendiente.
- `docs/workspace-foundation-rehearsal3-before.json` registró las 26 entidades inventariadas antes de EXPAND.

### EXPAND, legacy y app workspace-aware

`prisma migrate deploy` aplicó solamente `20260909120000_workspace_foundation`. El estado posterior quedó al día y el checker EXPAND confirmó tablas foundation, 17 columnas nullable, enum de scope, índices por workspace, los cinco uniques legacy y las 19 foreign keys.

Los contratos SQL de la referencia legacy `c16b401d292210bb9be51862abe1619638dbb819` se comprobaron con `EXPLAIN`, sin inserts: Push por endpoint, resumen mensual por año/mes, inserts legacy de notifications/folders/tags, cinco uniques legacy y escrituras con ownership nulo resultaron compatibles. La aplicación workspace-aware pasó 22/22 tests de Foundation y transición, incluidos resolución de membership, escritura de `workspaceId`, lectura aislada y convivencia con EXPAND.

### Backfill 1 por fase

El backfill optimizado completó las diez fases sin `P2028`:

| Fase | Inspected | Updated | Skipped | Duration |
| --- | ---: | ---: | ---: | ---: |
| Workspace base | 3 | 3 | 0 | 6058 ms |
| Personal workspaces | 1 | 1 | 0 | 1640 ms |
| Students and settings | 64 | 64 | 0 | 1327 ms |
| Routines and library | 46 | 46 | 0 | 2908 ms |
| Schedules and occurrences | 369 | 369 | 0 | 2557 ms |
| Legacy JSON roots | 0 | 0 | 0 | 2520 ms |
| Remaining ownership | 0 | 0 | 0 | 1156 ms |
| Notifications, Push and summaries | 206 | 206 | 0 | 2897 ms |
| Cross-workspace validation | 5 | 0 | 5 | 513 ms |
| Final ownership counts | 65 | 0 | 65 | 503 ms |

El resultado creó BM, owner y membership; asignó 63 alumnos gestionados a BM, 1 SELF_SERVICE a un workspace PERSONAL y 1 configuración a BM. Completó 17 rutinas, 15 carpetas, 14 bloques, 28 schedules, 341 occurrences, 1 resumen, 7 Push y 198 notifications.

### Backfill 2, verifier e inventario intermedio

La segunda pasada reportó cero actualizaciones relevantes en las diez fases: cero alumnos, PERSONAL, settings y raíces operativas modificadas. Reutilizó el mismo BM, owner y membership.

El verifier EXPAND confirmó 64 alumnos totales, 63 en BM, cero alumnos y raíces sin workspace, cero contenido privado sin workspace, cero SELF_SERVICE en BM y cero relaciones cross-workspace. `docs/workspace-foundation-rehearsal3-intermediate.json` conservó sin cambios todos los conteos de negocio del BEFORE, incluido SELF_SERVICE = 1 y confirmaciones = 151; las únicas altas fueron las esperadas de foundation: 2 workspaces, 1 user y 1 membership.

### CONTRACT gate, error CLI y reanudación

El gate previo a CONTRACT quedó en verde: backfill doble e idempotente, verifier EXPAND sin inconsistencias, inventario conservado, cinco uniques legacy presentes, build y TypeScript correctos, y smoke HTTP básico 6/6 para login, dashboard, alumnos, rutinas, biblioteca y clases.

El primer intento de invocación fue rechazado localmente porque `prisma db execute` no recibió el argumento obligatorio `--schema` o `--url`. Prisma no abrió ni ejecutó el archivo. La inspección posterior demostró que staging-v3 seguía completamente en EXPAND, por lo que el rehearsal se detuvo sin reintentar hasta recibir autorización explícita.

La reanudación volvió a confirmar el endpoint sanitizado de staging-v3, el schema EXPAND, el verifier en cero, los 17 ownership completos, los cinco índices legacy y CONTRACT aún pendiente. Se conservó el archivo SQL exacto, con SHA-256 `8AE883B4E051E3C66F53D92BFAA938258E6072E6CE258E3580914447AA2C42F0`, y se corrigió únicamente la invocación:

```text
npx prisma db execute --schema prisma/schema.prisma --file prisma/pending-contract/workspace_foundation/migration.sql
```

### CONTRACT e inspección final

Prisma informó `Script executed successfully`. El SQL ejecutó su preflight y su transacción completa. La inspección post-CONTRACT confirmó:

- las 17 columnas `workspaceId` con `NOT NULL`;
- los cinco uniques legacy eliminados;
- los cinco uniques compuestos por workspace presentes;
- tablas foundation, enum `WorkspaceContentScope`, índices y 19 foreign keys correctos.

El verifier CONTRACT terminó con schema compatible, Workspace BM y owner correctos, 64 alumnos totales, 63 alumnos BM, cero alumnos o raíces sin workspace, cero contenido privado sin workspace y cero relaciones cross-workspace.

### Inventory AFTER

`docs/workspace-foundation-rehearsal3-after.json` se capturó tras CONTRACT y se recapturó después de los smokes. La comparación BEFORE/intermedio/AFTER preservó todos los conteos de negocio: 64 alumnos, 17 rutinas, 14 bloques, 12 assignments, 25 sesiones, 4 evaluaciones físicas, 115 pagos, 28 schedules, 139 asignaciones de clase, 341 occurrences, 714 respuestas/asistencias, 732 asistencias legacy, 622 notifications de alumnos, 198 notifications de trainer, 359 notifications de logros, 16 Push de alumnos, 7 Push de trainer, 1 settings y 1 resumen mensual. SELF_SERVICE permaneció en 1 y las confirmaciones en 151. Foundation permaneció en 2 workspaces, 1 user y 1 membership.

### Trainer A/B y SELF_SERVICE

El fixture real creó dos trainers, dos workspaces y registros temporales dentro de una transacción. Desde Workspace A devolvieron cero las lecturas de alumno, rutina, assignment, pago, evaluación, schedule, notification y search pertenecientes a B. También devolvieron cero cuatro intentos de update sobre alumno, rutina, schedule y notification de B. El rollback obligatorio fue verificado fuera de la transacción con cero workspaces, users y students residuales.

El único SELF_SERVICE conserva workspace PERSONAL exclusivo, perfil, credencial activa y sus conteos previos: 0 sesiones de portal, 0 assignments de rutina, 0 workout sessions y 0 registros de progreso.

### Smoke tests completos

Una instancia local temporal conectada exclusivamente a staging-v3 en estado CONTRACT completó 18/18 respuestas HTTP 200: login, dashboard, alumnos, seguimiento, rutinas, biblioteca, clases, agenda, confirmaciones, asistencias, pagos, resumen mensual, evaluaciones, ranking, notifications, search, Push ownership y Push diagnostics. La primera entrada de asistencias omitió el parámetro obligatorio `date` y recibió el 400 de validación esperado; se corrigió sólo el harness y la corrida completa posterior terminó 18/18. La instancia se cerró y el inventario posterior siguió sin cambios.

### Tests y validaciones

- backfill + transition + Workspace Foundation: **32/32**;
- pretest: **74/74**;
- suite principal: **614/617**; los únicos tres fallos siguen siendo los contratos visuales conocidos de `block-timer`, `portal-class-schedule` y `portal-home-motion`;
- lint: **OK**;
- build y TypeScript: **OK**;
- Prisma validate: **OK**;
- git diff-check: **OK**.

No se tocó production, `pre-workspace-foundation-backup`, staging anterior, staging-v2, Vercel ni variables productivas. No se hizo commit ni push.

### Readiness

**READY FOR CONTROLLED EXPAND/CONTRACT PRODUCTION DEPLOY.**

## PRODUCTION EXPAND/CONTRACT DEPLOY

Fecha de ejecución: 2026-09-15. No se hizo commit ni push y no se modificaron `workspace-staging`, `workspace-staging-v2`, `workspace-staging-v3` ni `pre-workspace-foundation-backup`.

### Identidad, backup, BEFORE y EXPAND

El operador confirmó manualmente que `pre-workspace-foundation-backup` existe, tiene parent `production` y fue creada inmediatamente antes de la migración. La conexión activa se identificó como production y quedó diferenciada de staging-v3 y de las branches anteriores. No se registraron URLs ni credenciales.

`docs/workspace-foundation-production-before.json` ya estaba capturado contra production antes de la escritura. La migración activa `20260909120000_workspace_foundation` aplicó exclusivamente EXPAND. La inspección confirmó tablas foundation, las 17 columnas `workspaceId` nullable, enum, índices por workspace, 19 foreign keys y los cinco uniques legacy todavía presentes. El compatibility check legacy quedó en verde.

### Pausa reversible y deploy compatible

Las escrituras se pausaron con dos Project Firewall Rules temporales de Vercel en `brianmar3s-projects/bm-training-app`:

- `Workspace migration write pause`: `Deny` para métodos `POST`, `PUT`, `PATCH` y `DELETE`;
- `Workspace migration cron pause`: `Deny` para el path `/api/cron/payment-reminders`.

Ambas reglas se publicaron juntas. Durante la pausa, `GET /admin/login` respondió 200, el login por POST quedó bloqueado con 403 y el cron quedó bloqueado con 403. Las lecturas continuaron disponibles.

La carpeta local se vinculó explícitamente al project ID de `bm-training-app` y se desplegó el árbol de trabajo actual sin commit ni push. El deployment `dpl_DiNVXoY7XBcDEehN4s2xbTGSvyFu` terminó `Ready`, target `production`, y fue asociado a `https://bm-training-app.vercel.app`. Build, TypeScript y publicación de outputs terminaron correctamente. La sesión autenticada de entrenador permaneció operativa y cargó el dashboard nuevo.

### Backfill 1 y backfill 2

El primer backfill completó las diez fases:

| Fase | Inspected | Updated | Skipped | Duration |
| --- | ---: | ---: | ---: | ---: |
| Workspace base | 3 | 3 | 0 | 5788 ms |
| Personal workspaces | 1 | 1 | 0 | 1421 ms |
| Students and settings | 64 | 64 | 0 | 1239 ms |
| Routines and library | 46 | 46 | 0 | 2834 ms |
| Schedules and occurrences | 369 | 369 | 0 | 2441 ms |
| Legacy JSON roots | 0 | 0 | 0 | 2140 ms |
| Remaining ownership | 0 | 0 | 0 | 1376 ms |
| Notifications, Push and summaries | 208 | 208 | 0 | 2679 ms |
| Cross-workspace validation | 5 | 0 | 5 | 525 ms |
| Final ownership counts | 65 | 0 | 65 | 341 ms |

El resultado creó 2 workspaces, 1 user y 1 membership; asignó 63 alumnos gestionados a BM y el único SELF_SERVICE a un workspace PERSONAL exclusivo. Completó ownership para 1 settings, 17 rutinas, 15 carpetas, 14 bloques, 28 schedules, 341 occurrences, 1 resumen mensual, 7 suscripciones Push y 200 notifications.

La segunda pasada fue idempotente: cero actualizaciones en workspace base, PERSONAL, alumnos, settings y todas las raíces operativas. Las validaciones cross-workspace y de ownership volvieron a quedar en cero.

### Verifier EXPAND, inventario intermedio y smoke

El verifier EXPAND confirmó schema compatible, Workspace BM y owner correctos, 64 alumnos totales, 63 en BM, cero alumnos o raíces sin workspace, cero contenido privado sin workspace, cero SELF_SERVICE dentro de BM y cero relaciones cross-workspace.

`docs/workspace-foundation-production-intermediate.json` inventarió 26 entidades. Entre el BEFORE de las 14:08 y la pausa hubo actividad normal: respuestas/asistencias 714→715, notifications de trainer 198→200, notifications de logros 359→360 y confirmaciones 151→152. No hubo descensos. Las altas foundation fueron las esperadas: 2 workspaces, 1 user y 1 membership. Una segunda captura bajo la pausa produjo cero diferencias, demostrando estabilidad antes de CONTRACT.

El smoke EXPAND cubrió sesión autenticada, dashboard, alumnos, seguimiento, rutinas, biblioteca, clases, agenda, confirmaciones, asistencias, pagos, resumen mensual, evaluaciones, ranking, notifications, search, Push ownership y Push diagnostics. Todos los módulos cargaron sin redirect de login ni error crítico.

### CONTRACT y verificación final

El CONTRACT gate quedó en verde: verifier EXPAND sin inconsistencias, cero `workspaceId` nulos, inventario estable, cinco uniques legacy presentes, app nueva `Ready` y smoke EXPAND aprobado.

Se ejecutó exactamente:

```text
npx prisma db execute --schema prisma/schema.prisma --file prisma/pending-contract/workspace_foundation/migration.sql
```

Prisma informó `Script executed successfully`. La inspección post-CONTRACT confirmó las 17 columnas `workspaceId` con `NOT NULL`, los cinco uniques legacy eliminados, los cinco uniques compuestos presentes y todas las tablas, enum, índices y foreign keys correctos.

El verifier CONTRACT confirmó Workspace BM, owner membership, 64 alumnos totales, 63 en BM, cero ownership faltante, cero contenido privado sin workspace y cero relaciones cross-workspace. `docs/workspace-foundation-production-after.json` conservó exactamente los 26 conteos del inventario intermedio. La recaptura posterior al smoke final también produjo cero diferencias.

Workspace BM conserva owner, alumnos, rutinas, sesiones, horarios, asistencias, pagos, evaluaciones, dashboard, resumen mensual, ranking, notifications, biblioteca, search y ownership de Push. El único SELF_SERVICE conserva workspace PERSONAL exclusivo, perfil, credencial activa, 0 sesiones de portal, 0 assignments, 0 workout sessions y 0 registros de progreso.

El smoke final volvió a cubrir las 18 áreas productivas y terminó sin errores críticos ni redirects. No se crearon fixtures A/B ni se envió Push falso.

### Reanudación, validaciones y riesgos restantes

Las dos reglas temporales se desactivaron y se publicaron juntas. Vercel confirmó que los cambios del Firewall fueron aplicados. Un POST de login con origen válido y credencial vacía llegó nuevamente a la app y respondió 401, confirmando que el bloqueo general dejó de interceptar escrituras. El cron no se invocó para evitar una ejecución real innecesaria; su toggle quedó desactivado en Vercel.

- backfill + transition + Workspace Foundation: **32/32**;
- pretest: **74/74**;
- suite principal: **614/617**; sólo fallan los tres contratos visuales previos conocidos de `block-timer`, `portal-class-schedule` y `portal-home-motion`;
- lint: **OK**;
- build y TypeScript: **OK**;
- Prisma validate: **OK**;
- git diff-check: **OK**.

Vercel CLI agregó `.vercel` y `.env*` a `.gitignore` al vincular el proyecto. El primer intento de deploy fue interrumpido al detectar que la CLI había creado por nombre de carpeta un project auxiliar `bmcoach-local`; la carga fue cancelada y no afectó `bm-training-app`. El project auxiliar vacío permanece en Vercel: la eliminación automática fue rechazada por el control de aprobación por ser destructiva y no contar con autorización explícita.

**PRODUCTION EXPAND/CONTRACT DEPLOY SUCCESSFUL.**

## SCHEMA ALIGNMENT AFTER CONTRACT

Fecha: 2026-09-16. Esta etapa fue exclusivamente local y de solo lectura respecto de production. No se ejecutaron `migrate deploy`, `migrate resolve`, `db push`, `migrate dev`, SQL, backfill, commit ni push.

### Nullability y relaciones

El schema local se alineó con las 17 columnas `workspaceId` que CONTRACT dejó `NOT NULL`: `students.workspaceId`, `monthly_summaries.workspaceId`, `trainer_push_subscriptions.workspaceId`, `trainer_notifications.workspaceId`, `payments.workspaceId`, `events.workspaceId`, `coach_events.workspaceId`, `routines.workspaceId`, `training_routines.workspaceId`, `training_library_folders.workspaceId`, `training_library_tags.workspaceId`, `training_block_templates.workspaceId`, `evaluations.workspaceId`, `coach_settings.workspaceId`, `weekly_class_schedules.workspaceId`, `class_occurrences.workspaceId` y `classes.workspaceId`.

Las 17 relation fields correspondientes pasaron de `Workspace?` a `Workspace`. No se agregaron relaciones ni se cambiaron nombres. Se conservaron las acciones físicas existentes: `onDelete: SetNull` para `StudentRecord.workspace` y `CoachSettingsRecord.workspace`, y `onDelete: Restrict` para las otras 15; todas mantienen el `onUpdate` por defecto de Prisma, coherente con `ON UPDATE CASCADE`. Prisma valida el schema y emite dos advertencias de representación por combinar relación obligatoria con foreign key física `ON DELETE SET NULL`; no es una diferencia física ni se modificó para ocultarla.

### Índices Workspace Foundation

El diff final confirma que el schema refleja los índices creados por EXPAND y los uniques finales de CONTRACT. Permanecen representados: `workspace_memberships_workspaceId_userId_key`, `workspace_memberships_workspaceId_idx`, `workspace_memberships_userId_idx`, `students_workspaceId_idx`, `coach_settings_workspaceId_idx`, `monthly_summaries_workspaceId_status_year_month_idx`, `monthly_summaries_workspaceId_year_month_key`, `trainer_push_subscriptions_workspaceId_active_idx`, `trainer_push_subscriptions_workspaceId_endpoint_key`, `trainer_notifications_workspaceId_readAt_createdAt_idx`, `trainer_notifications_workspaceId_eventKey_key`, `payments_workspaceId_idx`, `events_workspaceId_idx`, `coach_events_workspaceId_date_time_idx`, `routines_workspaceId_idx`, `training_routines_scope_workspaceId_status_idx`, `training_library_folders_scope_workspaceId_status_name_idx`, `training_library_folders_workspaceId_normalizedName_key`, `training_library_tags_scope_workspaceId_name_idx`, `training_library_tags_workspaceId_normalizedName_key`, `training_block_templates_scope_workspaceId_status_updatedAt_idx`, `evaluations_workspaceId_idx`, `weekly_class_schedules_workspaceId_dayOfWeek_startTime_idx`, `class_occurrences_workspaceId_date_startTime_idx` y `classes_workspaceId_date_idx`.

Se retiraron del schema cinco declaraciones Workspace que nunca fueron creadas físicamente por EXPAND ni CONTRACT: `class_occurrences_workspaceId_status_date_idx`, `coach_events_workspaceId_status_showToStudents_date_idx`, `training_routines_workspaceId_objective_idx`, `training_routines_workspaceId_kind_status_idx` y `weekly_class_schedules_workspaceId_active_idx`.

CONTRACT eliminó físicamente y el schema ya no representa los cinco uniques legacy: `trainer_push_subscriptions_endpoint_key`, `trainer_notifications_eventKey_key`, `training_library_folders_normalizedName_key`, `training_library_tags_normalizedName_key` y `monthly_summaries_year_month_key`.

### Drift previo ajeno y defaults

El diff residual contiene 14 índices físicos legacy que Prisma intentaría eliminar para igualar el datamodel: `class_occurrences_date_startTime_idx`, `class_occurrences_status_date_idx`, `coach_events_date_time_idx`, `coach_events_status_showToStudents_date_idx`, `monthly_summaries_status_year_month_idx`, `trainer_notifications_ownerKey_readAt_createdAt_idx`, `trainer_push_subscriptions_ownerKey_active_idx`, `training_block_templates_status_updatedAt_idx`, `training_library_folders_status_name_idx`, `training_routines_kind_status_idx`, `training_routines_objective_idx`, `training_routines_status_idx`, `weekly_class_schedules_active_idx` y `weekly_class_schedules_dayOfWeek_startTime_idx`. Se clasifican como drift previo ajeno y no se normalizaron.

También permanece una diferencia de representación por truncado de identificador: el índice físico `nutrition_education_quiz_attempts_studentId_contentId_answeredA` frente al nombre que Prisma deriva, `nutrition_education_quiz_attempts_studentId_contentId_answe_idx`.

Workspace Foundation no introduce diferencias de defaults. Permanecen cuatro defaults físicos históricos en `training_block_templates.updatedAt`, `training_library_folders.updatedAt`, `training_routine_blocks.updatedAt` y `workout_block_logs.updatedAt` que Prisma propondría quitar porque `@updatedAt` es comportamiento del cliente y no expresa ese default de base. Se clasifican como drift previo/diferencia de representación y no se cambiaron.

### Diff final y migración CONTRACT definitiva

**WORKSPACE FOUNDATION DIFF = 0.** El diff residual se limita a 14 drops de índices legacy, cuatro drops de defaults históricos y un rename por truncado; no contiene alteraciones de nullability, relaciones, uniques ni índices atribuibles a Workspace Foundation.

Se creó `prisma/migrations/20260916104324_workspace_foundation_contract/migration.sql` como copia byte por byte del SQL ensayado en `prisma/pending-contract/workspace_foundation/migration.sql`. Ambos archivos tienen SHA-256 `8AE883B4E051E3C66F53D92BFAA938258E6072E6CE258E3580914447AA2C42F0`. La migración no fue ejecutada ni registrada con `migrate resolve`; el pending CONTRACT se conserva para revisión.

El verifier CONTRACT de solo lectura volvió a confirmar schema, uniques, Workspace BM y owner correctos, 64 alumnos, 63 en BM, cero ownership faltante, cero contenido privado sin workspace y cero relaciones cross-workspace.

### Validaciones locales de alineación

- Prisma format: **OK**;
- Prisma validate: **OK**, con las dos advertencias documentadas por los foreign keys físicos `ON DELETE SET NULL` sobre columnas ahora obligatorias;
- Workspace Foundation + transition + backfill: **32/32**;
- lint: **OK**;
- build y TypeScript: **OK**;
- diff estructural: **Workspace Foundation = 0**, con drift previo ajeno explícitamente inventariado arriba;
- git diff-check: **OK**; sólo se informaron advertencias de conversión LF/CRLF ya presentes en el árbol de trabajo.

## CONTRACT MIGRATION REGISTRATION

Fecha: 2026-09-16. La conexión activa fue confirmada nuevamente como production sin registrar su endpoint ni credenciales.

La migración definitiva `20260916104324_workspace_foundation_contract` y el SQL del pending CONTRACT eran idénticos byte por byte: 3644 bytes y SHA-256 `8AE883B4E051E3C66F53D92BFAA938258E6072E6CE258E3580914447AA2C42F0`.

El estado previo encontró 45 migraciones y una única pendiente: `20260916104324_workspace_foundation_contract`. Como CONTRACT ya estaba aplicado físicamente, se ejecutó exclusivamente:

```text
npx prisma migrate resolve --applied 20260916104324_workspace_foundation_contract
```

Prisma confirmó `Migration 20260916104324_workspace_foundation_contract marked as applied.` No se volvió a ejecutar `migration.sql`. El estado posterior informó `Database schema is up to date!`. La consulta directa de `_prisma_migrations` confirmó `20260909120000_workspace_foundation` y `20260916104324_workspace_foundation_contract` finalizadas, activas y sin rollback.

El verifier CONTRACT posterior mantuvo schema y uniques correctos, Workspace BM y owner correctos, 64 alumnos totales, 63 en BM, cero ownership faltante, cero contenido privado sin workspace y cero relaciones cross-workspace.

La comparación con `workspace-foundation-production-after.json` no mostró pérdidas. Hubo aumentos por actividad productiva normal mientras la aplicación permaneció activa: respuestas/asistencias 715→723, asistencias legacy 732→741, notifications de alumnos 622→631, notifications de trainer 200→202, notifications de logros 360→361 y confirmaciones 152→153. `migrate resolve` sólo modificó `_prisma_migrations` y no ejecutó SQL sobre tablas de negocio.

La guía del pending CONTRACT exigía promover el SQL sólo después de EXPAND, deploy compatible, pausa de escrituras, backfill doble e idempotente, verifier EXPAND limpio, inventarios conservados, smokes seguros y backup confirmado; además exigía alinear los `workspaceId` y ejecutar el verifier CONTRACT. Todos esos gates quedaron documentados y satisfechos antes del registro. Tras confirmar el historial y el verifier, el duplicado en `prisma/pending-contract/workspace_foundation/` fue retirado.

La validación local posterior terminó con Prisma validate **OK** —manteniendo las dos advertencias ya documentadas por `ON DELETE SET NULL`— y git diff-check **OK**, con únicamente los avisos de conversión LF/CRLF preexistentes.

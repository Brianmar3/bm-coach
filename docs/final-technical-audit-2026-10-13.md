# Auditoría técnica final — 13/10/2026

Base inspeccionada: HEAD 9b8d48b0 y working tree existente. Sin commit, push, deploy, migración ni escrituras en servicios externos. Los cambios previos se preservaron. No es una certificación de todos los datos de producción.

## Problemas corregidos

- P0 / aislamiento: POST y PUT de alumnos aceptaban IDs de horarios de otro workspace. Se agregó el filtro de workspace antes de validar cupo y antes de cualquier escritura. La ficha acota rutinas, clases y asistencias relacionadas para no revelar vínculos cruzados históricos.
- P0 / pagos incorrectos: anular un pago antiguo podía retroceder el vencimiento cuando existía otro registro posterior con la misma fecha de pago y snapshot. Se considera también createdAt. Test reproducido fallando antes de corregirlo; la anulación sin pago posterior conserva el comportamiento anterior.
- P0 / seguridad: reset de contraseña de entrenador no revocaba cookies firmadas anteriores. Se comprueba el registro durable usedAt del reset contra la emisión autenticada de la sesión (expiración menos duración fija), en proxy, autorización API, resolución de workspace y consulta de sesión. También se consideran resets revocados: pueden requerir iniciar sesión nuevamente. No se cambió el formato de cookie ni la base de datos.
- P1 / concurrencia: editar alumno comprobaba cupos bajo aislamiento por defecto. Se usa Serializable, como en el alta. Los conflictos P2034 de ambas rutas devuelven 409 sin presentarlos como un error 500.
- P2: ninguna corrección adicional de producto. Sin cambios estéticos ni funcionalidades nuevas.

## Validación

- Tests nuevos: 14 de alta/edición, servicios y aislamiento/concurrencia; 1 de orden de anulación; 3 de revocación. Se ajustó el test existente de ficha y agregó comprobación de vínculos históricos.
- Focal de seguridad, aislamiento, fotos privadas, invitaciones, offline y rutinas: 84/84 antes de la última aserción de ficha; focal final de regresiones: 26/26.
- npm test final: 147/147 pretest + 788/788 suite principal, sin fallos.
- Lint completo: 0 errores; 34 warnings preexistentes. Build final: aprobado, incluida generación de Prisma y TypeScript.
- Smoke de rutinas: ocho tipos, crear/guardar/activar, recuperación, conflictos, bibliotecas, 40/77 ejercicios, mobile 320/390/768 y temas/accents aprobados.
- Evaluaciones: 24 combinaciones; estados vacío/una/varias, histórico, selector y áreas aprobados.
- Teclado: 24 escenarios de foco, resize, cierre, scroll, rotación, limpieza y contraseña aprobados.
- Nutrición: 24 combinaciones de estados, hábitos, preferencias, consentimiento y teclado aprobadas.
- Modo enfoque: 24 escenarios de series, timer, historial, media, intervalos, navegación, offline y finalización aprobados.
- Offline: Personalizado/Mixto, cerrar/reabrir, reinicio frío del navegador, persistencia en IndexedDB, reintento, sincronización sin duplicados, snapshot fijado durante sesión, cambio de identidad y logout aprobados. Se actualizó el smoke para abrir Ver detalle antes de editar series, como requiere la UI actual.
- APIs/sesiones/fotos se probaron con dependencias simuladas; los navegadores usaron componentes reales y, en offline, build servido localmente. No se cargaron pagos ni alumnos reales. Los tests de fotos comprueban propietario/workspace, cache privada y denegaciones cruzadas.

## Fallos adicionales preexistentes documentados

Fuera de la suite npm test, la pasada ampliada detectó cinco casos previos ajenos a las correcciones:

1. portal-invitation-tenant-audit: regex de login desactualizada (la consulta ahora incluye student).
2. portal-invitation-tenant-audit: prohibición antigua de cualquier fetch handler, incompatible con el SW de shell público offline actual.
3. workspace-foundation: espera literal user.status en login; el control vive en trainerIdentityHasWorkspaceAccess y sus tests pasan.
4. classes-attendance-flow: espera una expresión anterior de selección de horario.
5. session-restoration: runner Node no resuelve el alias @/lib usado por portal-experience.

No se alteraron esas pruebas para aparentar una pasada verde.

## Archivos de esta auditoría

- app/api/alumnos/route.ts
- app/api/alumnos/[id]/route.ts
- app/api/admin/alumnos/[id]/quick-panel/route.ts
- app/api/pagos/[id]/route.ts
- app/api/admin/auth/session/route.ts
- lib/trainer-session-revocation.ts (nuevo)
- lib/trainer-workspace.ts
- lib/admin-api-auth.ts
- proxy.ts (preservando el cambio previo de eliminar-cuenta)
- package.json
- tests/enrollment-workspace-regression.test.ts (nuevo)
- tests/payment-void-order.test.ts (nuevo)
- tests/trainer-session-revocation.test.ts (nuevo)
- tests/student-quick-panels.test.ts
- scripts/smoke-offline-training.mjs
- docs/final-technical-audit-2026-10-13.md

## Límites y riesgos pendientes de operación

- No se ejecutó concurrencia contra PostgreSQL real, inventario de vínculos históricos ni migración/retiro de fotos públicas históricas. Los filtros corregidos no reparan filas antiguas.
- No se verificaron proveedores reales de Blob, push ni un teléfono físico durante esta ejecución. Los rehearsals anteriores no sustituyen un inventario actual de producción.
- Hay dependencias y pruebas preexistentes sin seguimiento (por ejemplo lib/student-account-deletion.ts y lib/student-photo-migration.ts); el working tree validado no equivale a un checkout limpio de Git. No se añadieron ni descartaron.
- Mantener registros de reset consumidos/revocados: ahora son parte de la revocación de sesiones hasta que expiren las cookies anteriores. Cualquier limpieza futura debe conservar esa garantía.

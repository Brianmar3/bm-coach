# PLATFORM OWNER PRODUCTION DEPLOY

Fecha: 2026-09-17.

## Estado

El deploy quedó detenido después de aplicar y validar la migración de base de datos. El código de Platform Owner no fue publicado porque Vercel CLI respondió `Not authorized`. No se intentó un método alternativo y no se crearon invitaciones ni fixtures en producción.

## Backup y producción

- Backup confirmado manualmente: `pre-platform-trainers-production-backup-2026-09-17`, parent `production`.
- Branch productiva confirmada: `br-plain-smoke-avc7nu90`.
- Endpoint productivo confirmado: `ep-crimson-voice-avwm5uvh`.
- El endpoint es distinto de `platform-trainers-staging`.

## Inventario BEFORE

- Users: 1.
- Workspaces: 2.
- Workspace memberships: 1.
- Students: 64.
- Trainer invitations: 0.
- PLATFORM_OWNER: 0.
- `bm-fuerza-funcional`: exactamente 1 OWNER activo.

Evidencia: `docs/platform-trainers-production-before.json`.

## Migración

- `20260917120000_platform_owner_trainers` era la única migración pendiente.
- El gate previo confirmó exactamente un OWNER BM activo.
- `prisma migrate deploy` aplicó la migración correctamente.
- El estado posterior fue `Database schema is up to date`.
- Resultado: exactamente 1 PLATFORM_OWNER, correspondiente al OWNER activo de BM.
- Users, workspaces, memberships, students y ownership BM no cambiaron.

Evidencia: `docs/platform-trainers-production-post-migration.json`.

## Deploy, smoke y fixtures

- Primer intento de deploy: detenido antes de publicar; Vercel CLI informó `Not authorized`.
- La autenticación se restableció y se reconfirmaron el vínculo local a `bm-training-app`, el team `brianmar3s-projects` y el dominio `bm-training-app.vercel.app`.
- Segundo intento: el código local filtrado se cargó en el proyecto correcto. La CLI local terminó mostrando `deploy_failed: fetch failed`, pero los logs completos de Vercel demostraron que el build remoto continuó: compilación, TypeScript, generación de 71 páginas, despliegue de outputs y caché finalizaron correctamente.
- Deployment `dpl_A8b6LgvxEBNVW8eWM6yYqPa9GhS5`: target `production`, estado `Ready`.
- El deployment quedó asociado a `https://bm-training-app.vercel.app`. El `fetch failed` fue un fallo transitorio de comunicación o polling de la CLI local después de iniciar el trabajo remoto, no un fetch ejecutado por la aplicación durante `next build`.
- Smoke de Plataforma: no ejecutado porque el código no fue publicado.
- Invitación y aceptación: no ejecutadas.
- Trainer y workspace fixture: no creados.
- Aislamiento y biblioteca GLOBAL en producción: no ejecutados.
- Inventory AFTER final: pendiente hasta que el código pueda desplegarse y se completen los smoke tests.

## Riesgo restante

La base productiva contiene la migración aditiva de Platform Owner y el código correspondiente quedó publicado en un deployment productivo `Ready`. No se identificó un cambio de código necesario para el supuesto fallo remoto: los fetch de Platform Owner están limitados a componentes cliente y no se ejecutan durante el build. Corresponde retomar el despliegue controlado desde los smoke tests productivos, sin repetir la migración ni el deploy.

## Smoke y flujo productivo final

El smoke de PLATFORM_OWNER confirmó login, sesión, dashboard BM, navegación autorizada, `/platform`, `/platform/trainers`, listado y CTA `+ Nuevo entrenador`. El workspace BM y sus datos permanecieron intactos.

Se creó y aceptó una única invitación productiva identificada como TEST. El token se entregó una vez, sólo persistió su SHA-256, vencía a los siete días y su segundo uso devolvió `410`. El alta produjo un User `TRAINER`, password scrypt, workspace `PROFESSIONAL` independiente y una única membership `OWNER` activa. El onboarding MIXED quedó persistido.

El primer gate del dashboard se había detenido porque buscó el CTA en el HTML SSR. La página completa los datos después de hidratarse. La comprobación posterior en navegador real mostró `Tu espacio está listo`, `Agregar primer alumno`, 0 alumnos, 0 asistencia, $0 en cobros y ausencia del enlace Plataforma.

El trainer TEST recibió `404` seguro al intentar acceder directamente a alumno, pagos, evaluación, clase y rutina privada BM. Sus listas de alumnos, clases y notificaciones quedaron vacías. `/platform` y `/platform/trainers` redirigieron al dashboard; GET de trainers y POST de invitación devolvieron `403`. No se observó ningún `500` ni dato BM.

Producción no tenía bloques GLOBAL activos. Se creó `TEST PLATFORM GLOBAL` únicamente para el smoke: fue visible, su edición devolvió `404`, su copia devolvió `201` y quedó con `scope = WORKSPACE` y el workspace del trainer TEST. El GLOBAL original fue eliminado en `finally`; la copia WORKSPACE se conserva como fixture documentado.

Los conflictos seguros de identidad para trainer existente, alumno gestionado y SELF_SERVICE devolvieron `409` sin crear identidades duplicadas.

El inventario AFTER conserva sin cambios el ownership BM: 63 alumnos gestionados, 17 rutinas privadas, 28 horarios, 351 ocurrencias y 205 notificaciones; pagos, evaluaciones y tablas legacy también conservaron sus conteos. PLATFORM_OWNER continúa siendo exactamente 1 y el OWNER BM activo no cambió. Las únicas altas corresponden al trainer TEST, su workspace, membership, invitación aceptada y copia WORKSPACE.

El enum productivo de User usa `SUSPENDED` como estado deshabilitado; no existe un valor `DISABLED`. El trainer TEST quedó finalmente `SUSPENDED`. Su User, workspace y membership se conservaron. No quedó ningún recurso GLOBAL temporal.

Validaciones finales: 64/64 tests focalizados y de Workspace Foundation, lint OK, build y TypeScript OK, Prisma validate OK y `git diff --check` OK.

Evidencia sanitizada:

- `docs/platform-trainers-production-flow.json`;
- `docs/platform-trainers-production-continuation.json`;
- `docs/platform-trainers-production-after.json`.

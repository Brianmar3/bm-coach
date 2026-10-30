# Acceso Master: causa, corrección y verificación

Fecha: 29/10/2026. Proyecto: `C:\bmcoach-local`, BM Training. Sin despliegue, cambios de datos, membresías, commit ni push.

## Causa comprobada

La separación de cookies era real, pero la política de entrada contradecía esa separación:

- En la versión previa de `lib/master-access.ts`, líneas 9–10, una sesión Master ausente/inválida daba paso a `trainerValid → /dashboard` o `studentValid → /portal`.
- El bloque de `/master` en `proxy.ts` validaba la cookie de Trainer y llamaba a esa política. Un propietario autenticado únicamente como entrenador era redirigido antes de poder ver el formulario de Master. Lo mismo ocurría si la cookie Master había vencido y Trainer seguía vigente.
- La rama de rechazo de `/platform/*` repetía ese fallback. Así, una sesión Master ausente/vencida podía terminar en Dashboard al acceder a enlaces internos.
- `tests/master-private-access.test.ts`, en su prueba anterior «TRAINER y STUDENT que intentan /master vuelven a su portal», exigía precisamente esos destinos. Las pruebas anteriores comprobaban separación de cookies, pero mantenían el comportamiento incorrecto como contrato.

Se ejecutó el proxy real con NextRequest/NextResponse reales, firmas HMAC reales y un almacén de usuarios simulado. Antes del cambio, 6 de 8 escenarios fallaron. El primer fallo devolvió `Location: https://bm.test/dashboard` para `/master` con cookie Trainer válida cuya identidad tenía PLATFORM_OWNER. Después del cambio pasaron los 8; luego se amplió a 11 pruebas de integración.

Esto demuestra un defecto del servidor independiente del navegador. No se inspeccionaron las cookies del Chrome del usuario: no estaba conectado. No se atribuye el problema a caché, Chrome ni configuración remota sin evidencia.

## Por qué las correcciones anteriores no alcanzaron

El commit `7ebf43e2` (separate private master access) separó nombres de cookies, roles firmados y logout, pero introdujo/conservó el fallback de Master a los otros portales. `3371793c` (allow platform owner trainer access) permitió correctamente que el propietario también entrara como entrenador; no eliminó ese fallback. Por eso un propietario con sesión Trainer pero sin sesión Master seguía sin poder abrir su login Master.

También había una diferencia entre fronteras: el proxy comprobaba revocación por restablecimiento de contraseña y `platform-auth.ts` no lo hacía. Se unificó la validación sin retirar esa protección.

## Implementación

- `proxy.ts:58`: `/master` consulta únicamente la sesión Master. Con propietario autorizado entra a `/platform/trainers`; sin ella muestra el login. Nunca elige un portal por cookies ajenas.
- `proxy.ts:66`: `/platform/*` exige la misma autorización; si falta, vuelve a `/master?next=...`. Las API responden 401/403, sin redirigir a Dashboard.
- `lib/platform-session-access.ts:6`: validación común de firma, vencimiento, identidad no anónima, revocación, existencia de usuario, estado ACTIVE y rol actual PLATFORM_OWNER en la base. La usan proxy, páginas y API.
- `lib/platform-auth.ts:9`: reutiliza esa validación. Se conserva la comprobación de autorización en páginas y handlers, además del proxy.
- `lib/master-access.ts:3`: la entrada Master ya no tiene fallback Trainer/Student. `masterReturnPath` limita `next` a rutas internas `/platform` y rechaza otros portales/orígenes.
- `app/master/page.tsx:29`: después de recibir Set-Cookie hace una navegación nueva de documento al destino seguro, para validar la sesión en el servidor sin reutilizar navegación prefetched del login. Es una prevención adicional, no una causa de caché demostrada.
- Las respuestas de entrada/autorización Master llevan `Cache-Control: private, no-store, max-age=0`.

No se modificaron creación, firma, nombre, duración ni opciones de las cookies existentes. Master, Trainer y Student mantienen cookies independientes. No se convierte automáticamente una sesión Trainer en permiso Master; las sesiones viejas de otro ámbito conducen al login, sin exigir borrar cookies. La autorización sigue dependiendo de la identidad propietaria validada, no de la presencia de una cookie.

## Pruebas y resultados

Comando reproducible: `npm run test:master-access`.

61 pruebas enfocadas aprobadas. Las 11 pruebas nuevas ejecutan código real de proxy, guards y handlers de login/logout con persistencia simulada. Cubren:

| Escenario | Resultado |
| --- | --- |
| Sólo Master válido | Entrada a Master y rutas internas permitidas |
| Sólo Trainer, incluido propietario | `/master` muestra su formulario; `/platform` conduce a él |
| Ambas sesiones, incluso identidades distintas | La sesión Trainer no sustituye ni interfiere con Master |
| Acceso directo y recarga repetida | Master conserva su destino |
| Alternar Dashboard y Master | Cada guard conserva su propia cookie |
| Master vencido/inválido/firma vieja con Trainer vigente | Login Master disponible; API rechazada |
| Cookies legadas v1/v2 de Trainer, incluso puestas bajo nombre Master | No conceden Master ni bloquean el formulario |
| Rol TRAINER, usuario suspendido o sesión revocada | Rechazo en proxy, página y API |
| Restaurar cookie persistente en un nuevo contexto | Se reconstruye autorización desde cookie firmada y usuario |
| Login/logout Master | Sólo escribe/elimina su cookie; Trainer permanece válida |
| Producción, mutación desde origen ajeno | 403; se conserva control de origen |
| `next` externo, relativo ambiguo o de otro portal | Vuelve a destino Master seguro |

La cookie emitida por el handler real conserva HttpOnly, Secure en producción, SameSite=Lax, Path=/, Expires y Max-Age=2.592.000 segundos (30 días). La firma y el vencimiento también se verifican en el servidor; conservar físicamente una cookie vencida no prolonga la autorización.

Suite general: 153 pruebas de pretest + 851 principales aprobadas. Build Next.js 16.2.10/Turbopack de producción correcto, 82 páginas estáticas; conexión ficticia y correos desactivados. TypeScript independiente conserva los 53 diagnósticos previos en tests; ninguno nuevo en la corrección. Lint de archivos modificados, incluidos fixture y tests: limpio. Lint global: 0 errores y 34 advertencias previas en scripts y artefactos nativos ajenos.

### Verificación de navegador

Se ejecutó la compilación real con `next start`, NODE_ENV de producción, una cuenta propietaria ficticia, firmas y handlers reales. El preload explícito `tests/fixtures/master-browser-store.cjs` sustituye únicamente el almacén de pruebas, exige una URL de base loopback ficticia y bloquea escrituras. No se conectó a la base real.

En el navegador integrado se comprobó: login Trainer → Dashboard; navegación directa a `/master` manteniendo Trainer → formulario Master; login Master → `/platform/trainers`; recarga → permanece en Master; enlace Configuración → `/platform/settings`; enlace «Ir a BM Training» → `/dashboard`. El fixture no implementa los datos comerciales del Dashboard; sus lecturas no forman parte de esta verificación de navegación.

Una reconexión reinició las herramientas y el servidor antes de completar el regreso final a Master y el cierre/reapertura de pestaña. La política del navegador impidió recuperar la pestaña que había quedado en una página interna de error. No se intentó evadirla. Esos escenarios de autorización están cubiertos por pruebas automatizadas; no se afirma haber cerrado/reabierto físicamente el Chrome del usuario ni validado su perfil de producción.

## Vercel Production

Se verificaron `.vercel/project.json` (proyecto `bm-training-app`), `vercel.json` y `next.config.ts`: no hay redirects/rewrites de Master configurados allí. AppFrame excluye `/master` y `/platform` del marco Trainer; el service worker no intercepta esas navegaciones. La redirección comprobada estaba en el proxy de aplicación.

La configuración local de producción tiene BM_COACH_ADMIN_TOKEN de longitud válida; no se mostraron secretos. No hay CLI/conector Vercel disponible para inspeccionar las variables remotas ni el deployment actualmente activo. No se modificó configuración remota.

No se requieren migraciones ni variables nuevas. Para activar la corrección, con autorización posterior:

1. Desplegar estos cambios en el proyecto Production correcto.
2. Verificar que BM_COACH_ADMIN_TOKEN existente tenga al menos 32 caracteres y sea estable entre despliegues; no rotarlo como parte de esta corrección, porque invalidaría las sesiones firmadas actuales.
3. Probar en la URL Production habitual `/master`, `/platform/settings`, recarga y alternancia con Dashboard. Conservar los controles HTTPS/Secure y la validación ACTIVE/PLATFORM_OWNER.
4. Si una sesión Master antigua ya venció o pertenece a otro ámbito, iniciar sesión Master normalmente; Trainer puede permanecer abierta. No hace falta borrar cookies, cambiar de navegador ni usar incógnito.

Hasta ese despliegue autorizado, Production seguirá ejecutando su código anterior. El cierre físico/reapertura de Chrome y la sesión específica del usuario quedan como comprobación posterior al despliegue.

# BM Training Master: instalación Android

## Causa comprobada en la aplicación

Antes de esta corrección, `app/layout.tsx` anunciaba `/manifest.webmanifest` y ni `/master` ni `/platform` lo reemplazaban. `app/manifest.ts` define esa aplicación como `id: /admin`, `start_url: /dashboard`, `scope: /`.

Por lo tanto, instalar la aplicación ofrecida desde `/master` no fijaba esa URL como inicio: ofrecía la PWA general de Entrenador. El icono lanzaba `/dashboard` y, sin sesión Trainer, el proxy llevaba al login de Entrenador. Esto es distinto del defecto anterior de autenticación Master.

Además, con una sesión Master válida `/master` redirige legítimamente a `/platform/trainers`; también era necesario cambiar el manifiesto anunciado en esa página. Corregir solamente el login dejaba sin cubrir la instalación realizada después de autenticarse.

El manifiesto determina el inicio de una PWA; la URL visitada al instalar no lo sustituye. La identidad `id` distingue aplicaciones instaladas. Referencia primaria: [Chrome: identidad PWA](https://developer.chrome.com/docs/capabilities/pwa-manifest-id).

No se inspeccionó el WebAPK concreto del celular. La causa está comprobada en la configuración anterior y reproduce la ruta descrita; la instalación física Android queda como aceptación después del despliegue.

## Auditoría y configuración final

| Experiencia | Manifiesto anunciado | Identidad | Inicio | Scope declarado |
| --- | --- | --- | --- | --- |
| Entrenador | `/manifest.webmanifest`, generado por `app/manifest.ts` | `/admin` | `/dashboard` | `/` |
| Alumno | `/portal/manifest.webmanifest` | `/portal` | `/portal` | `/portal/` |
| Master | `/master/manifest.webmanifest` | `/master` | `/master` | `/` |

- `app/master/layout.tsx` y `app/platform/layout.tsx` publican los mismos metadatos `lib/master-pwa.ts`. El HTML servido tiene un único enlace manifest correspondiente a su experiencia.
- El nombre completo es **BM Training Master**. La etiqueta corta **BM Master** permite distinguir el icono cuando Android recorta nombres largos. Se reutilizan los iconos oficiales de 192/512 píxeles y maskable; no hay cambios en el diseño de la aplicación.
- El manifiesto Master es público y no contiene datos ni permisos. El scope `/` es necesario para cubrir las rutas existentes no contiguas `/master` y `/platform/*`. Un scope `/master/` dejaría fuera el inicio `/master` y el panel. Sólo se admite un prefijo de scope; no se cambia la estructura de rutas para resolverlo.
- Scope no es autorización. Los guards de `PLATFORM_OWNER`, estado de usuario, firma y vigencia de sesión siguen actuando en cada petición. No se modificaron cookies, login, logout ni reglas de acceso.
- La identidad de Entrenador y su inicio no cambian. Las sesiones Master y Trainer pueden coexistir en el mismo origen con sus cookies separadas.
- Se conserva el manifiesto de Alumno exactamente como estaba. Su combinación previa de inicio `/portal` y scope declarado `/portal/` no incluye literalmente el inicio según la comparación de prefijos del estándar; el navegador puede usar su scope predeterminado. No causa el inicio incorrecto de Master y no se cambia en este parche.
- Se conserva el único registro `/sw.js`, con scope `/`. Su caché de navegación offline sólo interviene en el portal; no sustituye las navegaciones `/master` o `/platform/*`, ni cachea los manifiestos. No se registra otro worker que pueda interferir con offline o push.
- `app/page.tsx` conserva su redirección general a Dashboard. Las notificaciones del worker mantienen sus destinos; no son parte del lanzamiento desde un icono. No había shortcuts de manifiesto adicionales que redirigieran Master y no se agregan acciones innecesarias.
- No se alteran la configuración ni los manifiestos del contenedor Android nativo. El escenario corregido corresponde a instalación web desde Chrome.

Varias PWAs del mismo origen comparten almacenamiento y permisos del navegador; las identidades distintas no los aíslan. Chrome también puede suprimir la promoción automática de instalación cuando ya existe una aplicación con scope superpuesto. Usar el menú manual de Chrome y verificar el nombre ofrecido evita confundir las experiencias; no se depende de `beforeinstallprompt`. Referencia primaria: [Google: múltiples PWAs del mismo origen](https://web.dev/articles/building-multiple-pwas-on-the-same-domain).

## Qué hacer con accesos anteriores

Después de desplegar esta corrección con autorización:

1. Abrir la URL habitual de Production terminada en `/master` **desde una pestaña de Chrome**. Si la sesión Master sigue vigente, llegará al panel; ambas páginas anuncian la nueva identidad.
2. Usar **Instalar aplicación / Agregar a pantalla principal** desde el menú de Chrome. Comprobar que la oferta dice **BM Training Master** (etiqueta corta **BM Master**) y crear ese acceso.
3. Abrir el nuevo icono. Su inicio configurado es `/master`: mostrará el login Master o el panel si la sesión propietaria sigue vigente. Una sesión Trainer abierta no cambia ese destino.
4. Conservar la aplicación **BM Training** para Entrenador. Si el acceso viejo creado para Master abre Dashboard, pertenece a la identidad general `/admin`; no se transforma automáticamente en la nueva `/master`. Puede retirarse sólo el icono duplicado de la pantalla de inicio, sin desinstalar la aplicación general ni borrar datos del sitio.

Cambiar el nombre de un icono viejo no cambia su identidad ni su ruta de inicio. Una PWA vieja `/admin` debe seguir abriendo Trainer para no romper esa instalación. Un simple marcador, en cambio, conserva la URL guardada: si apunta a `/master`, usa el acceso Master; si apunta a `/dashboard`, debe recrearse para Master. No hace falta borrar cookies, usar incógnito ni borrar el almacenamiento/offline del portal.

Las actualizaciones de WebAPK/manifiesto pueden ser diferidas por Chrome. Pero no se debe esperar que una actualización de `/admin` lo convierta en `/master`: son identidades diferentes. Referencia primaria: [Chrome: actualizaciones del manifiesto](https://web.dev/articles/manifest-updates).

## Pruebas reproducibles

- `npm run test:master-pwa`: identidad, inicio, metadatos de ambos puntos Master, conservación de Trainer/Alumno, iconos, alcance y comportamiento real del worker en VM; incluye regresiones de autorización.
- `npm run test:master-access`: regresiones de autenticación Master y coexistencia de sesiones.
- Después de `npx next build`, `npm run test:master-pwa:http`: levanta la compilación real en loopback, con cuenta ficticia, base desconectada y escrituras bloqueadas. Sirve HTML con User-Agent Android/Chrome y comprueba manifiesto público, único enlace correcto, login, cookies simultáneas, inicio Master, inicio Trainer, recarga, enlaces internos y protección de API. El servidor se cierra al terminar.

Resultado: 26 pruebas PWA/regresión, 5 HTTP y 61 de acceso Master aprobadas. Build de producción correcto (82 páginas estáticas), lint de archivos del cambio sin errores ni advertencias. TypeScript conserva exactamente los 53 errores previos de tests, sin diagnósticos nuevos. Evidencia resumida en `docs/master-pwa-validation.json`.

La suite HTTP simula peticiones de lanzamiento a `start_url`; no instala WebAPKs ni acciona un launcher Android físico. No se afirma haber validado el menú de instalación de cada versión de Chrome o del dispositivo del usuario. La comprobación final consiste en instalar y abrir los dos iconos en ese dispositivo después del despliegue.

No requiere migraciones ni variables nuevas. No se despliega, no se modifica información comercial, no se toca BM Timer y no se hace commit ni push.

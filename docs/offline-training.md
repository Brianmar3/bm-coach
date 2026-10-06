# Rutina sin conexión del alumno

Implementación web para Personalizados y Mixtos con rutina activa. No modifica planes, asignaciones, modelos de datos ni Android/Capacitor. No hay migraciones, commit, push ni despliegue.

## Arquitectura

El service worker anterior sólo gestionaba notificaciones. Capacitor abre la web remota en `/portal/login`; páginas y datos dependían del servidor. Los borradores y temporizadores en localStorage no permitían recuperar la aplicación completa sin internet.

Ahora el service worker prepara `/portal/offline` y sus recursos estáticos. Es una pantalla pública sin datos del alumno renderizados en el servidor. Ante una navegación del portal que falla por falta de red, sirve esa pantalla. No cachea APIs, páginas autenticadas, pagos ni historial. Conserva los manejadores de notificaciones.

La pantalla reutiliza `WorkoutView`, resumen final y temporizadores actuales. Respeta Apariencia y branding del workspace. Permite navegar días/bloques/ejercicios, cargar series/resultados, guardar borradores y finalizar sesiones. Sin rutina descargada muestra un mensaje claro.

## Ajuste de presentación offline

Online sin pendientes no hay tarjeta, mensaje «Sincronizado» ni enlace «Abrir rutina guardada». Offline muestra sólo «Modo sin conexión»; online con pendientes muestra un estado discreto que desaparece al confirmar la cola. Los errores conservan el reintento existente.

Inicio/Rutina mantienen sus URLs: la sección ya abierta utiliza automáticamente la copia, sin redirigir a una pantalla alternativa. La reapertura mediante el shell público conserva los componentes visuales de cabecera, navegación y rutina. Inicio reutiliza la tarjeta habitual del plan; si ya estaba cargado, conserva su composición completa. En una reapertura offline sólo hay datos de rutina: no se inventan perfil, pagos, clases ni estadísticas no guardadas. Al reconectar y terminar la sincronización, el shell vuelve a cargar la ruta habitual online.

La prueba de navegador ahora verifica también la ausencia de estado online, aviso compacto, Inicio/Rutina offline y restauración automática de la ruta online. Validación de este ajuste: 47 focales, 824 pruebas de `npm test`, build aprobado y lint sin errores (34 advertencias previas). No cambia IndexedDB, cola, comprobantes, service worker ni APIs.

## Persistencia y aislamiento

IndexedDB `bm-training-offline-v1` guarda una copia activa en `state` y la cola en `records`. La copia incluye branding, identificación mínima, días, bloques, ejercicios, series, repeticiones, descansos, instrucciones y hasta ocho sesiones propias de referencia. Excluye alumnos asignados/históricos y resúmenes de gestión. La cola contiene payload, timestamps originales, ID estable, revisión, comprobante firmado y confirmación/error del servidor.

Las claves incluyen workspace, alumno y sesión original, además de rutina/día/semana para cada registro. No contiene contraseñas, cookies, tokens de autenticación ni información de otros alumnos. El comprobante HMAC certifica la programación descargada: no permite iniciar sesión ni guardar sin una cuenta actualmente autenticada del mismo alumno/workspace. Usa la clave segura existente `BM_COACH_ADMIN_TOKEN` con un dominio propio.

La copia sigue disponible offline si vence la sesión del servidor; para sincronizar es obligatorio ingresar nuevamente con la misma cuenta. El vencimiento original es metadato del comprobante, no un permiso de acceso al backend. Otra cuenta/workspace limpia la copia anterior. Logout elimina IndexedDB y borradores/temporizadores heredados, con advertencia si hay pendientes. Offline deja sólo una marca no sensible para revocar la sesión remota al reconectar o antes del próximo login.

## Sincronización y conflictos

Cada cambio se guarda antes del envío. La cola se intenta al guardar, recuperar conexión, volver a la app y cada 30 segundos mientras está visible. Ordena por fecha/hora originales y confirma por revisión: respuestas tardías no confirman ediciones más nuevas. Los errores/timeouts conservan los registros para reintento. Hay un bloqueo entre pestañas para el envío y aviso compartido del logout.

El ID del servidor deriva de workspace/alumno/sesión original/ID local. La API reconoce reintentos, conserva sesiones completadas inmutables y mantiene bloqueo/regla semanal existentes. Permite entrega tardía de semanas anteriores con programa firmado de la cuenta correcta y rechaza fechas futuras. No agrega tablas/columnas.

Mientras hay sesión en curso de la semana actual o pendientes mantiene el programa original. Sincroniza antes de reemplazarlo. Los borradores de semanas anteriores se conservan en el servidor y no impiden actualizar la rutina de la nueva semana. El servidor toma objetivos e instrucciones del comprobante; si el entrenador eliminó elementos, conserva referencias y snapshots históricos usando relaciones anulables existentes. Después de finalizar/sincronizar descarga la rutina actual. Un conflicto con una sesión completada en otro dispositivo mantiene el pendiente y muestra el error; no altera el historial ni inventa otra sesión semanal.

## Validación y límites

- `npm test`: 131 pretest + 693 test, aprobados; incluye ocho pruebas nuevas de cola/comprobante/API.
- Focales de rutina/semana/progreso/notificaciones: 75 aprobados. La API real se ejecuta con autenticación/persistencia simuladas, sin modificar bases de datos.
- Chromium/Edge contra build de producción y APIs sintéticas: Personalizado/Mixto, móvil, offline, reapertura, edición/finalización, fallo/reintento, una sola sesión, actualización posterior del programa, logout, otra cuenta, ausencia de copia y reinicio completo del proceso conservando IndexedDB/service worker. Sin desbordamiento horizontal ni errores JavaScript.
- Lint de archivos tocados: sin errores ni advertencias. Lint completo: sin errores, 34 advertencias preexistentes en Android generado/scripts ajenos.
- `npm run build`: aprobado después de detener el servidor de prueba que ocupaba la DLL de Prisma.

Se necesita cargar previamente app y rutina con conexión. La primera apertura absoluta sin código/service worker descargados no puede funcionar offline. Videos/medios externos y demás secciones requieren conexión. Clases offline queda fuera de esta etapa. Borrar datos, desinstalar o la eliminación de almacenamiento por el navegador/OS puede eliminar pendientes locales.

No se probó un teléfono Android/WebView físico ni una base de datos real. El arranque de Capacitor con `server.url` remoto necesita esa comprobación: el reinicio de navegador no demuestra que el bootstrap nativo funcione igual. Estos cambios web no requieren un AAB por sí mismos; primero deben publicarse y abrirse online. Si el WebView falla antes de intervenir el service worker, hará falta un fallback empaquetado y un nuevo AAB. No se modificó ni generó uno.

## Archivos de este cambio

Nuevos:

- `app/api/portal/offline/route.ts`
- `app/portal/offline/page.tsx`
- `componentes/offline-training.tsx`
- `lib/offline-training-client.ts`
- `lib/offline-training-store.ts`
- `lib/offline-training-types.ts`
- `lib/offline-training-sync.ts`
- `lib/offline-training-proof.ts`
- `tests/offline-training.test.ts`
- `tests/offline-training-api.test.ts`
- `scripts/smoke-offline-training.mjs`
- `docs/offline-training.md`

Modificados:

- `app/api/portal/entrenamientos/route.ts`
- `app/api/portal/login/route.ts`
- `app/api/portal/session/route.ts`
- `componentes/portal-section.tsx`
- `componentes/portal-shell.tsx`
- `componentes/portal-login-form.tsx`
- `componentes/pwa-service-worker-registration.tsx`
- `componentes/student-profile-view.tsx`
- `componentes/self-service-account-actions.tsx`
- `public/sw.js`
- `tests/portal-progress.test.ts`
- `tests/student-workout-view.test.ts`
- `tests/portal-home-motion.test.ts` (sólo expectativa de versión del service worker; conserva cambios previos)
- `package.json`

El workspace ya tenía otros cambios; esta lista identifica exclusivamente archivos tocados para el acceso offline.

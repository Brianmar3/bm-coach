# Autoregistro y autogestión — Etapa A

## Alcance y arquitectura auditada

Implementado únicamente A: registro, clasificación SELF_SERVICE y onboarding. No se implementaron el Home funcional (B), el creador guiado (C) ni su integración con sesiones/progreso (D).

El proyecto usa StudentRecord como identidad y ficha persistente; no existe un modelo User independiente. StudentPortalCredential y StudentPortalSession ya resuelven acceso con contraseña scrypt, sesiones mediante token hash y cookies HTTPOnly. StudentRecord.data ya contiene el perfil y el estado de onboarding. Se reutilizan estas estructuras y la misma identidad; no se crea una segunda ficha ni una segunda autenticación.

Los servicios CLASSES, PERSONALIZED y MIXED siguen intactos. Se añade accountType: SELF_SERVICE y trainerId: null en el JSON existente. En registros anteriores, accountType ausente equivale a alumno del entrenador. Por compatibilidad con el enum requerido de Prisma, la columna serviceType conserva PERSONALIZED como valor técnico para una cuenta nueva, pero NO concede un servicio personalizado: accountType controla el acceso. No se crea plan, cuota, membresía, asignación, confirmación ni rutina. No hubo cambios de esquema, migraciones ni resets. La comprobación integral creó y eliminó exclusivamente dos cuentas sintéticas identificadas; no modificó alumnos reales.

## Recorrido implementado

1. Desde el login, Crear cuenta lleva a /portal/crear-cuenta. /portal/registro ya existía como registro rápido del alumno, por eso no se reemplazó.
2. POST /api/portal/registro valida los seis campos permitidos, normaliza email, rechaza identidad/roles/servicios arbitrarios y utiliza la regla existente de contraseña (10–128 caracteres, mayúscula, minúscula, número).
3. El email se reserva como username único. También se verifica contra emails anteriores, sin distinguir mayúsculas, y se evita repetir teléfono. Cuenta, credencial y sesión se crean juntas en una transacción. Un lock transaccional serializa registros y un límite compartido de 10 altas exitosas/minuto reduce ráfagas; no reemplaza protección perimetral anti-bots.
4. Se inicia sesión y se lleva al onboarding, nunca al Home de clases.
5. Al completar se muestra /portal/autogestion: confirmación de cuenta, datos propios, editar perfil y cerrar sesión. Indica explícitamente que el creador de rutinas todavía no está disponible; no simula prestaciones de las siguientes etapas.

No se encontraron términos/consentimiento ya implementados para reutilizar. No se agregó una aceptación ficticia. Email no incluye verificación por enlace ni recuperación nueva de contraseña en esta etapa.

## Perfil real y UX

Se reutilizan StudentOnboarding, sus cuatro pasos, estilos existentes, marca, BM Icons V1 y PasswordField. Objetivos propios: ganar masa, bajar grasa, mejorar salud, ganar fuerza, mejorar rendimiento y mantenerse activo.

Se guardan en el mismo StudentRecord.data: fecha de nacimiento, altura en cm, peso en kg, objetivo, nivel, experiencia, indicador y descripción de limitaciones, días disponibles (1 lunes–7 domingo), minutos por sesión (15–120), lugar, equipamiento, onboardingCompleted y fecha de actualización. La edición posterior usa el mismo onboarding y el mismo registro.

## Aislamiento y permisos

- El registro público rechaza campos extra, incluidos role, accountType, trainerId, serviceType y studentId.
- El onboarding toma exclusivamente el ID de la sesión y guarda campos permitidos. No acepta cambiar clasificación, cuota, entrenador ni identidad.
- getPortalSession rechaza SELF_SERVICE por defecto. Sólo registro/acceso, consulta de sesión, onboarding y cuenta propia están habilitados en A. Las APIs existentes de clases, pagos, rutina, ranking y progreso no reciben permisos implícitos.
- Las páginas del portal tradicional redirigen a autogestión; el panel entrenador conserva su autenticación administrativa independiente.
- coachedStudentsWhere excluye SELF_SERVICE y conserva el JSON histórico sin accountType. Se usa en alumnos, dashboard, pagos/resumen, ranking, seguimiento, diagnósticos/notificaciones y asistencia.
- Las asignaciones de clases/rutinas rechazan cuentas autogestionadas. La ficha administrativa de alumnos no sirve como upgrade implícito.
- El store heredado de alumnos excluye estas cuentas al leer y las conserva al reemplazar la colección, rechazando colisiones de identidad.

Un upgrade futuro debe ser una operación administrativa explícita sobre el MISMO id: cambiar accountType y asignar servicio/plan/relaciones correspondientes. No se implementó upgrade, pagos nuevos ni administración general de usuarios.

## Validación realizada

- 140 pruebas relacionadas aprobadas (registro/seguridad, onboarding, acceso, dashboard, pagos, resumen mensual, ranking, asistencia, clases y creación de rutinas).
- Las pruebas nuevas ejecutan los handlers con dependencias de base/cookies simuladas: alta atómica, email anterior duplicado, error de base, origen inválido, contraseña débil, límite de altas y rechazo de escalada; también verifican el hashing real y el aislamiento de sesión.
- Consulta de sólo lectura inicial a la base configurada: 63 registros, 63 alumnos conservados por el filtro, 0 SELF_SERVICE; partición válida.
- Prueba integral real con scripts/verify-self-service-stage-a.mjs --run: 6 grupos aprobados. Creó dos cuentas mediante HTTP, verificó las credenciales/sesiones reales y email duplicado, guardó los cuatro pasos mediante HTTP y comprobó todos sus campos en Prisma. Intentó cambiar studentId, accountType, trainerId y cuota: sólo cambió el perfil propio y la segunda cuenta quedó intacta. Comprobó cuenta propia renderizada, APIs y panel entrenador bloqueados, ausencia de asignaciones/cuotas/asistencia, exclusión del filtro del entrenador, logout que revoca el token y login que recupera la misma identidad y rechaza contraseña incorrecta. Eliminó únicamente esas dos cuentas con sus credenciales/sesiones; siguen los 63 alumnos anteriores.
- Smoke HTTP contra next start local: crear-cuenta y login 200; onboarding/cuenta/perfil sin sesión redirigen al login; APIs de sesión/datos/dashboard anónimas 401; registro inválido 400.
- npm run lint aprobado; npx next build aprobado; npx prisma validate aprobado; git diff --check aprobado (avisos LF/CRLF del entorno).
- Suite general npm test: pretest 74/74; suite principal 609/611. Fallan dos expectativas preexistentes de archivos no modificados por A: tests/block-timer.test.ts («INTERVAL no se marca completo…») y tests/portal-home-motion.test.ts («densidad compacta en mobile»). No se tocaron esos tests ni esos componentes para ocultarlos.
- No se realizó una prueba física Android/TWA. La comprobación integral HTTP real no equivale a validación visual en dispositivo.
- Sin commit ni push.

## Archivos de esta etapa

- app/api/admin/command-search/route.ts
- app/api/admin/evaluaciones/progreso/route.ts
- app/api/admin/push/diagnostics/route.ts
- app/api/admin/ranking/route.ts
- app/api/alumnos/[id]/route.ts
- app/api/alumnos/route.ts
- app/api/asistencias/route.ts
- app/api/dashboard/route.ts
- app/api/portal/logout/route.ts
- app/api/portal/onboarding/route.ts
- app/api/portal/session/route.ts
- app/api/rutinas/[id]/asignaciones/route.ts
- app/api/rutinas/[id]/duplicar/route.ts
- app/api/rutinas/[id]/route.ts
- app/api/rutinas/route.ts
- app/api/seguimiento/route.ts
- app/api/store/[collection]/route.ts
- app/portal/login/page.tsx
- app/portal/onboarding/page.tsx
- componentes/portal-login-form.tsx
- componentes/student-onboarding.tsx
- lib/event-publication-notifications.ts
- lib/monthly-summary.ts
- lib/payments.ts
- lib/point-ranking.ts
- lib/portal-auth.ts
- lib/student-onboarding.ts
- lib/weekly-attendance-data.ts
- lib/weekly-classes.ts
- types/gestion.ts
- app/api/portal/registro/route.ts
- app/portal/autogestion/page.tsx
- app/portal/autogestion/perfil/page.tsx
- app/portal/crear-cuenta/page.tsx
- componentes/portal-registration-form.tsx
- componentes/self-service-account-actions.tsx
- componentes/self-service-preferences.tsx
- lib/coached-students.ts
- lib/self-service.ts
- tests/self-service.test.ts
- scripts/verify-self-service-stage-a.mjs
- docs/self-service-stage-a.md

Los cambios previos en app/api/seguimiento/detalle/route.ts, scripts/generate-bm-android-brand-assets.py, website-netlify/ y el ZIP del sitio se preservaron sin editarlos.

## Siguientes etapas

B: Home autogestionado, capacidades y navegación propias, sin agenda/cuota presencial.
C: asistente determinista basado en biblioteca BM, objetivos, frecuencia, nivel y equipamiento; edición controlada.
D: activar las rutinas generadas usando TrainingRoutine y el motor existente de sesiones, series, cargas, RIR, descansos e historial; habilitar únicamente endpoints con ownership verificado. Sin motor paralelo.

## Prueba manual en teléfono

Estos cambios están locales: no se hizo deploy. Después de desplegarlos en el entorno HTTPS que quieras probar:

1. Abrí /portal/login en una pestaña privada del teléfono y tocá Crear cuenta. También podés entrar directamente a /portal/crear-cuenta.
2. Ingresá nombre, apellido, email y teléfono nuevos, contraseña de 10–128 caracteres con mayúscula, minúscula y número, y repetila. Tocá Crear mi cuenta.
3. Debe abrirse /portal/onboarding. Tocá Empezar; completá fecha de nacimiento, altura y peso; Continuar.
4. Elegí un objetivo; Continuar. Completá experiencia, limitaciones, días, minutos, lugar y equipamiento; Continuar.
5. Revisá el resumen y tocá Ir a BM Training. Debe abrirse /portal/autogestion, con tu perfil guardado y sin agenda/cuota/asignaciones del entrenador.
6. Entrá a Editar mi perfil, cambiá un dato, completá el flujo y recargá para verificar que persiste.
7. Tocá Cerrar sesión. Volvé a entrar con el email y contraseña; debe volver a la misma cuenta sin repetir onboarding.
8. Intentá abrir /dashboard: debe pedir el acceso del entrenador. /portal/clases debe volver al contexto autogestionado, no mostrar clases presenciales.
9. Con una segunda cuenta en otra pestaña privada/dispositivo, verificá que ambas muestran sus propios datos. Desde tu acceso de entrenador, verificá que las nuevas cuentas no aparecen en alumnos, cuotas ni selectores de clases/rutinas.
10. Intentá registrarte otra vez con el mismo email: debe rechazar el duplicado. La cuenta de prueba manual es una cuenta real y no se elimina automáticamente.

Para probar sin desplegar: ejecutar Next en modo desarrollo accesible en la red local (npm run dev -- --hostname 0.0.0.0) y abrir http://IP-DE-LA-PC:3000/portal/crear-cuenta desde el teléfono conectado a la misma Wi-Fi. Confirmar el puerto informado por Next y el permiso de firewall. No usar next start sobre HTTP de LAN para esta prueba: las cookies de producción son Secure y requieren HTTPS.

## git status --short al cierre

```text
 M app/api/admin/command-search/route.ts
 M app/api/admin/evaluaciones/progreso/route.ts
 M app/api/admin/push/diagnostics/route.ts
 M app/api/admin/ranking/route.ts
 M app/api/alumnos/[id]/route.ts
 M app/api/alumnos/route.ts
 M app/api/asistencias/route.ts
 M app/api/dashboard/route.ts
 M app/api/portal/logout/route.ts
 M app/api/portal/onboarding/route.ts
 M app/api/portal/session/route.ts
 M app/api/rutinas/[id]/asignaciones/route.ts
 M app/api/rutinas/[id]/duplicar/route.ts
 M app/api/rutinas/[id]/route.ts
 M app/api/rutinas/route.ts
 M app/api/seguimiento/detalle/route.ts
 M app/api/seguimiento/route.ts
 M app/api/store/[collection]/route.ts
 M app/portal/login/page.tsx
 M app/portal/onboarding/page.tsx
 M componentes/portal-login-form.tsx
 M componentes/student-onboarding.tsx
 M lib/event-publication-notifications.ts
 M lib/monthly-summary.ts
 M lib/payments.ts
 M lib/point-ranking.ts
 M lib/portal-auth.ts
 M lib/student-onboarding.ts
 M lib/weekly-attendance-data.ts
 M lib/weekly-classes.ts
 M scripts/generate-bm-android-brand-assets.py
 M types/gestion.ts
?? Brian-Martinez-Fuerza-Funcional-Netlify.zip
?? app/api/portal/registro/
?? app/portal/autogestion/
?? app/portal/crear-cuenta/
?? componentes/portal-registration-form.tsx
?? componentes/self-service-account-actions.tsx
?? componentes/self-service-preferences.tsx
?? docs/self-service-stage-a.md
?? lib/coached-students.ts
?? lib/self-service.ts
?? scripts/verify-self-service-stage-a.mjs
?? tests/self-service.test.ts
?? website-netlify/
```

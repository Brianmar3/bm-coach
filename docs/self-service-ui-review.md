# Revisión UI SELF_SERVICE

## Implementación

- Se extrajo la presentación existente de PERSONALIZED a `componentes/portal-visuals.tsx`: header, avatar de perfil, hero, contenedor de rutina, contenedor de perfil, estilos de estadísticas y enlaces de navegación móvil.
- Los componentes originales consumen ahora esas mismas piezas. Se conservaron sus clases y su lógica; no se trasladaron permisos ni funcionalidades de alumnos a SELF_SERVICE.
- Home: saludo compacto, objetivo/nivel/días reales, estado vacío de rutina y dos estadísticas reales, en lugar de tarjetas grandes independientes.
- Rutina: estado vacío «Todavía no creaste una rutina.» y botón «Crear mi rutina». El creador no existe en esta etapa: el botón está deshabilitado, con explicación accesible. No se implementó creador ni nueva detección de rutinas activas.
- Perfil: avatar y encabezado compartidos, enlaces compactos «Mi información» y «Editar perfil», y cierre de sesión existente. La información completa sigue en su ruta actual.
- Se mantienen exclusivamente Inicio / Rutina / Perfil. No se agregaron notificaciones, clases, cuotas, nutrición ni evaluaciones.
- No se cambiaron auth, onboarding, datos, permisos, redirects, APIs ni Prisma.

## Validaciones

- 79 tests relacionados aprobados: self-service-home, self-service, student-onboarding, authentication-ux, portal-progress, ux-consistency, student-quick-panels y student-workout-view.
- Suites portal-home-motion y portal-home-responsive-layout: 12 aprobados y 3 fallos previos. Se ejecutaron las mismas expectativas contra los archivos de HEAD y se reprodujeron exactamente los mismos tres fallos: densidad antigua del hero, altura natural y reserva inferior (las dos últimas inspeccionan un fragmento de código demasiado amplio). No se corrigieron esas expectativas ajenas.
- Las pruebas de estilos extraídos leen también el nuevo archivo compartido.
- npm run lint: OK, sin warnings tras eliminar una directiva que quedó sin uso.
- npx next build: OK, TypeScript y generación de páginas completados.
- npx prisma validate: OK.
- git diff --check: OK. Git emite avisos de normalización LF/CRLF, no errores de whitespace.
- No hubo validación visual en navegador autenticado ni en teléfono real. Los tests de navegación son estructurales; no equivalen a una prueba táctil end-to-end.
- Sin commit ni push.

## Archivos de esta tarea

- componentes/portal-visuals.tsx (nuevo)
- componentes/portal-shell.tsx
- componentes/portal-section.tsx
- componentes/student-profile-view.tsx
- componentes/self-service-shell.tsx
- app/portal/autogestion/page.tsx
- app/portal/autogestion/rutina/page.tsx
- app/portal/autogestion/perfil/page.tsx
- app/portal/autogestion/perfil/informacion/page.tsx
- tests/self-service-home.test.ts
- tests/portal-home-motion.test.ts
- tests/portal-home-responsive-layout.test.ts
- tests/ux-consistency.test.ts
- docs/self-service-ui-review.md (este informe)

## git status --short

Los seis archivos de API y el script Android ya estaban modificados al comenzar y se preservaron sin tocarlos.

```text
 M app/api/admin/command-search/route.ts
 M app/api/admin/evaluaciones/progreso/route.ts
 M app/api/admin/push/diagnostics/route.ts
 M app/api/admin/ranking/route.ts
 M app/api/alumnos/[id]/route.ts
 M app/api/seguimiento/detalle/route.ts
 M app/portal/autogestion/page.tsx
 M app/portal/autogestion/perfil/informacion/page.tsx
 M app/portal/autogestion/perfil/page.tsx
 M app/portal/autogestion/rutina/page.tsx
 M componentes/portal-section.tsx
 M componentes/portal-shell.tsx
 M componentes/self-service-shell.tsx
 M componentes/student-profile-view.tsx
 M scripts/generate-bm-android-brand-assets.py
 M tests/portal-home-motion.test.ts
 M tests/portal-home-responsive-layout.test.ts
 M tests/self-service-home.test.ts
 M tests/ux-consistency.test.ts
?? componentes/portal-visuals.tsx
?? docs/self-service-ui-review.md
```

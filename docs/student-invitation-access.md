# Acceso después de una invitación de alumno

La invitación `/join/student/[token]` sirve únicamente para crear una cuenta. El acceso permanente es `/portal/login?mode=student`; el portal es `/portal`.

Después de un alta exitosa, el formulario usa el mismo `/api/portal/login` y la misma reconciliación offline que el login existente. La pantalla final explica que el enlace de invitación ya no hace falta. Si se inicia sesión, «Entrar a BM Training» lleva al portal. Si falla el login automático, la cuenta permanece creada y ese botón lleva al acceso normal: no se repite el alta.

La página distingue utilizada, vencida sin usar, revocada, inválida y espacio no disponible. Una utilizada ofrece Ingresar incluso después de su fecha de vencimiento. Sólo conserva nombre y accent del workspace cuando el acceso al workspace está habilitado; no expone información personal ni credenciales. No permite otra alta.

No se modificaron endpoints, sesiones, límites, revocación, token single-use, plazo de siete días, Prisma ni Android. Existe infraestructura PWA, pero no se encontró un flujo interactivo de instalación para reutilizar; no se agregó otro instalador.

## Archivos
- `app/join/student/[token]/page.tsx`.
- `componentes/student-invitation-form.tsx`.
- `componentes/student-invitation-outcome.tsx` (nuevo).
- `lib/student-invitation-access.ts` (nuevo).
- `tests/student-invitation-registration.test.mjs`: handlers reales y página real con base simulada.
- `tests/evaluation-interpretation.test.ts`: actualiza una comprobación estática preexistente al marcado vigente de filtros; sin cambios de producto.
- `scripts/smoke-student-invitation-access.mjs` (nuevo).
- Este documento y `docs/visuals/student-invitation-access`.

Validación: 47 tests focales; npm test 153 + 848 PASS; smoke 48 escenarios PASS en 320/390/430/1280 con accent BM/azul; lint sin errores y 34 warnings preexistentes; build y TypeScript PASS. El smoke usa APIs simuladas y los tests de integración ejecutan handlers reales contra una base simulada. No se usaron cuentas reales ni teléfono físico.

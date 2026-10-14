# Búsqueda y filtros integrados

`SearchWithFilters` contiene la lupa, el buscador existente, el icono de filtros con badge y el panel desplegable. `TrainerFilters` reutiliza ese contenedor para sus selectores. El panel empieza cerrado también en desktop. Enter activa el botón; Escape cierra el panel y devuelve el foco al icono.

Pantallas unificadas:
- Alumnos, Evaluaciones, Pagos y detalle por alumno de Resumen mensual.
- Rutinas asignadas y clases completas.
- Biblioteca de ejercicios, listado de bloques y selector de bloques.
- Seguimiento actual y componente de seguimiento anterior.
- Eventos.

Se conservan los valores, handlers, debounce, paginación, consultas, favoritos, recientes y operaciones existentes. El contador representa los filtros adicionales; la búsqueda se conserva al limpiar salvo donde el handler previo ya la limpiaba. No se modificaron los módulos del portal alumno ni el panel de administración de la plataforma.

Validación: tests focales y scripts `smoke-trainer-filters.mjs`, `smoke-exercise-picker-mobile.mjs` y `smoke-search-filter-consumers.mjs`. Los smokes usan componentes reales, CSS compilado y respuestas HTTP simuladas; no escriben datos reales. Evidencias en `docs/visuals/integrated-*`.
## Archivos de esta tarea

- `componentes/search-with-filters.tsx` (nuevo).
- `componentes/trainer-filters.tsx`.
- `app/globals.css`.
- `app/rutinas/page.tsx`, `app/eventos/page.tsx`.
- `componentes/exercise-library.tsx`.
- `componentes/training-library-blocks.tsx`, `componentes/training-library-block-picker.tsx`.
- `componentes/routine-follow-up-dashboard.tsx`, `componentes/routine-follow-up.tsx`.
- `tests/routine-library-reorganization.test.ts` (actualiza el contrato del handler existente con protección de doble clic).
- `scripts/smoke-trainer-filters.mjs`, `scripts/smoke-exercise-picker-mobile.mjs`.
- `scripts/smoke-search-filter-consumers.mjs` (nuevo).
- Este documento y las evidencias `docs/visuals/integrated-trainer-filters`, `integrated-exercise-picker`, `integrated-filter-consumers`.

Resultado: 153 tests focales PASS; 144 escenarios de vistas principales, 56 de Biblioteca de ejercicios y 112 de consumidores adicionales PASS. Lint: 0 errores y 34 warnings preexistentes. Build y TypeScript: PASS. El teclado móvil físico no se probó; se usó navegador y viewport reducido en el smoke de Biblioteca.

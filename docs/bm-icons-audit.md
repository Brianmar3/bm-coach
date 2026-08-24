# Auditoría inicial de iconos

Auditoría realizada para BM Icons V1. El relevamiento encontró 30 usos de `<svg>` distribuidos en 19 archivos, 14 declaraciones de componentes de icono locales y 66 líneas con símbolos Unicode potencialmente usados como iconos. Las cifras son un inventario técnico: algunos SVG son gráficos o ilustraciones y varios caracteres Unicode son texto legítimo.

| Área / concepto | Fuente anterior | Tipo | Estado V1 |
| --- | --- | --- | --- |
| Navegación alumno: Inicio, Rutina, Clases, Nutrición, Evaluación | `portal-shell.tsx` | Unicode | Migrado a BM Icons |
| Ajustes: campana, seguridad, privacidad, preferencias, ayuda, logout | `settings-icons.tsx` | SVG local | Migrado; archivo conservado como adaptador |
| Perfil: configuración, avatar, editar e información personal | `student-profile-view.tsx` | Unicode | Migrado a BM Icons |
| Sidebar entrenador | `sidebar.tsx` | SVG local | Conservado; candidato a fase gradual |
| Dashboard entrenador | `app/dashboard/page.tsx` | SVG local | Conservado; iconografía contextual |
| Pagos | `app/pagos/page.tsx` | SVG local | Conservado; candidato a fase gradual |
| Nutrición y hábitos | `student-nutrition.tsx` | SVG local | Conservado; dominio especializado |
| Progreso alumno | `portal-progress.tsx` | SVG local | Conservado; dominio especializado |
| Clases: calendario y registros | `portal-classes.tsx` | SVG local | Conservado; candidato a fase gradual |
| Notificaciones administrativas | `admin-notification-center.tsx` | SVG local | Conservado para no mezclar comportamiento |
| Reproducción multimedia | `routine-exercise-media.tsx` | SVG local | Conservado; control multimedia específico |
| FAB entrenador | `trainer-floating-actions.tsx` | SVG local | Conservado; tiene animación propia |
| Ranking y gamificación | `portal-ranking.tsx`, `portal-section.tsx` | SVG local | Conservado; medallas y escudos especiales |
| Gráficos y visualizaciones | componentes de charts | SVG | Excluido: no es iconografía de interfaz |
| Body map | componentes de mapa corporal | SVG | Excluido: ilustración interactiva |
| Splash BM | `bm-training-splash.tsx` | SVG/CSS | Excluido: branding y animación |
| Logos, avatares y media de ejercicios | `public/` y `Image` | Raster | Excluido: assets de marca o contenido |

## Duplicados e inconsistencias detectadas

- Campana, calendario, usuario, gráfico, agregar y controles de navegación tenían más de una representación.
- Ajustes mantenía un mapa de paths independiente aunque los mismos conceptos ya aparecían en otras superficies.
- La navegación inferior y Perfil usaban caracteres dependientes de la fuente, con peso y alineación distintos entre Android, iOS y escritorio.
- Algunas piezas especializadas comparten concepto pero también animación o composición propia; se dejaron intactas para evitar una migración visual masiva.

## Resultado

BM Icons V1 ofrece 56 nombres exportados normalizados (incluyendo alias semánticos que comparten un único dibujo). La primera integración reemplaza los casos repetidos de menor riesgo y deja documentados los candidatos posteriores. No se modificaron lógica de negocio, rutas, APIs, Prisma, datos ni assets visuales existentes.

# BM Training · Sistema de íconos premium

## Diseño e integración

Familia SVG dibujada en código sobre una grilla de 24 unidades, con margen óptico y trazo redondeado de 1,7. Las siluetas principales son distintas y conservan legibilidad a 16, 20 y 24 px. Sin imágenes raster en producción, filtros, gradientes metálicos, fuentes de íconos o dependencias nuevas.

Carpeta: componentes/icons/bm-premium. Los imports existentes desde componentes/icons y bm-icons continúan funcionando. La migración central actualiza navegación, cards, clases, rutina, evaluación, progreso, calendario, timer, ranking y datos en sus consumidores. Sidebar y nutrición dejan de mantener una segunda colección local de SVG. Los SVG de gráficos y las ilustraciones decorativas conservan su función original; no son íconos de interfaz.

API: size, className, color, stroke, strokeWidth, active, title. Por defecto heredan currentColor del contexto. active usa brand-text del workspace; un color explícito tiene prioridad. Los íconos decorativos se ocultan al lector de pantalla y no reciben foco; title habilita role=img. No se cambia el área táctil ni el nombre accesible del botón.

## Dónde se aplica cada ícono

| Concepto | Exportaciones | Consumidores |
|---|---|---|
| Inicio | BmHomeIcon | `componentes/offline-training.tsx`, `componentes/portal-shell.tsx`, `componentes/self-service-shell.tsx` |
| Rutina | BmRoutineIcon, BmBarbellIcon, BmDumbbellIcon | `app/dashboard/page.tsx`, `app/portal/autogestion/page.tsx`, `componentes/offline-training.tsx`, `componentes/portal-classes.tsx`, `componentes/portal-evaluations-dashboard.tsx`, `componentes/portal-progress.tsx`, `componentes/portal-section.tsx`, `componentes/portal-shell.tsx`, `componentes/quick-log.tsx`, `componentes/self-service-routine-wizard.tsx`, `componentes/self-service-shell.tsx`, `componentes/sidebar.tsx`, `componentes/student-onboarding.tsx`, `componentes/student-profile-view.tsx` |
| Clases | BmClassesIcon | `app/alumnos/page.tsx`, `componentes/portal-shell.tsx`, `componentes/sidebar.tsx`, `componentes/student-profile-view.tsx` |
| Nutrición | BmNutritionIcon, BmAppleIcon | `componentes/portal-shell.tsx` |
| Evaluación | BmEvaluationIcon | `componentes/portal-evaluations-dashboard.tsx`, `componentes/portal-progress.tsx`, `componentes/portal-section.tsx`, `componentes/portal-shell.tsx`, `componentes/sidebar.tsx` |
| Alumnos | BmStudentsIcon | `componentes/sidebar.tsx` |
| Objetivo | BmTargetIcon | `app/alumnos/page.tsx`, `app/portal/autogestion/page.tsx`, `componentes/portal-section.tsx`, `componentes/self-service-routine-wizard.tsx`, `componentes/student-profile-view.tsx` |
| Progreso | BmProgressIcon | `app/dashboard/page.tsx`, `app/portal/autogestion/page.tsx`, `componentes/evaluation-insights.tsx`, `componentes/portal-evaluations-dashboard.tsx`, `componentes/portal-progress.tsx`, `componentes/portal-section.tsx`, `componentes/quick-log.tsx`, `componentes/student-onboarding.tsx` |
| Molestias | BmDiscomfortIcon | `componentes/student-health-observations.tsx`, `componentes/student-profile-view.tsx` |
| Calendario | BmCalendarIcon | `app/alumnos/page.tsx`, `componentes/portal-classes.tsx`, `componentes/portal-progress.tsx`, `componentes/portal-section.tsx`, `componentes/student-nutrition.tsx`, `componentes/student-onboarding.tsx`, `componentes/student-profile-view.tsx` |
| Timer | BmTimerIcon | `app/alumnos/page.tsx`, `componentes/exercise-rest-timer.tsx`, `componentes/portal-classes.tsx`, `componentes/portal-progress.tsx`, `componentes/portal-section.tsx`, `componentes/rest-timer-provider.tsx`, `componentes/self-service-routine-wizard.tsx` |
| Ranking | BmRankingIcon | `componentes/portal-section.tsx`, `componentes/student-onboarding.tsx` |

Perfil: Altura/peso usa medidas; Objetivo usa diana; Entrena actualmente usa mancuerna; Nivel/experiencia usa niveles; Molestias usa torso con punto localizado. Altura y Peso en onboarding mantienen íconos distintos. La diana neutra ya existente del onboarding se conserva. En la ficha del entrenador se agregan íconos a las etiquetas de datos sin modificar sus valores.

## Catálogo público (76 exportaciones, incluidos alias compatibles)

BmHomeIcon, BmRoutineIcon, BmClassesIcon, BmNutritionIcon, BmAppleIcon, BmEvaluationIcon, BmStudentsIcon, BmTargetIcon, BmFocusIcon, BmProgressIcon, BmDiscomfortIcon, BmCalendarIcon, BmTimerIcon, BmRankingIcon, BmHeightIcon, BmWeightIcon, BmMeasurementsIcon, BmLevelIcon, BmBirthdayIcon, BmDashboardIcon, BmMonthlyIcon, BmMenuIcon, BmDumbbellIcon, BmBarbellIcon, BmProfileIcon, BmUserIcon, BmUserPlusIcon, BmSettingsIcon, BmBellIcon, BmShieldCheckIcon, BmLockIcon, BmSlidersIcon, BmHelpCircleIcon, BmLogoutIcon, BmPlusIcon, BmPlayIcon, BmEditIcon, BmBackIcon, BmChevronRightIcon, BmCloseIcon, BmDeleteIcon, BmSearchIcon, BmFilterIcon, BmMoreIcon, BmCopyIcon, BmCheckIcon, BmEyeIcon, BmEyeOffIcon, BmPointsIcon, BmTrophyIcon, BmMedalIcon, BmCrownIcon, BmAttendanceIcon, BmPaymentIcon, BmWalletIcon, BmHistoryIcon, BmChartIcon, BmChallengeIcon, BmWorkoutIcon, BmClipboardIcon, BmFlameIcon, BmHealthIcon, BmHydrationIcon, BmPhoneIcon, BmMailIcon, BmInfoIcon, BmCommentIcon, BmBookmarkIcon, BmStarIcon, BmCartIcon, BmCookingIcon, BmBookIcon, BmLearningIcon, BmProteinIcon, BmPlantIcon, BmMealPlanIcon.

## Validación

[Vista navegable de la familia y contextos](visuals/bm-premium-icons.html) con selector Claro/Oscuro. Capturas de referencia: bm-premium-light-390.png, bm-premium-dark-390.png, bm-premium-light-1280.png y bm-premium-dark-1280.png.

La vista usa los SVG, Sidebar, PortalNavigationLink, InfoRow y Detail reales, con datos de prueba. Se comprueban 320/390/1280 px, Claro/Oscuro, dorado BM y verde personalizado, encuadre sin recortes, semántica distinta del perfil, estados activos, accesibilidad SVG y ausencia de overflow horizontal. No es una sesión autenticada de producción ni un Android físico.

Pruebas focales de íconos, perfil, onboarding, timer y molestias; suite completa; lint; build. El temporizador, eventos, sonido, rutas, persistencia, APIs y modelos no se modifican. No se despliega producción, ni se hace commit o push.

## Archivos de esta tarea

- app/alumnos/page.tsx
- componentes/icons/bm-icons.tsx
- componentes/icons/bm-premium/icon.tsx
- componentes/icons/bm-premium/core.tsx
- componentes/icons/bm-premium/support.tsx
- componentes/icons/bm-premium/index.ts
- componentes/portal-visuals.tsx
- componentes/sidebar.tsx
- componentes/student-profile-view.tsx
- componentes/student-onboarding.tsx
- componentes/student-health-observations.tsx
- componentes/student-nutrition.tsx
- tests/bm-icons.test.ts
- tests/student-enrollment-limitations.test.ts
- scripts/smoke-bm-premium-icons.mjs
- docs/bm-premium-icons.md
- docs/visuals/bm-premium-icons.html
- docs/visuals/bm-premium-light-390.png
- docs/visuals/bm-premium-light-1280.png
- docs/visuals/bm-premium-dark-390.png
- docs/visuals/bm-premium-dark-1280.png

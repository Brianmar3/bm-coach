# Progreso granular del entrenamiento

La cabecera normal calculaba completedBlocks / totalBlocks. Un bloque de fuerza sólo se considera terminado cuando todos sus ejercicios tienen todas sus series completas; por eso tres ejercicios completos dentro del único bloque seguían mostrando 0%.

La fuente compartida es lib/workout-day-progress.ts. El export focusProgress de lib/workout-focus-flow.ts es un alias de workoutDayProgress, no otro cálculo. La cabecera normal y Enfoque leen el mismo borrador de sesión. No se persiste un porcentaje ni se cambia API/IndexedDB/sync.

En fuerza: series completadas / series reales de la sesión. Dos series dentro de un ejercicio de cuatro aportan inmediatamente; desmarcar resta. La copia STRENGTH de los bloques no duplica las series. Entrada en calor sigue siendo texto informativo y no se cuenta.

En sesiones mixtas, cada bloque sin series aporta una unidad como antes, pero puede aportar una fracción verificable:
- Movilidad, libre y circuito sin objetivo de rondas: ejercicios marcados, deduplicados y pertenecientes al bloque, más el checkpoint existente de finalización explícita. Todos los checks por sí solos no cierran el bloque.
- Circuito con rondas programadas: rondas registradas, acotadas al objetivo, más el checkpoint de finalización. No se suman además los checks de estaciones.
- EMOM: minutos registrados frente a los minutos programados más el checkpoint de finalización.
- Intervalos, AMRAP y For time: completion existente. Sus timers no persisten una unidad parcial acotada durante ejecución; no se convierte tiempo transcurrido ni vueltas abiertas en un porcentaje inventado.
- completed=true aporta la unidad completa en todos los bloques sin series, preservando su semántica actual.

Fórmula mixta: (series completas + fracciones de bloques sin series) / (series reales + cantidad de bloques sin series). No implica igual esfuerzo entre una serie y un bloque: mide cumplimiento del plan, no carga ni duración.

El porcentaje permanece entre 0 y 100 y el vacío da 0. El texto no redondea 99.x a 100 si hay un checkpoint pendiente. Finalización de bloques y sesión mantiene sus reglas existentes.

En fuerza, el círculo ahora muestra ejercicios totalmente completados (3/6), mientras barra y porcentaje muestran series. En sesiones mixtas conserva el contador de bloques completos; es un indicador separado del avance granular.

scripts/smoke-workout-day-progress.mjs usa el componente real en el build local con APIs sintéticas, IndexedDB y Service Worker reales. Comprueba el caso de tres ejercicios completos/10 de 20 series, igualdad entre pantallas, desmarcado, 320/390/430 px, light/dark/system, BM/azul, recarga offline y sync sin duplicación. Capturas e informe en docs/visuals/workout-day-progress. No reemplaza una prueba física de Android.

Resultado: 81 tests focales PASS; npm test 147 previos + 834 principales PASS; lint 0 errores y 34 warnings preexistentes; build/TypeScript PASS; 25 escenarios de navegador PASS, incluida recarga offline y sincronización. APIs sintéticas, sin base de datos real ni dispositivo físico.

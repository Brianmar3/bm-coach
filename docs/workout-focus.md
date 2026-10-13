# Modo Enfoque guiado

## Ejecución

Entrar muestra el ejercicio sin iniciar sesión ni descanso. “Iniciar entrenamiento” utiliza beginWith, el borrador y el guardado existentes. Editar carga/reps/esfuerzo en la preparación no inicia la sesión. Ya iniciada, la primera serie pendiente se destaca y la acción principal permite completarla; todas las filas siguen siendo editables.

Completar una serie conserva el guardado local/IndexedDB y la sincronización existentes. Se inicia el descanso programado del ejercicio mediante una acción explícita del proveedor existente (no un toggle). Pausar, reanudar, reiniciar y saltar actúan sobre ese mismo timer. La pausa también se recupera al recargar.

Al completar todas las series, se muestra feedback y se avanza después del descanso existente, con una transición mínima de 600 ms. Sin descanso programado, sólo se espera ese feedback. La navegación manual cancela el avance pendiente; desmarcar una serie impide avanzar sobre un ejercicio incompleto. Los locks existentes y un bloqueo de acción evitan doble guardado/doble avance.

Al terminar la fuerza, si quedan otros bloques, la acción invita a continuar con los bloques del recorrido. Si está todo completo, abre el resumen de finalización existente. La confirmación conserva sensación/dolor/comentario y persistencia idempotente; no crea un cierre paralelo.

## Contexto y tiempo

El detalle de Biblioteca aporta instrucciones, músculo, equipo y media opcional. Se consulta independientemente del flag de media; instrucciones disponibles siguen visibles sin imagen. Fallos de red/media no impiden entrenar ni muestran contenedores vacíos. La información no cacheada de Biblioteca puede faltar offline; la rutina y las indicaciones del entrenador siguen disponibles.

El progreso usa el cálculo compartido de lib/workout-day-progress.ts: series realmente completadas y resultados verificables de bloques sin series, no la posición de navegación. La cabecera normal usa el mismo helper; ver docs/workout-day-progress.md para las unidades y checkpoints por tipo. El tiempo total es tiempo transcurrido incluyendo descansos y tiempo con la app cerrada. Un ancla local bajo la clave existente del borrador permite empezar en cero y recuperar precisión tras reload; se elimina al finalizar y entra en la limpieza existente de drafts/timers al cambiar de cuenta. Sesiones antiguas sin ancla usan fecha/hora existente con precisión de minutos. No se cambió backend, API, Prisma ni Android.

## Validación

`tests/workout-focus-flow.test.ts` cubre selección/progreso/avance/tiempo y contratos de integración. `scripts/smoke-workout-focus.mjs` monta WorkoutView real con el shell offline del build local, APIs y media sintéticas, IndexedDB y Service Worker reales, sin DB. Comprueba 320/390/430/768/1280, dark/light/system-light/system-dark, accents BM/azul, navegación, edición, descanso, autoavance y finalización única. Incluye recarga sin conexión, recuperación de pausa y sincronización sin registros duplicados; las capturas y el informe quedan en docs/visuals/workout-focus.

El teclado se comprueba mediante viewport visual reducido y emulación táctil de Edge; no reemplaza una prueba física en Android. La media de prueba es sintética, sin descargar ni modificar el catálogo real.

Resultado final: 65 tests focales PASS; npm test 147 previos + 821 principales PASS; lint 0 errores y 34 warnings preexistentes; build y TypeScript PASS; 42 escenarios de navegador PASS. Capturas revisadas de inicio, activo, media, claro, pausa y desktop. Sin commit, push ni deploy.

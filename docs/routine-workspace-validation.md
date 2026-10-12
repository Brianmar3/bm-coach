# Armador de rutinas — cierre de validación

Fecha: 11 de octubre de 2026. Sin commit, push, deploy ni migraciones.

## Alcance

Workspace de rutinas con navegador de días, canvas del día activo, resumen real de programación y configuración/asignación secundaria. Se conservan el modelo de bloques, la serialización, las validaciones y los mecanismos de versiones/historial existentes. El portal del alumno no se modificó.

## Evidencia

- 202 tests focales del armador aprobados.
- `npm test`: 147 pruebas previas y 766 principales aprobadas; total 913.
- `npm run lint`: sin errores; 34 warnings ajenos al cambio, en copias generadas de `native-bridge.js` de Android y scripts de verificación de plataforma.
- `npm run build`: aprobado; compilación, TypeScript y generación de rutas completas.
- Smoke: componentes React reales, CSS compilado y Edge headless; respuestas HTTP simuladas, sin escritura en una base real.
- Prueba del PUT real con base simulada: revisión vieja devuelve 409 antes de escribir; revisión vigente y clientes anteriores sin guard opcional siguen aceptados. Se verifica aislamiento Serializable.
- 36 combinaciones: 320/390/768/1280/1440/1920 × Claro/Oscuro/Sistema × accent BM/personalizado. Se interactúa con inputs y Biblioteca, además de comprobar geometría horizontal.
- Operaciones móviles a 320/390/768: crear día/bloque/ejercicio, buscar, editar series y reps, duplicar ejercicio, selección múltiple, aplicar series/reps/descanso, mover ejercicio, copiar/mover bloque, undo, guardar y activar. También viewport reducido a 450 px de alto para aproximar teclado abierto.
- Todos los tipos: Fuerza, Circuito, Intervalos, EMOM, AMRAP, For time, Bloque libre y Movilidad. Creación, nombre/instrucciones, colapsar/expandir, inserción, duplicar, borrar, undo/redo y guardado.
- Activación válida sin alumno y con alumno; advertencias de contenido vacío; un ejercicio incompleto bloquea la activación.
- Guardado con demora simulada de 700 ms, bloqueo de edición durante petición, conflicto 409, retry, Ctrl+S, salida limpia, continuar editando, guardar y salir, descarte y recuperación después de recargar, incluidos borradores aún sin ID de servidor.
- Deshacer hasta la versión guardada elimina la copia local obsoleta.
- Los menús de bloque se cierran al ejecutar acciones; la prueba encontró y corrigió una superposición después de duplicar.

## Rutina de prueba

Hipertrofia Piernas, tres días y 13 ejercicios al terminar las inserciones y transferencias. Cuádriceps dominante (sentadilla, prensa, zancadas y extensión), posterior/glúteos (rumano, hip thrust, curl y abducción), mixto (goblet, sumo, step up y gemelos), con reutilización desde Biblioteca y un bloque de intervalos para comprobar el aviso de bloque vacío. Datos de prueba; no constituye una prescripción publicada.

## Rendimiento observado

Última ejecución local, con otras verificaciones corriendo en paralelo. Los tiempos incluyen Playwright y el render; no son mediciones de producción ni de un teléfono físico.

| Escenario | Diez teclas | Cambio de día promedio |
|---|---:|---:|
| 1 día / 5 ejercicios | 225 ms | 50 ms |
| 3 días / 20 ejercicios | 409 ms | 149 ms |
| 5 días / 40 ejercicios | 383 ms | 196 ms |
| 7 días / 77 ejercicios | 332 ms | 151 ms |

Se verificaron reorder por teclado, selección, Biblioteca y undo en cada escenario. Sólo se montan los ejercicios del día activo. No se agregó virtualización: no apareció un problema medible que justificara esa complejidad.

## Comparación aproximada de interacciones

Estimación del recorrido, sin contar escritura ni selección de una opción nativa como múltiples clics. No es un experimento cronometrado antes/después.

| Tarea | Antes | Ahora |
|---|---|---|
| Crear desde cero | 3 acciones + datos | 3 acciones + datos; abre workspace |
| Agregar día | 1 acción | 1 acción |
| Agregar bloque nuevo | Apertura + crear nuevo + tipo | Apertura + tipo |
| Agregar ejercicio de catálogo | Crear fila + abrir catálogo + detalle + elegir | Abrir buscador + Agregar |
| Duplicar día | Acción visible | Menú + duplicar; menos ruido permanente |
| Copiar bloque entre días | Reconstrucción/reutilización indirecta | Menú + destino |
| Mover ejercicio entre bloques/días | Rehacer ubicación manualmente | Más acciones + destino compatible |
| Biblioteca de bloques | Abrir/elegir; repetir apertura | Primera apertura/elegir; siguientes inserciones con Agregar |
| Guardar | Guardar y volver a abrir para continuar | Guardar, permanece editando |
| Activar | Acción final | Revisar + confirmar; paso deliberado de seguridad |

## Persistencia y límites

- Autoguardado local debounced a 650 ms, por workspace, entrenador y rutina. Guardar/publicar en servidor sigue siendo explícito.
- Una copia local no es un guardado en servidor: la interfaz lo indica expresamente. No sincroniza entre dispositivos y depende del almacenamiento del navegador.
- Las rutinas activas no se publican automáticamente mientras se escribe. No se introdujo un endpoint de borradores parciales separado.
- Undo/redo conserva hasta 60 estados locales y agrupa escritura por campo. El historial local se reinicia después de guardar correctamente en servidor.
- Favoritos/recientes de ejercicios corresponden a la sesión de edición y están rotulados así. Los favoritos/recientes de bloques usan los datos persistidos existentes.
- Los movimientos de ejercicio permiten destinos del mismo tipo para conservar la semántica de prescripción. Reordenar dentro de una lista conserva IDs; transferir a otra ubicación crea IDs nuevos y mantiene intacto el historial existente.
- Teclado Android/iOS físico, lectores de pantalla y persistencia real en Neon no se probaron en esta ejecución. La emulación de viewport no sustituye esa validación física.
- No se añadieron nuevas bibliotecas, Prisma, migraciones ni cambios en Android/Capacitor.

## Archivos nuevos de esta tarea

- `C:/bmcoach-local/componentes/routine-editor-workspace.tsx`
- `C:/bmcoach-local/componentes/routine-exercise-bulk-editor.tsx`
- `C:/bmcoach-local/componentes/routine-exercise-quick-fields.tsx`
- `C:/bmcoach-local/componentes/use-routine-editor-session.ts`
- `C:/bmcoach-local/lib/routine-editor-state.ts`
- `C:/bmcoach-local/lib/routine-drawer-keyboard.ts`
- `C:/bmcoach-local/scripts/smoke-routine-workspace.mjs`
- `C:/bmcoach-local/tests/routine-editor-state.test.ts`
- `C:/bmcoach-local/tests/routine-editor-conflict.test.ts`
- `C:/bmcoach-local/docs/routine-workspace-validation.md`

## Archivos modificados por esta tarea

- `C:/bmcoach-local/app/rutinas/page.tsx`
- `C:/bmcoach-local/app/globals.css`
- `C:/bmcoach-local/app/api/rutinas/[id]/route.ts`
- `C:/bmcoach-local/app/api/admin/auth/session/route.ts`
- `C:/bmcoach-local/componentes/exercise-library.tsx`
- `C:/bmcoach-local/componentes/training-library-block-picker.tsx`
- `C:/bmcoach-local/componentes/routine-block-sorter.tsx`
- `C:/bmcoach-local/package.json`
- `C:/bmcoach-local/tests/class-template-editor.test.ts`
- `C:/bmcoach-local/tests/evaluation-interpretation.test.ts`
- `C:/bmcoach-local/tests/exercise-library.test.ts`
- `C:/bmcoach-local/tests/routine-block-reorder.test.ts`
- `C:/bmcoach-local/tests/routine-editor-flow.test.ts`
- `C:/bmcoach-local/tests/routine-exercise-media.test.ts`
- `C:/bmcoach-local/tests/routine-trainer-view.test.ts`
- `C:/bmcoach-local/tests/training-blocks.test.ts`
- `C:/bmcoach-local/tests/training-library-insertion.test.ts`

El resto de cambios preexistentes del repositorio se preservó. Los archivos `routine-*.tmp.txt` y las muestras de vídeo temporales son evidencia local de ejecución, no código del producto.

## Cierre de Biblioteca y menús — 12/10/2026

Se completó la validación del arrastre COPY desde las dos Bibliotecas y del menú flotante de bloques. La reanudación corrigió únicamente la conexión de las zonas de bloques al editor correspondiente; el editor de clases conservó su inserción anterior.

- 202 tests focales: aprobados.
- npm test: 147 pretest + 766 tests, todos aprobados.
- npm run build: aprobado, incluida generación de Prisma. El bloqueo inicial de archivos no se reprodujo en la ejecución final.
- Edge con componentes React reales y HTTP simulado: inserciones al inicio/medio/final, destino vacío, rechazo de destino inválido, doble clic, IDs independientes, undo/redo, copia local y guardado/recarga aprobados.
- Autoscroll con arrastre nativo real y menú durante scroll: aprobados.
- 30 combinaciones de 390/768/1280/1440/1920, Claro/Oscuro/Sistema y accent BM/personalizado: aprobadas.
- Regresión previa: 36 combinaciones visuales, ocho tipos de bloque, mobile 320/390/768, recuperación/conflictos/activación y escenarios hasta 77 ejercicios: aprobados.
- Evidencia visual de este cierre: `C:/Users/brian/AppData/Local/Temp/bm-routine-workspace-Kh3xnB`.

Archivos de esta mejora: app/rutinas/page.tsx, app/globals.css, componentes/routine-floating-actions.tsx (nuevo), componentes/routine-library-drag.tsx (nuevo), componentes/routine-block-sorter.tsx, componentes/exercise-library.tsx, componentes/training-library-block-picker.tsx, scripts/routine-library-interaction-checks.mjs (nuevo), scripts/smoke-routine-workspace.mjs, tests/routine-block-reorder.test.ts, tests/training-library-insertion.test.ts y este documento.

Limitaciones: pruebas de navegador con respuestas HTTP simuladas, no con base de producción; teclado móvil mediante viewport reducido, sin dispositivo físico. El arrastre desde Biblioteca requiere mouse/trackpad en desktop; mobile conserva Agregar. Sin APIs nuevas, cambios de modelo, migraciones, commit, push ni deploy en esta mejora.
- npm run lint final: aprobado, 0 errores y 34 warnings preexistentes.

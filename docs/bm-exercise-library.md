# Arquitectura de la Biblioteca de ejercicios BM

## Flujo

`external/exercises-dataset-main/data/exercises.json` → importador determinista → `data/bm-exercise-library.json` → API de lectura → selector de Rutinas → bloques/circuitos → futuro detalle en el portal del alumno.

`scripts/build-exercise-library.mjs` transforma el dataset real en el modelo `BMExercise`. Mantiene el nombre original como `name`, utiliza sólo las instrucciones españolas existentes y crea un texto normalizado para búsqueda en ambos idiomas.

## Localización española

La identidad es siempre `id = dataset:<sourceId>`; ni `displayNameEs` ni los aliases participan de ella. `name` conserva literalmente el nombre fuente inglés y `displayName` se mantiene como alias de compatibilidad del nombre visible español. Las nuevas selecciones guardan `displayNameEs`, `targetMuscleLabelEs` y `equipmentLabelEs` como snapshots, pero persisten el ID original dentro de `bm-library://exercise/...`.

La terminología central vive en `data/exercise-localization-es.json`: incluye labels para implementos, partes corporales y músculos, patrones de movimientos, calificadores, aliases estándar y excepciones exactas. La generación aplica, en orden, excepción exacta, patrón de movimiento, composición controlada y fallback. Una segunda pasada se ejecuta exclusivamente sobre los elementos que la primera dejó en `REVIEW`; usa reglas y excepciones separadas, admite composiciones controladas de varios movimientos y conserva intactos los nombres ya aceptados. Los casos que todavía tienen términos desconocidos o un contexto ambiguo quedan con `translationStatus = REVIEW` y `displayNameEs = name`; no se inventa una traducción.

Los aliases incluyen el nombre fuente y el nombre español, además de variantes estándar como `RDL`, `pesa rusa` o `máquina Smith` cuando corresponden. El reporte reproducible `reports/exercise-library-translation-audit.json` registra cobertura, estrategias, resultados de la segunda pasada, comprobación de regresión sobre lo previamente aceptado, controles básicos de calidad y todos los pendientes con contexto y sugerencia. Cambiar un texto visible o resolver un pendiente no cambia IDs, GIF, miniaturas, atribución ni referencias guardadas.

## Biblioteca y búsqueda

La API carga y memoriza el JSON generado una vez por proceso. El listado entrega un resumen liviano; el detalle completo, incluidas instrucciones, se obtiene sólo cuando se abre un ejercicio. Los filtros de parte corporal, equipamiento y músculo objetivo se derivan del dataset. La búsqueda normaliza mayúsculas, tildes, espacios, guiones y puntuación, y expande abreviaturas simples (`bb`, `db`, `kb`, `bw`).

## Rutinas y compatibilidad

El modelo actual `TrainingRoutineExercise` guarda el nombre, grupo muscular, equipamiento y `videoUrl` como texto y no ofrece metadata JSON ni `libraryExerciseId`. Esta fase no modifica Prisma: al seleccionar desde Biblioteca BM, el borrador conserva el ID explícito durante la edición y persiste en `videoUrl` una referencia interna estable (`bm-library://exercise/dataset%3A…`). El resolver la convierte en la ruta local de media sólo al renderizar. También reconoce las referencias transitorias anteriores con `bm-training.local`, por lo que no rompe datos guardados durante el desarrollo. La referencia permite recuperar el ID, la miniatura, el GIF, las instrucciones y la atribución después de guardar y recargar. Nombre, músculo y equipamiento siguen guardándose como snapshots compatibles; series, repeticiones, carga y descanso continúan bajo control del entrenador.

Los ejercicios manuales y todas las rutinas legacy sin ID siguen usando exactamente el flujo textual existente. El script de auditoría sólo propone coincidencias exactas/normalizadas y nunca modifica datos. Los resultados ambiguos o sin coincidencia requieren curación humana.

Una fase posterior puede normalizar esta referencia agregando `libraryExerciseId String?` a `TrainingRoutineExercise`, con índice y sin reemplazar `name`. La migración debería ser aditiva, nullable y sin backfill automático; `name` debe mantenerse como snapshot y fallback histórico. No es necesaria para el flujo actual.

## Medios y reutilización

`ExerciseThumbnail`, `ExerciseMedia`, `ExerciseDetail` y `RoutineExerciseMediaButton` son reutilizables. El listado y los circuitos cargan sólo miniaturas estáticas; el GIF se solicita al abrir el detalle. El detalle separa las instrucciones propias del ejercicio de la “Indicación de tu entrenador” y mantiene la atribución. La ruta de medios valida que el archivo permanezca dentro del dataset local y respeta el feature flag documentado en `docs/exercise-library-media.md`.

## Operación reproducible

- Regenerar: `node scripts/build-exercise-library.mjs`.
- Auditar sin escrituras: `node scripts/audit-exercise-library.mjs`.
- Los reportes quedan en `reports/exercise-library-audit.json` y `reports/exercise-library-translation-audit.json`.
- No se requiere migración ni dependencia adicional.

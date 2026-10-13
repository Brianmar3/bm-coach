# Ejercicios propios BM

## Arquitectura

`data/bm-exercise-library.json` sigue siendo la base generada (no editar manualmente). `data/bm-exercise-library-custom.json` es la fuente propia versionada, inicialmente `[]`. El importador externo nunca escribe sobre ella.

`lib/exercise-library-catalog.mjs` valida BM y ensambla base + custom en ese orden. `loadExerciseLibrary()` es la lectura única del producto: lista, detalle, búsqueda, filtros y referencias de Rutinas usan el catálogo final. No se fusionan nombres repetidos. Esquema inválido o ID duplicado falla explícitamente, sin omisiones silenciosas. No hay DB, migraciones ni dependencias nuevas.

El catálogo conserva el caché por proceso existente. Para publicar futuras altas hay que incluir el JSON y reiniciar/rebuild del entorno correspondiente. No eliminar ni reemplazar IDs ya usados en rutinas.

## Alta controlada

Crear un JSON de entrada independiente. Ejemplo de formato; no constituye un alta real:

```json
{
  "name": "Nombre original",
  "displayNameEs": "Nombre en español",
  "aliases": ["Alias conocido"],
  "bodyPart": "upper legs",
  "bodyPartLabelEs": "Piernas",
  "targetMuscle": "hamstrings",
  "targetMuscleLabelEs": "Isquiotibiales",
  "secondaryMuscles": ["glutes"],
  "secondaryMusclesEs": ["Glúteos"],
  "equipment": "dumbbell",
  "equipmentLabelEs": "Mancuernas",
  "instructionStepsEs": ["Indicación técnica revisada por el entrenador."]
}
```

```sh
npm run exercise-library:add -- --input ejercicio.json
npm run exercise-library:add -- --input ejercicio.json --write
```

Sin `--write` sólo valida y muestra preview y similares. Con `--write` vuelve a leer las fuentes bajo lock exclusivo, valida IDs, muestra advertencias y guarda atómicamente sólo el custom. Un lock existente provoca error y no se borra. Si un proceso termina abruptamente, revisar que no haya otra alta activa antes de quitar manualmente su lock residual.

Se puede suministrar `id: "bm:<UUID>"` en minúsculas. Si se omite, genera UUID v4; queda persistido al guardar. Nunca depende del nombre, orden ni dataset. Cada preview sin ID genera uno provisional distinto: para revisar exactamente el mismo ID antes de guardar, incluir el mostrado en el JSON de entrada.

Se reutiliza `BMExercise`: source=BM_CUSTOM, sourceId=UUID, displayName (si se omite), muscleGroup y etiqueta (si se omiten), searchableText, translationStatus=EXCEPTION y translationPass=1 son derivados. EXCEPTION representa aquí contenido editorial propio. Arrays e instrucciones pueden omitirse. Campos desconocidos e overrides incompatibles se rechazan. Reutilizar claves existentes de categorías/equipo cuando representen el mismo concepto; nuevas categorías legítimas se admiten.

## Similares

`findSimilarExercises()` compara nombres originales/españoles y aliases de ambas fuentes. Normaliza tildes, caja, puntuación, espacios y BB/DB/KB/BW. Traducciones conocidas provienen de nombres y aliases existentes; no se inventan.

Informa exactos y similitud Dice de bigramas >=0,82. Diferencias de equipo/músculo se señalan como posible variante; postura/agarre/lateralidad requieren revisión humana. Puede dar falsos positivos/negativos. Las advertencias no bloquean ni fusionan; sólo esquema inválido y colisiones de ID impiden el alta.

## Multimedia propia opcional

Campos existentes `thumbnailPath` y `gifPath`, sin URLs ni slash inicial:

```text
exercise-media/bm/<UUID-del-ejercicio>/miniatura.webp
exercise-media/bm/<UUID-del-ejercicio>/demostracion.gif
```

Archivos bajo `public/exercise-media/bm/<UUID>/`. Miniaturas jpg/jpeg/png/webp/gif; gifPath exige GIF. No admite traversal ni rutas de otro ejercicio. No se agregó multimedia en esta tarea.

El endpoint existente sirve ambos orígenes y respeta flags: producción deshabilitada por defecto; habilitar explícitamente EXERCISE_MEDIA_ENABLED=true con proveedor local. Falta de archivo devuelve 404, sin ocultar ejercicio/instrucciones. Los archivos en public son públicos incluso con endpoint deshabilitado: sólo material demostrativo propio con derechos, nunca fotos privadas. Proveedor remoto sigue sin implementar.

## Auditoría y pruebas

`npm run exercise-library:audit` informa BASE / BM CUSTOM / TOTAL, pares dentro/entre fuentes y coincidencias entre fuentes del helper. Sólo escribe informes en docs, sin catálogo, DB ni /external/.

`tests/exercise-library-custom.test.ts` usa fuentes/altas temporales: ensamblado, IDs, esquema, búsqueda/filtros, aliases, media, similares, CLI, lock, rebuild y referencias de Rutinas. La fuente real permanece vacía. Los tests existentes siguen comprobando la base de 1.324 ejercicios.

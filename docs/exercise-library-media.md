# Medios de la Biblioteca de ejercicios BM

## Origen y alcance

La biblioteca se genera desde `external/exercises-dataset-main`. El dataset contiene 1.324 registros, miniaturas en `images/` y demostraciones GIF en `videos/`. Los datos no multimedia y el código del dataset se distribuyen bajo MIT.

Los JPG, PNG y GIF son una excepción: el `NOTICE.md` del dataset los identifica como © Gym visual. La copia local usa la resolución 180×180 indicada por el dataset, exige conservar la atribución y no demuestra que BM Training posea una licencia comercial. Clonar el repositorio no concede por sí solo permiso para publicar o redistribuir esos medios.

## Funcionamiento

- La biblioteca textual siempre está disponible.
- `EXERCISE_MEDIA_ENABLED=true` habilita la lectura de medios locales; `false` la deshabilita.
- Si la variable no está definida, los medios se habilitan sólo en desarrollo y permanecen deshabilitados en producción.
- Las rutas se resuelven desde la raíz del proyecto; no hay rutas absolutas de Windows ni copias en `public/`.
- El listado solicita únicamente miniaturas con carga diferida. El GIF se solicita sólo al abrir el detalle.
- El detalle conserva visible el valor real de `attribution` cuando muestra un medio.

## Antes de producción

1. Confirmar por escrito los derechos de uso y redistribución con Gym visual.
2. Definir el hosting autorizado, controles de acceso, caché y atribución exigida por la licencia obtenida.
3. Mantener los archivos en 180×180 salvo autorización expresa para otra resolución.
4. Habilitar `EXERCISE_MEDIA_ENABLED=true` únicamente después de esa revisión.
5. Si no existe licencia suficiente, mantener el flag deshabilitado: búsqueda, filtros, selección e instrucciones siguen funcionando.

No se copiaron en esta implementación las 1.324 miniaturas ni los 1.324 GIF a la aplicación pública.

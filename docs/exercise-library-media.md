# Medios de la Biblioteca de ejercicios BM

## Origen y alcance

La biblioteca se genera desde `external/exercises-dataset-main`. El dataset contiene 1.324 registros, miniaturas en `images/` y demostraciones GIF en `videos/`. Los datos no multimedia y el código del dataset se distribuyen bajo MIT.

Los JPG, PNG y GIF son una excepción: el `NOTICE.md` del dataset los identifica como © Gym visual. La copia local usa la resolución 180×180 indicada por el dataset, exige conservar la atribución y no demuestra que BM Training posea una licencia comercial. Clonar el repositorio no concede por sí solo permiso para publicar o redistribuir esos medios.

## Funcionamiento

- La biblioteca textual siempre está disponible.
- `EXERCISE_MEDIA_ENABLED=true` autoriza el uso de medios de Biblioteca BM; `false` lo deshabilita. No controla videos manuales del entrenador.
- Si la variable no está definida, los medios se habilitan sólo en desarrollo y permanecen deshabilitados en producción.
- `EXERCISE_MEDIA_PROVIDER` acepta `local` o `remote` y usa `local` por defecto. `remote` está reservado para un proveedor futuro y permanece no disponible hasta que exista una integración autorizada.
- La aplicación diferencia configuración de disponibilidad: el flag puede estar activo, pero la UI sólo recibe `mediaEnabled=true` si el provider local encuentra directorios de imágenes y videos con archivos reales.
- Las rutas se resuelven desde la raíz del proyecto; no hay rutas absolutas de Windows ni copias en `public/`.
- El listado solicita únicamente miniaturas con carga diferida. El GIF se solicita sólo al abrir el detalle.
- El detalle conserva visible el valor real de `attribution` cuando muestra un medio.
- Si el provider o el asset no está disponible, el endpoint responde `404` sin exponer paths internos y la UI omite por completo thumbnail, GIF y acción de video.

## Diagnóstico de producción

Los 1.324 JPG/PNG y los 1.324 GIF existen localmente bajo `external/exercises-dataset-main/images` y `external/exercises-dataset-main/videos`. La carpeta `external/` está ignorada por Git y `next.config.ts` la excluye expresamente del artefacto de producción. Por eso Vercel no recibe esos archivos.

Configurar únicamente `EXERCISE_MEDIA_ENABLED=true` en Vercel no alcanza: el provider `local` buscaría archivos que no existen dentro de la función desplegada y devolvería `404`. La solución de producción requiere primero permiso de publicación y luego un provider remoto autorizado —por ejemplo Vercel Blob, un CDN/servicio de imágenes o media propia de BM Training— que conserve atribución, controles de acceso y condiciones de licencia.

## Antes de producción

1. Confirmar por escrito los derechos de uso y redistribución con Gym visual.
2. Definir el hosting autorizado, controles de acceso, caché y atribución exigida por la licencia obtenida.
3. Mantener los archivos en 180×180 salvo autorización expresa para otra resolución.
4. Implementar y probar el adaptador remoto autorizado; no seleccionar `EXERCISE_MEDIA_PROVIDER=remote` antes de que exista.
5. Habilitar `EXERCISE_MEDIA_ENABLED=true` únicamente después de esa revisión.
6. Si no existe licencia suficiente, mantener el flag deshabilitado: búsqueda, filtros, selección e instrucciones siguen funcionando.

No se copiaron en esta implementación las 1.324 miniaturas ni los 1.324 GIF a la aplicación pública.

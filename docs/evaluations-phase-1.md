# Evaluaciones profesionales — Parte 1

## Arquitectura

La ficha del alumno renderiza `StudentEvaluations` solamente cuando el servicio actual es `PERSONALIZED` o `MIXED`. Un cambio a `CLASSES` oculta el acceso, pero no toca los registros. Las APIs siguen permitiendo consultar evaluaciones históricas del alumno y bloquean la creación para servicios de solo clases.

Se extendió `PhysicalEvaluation`, que ya era la entidad relacional usada por BM Training para mediciones, portal y comentarios de seguimiento. `EvaluationRecord` se mantiene intacto como almacenamiento heredado genérico. El mapa de volumen muscular semanal también se mantiene intacto; el selector de molestias es una interfaz independiente.

## Modelos

- `PhysicalEvaluation`: cabecera, alumno, versión, estado, paso, completitud, bloques JSON y conclusiones manuales. Sus columnas históricas de medidas y fotos no se eliminan.
- `EvaluationMeasurement`: medida comparable, tipo, lado, valor, unidad y nota.
- `EvaluationBodyIssue`: zona, lado, intensidad percibida, presencia de molestia, estado y observaciones.
- `EvaluationTestResult`: resultado de movilidad o test físico, valores simples y laterales, protocolo, variante y observaciones.

Los registros existentes reciben versiones consecutivas por alumno mediante `ROW_NUMBER` y quedan como `COMPLETED`, con 100% de completitud. Esto evita que una migración convierta historia consolidada en borradores editables.

## Estados y versiones

- Sin registros representa conceptualmente `NOT_STARTED` / “Sin evaluación”; no se persiste una fila vacía.
- Una evaluación nueva comienza en `IN_PROGRESS`.
- `COMPLETED` es inmutable.
- `REASSESSMENT_RECOMMENDED` es un estado manual de una evaluación ya completada.
- El par alumno + versión es único. La creación calcula el siguiente número en una transacción serializable.
- `creationKey` es única e idempotente. Una doble solicitud devuelve la misma evaluación y nunca inserta dos versiones.
- Si ya hay un borrador, “Nueva evaluación” continúa ese borrador; no crea otro en paralelo.

## Flujo y autoguardado

El flujo contiene ocho pasos: información general; objetivo y experiencia; hábitos; observaciones y mapa de molestias; movilidad; medidas; tests físicos; resumen final.

Los cambios relevantes se guardan 900 ms después de la última edición. Cada `PUT` usa el mismo `evaluationId`, reemplaza atómicamente las colecciones estructuradas del borrador y persiste `currentStep`. La UI muestra “Guardando…”, “Guardado” o “Error al guardar”; bloquea la finalización durante una escritura y conserva los valores visibles si la API falla. “Guardar y salir” fuerza un guardado antes de cerrar.

Las evaluaciones completadas se abren en modo consulta y todas las rutas de escritura comprueban otra vez el estado en el servidor.

## Completitud

Una función determinista compartida pondera ocho bloques, cada uno vacío, parcial o completo. El resultado se limita a 0–100 y el backend lo recalcula; no confía en un porcentaje enviado por el navegador.

Para completar se exige solamente:

- fecha;
- objetivo principal;
- nivel o experiencia;
- disponibilidad semanal;
- observación final del entrenador;
- una medida o un test realizado.

La API devuelve la lista exacta de faltantes con estado 422. La finalización valida y actualiza estado, porcentaje y `completedAt` en una misma transacción.

## Endpoints

- `GET /api/admin/alumnos/:id/evaluaciones`: historial descendente.
- `POST /api/admin/alumnos/:id/evaluaciones`: crear o recuperar idempotentemente el borrador.
- `GET /api/admin/alumnos/:id/evaluaciones/:evaluationId`: detalle completo.
- `PUT /api/admin/alumnos/:id/evaluaciones/:evaluationId`: autoguardar el borrador.
- `PATCH /api/admin/alumnos/:id/evaluaciones/:evaluationId`: marcar reevaluación recomendada.
- `DELETE /api/admin/alumnos/:id/evaluaciones/:evaluationId`: sólo borradores.
- `POST /api/admin/alumnos/:id/evaluaciones/:evaluationId/complete`: completar transaccionalmente.
- `GET /api/admin/alumnos/:id/evaluaciones/latest`: lectura de la última evaluación consolidada para una Parte 2 futura.

Todas requieren la sesión administrativa actual. Cada consulta combina `studentId` y `evaluationId`. La aplicación actual es de entrenador único y no posee entidad `Trainer`; `trainerName` queda como snapshot. El aislamiento entre múltiples entrenadores deberá agregarse junto con un modelo de tenant/entrenador antes de habilitar cuentas múltiples.

## Migración

La migración se creó en `prisma/migrations/20260808143000_evaluations_phase_1/migration.sql`. No fue aplicada a producción.

Pasos controlados:

1. Crear un respaldo y probar sobre una copia de la base.
2. Revisar que no haya una migración concurrente.
3. Ejecutar `npx prisma migrate deploy` en el entorno elegido.
4. Ejecutar `npx prisma generate` en la aplicación desplegada.
5. Verificar versiones consecutivas y conteos antes/después.

## Pruebas automáticas

`tests/evaluation-workflow.test.ts` cubre completitud, faltantes, medidas, lados, molestias, tests, habilitación, idempotencia, protección de completadas y seguridad aditiva de la migración. La suite completa debe ejecutarse con `npm test`, seguida por `npm run lint`, `npm run build` y `git diff --check`.

## Prueba manual

1. Abrir un alumno Personalizado y verificar Evaluaciones.
2. Crear una evaluación, completar el primer paso y esperar “Guardado”.
3. Recargar, continuar y confirmar el último paso.
4. Salir y volver a abrir el borrador.
5. Agregar y quitar varias zonas corporales.
6. Registrar medidas decimales y valores laterales.
7. Registrar tests realizados y no realizados.
8. Intentar completar con faltantes y comprobar la lista.
9. Completar los esenciales, confirmar y abrir en modo consulta.
10. Crear una segunda evaluación y verificar versión 2 sin cambios en versión 1.
11. Cambiar el alumno a Clases y verificar que el acceso se oculta.
12. Volver a Personalizado y comprobar que el historial reaparece.
13. Repetir en pantalla móvil y escritorio, con teclado y navegación por foco.

### Checklist de cierre visual y Edad

1. Abrir un alumno Personalizado y comprobar que Evaluaciones ocupa un bloque compacto.
2. Abrir “Ver evaluaciones” y revisar encabezado, estadísticas y resumen rápido.
3. Crear una evaluación y verificar Edad en el Paso 1.
4. Con fecha de nacimiento, confirmar edad calculada; sin fecha, cargarla manualmente.
5. Confirmar que “Observaciones generales del entrenador” ya no aparece en el Paso 1.
6. Avanzar al Paso 2, volver al Paso 1 y esperar el estado “Guardado”.
7. Recargar, salir y continuar; confirmar que la edad permanece.
8. Completar la evaluación y revisar historial, versión, estado y reevaluación.
9. Entrar como alumno y verificar estado, progreso y próxima evaluación.
10. Confirmar que el alumno no ve notas, observaciones o limitaciones internas.
11. Repetir en escritorio, tablet y móvil; comprobar X visible, botones accesibles y ausencia de scroll horizontal.

## Pendiente para Parte 2

No se implementaron gráficos, comparaciones visuales, fotos nuevas, automatizaciones clínicas, inteligencia artificial ni integración con el creador de rutinas. El endpoint `latest` deja preparada una lectura futura sin cambiar hoy el comportamiento de rutinas.

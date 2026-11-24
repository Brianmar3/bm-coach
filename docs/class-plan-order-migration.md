# Orden de clases planificadas

La migración `20261124120000_group_class_plan_order` agrega `sortOrder` a `group_class_plans`.
Asigna a cada clase existente su posición según `createdAt` e `id`, por separado para cada
workspace y fecha. Conserva todas las filas, los contenidos, las asociaciones con horarios
y el historial. Las clases nuevas se agregan al final del día.

El despliegue requiere aplicar esta migración **antes** de activar el código nuevo, porque
las consultas y el guardado del calendario usan la columna. No se ejecutó en Production.

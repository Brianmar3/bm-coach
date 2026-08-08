# Evaluaciones profesionales — Parte 3

## Comparaciones

La comparación se calcula sobre la capa unificada (`PhysicalEvaluation` y `EvaluationRecord` legacy deduplicados). No persiste resultados ni modifica históricos. Las medidas usan sus unidades canónicas; un test sólo es comparable si coinciden clave, categoría, lado, unidad, variante y protocolo. Para Step Test también deben coincidir altura y duración cuando esos datos existen.

La ausencia nunca se convierte en cero. No se calcula porcentaje con una base cero, un dato ausente o un resultado incompatible. Los cambios de medidas se describen de forma neutral como aumentó, disminuyó o sin cambios.

## Índice de progreso BM

Es un indicador interno del progreso del plan, no una evaluación médica ni del estado físico general. Requiere dos evaluaciones y al menos dos componentes comparables. Se calcula dinámicamente y no se guarda.

Pesos máximos:

- Medidas vinculadas al objetivo: 30%.
- Rendimiento: 30%.
- Movilidad/control: 25%.
- Prioridades: 15%.

Sólo se usan los componentes disponibles y sus pesos se renormalizan: `Σ (puntaje del componente × peso) / suma de pesos disponibles`. Cada señal se limita a 0–100 y el resultado final también. La interfaz muestra puntaje, pesos, fórmula y datos utilizados.

Las medidas dependen del objetivo. Para pérdida de grasa se consideran cintura y grasa corporal comparables. Para ganancia muscular se considera masa muscular cuando existe. El peso aislado no se califica como mejor o peor. Rendimiento y movilidad usan únicamente tests compatibles; los estados se comparan mediante transiciones explícitas y no se presentan como números clínicos. Prioridades compara identificadores deterministas resueltos, persistentes y nuevos.

## Evolución por áreas y simetría

Las áreas muestran `Sin datos suficientes`, `Estable`, `Evolución` o `Requiere seguimiento`, según cambios compatibles de tests y medidas. Simetría informa derecha, izquierda, diferencia absoluta, porcentaje y lado con menor resultado. No diagnostica desbalances musculares.

Las molestias se clasifican como nueva zona informada, continúa informada o ya no informada. La última categoría no significa lesión curada.

## Dashboard, rendimiento y compatibilidad

El entrenador consume un endpoint agregado autenticado con alumnos elegibles, evaluaciones normalizadas/deduplicadas y estadísticas. Se ejecutan tres consultas agrupadas (alumnos, evaluaciones físicas con sus hijos y registros legacy), sin cargar binarios de fotos. Los gráficos son SVG y no agregan dependencias.

El portal usa la proyección pública existente. Elimina notas de planificación, limitaciones, comentarios finales, observaciones y compensaciones del entrenador antes de responder. La comparación pública sólo usa datos del alumno.

No se creó esquema ni migración. No se modificaron los flujos de creación o asignación de Rutinas.

## Limitaciones

- Un cambio numérico en un test compatible se presenta como evolución del resultado; no implica mejora clínica.
- Objetivos no reconocidos no aportan un componente de medidas al índice.
- Datos legacy incompletos pueden visualizarse, pero sólo participan en cálculos cuando cumplen las mismas reglas de comparabilidad.
- Las estadísticas derivan del estado actual; no implementan telemetría ni eventos analíticos.

## Checklist manual

1. Alumno con una evaluación: no aparecen comparaciones ni índice falsos.
2. Alumno con dos evaluaciones: base y reciente correctas.
3. Revisar gráfico de peso y tooltips.
4. Revisar todos los perímetros disponibles.
5. Confirmar comparación de test compatible.
6. Confirmar exclusión y explicación de test incompatible.
7. Revisar simetría derecha/izquierda.
8. Revisar estados de evolución de molestias.
9. Abrir “¿Cómo se calcula?” del índice.
10. Contrastar cantidades del dashboard global con datos reales.
11. Revisar evolución y comparación en el portal.
12. Verificar ausencia de notas privadas en la respuesta del portal.
13. Probar viewport móvil sin desplazamiento horizontal.
14. Probar dashboard y comparación en escritorio.

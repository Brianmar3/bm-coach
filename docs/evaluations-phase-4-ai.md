# Evaluaciones — Parte 4: asistencia de planificación con IA

## Arquitectura y autoridad

El flujo es: datos normalizados → interpretación determinista → contexto mínimo → proveedor compatible → validación local → propuesta temporal → revisión del entrenador → estado local del editor → guardado normal de Rutinas.

La IA nunca llama las APIs de creación o activación de Rutinas. La propuesta no contiene estado de rutina ni identificadores persistidos. Sólo la acción manual “Aplicar” copia los días seleccionados al formulario; luego el entrenador puede editar y usar Guardar borrador o Activar rutina como antes.

## Proveedor y límites

Se reutiliza el proveedor compatible ya configurado mediante `NUTRITION_AI_BASE_URL`, `NUTRITION_AI_API_KEY` y `NUTRITION_AI_MODEL`. Las claves permanecen en servidor. No se agregó otro proveedor.

Las llamadas ocurren únicamente al pulsar Generar o Regenerar. El cliente bloquea solicitudes simultáneas y cada solicitud tiene clave idempotente. El servidor usa las tablas de uso existentes con la función `routine_proposal`, límite diario configurable mediante `ROUTINE_AI_DAILY_LIMIT` y registro de éxito/error sin guardar el prompt completo ni el contexto sensible.

## Contexto autorizado y privacidad

Se envían: objetivo, objetivos secundarios, nivel, disponibilidad, actividades, últimas medidas relevantes, evolución, tests, movilidad, asimetrías, zonas informadas, prioridades, alertas, recomendaciones y vigencia. También se envían restricciones de días, duración, entorno, equipamiento e indicaciones temporales del entrenador.

No se envían nombre completo, teléfono, email, pagos, datos administrativos, hábitos completos, notas privadas, comentarios finales ni observaciones internas. Las indicaciones para una generación no se persisten como parte de la evaluación.

## JSON y validación

La respuesta debe contener resumen, frecuencia, estructura semanal, días, bloques, ejercicios, justificaciones, advertencias y notas. Los bloques permitidos son `STRENGTH`, `INTERVAL`, `EMOM`, `AMRAP` y `FOR_TIME`.

La salida se valida y sanitiza antes de llegar al editor:

- frecuencia de 1 a la disponibilidad declarada;
- cantidad de días igual a la frecuencia;
- hasta 5 bloques por día y 8 ejercicios por bloque;
- 1–6 series por ejercicio;
- descansos de hasta 300 segundos por ejercicio;
- unidades, objetivos y tipos de bloque/ejercicio conocidos;
- duración compatible con la indicada;
- máximo orientativo de 80 series semanales y 40 ejercicios;
- nombres contra ejercicios actuales de Rutinas, Registro rápido y un conjunto canónico mínimo.

Un nombre no resuelto no se inserta silenciosamente: queda marcado y exige confirmación. Los excesos de volumen también exigen revisión. Si el JSON es inválido, se solicita una corrección una vez; el segundo fallo devuelve un error seguro.

## Reglas deterministas y trazabilidad

La interpretación se obtiene de `evaluation-interpretation.ts`; la IA no reinterpreta los datos crudos desde cero. Cada explicación separa dato observado, interpretación, posible impacto y sugerencia. La propuesta y cada ejercicio pueden incluir `evidenceIds`.

La cobertura de prioridades se vuelve a calcular localmente. No basta una palabra similar: existen reglas por identificador/categoría para tobillo, zona media, movilidad, equilibrio, asimetría y fuerza. La interfaz diferencia prioridades verificablemente cubiertas y pendientes.

## Ejercicios y alternativas

El catálogo disponible se arma con ejercicios activos de Rutinas, nombres recientes de Registro rápido y nombres canónicos frecuentes. Cambiar ejercicio ofrece entre dos y cuatro alternativas conocidas y sólo modifica ese ejercicio en la propuesta.

## Fallback

Si falta configuración, se alcanza el límite, falla el proveedor o la respuesta no valida, Rutinas continúa funcionando y muestra: “No se pudo generar la propuesta. Podés continuar creando la rutina manualmente.” La evaluación y las sugerencias deterministas permanecen disponibles.

## Checklist manual

1. Elegir alumno Personalizado con evaluación.
2. Abrir el creador y revisar el resumen determinista.
3. Generar una propuesta.
4. Abrir las explicaciones de estructura, prioridad y ejercicio.
5. Confirmar frecuencia y disponibilidad.
6. Revisar prioridades cubiertas y pendientes.
7. Revisar alertas y lenguaje sobre molestias.
8. Cambiar un ejercicio.
9. Regenerar con una indicación adicional.
10. Seleccionar sólo algunos días y aplicar parcialmente.
11. Editar días, bloques y ejercicios aplicados.
12. Guardar manualmente como borrador.
13. Confirmar que nunca se activó automáticamente.
14. Probar alumno sin evaluación y su advertencia.
15. Simular proveedor deshabilitado o error y confirmar fallback.
16. Probar doble toque y límite diario.
17. Probar móvil sin desplazamiento horizontal.
18. Probar escritorio.

# Misión semanal BM

## Período y alcance

La misión usa la semana calendario de Argentina: lunes 00:00 a domingo 23:59. En esta primera versión existe únicamente la misión de asistencia para alumnos con servicio de Clases o Mixto y horarios semanales asignados. Personalizado queda preparado para una futura misión de entrenamiento, sin inventar objetivos.

## Target

El target se crea una vez por alumno y semana contando las clases de sus horarios asignados que caen dentro de esa semana. Se respetan la fecha real de alta, los intervalos de asignación y los eventos de suspensión, baja o reactivación. Una clase cancelada no integra el target.

La misión guarda las claves `horario + fecha` previstas. Esto congela el objetivo ante cambios posteriores de plan o asignaciones, pero permite retirar una clase que luego sea cancelada explícitamente.

## Progreso y estados

El progreso cuenta exclusivamente asistencias reales `PRESENT` registradas por el entrenador. `ABSENT`, `JUSTIFIED`, `UNKNOWN` y las confirmaciones `GOING/NOT_GOING` no suman.

- `ACTIVE`: semana vigente con progreso menor al target.
- `COMPLETED`: progreso igual o superior al target; conserva fecha de finalización.
- `EXPIRED`: terminó la semana sin completar, o todas las clases previstas fueron canceladas.

Las filas semanales no se eliminan. Guardan semana, target final, progreso, estado, recompensa y fechas de finalización y acreditación, suficientes para una futura pantalla “Mis misiones”.

## Recompensa, idempotencia y ranking

La recompensa central es `WEEKLY_MISSION_REWARD = 15`. Al completar, el sistema actual de puntos crea un movimiento con origen `WEEKLY_MISSION` y clave estable `weekly-mission:<missionId>`.

La restricción única existente de transacciones (`studentId + eventKey`) garantiza una sola recompensa aunque se recargue el portal o se procese nuevamente una asistencia. El movimiento entra en el total existente y, por lo tanto, impacta en el ranking sin modificar su algoritmo.

## Casos límite

- Sin clases programadas: no se crea una misión imposible ni se muestra `0/0`.
- Alumno inactivo o suspendido: no se crea una misión nueva; el historial permanece.
- Alta a mitad de semana: sólo cuentan clases desde su fecha de inicio.
- Cambio de plan o asignación: no cambia retroactivamente el snapshot de la semana.
- Cancelación posterior: se descuenta únicamente la clase cancelada guardada en el snapshot.
- Correcciones de asistencia: una misión ya completada y sus puntos no se revocan.

## Preparación para engagement futuro

El historial semanal permite calcular rachas consecutivas contando semanas `COMPLETED`, sin cambiar el modelo. El read model compartido expone `remaining`, `percentage`, `state` y el texto de progreso para que “Tu día en BM” pueda reutilizar mensajes como “Te falta 1 clase para completar tu misión semanal”.

El recálculo se ejecuta dentro del mismo flujo que hoy reconcilia puntos después de una asistencia. Así, un futuro resumen post-clase podrá leer inmediatamente el avance actualizado sin crear otro sistema de recompensas.

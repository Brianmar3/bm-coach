import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cleanRoutineDisplayName, completedExerciseCount, initialOpenExerciseId, usefulDayName } from "../lib/workout-presentation.ts";

const source = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const overlay = readFileSync(new URL("../componentes/routine-overlay.tsx", import.meta.url), "utf8");
const finalModal = source.slice(source.indexOf("<RoutineOverlay open={finalOpen}"), source.indexOf("function WorkoutHistoryView"));

test("la rutina del alumno no renderiza emojis decorativos", () => {
  assert.doesNotMatch(source, /[🔥💪🏽🏋🏽🍑🦵🏽⚡🤸🏽]/u);
  assert.doesNotMatch(source, /getMuscleGroupEmoji/);
  assert.match(source, /BmBarbellIcon/);
});

test("dolor o molestias es un bloque visual propio sin cambiar su comportamiento", () => {
  assert.match(source, /rounded-xl border border-red-400\/20 bg-red-400\/\[\.05\] p-3\.5 text-red-100/);
  assert.match(source, /Marcá esta opción si sentiste dolor durante la sesión\./);
  assert.match(source, /checked=\{draft\.hasPain\}/);
  assert.match(source, /onChange=\{\(event\) => setDraft\(\{ \.\.\.draft, hasPain: event\.target\.checked \}\)\}/);
  assert.match(overlay, /role="dialog"/);
  assert.match(source, /onClick=\{\(\) => save\(true\)\}/);
});

test("el modal sigue adaptado a movil y conserva el payload de finalizacion", () => {
  assert.match(overlay, /max-h-\[min\(90dvh/);
  assert.match(finalModal, /min-h-0 overflow-y-auto/);
  assert.match(source, /flex min-w-0 items-start/);
  assert.match(source, /const payload = \{ \.\.\.draft, durationMinutes: duration, generalFeeling:.*finalComment, painDetails, status:/);
});

test("el encabezado limpia copias y evita repetir el nombre del día", () => {
  assert.equal(cleanRoutineDisplayName(" Rutina Juani nueva (copia) "), "Rutina Juani nueva");
  assert.equal(cleanRoutineDisplayName("Rutina base - copia"), "Rutina base");
  assert.equal(usefulDayName(1, "Día 1"), "");
  assert.equal(usefulDayName(1, "Glúteos"), "Glúteos");
  assert.match(source, /routineDisplayName/);
  assert.doesNotMatch(source, /<h1[^>]*>Día \{selectedDay\.dayNumber\}/);
});

test("el selector horizontal funciona con cualquier cantidad de días", () => {
  assert.match(source, /trainingDays\.map/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /aria-pressed/);
});

test("el resumen usa bloques reales, duración, estado y progreso", () => {
  assert.equal(completedExerciseCount([{ exerciseId: "a", sets: [{ completed: true }] }, { exerciseId: "b", sets: [{ completed: false }] }]), 1);
  for (const value of ["bloques completados", "Día sugerido", "Sin comenzar", "En curso", "Completado"]) assert.match(source, new RegExp(value));
  assert.match(source, /portal-routine-progress-ring/);
  assert.match(source, /\{completedBlocks\}\/\{totalBlocks\}/);
  assert.match(source, /\{selectedDay\.estimatedMinutes\} min/);
  assert.match(source, /width: `\$\{dayProgress\}%`/);
});

test("el hero usa iconografía lineal neutral", () => {
  assert.doesNotMatch(source, /muscleGroupEmoji/);
  assert.match(source, /BmBarbellIcon/);
});

test("la entrada en calor aparece solo cuando existe y abre un modal accesible", () => {
  assert.match(source, /selectedDay\.warmup\.trim\(\) && <button/);
  assert.match(source, />Entrada en calor<\/strong>/);
  assert.match(source, /Prepará tu cuerpo para entrenar/);
  assert.match(source, /setWarmupOpen\(true\)/);
  assert.match(overlay, /role="dialog"/);
  assert.match(overlay, /aria-modal="true"/);
  assert.match(source, /Entrada en calor/);
  assert.match(source, /\{selectedDay\.warmup\}/);
  assert.match(source, /whitespace-pre-wrap/);
});

test("el modal se cierra de forma segura y queda sobre la navegación móvil", () => {
  assert.match(overlay, /event\.key === "Escape"/);
  assert.match(overlay, /document\.body\.style\.overflow = "hidden"/);
  assert.match(overlay, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(overlay, /createPortal/);
  assert.match(overlay, /document\.body/);
  assert.match(source, /aria-label="Cerrar entrada en calor"/);
  assert.match(source, /<BmCloseIcon size=\{22\} \/>/);
  assert.match(overlay, /event\.target === event\.currentTarget/);
  assert.match(overlay, /z-\[210\]/);
  assert.match(overlay, /items-center justify-center/);
  assert.match(overlay, /safe-area-inset-top/);
  assert.match(overlay, /safe-area-inset-bottom/);
  assert.match(overlay, /max-h-\[min\(90dvh/);
});

test("el selector de un solo día ocupa únicamente el ancho necesario", () => {
  assert.match(source, /aria-label="Días de la rutina"[^>]*w-fit max-w-full/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /shrink-0 rounded-full/);
});

test("finalizar entrenamiento reutiliza el overlay seguro y conserva sus acciones", () => {
  assert.match(finalModal, /<RoutineOverlay open=\{finalOpen\}/);
  assert.match(finalModal, /maxWidth="max-w-xl"/);
  assert.match(finalModal, /aria-label="Cerrar finalización"/);
  assert.match(finalModal, /Continuar entrenando/);
  assert.match(finalModal, /Guardar para continuar después/);
  assert.match(finalModal, /Confirmar y finalizar/);
  assert.match(finalModal, /min-h-0 overflow-y-auto/);
});

test("abre el primer ejercicio incompleto y mantiene un único acordeón controlado", () => {
  const exercises = [
    { exerciseId: "done", sets: [{ completed: true }] },
    { exerciseId: "current", sets: [{ completed: true }, { completed: false }] },
  ];
  assert.equal(initialOpenExerciseId(exercises), "current");
  assert.match(source, /openExerciseId === exercise\.exerciseId/);
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /setOpenExerciseId\(open \? null : exercise\.exerciseId\)/);
});

test("contraer no elimina el borrador ni cambia el guardado existente", () => {
  assert.match(source, /updateSet\(exerciseIndex, setIndex/);
  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /apiRequest<.*>\("\/api\/portal\/entrenamientos"/);
});

test("la tabla compacta conserva Kg, Reps, esfuerzo, valores y checkbox accesible", () => {
  assert.match(source, /grid-cols-\[2\.25rem_minmax\(0,1fr\)_minmax\(0,1fr\)_minmax\(0,1fr\)_2\.5rem\]/);
  assert.match(source, /value=\{set\.weight \?\? ""\}/);
  assert.match(source, /value=\{set\.repetitions \?\? ""\}/);
  assert.match(source, /value=\{set\.effort \?\? ""\}/);
  assert.match(source, /Serie \$\{set\.setNumber\} completada/);
});

test("las instrucciones estructurales quedan visibles y las observaciones usan Indicaciones", () => {
  assert.match(source, /separateWorkoutInstructions\(programmed\?\.observations\)/);
  assert.match(source, /data-structural-instructions/);
  assert.match(source, /instructions\.structural\.map/);
  assert.match(source, /instructions\.technicalText && <details/);
  assert.match(source, />Indicaciones<\/summary>/);
  assert.doesNotMatch(source, />Ver técnica<\/summary>/);
  assert.match(source, /RoutineExerciseMediaButton exercise=\{programmed\} libraryMediaEnabled=\{data\.exerciseMediaEnabled\} separated/);
  assert.match(source, /instructions\.technicalText/);
  assert.match(source, /RoutineExerciseMediaButton/);
  assert.doesNotMatch(source, /Abrir video técnico/);
  assert.doesNotMatch(source, /programmed\.observations && <p/);
  assert.doesNotMatch(source, /autoPlay/);
});

test("el cierre nuevo pide solo sensación, duración y dolor cuando corresponde", () => {
  assert.doesNotMatch(finalModal, /Rating label="Energía antes/);
  assert.doesNotMatch(finalModal, /Rating label="Energía después/);
  assert.doesNotMatch(finalModal, /Rating label="Dificultad percibida/);
  assert.doesNotMatch(finalModal, /draft\.energyAfter === null/);
  assert.doesNotMatch(finalModal, /draft\.difficulty === null/);
  assert.match(finalModal, /Sensación general/);
  assert.match(finalModal, /Duración calculada \(min\)/);
  assert.match(finalModal, /checked=\{draft\.hasPain\}/);
  assert.match(finalModal, /Comentario final \(opcional\)/);
  assert.match(finalModal, /onClick=\{\(\) => save\(true\)\}/);
});

test("el historial conserva la lectura de energía y dificultad de sesiones anteriores", () => {
  const history = source.slice(source.indexOf("function WorkoutHistoryView"));
  assert.match(history, /session\.energyBefore/);
  assert.match(history, /session\.difficulty/);
  assert.match(history, /session\.energyAfter/);
});

test("el bloque libre nuevo pide sólo completado y el historial conserva datos anteriores", () => {
  const card = source.slice(source.indexOf("function WorkoutBlockCard"), source.indexOf("function workoutBlockResultSummary"));
  const history = source.slice(source.indexOf("function workoutBlockResultSummary"));
  assert.match(card, /Bloque completado/);
  assert.doesNotMatch(card, /block\.blockType === "FREE" && <Field label="Resultado"/);
  assert.match(card, /block\.blockType !== "FREE" && <Field label="Observación"/);
  assert.match(history, /result\.resultText/);
  assert.match(history, /block\.result\.observation/);
});

test("las acciones mantienen handlers y aparecen después de los ejercicios", () => {
  assert.match(source, /onClick=\{\(\) => save\(false\)\}/);
  assert.match(source, /onClick=\{openFinalSummary\}/);
  assert.match(source, /disabled=\{saving \|\| !started\}/);
  assert.doesNotMatch(source, /fixed inset-x-3 bottom-/);
  assert.match(source, /mt-5 grid grid-cols-2/);
  assert.match(source, /max-\[340px\]:grid-cols-1/);
});

test("el historial vacío muestra un único mensaje", () => {
  assert.doesNotMatch(source, /Sin sesiones registradas/);
  assert.equal(source.match(/Todavía no hay entrenamientos registrados\./g)?.length, 1);
});

test("la pantalla de Rutina termina en Ver mi progreso y el historial vive en su ruta dedicada", () => {
  const routineStart = source.indexOf('if (section === "rutina")');
  const routineRender = source.slice(routineStart, source.indexOf(";", routineStart) + 1);
  assert.match(routineRender, /return <WorkoutView data=\{data\} \/>/);
  assert.doesNotMatch(routineRender, /WorkoutHistoryView|historial-entrenamientos/);
  assert.match(source, /if \(section === "historial"\) return <WorkoutHistoryView data=\{data\} \/>/);
  assert.match(source, /Ver mi progreso/);
  assert.match(source, /PortalActionCard href="\/portal\/progreso"/);
});

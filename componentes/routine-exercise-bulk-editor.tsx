"use client";
import { useState } from "react";
import type { EditableTrainingBlockDraft as Block } from "@/lib/training-library-block-draft";

export function RoutineExerciseBulkEditor({ block, update }: { block: Block; update: (updater: (block: Block) => Block) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [rest, setRest] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [message, setMessage] = useState("");
  if (block.type !== "STRENGTH" || block.exercises.length < 2) return null;
  const count = block.exercises.filter(exercise => selected.includes(exercise.clientId)).length;
  const valid = count > 0 && (rest !== "" || sets !== "" || reps.trim() !== "") && (rest === "" || Number(rest) >= 0) && (sets === "" || Number(sets) >= 1);
  return <details className="routine-bulk-editor"><summary>Editar varios ejercicios</summary><div className="routine-bulk-options"><label><input type="checkbox" checked={count === block.exercises.length} onChange={event => setSelected(event.target.checked ? block.exercises.map(exercise => exercise.clientId) : [])}/> Seleccionar todos</label>{block.exercises.map(exercise => <label key={exercise.clientId}><input type="checkbox" checked={selected.includes(exercise.clientId)} onChange={event => setSelected(current => event.target.checked ? [...current, exercise.clientId] : current.filter(id => id !== exercise.clientId))}/>{exercise.order}. {exercise.name || "Sin nombre"}</label>)}</div><div className="routine-bulk-fields"><label>Series<input type="number" min={1} max={100} value={sets} onChange={event => setSets(event.target.value)} placeholder="Sin cambiar"/></label><label>Reps<input value={reps} onChange={event => setReps(event.target.value)} placeholder="Sin cambiar"/></label><label>Descanso (s)<input type="number" min={0} value={rest} onChange={event => setRest(event.target.value)} placeholder="Sin cambiar"/></label><button type="button" disabled={!valid} onClick={() => { update(current => ({ ...current, exercises: current.exercises.map(exercise => !selected.includes(exercise.clientId) ? exercise : { ...exercise, ...(rest !== "" ? { restSeconds: Number(rest) } : {}), ...(sets !== "" ? { sets: Number(sets) } : {}), ...(reps.trim() !== "" ? { repetitions: reps.trim() } : {}) }) })); setMessage(`Prescripción aplicada a ${count} ejercicios. Podés deshacer el cambio.`); }}>Aplicar a {count}</button></div>{message && <p role="status">{message}</p>}</details>;
}

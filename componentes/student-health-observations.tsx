import type { Student } from "@/types/gestion";

export function StudentHealthObservations({ student }: { student: Pick<Student, "notes" | "hasLimitations" | "limitations"> }) {
  return <div className="mt-5 min-w-0 rounded-xl bg-zinc-950 p-4 text-sm text-zinc-300">
    {student.hasLimitations === true && <div className="mb-4">
      <h3 className="font-semibold text-zinc-100">Molestias o limitaciones informadas</h3>
      <p className="mt-1">El alumno indicó que tiene una molestia o limitación: Sí.</p>
      <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{student.limitations?.trim() || "Sin descripción informada."}</p>
    </div>}
    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{student.notes || "Sin observaciones."}</p>
  </div>;
}

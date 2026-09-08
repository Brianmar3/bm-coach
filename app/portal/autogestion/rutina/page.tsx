import { requireSelfServiceAccount } from "@/lib/self-service-account";
import { SelfServiceShell } from "@/componentes/self-service-shell";
import { SelfServiceRoutineWizard } from "@/componentes/self-service-routine-wizard";
import { selfServicePreferences } from "@/lib/self-service";
import { hasActivePortalRoutine } from "@/lib/portal-service-access";
import { PortalSection } from "@/componentes/portal-section";
export default async function SelfServiceRoutinePage() {
  const { student, studentId } = await requireSelfServiceAccount();
  if (await hasActivePortalRoutine(studentId)) return <SelfServiceShell student={student}><PortalSection section="rutina" dataEndpoint="/api/portal/autogestion/rutina" selfService /></SelfServiceShell>;
  const preferences = selfServicePreferences(student);
  const level = student.experienceLevel === "Intermedio" || student.experienceLevel === "Avanzado" ? student.experienceLevel : "Principiante";
  return <SelfServiceShell student={student}><SelfServiceRoutineWizard initial={{ objective: student.goal || "Mejorar salud", level, daysPerWeek: Math.max(1, Math.min(preferences.availableDays.length || 3, 5)), sessionMinutes: preferences.sessionMinutes || 45, trainingLocation: preferences.trainingLocation || "Gimnasio", equipment: preferences.equipment.length ? preferences.equipment : ["Peso corporal"], priorityMuscle: "", variation: 0 }} /></SelfServiceShell>;
}

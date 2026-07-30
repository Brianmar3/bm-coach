import "server-only";

import type { PortalAchievement } from "@/lib/portal-achievements";
import { loadUnifiedExerciseRecords } from "@/lib/unified-exercise-records";

function display(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

export async function loadUnifiedRecordAchievements(
  studentId: string,
  activityStart?: Date,
): Promise<PortalAchievement[]> {
  const records = await loadUnifiedExerciseRecords(studentId);
  const startKey = activityStart?.toISOString().slice(0, 10) ?? "";
  return records.flatMap((record) => {
    if (startKey && record.date < startKey) return [];
    const work = `${record.sets} × ${record.repetitions} · ${display(record.load)} ${record.unit || "kg"}`;
    return record.marks.map((mark): PortalAchievement => {
      const first = mark === "FIRST_MARK";
      const maximum = mark === "MAX_LOAD";
      const name = first
        ? "Primera marca registrada"
        : maximum
          ? "Nueva carga máxima"
          : "Nuevo récord de repeticiones";
      const description = first
        ? work
        : maximum
          ? `Superaste tu carga máxima anterior. ${work}.`
          : `Superaste tus repeticiones con la misma carga. ${work}.`;
      return {
        id: first
          ? `unified:first:${record.exerciseKey}`
          : `unified:${maximum ? "max" : "repetitions"}:${record.source.toLowerCase()}:${record.sourceId}`,
        icon: first ? "◆" : "▲",
        name,
        description,
        unlocked: true,
        unlockedAt: record.date,
        progress: 1,
        target: 1,
        category: first ? "PROGRESO" : maximum ? "FUERZA" : "REPETICIONES",
        level: maximum ? "DESTACADO" : "COMUN",
        exercise: record.exerciseName,
        previousValue: record.previous
          ? `${display(record.previous.load)} ${record.previous.unit || "kg"}`
          : undefined,
        newValue: `${display(record.load)} ${record.unit || "kg"}`,
        sessionId: record.sessionId,
        quickLogId: record.source === "QUICK_LOG" ? record.sourceId : undefined,
        source: record.source,
      };
    });
  });
}

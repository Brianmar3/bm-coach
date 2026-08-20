export type DuplicateRoutineStatus = "ACTIVA" | "BORRADOR" | "FINALIZADA" | "ARCHIVADA";

export type DuplicateRoutineExerciseShape = {
  order: number;
  name: string;
  sets: number;
  repetitions: string;
  targetType: string;
  targetSeconds: number | null;
  targetRepetitions: string | null;
  targetDistance: string | null;
  targetSide: string | null;
};

export type DuplicateRoutineBlockShape = {
  order: number;
  type: string;
  rounds: number | null;
  durationSeconds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  restBetweenRoundsSeconds: number | null;
  targetRounds: number | null;
  exercises: DuplicateRoutineExerciseShape[];
};

export type DuplicateRoutineDayShape = {
  dayNumber: number;
  estimatedMinutes: number | null;
  blocks: DuplicateRoutineBlockShape[];
};

export type DuplicateRoutineAuditSource = {
  id: string;
  name: string;
  objective: string;
  status: DuplicateRoutineStatus;
  createdAt: Date;
  updatedAt: Date;
  students: Array<{ id: string; name: string; active: boolean }>;
  days: DuplicateRoutineDayShape[];
  sessionCount: number;
  lastSessionAt: Date | null;
  assignmentCount: number;
  versionCount: number;
  exerciseLogCount: number;
  blockLogCount: number;
  followUpCount: number;
};

export type DuplicateRoutineCandidate = {
  id: string;
  name: string;
  normalizedName: string;
  objective: string;
  status: DuplicateRoutineStatus;
  createdAt: string;
  updatedAt: string;
  students: Array<{ id: string; name: string; active: boolean }>;
  dayCount: number;
  blockCount: number;
  exerciseCount: number;
  sessionCount: number;
  lastSessionAt: string;
  assignmentCount: number;
  versionCount: number;
  exerciseLogCount: number;
  blockLogCount: number;
  followUpCount: number;
  hasHistory: boolean;
  safeToDelete: boolean;
  riskReasons: string[];
};

export type DuplicateRoutineGroup = {
  id: string;
  normalizedName: string;
  objective: string;
  routines: DuplicateRoutineCandidate[];
};

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function normalizeDuplicateRoutineName(value: string) {
  let result = value.trim();
  let previous = "";
  while (result !== previous) {
    previous = result;
    result = result.replace(/^\s*copia\s+de\s+/i, "").replace(/\s*\(\s*copia(?:\s+\d+)?\s*\)\s*$/i, "").trim();
  }
  return normalizedText(result);
}

export function routineStructureFingerprint(routine: Pick<DuplicateRoutineAuditSource, "objective" | "days">) {
  return JSON.stringify({
    objective: normalizedText(routine.objective),
    days: [...routine.days].sort((a, b) => a.dayNumber - b.dayNumber).map((day) => ({
      estimatedMinutes: day.estimatedMinutes,
      blocks: [...day.blocks].sort((a, b) => a.order - b.order).map((block) => ({
        type: block.type,
        rounds: block.rounds,
        durationSeconds: block.durationSeconds,
        workSeconds: block.workSeconds,
        restSeconds: block.restSeconds,
        restBetweenRoundsSeconds: block.restBetweenRoundsSeconds,
        targetRounds: block.targetRounds,
        exercises: [...block.exercises].sort((a, b) => a.order - b.order).map((exercise) => ({
          name: normalizedText(exercise.name),
          sets: exercise.sets,
          repetitions: normalizedText(exercise.repetitions),
          targetType: exercise.targetType,
          targetSeconds: exercise.targetSeconds,
          targetRepetitions: normalizedText(exercise.targetRepetitions ?? ""),
          targetDistance: normalizedText(exercise.targetDistance ?? ""),
          targetSide: normalizedText(exercise.targetSide ?? ""),
        })),
      })),
    })),
  });
}

export function routineDeletionRisk(source: DuplicateRoutineAuditSource) {
  const reasons: string[] = [];
  if (source.status === "ACTIVA") reasons.push("La rutina está activa.");
  if (source.assignmentCount > 0) reasons.push(`Tiene ${source.assignmentCount} asignación${source.assignmentCount === 1 ? "" : "es"} de alumno.`);
  if (source.sessionCount > 0) reasons.push(`Tiene ${source.sessionCount} sesión${source.sessionCount === 1 ? "" : "es"} registrada${source.sessionCount === 1 ? "" : "s"}.`);
  if (source.versionCount > 0) reasons.push(`Tiene ${source.versionCount} versión${source.versionCount === 1 ? "" : "es"} histórica${source.versionCount === 1 ? "" : "s"}.`);
  if (source.exerciseLogCount > 0) reasons.push("Tiene progreso de ejercicios asociado.");
  if (source.blockLogCount > 0) reasons.push("Tiene progreso de bloques asociado.");
  if (source.followUpCount > 0) reasons.push("Tiene comentarios de seguimiento asociados.");
  return reasons;
}

export function findPossibleRoutineDuplicates(sources: DuplicateRoutineAuditSource[]): DuplicateRoutineGroup[] {
  const grouped = new Map<string, DuplicateRoutineAuditSource[]>();
  for (const source of sources) {
    const normalizedName = normalizeDuplicateRoutineName(source.name);
    if (!normalizedName) continue;
    const key = `${normalizedName}\u0000${routineStructureFingerprint(source)}`;
    const routines = grouped.get(key) ?? [];
    routines.push(source);
    grouped.set(key, routines);
  }

  return [...grouped.entries()].flatMap(([key, routines]) => {
    if (routines.length < 2) return [];
    const normalizedName = normalizeDuplicateRoutineName(routines[0].name);
    return [{
      id: key,
      normalizedName,
      objective: routines[0].objective,
      routines: routines.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map((source) => {
        const riskReasons = routineDeletionRisk(source);
        const blocks = source.days.flatMap((day) => day.blocks);
        return {
          id: source.id,
          name: source.name,
          normalizedName,
          objective: source.objective,
          status: source.status,
          createdAt: source.createdAt.toISOString(),
          updatedAt: source.updatedAt.toISOString(),
          students: source.students,
          dayCount: source.days.length,
          blockCount: blocks.length,
          exerciseCount: blocks.reduce((total, block) => total + block.exercises.length, 0),
          sessionCount: source.sessionCount,
          lastSessionAt: source.lastSessionAt?.toISOString() ?? "",
          assignmentCount: source.assignmentCount,
          versionCount: source.versionCount,
          exerciseLogCount: source.exerciseLogCount,
          blockLogCount: source.blockLogCount,
          followUpCount: source.followUpCount,
          hasHistory: source.sessionCount + source.versionCount + source.exerciseLogCount + source.blockLogCount + source.followUpCount > 0,
          safeToDelete: riskReasons.length === 0,
          riskReasons,
        };
      }),
    }];
  }).sort((a, b) => b.routines.length - a.routines.length || a.normalizedName.localeCompare(b.normalizedName, "es"));
}


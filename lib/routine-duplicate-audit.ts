import { Prisma } from "@prisma/client";
import { findPossibleRoutineDuplicates, type DuplicateRoutineAuditSource } from "@/lib/routine-duplicates";

export const routineDuplicateAuditSelect = {
  id: true,
  name: true,
  objective: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  assignments: { select: { studentId: true, active: true, student: { select: { data: true } } } },
  workoutSessions: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
  days: {
    orderBy: { dayNumber: "asc" },
    select: {
      dayNumber: true,
      estimatedMinutes: true,
      blocks: {
        orderBy: { order: "asc" },
        select: {
          order: true,
          type: true,
          rounds: true,
          durationSeconds: true,
          workSeconds: true,
          restSeconds: true,
          restBetweenRoundsSeconds: true,
          targetRounds: true,
          _count: { select: { workoutLogs: true } },
          exercises: {
            orderBy: { order: "asc" },
            select: {
              order: true,
              name: true,
              sets: true,
              repetitions: true,
              targetType: true,
              targetSeconds: true,
              targetRepetitions: true,
              targetDistance: true,
              targetSide: true,
              _count: { select: { workoutLogs: true, followUpComments: true } },
            },
          },
        },
      },
    },
  },
  _count: { select: { workoutSessions: true, assignments: true, versions: true } },
} satisfies Prisma.TrainingRoutineSelect;

type AuditRecord = Prisma.TrainingRoutineGetPayload<{ select: typeof routineDuplicateAuditSelect }>;

function studentName(data: Prisma.JsonValue) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "Alumno sin nombre";
  const record = data as Record<string, unknown>;
  return [record.firstName, record.lastName].filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(" ").trim() || "Alumno sin nombre";
}

export function duplicateAuditSource(record: AuditRecord): DuplicateRoutineAuditSource {
  const blocks = record.days.flatMap((day) => day.blocks);
  const exercises = blocks.flatMap((block) => block.exercises);
  return {
    id: record.id,
    name: record.name,
    objective: record.objective,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    students: record.assignments.map((assignment) => ({ id: assignment.studentId, name: studentName(assignment.student.data), active: assignment.active })).sort((a, b) => a.name.localeCompare(b.name, "es")),
    days: record.days,
    sessionCount: record._count.workoutSessions,
    lastSessionAt: record.workoutSessions[0]?.date ?? null,
    assignmentCount: record._count.assignments,
    versionCount: record._count.versions,
    exerciseLogCount: exercises.reduce((total, exercise) => total + exercise._count.workoutLogs, 0),
    blockLogCount: blocks.reduce((total, block) => total + block._count.workoutLogs, 0),
    followUpCount: exercises.reduce((total, exercise) => total + exercise._count.followUpComments, 0),
  };
}

type DuplicateAuditClient = { trainingRoutine: Pick<Prisma.TransactionClient["trainingRoutine"], "findMany"> };

export async function loadRoutineDuplicateGroups(client: DuplicateAuditClient) {
  const records = await client.trainingRoutine.findMany({ where: { kind: "ASSIGNED" }, select: routineDuplicateAuditSelect, orderBy: { createdAt: "asc" } });
  return findPossibleRoutineDuplicates(records.map(duplicateAuditSource));
}

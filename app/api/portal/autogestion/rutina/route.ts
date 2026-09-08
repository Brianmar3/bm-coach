import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSelfServiceAccount } from "@/lib/self-service-account";
import { loadExerciseLibrary, exerciseMediaAvailable } from "@/lib/exercise-library-server";
import { selfServiceRoutineInput, validSelfServiceRoutineAnswers } from "@/lib/self-service-routine-persistence";
import type { SelfServiceRoutineProposal } from "@/lib/self-service-routine-proposal";
import { createRoutineDays, databaseUnavailable, routineData, routineFingerprint, routineInclude, routineVersionSnapshot, serializeRoutine, validateRoutine } from "@/lib/rutinas";
import { activePortalRoutineWhere } from "@/lib/portal-service-access";
import { portalWorkoutSessionInclude, serializePortalWorkoutSessions } from "@/lib/portal-workout-history";
import { argentinaDateKey } from "@/lib/payment-dates";
import { validRequestOrigin } from "@/lib/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { student, studentId } = await requireSelfServiceAccount();
  const [routine, sessions, media] = await Promise.all([
    prisma.trainingRoutine.findFirst({ where: activePortalRoutineWhere(studentId), include: routineInclude, orderBy: { updatedAt: "desc" } }),
    prisma.workoutSession.findMany({ where: { studentId }, include: portalWorkoutSessionInclude, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 30 }),
    exerciseMediaAvailable(),
  ]);
  const privateRoutine = routine ? { ...serializeRoutine(routine), studentIds: [studentId], students: [{ id: studentId, name: `${student.firstName} ${student.lastName}`.trim() }], historicalStudents: [{ id: studentId, name: `${student.firstName} ${student.lastName}`.trim() }] } : null;
  return Response.json({
    exerciseMediaEnabled: media,
    profile: { ...student, id: studentId, scheduleLabels: [], flexibleSchedule: "", profileImageUrl: student.profileImageUrl ?? "", height: Number(student.height) || 0, weight: Number(student.weight) || 0, experienceLevel: student.experienceLevel ?? "", trainingExperience: student.trainingExperience ?? "", hasLimitations: student.hasLimitations === true, limitations: student.limitations ?? "", onboardingUpdatedAt: student.onboardingUpdatedAt ?? "" },
    routine: privateRoutine,
    workoutSessions: serializePortalWorkoutSessions(sessions),
  });
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const { studentId } = await requireSelfServiceAccount();
  const body = await request.json().catch(() => null) as { answers?: unknown; proposal?: SelfServiceRoutineProposal } | null;
  if (!body || !validSelfServiceRoutineAnswers(body.answers) || !body.proposal) return Response.json({ error: "Revisá la propuesta antes de activarla." }, { status: 400 });
  let input;
  try {
    input = selfServiceRoutineInput(studentId, body.answers, body.proposal, await loadExerciseLibrary(), argentinaDateKey());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Revisá la propuesta antes de activarla." }, { status: 400 });
  }
  try {
    const validationError = validateRoutine(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const fingerprint = routineFingerprint(input);
    const result = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`self-service-routine:${studentId}`})::bigint)`);
      const duplicate = await transaction.trainingRoutine.findFirst({
        where: { ...activePortalRoutineWhere(studentId), tags: { has: "SELF_SERVICE_OWNED" }, versions: { some: { fingerprint } } },
        include: routineInclude,
      });
      if (duplicate) return { record: duplicate, reused: true };

      const previous = await transaction.trainingRoutineAssignment.findMany({
        where: { studentId, active: true, routine: { status: "ACTIVA" } },
        select: { routineId: true, routine: { select: { tags: true, assignments: { select: { studentId: true } } } } },
      });
      await transaction.trainingRoutineAssignment.updateMany({ where: { studentId, active: true }, data: { active: false, archivedAt: new Date() } });
      const ownedRoutineIds = previous.filter((assignment) => assignment.routine.tags.includes("SELF_SERVICE_OWNED") && assignment.routine.assignments.every((item) => item.studentId === studentId)).map((assignment) => assignment.routineId);
      if (ownedRoutineIds.length) await transaction.trainingRoutine.updateMany({ where: { id: { in: ownedRoutineIds } }, data: { status: "ARCHIVADA", archivedAt: new Date() } });

      const created = await transaction.trainingRoutine.create({
        data: { ...routineData(input), assignments: { create: { studentId, active: true, archivedAt: null } } },
      });
      await createRoutineDays(transaction, created.id, input.days);
      await transaction.trainingRoutineVersion.create({ data: { routineId: created.id, version: 1, summary: "Versión inicial", fingerprint, snapshot: routineVersionSnapshot(input) as unknown as Prisma.InputJsonValue } });
      return { record: await transaction.trainingRoutine.findUniqueOrThrow({ where: { id: created.id }, include: routineInclude }), reused: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ routine: serializeRoutine(result.record), reused: result.reused }, { status: result.reused ? 200 : 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "La rutina cambió al mismo tiempo. Intentá nuevamente." }, { status: 409 });
    console.error("No se pudo activar la rutina de Mi cuenta", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "El servicio no está disponible temporalmente." : "No pudimos guardar tu rutina. Intentá nuevamente." }, { status: unavailable ? 503 : 500 });
  }
}

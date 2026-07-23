import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
import { routineInclude, serializeRoutine } from "@/lib/rutinas";
import { serializeEvaluation } from "@/lib/evaluaciones";
import { serializeEvent } from "@/lib/eventos";
import type { Payment, PaymentStatus, Student } from "@/types/gestion";
import type { PortalData } from "@/types/portal";
import type { Prisma, StudentPaymentStatus } from "@prisma/client";
import { argentinaDateKey, dateKeyToDatabase } from "@/lib/payment-dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentWithStudent = Prisma.StudentPaymentGetPayload<{ include: { student: true } }>;

function effectiveStatus(status: StudentPaymentStatus, dueDate: Date): PaymentStatus {
  if (status === "PAGADO") return "pagado";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "vencido";
  if (days <= 7) return "proximo_a_vencer";
  return "pendiente";
}

function serializePayment(record: PaymentWithStudent): Payment {
  const student = record.student.data as unknown as Student;
  return { id: record.id, studentId: record.studentId, student: `${student.firstName} ${student.lastName}`.trim(), amount: Number(record.amount), concept: record.concept, dueDate: record.dueDate.toISOString().slice(0, 10), paidDate: record.paidDate?.toISOString().slice(0, 10) ?? "", method: record.method, status: effectiveStatus(record.status, record.dueDate), notes: record.notes, createdAt: record.createdAt.toISOString() };
}

export async function GET() {
  try {
    const session = await getPortalSession();
    if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
    if (session.credential.mustChangePassword) return Response.json({ error: "Debés cambiar tu contraseña temporal.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    const studentId = session.studentId;
    const todayKey = argentinaDateKey();
    const today = dateKeyToDatabase(todayKey);
    const weekStart = new Date(today); weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    const [routine, evaluations, payments, events, workoutSessions, comments, nextClass] = await Promise.all([
      prisma.trainingRoutine.findFirst({ where: { status: "ACTIVA", assignments: { some: { studentId } } }, include: routineInclude, orderBy: { updatedAt: "desc" } }),
      prisma.physicalEvaluation.findMany({ where: { studentId }, include: { student: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
      prisma.studentPayment.findMany({ where: { studentId }, include: { student: true }, orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }] }),
      prisma.coachEvent.findMany({ where: { status: "PENDIENTE", date: { gte: today } }, orderBy: [{ date: "asc" }, { time: "asc" }], take: 8 }),
      prisma.workoutSession.findMany({
        where: { studentId },
        include: { day: true, routine: true, exercises: { include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } } } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 30,
      }),
      prisma.followUpComment.findMany({
        where: { studentId, private: false },
        include: { exercise: true },
        orderBy: { createdAt: "desc" },
      }),
      session.credential.student.primaryScheduleId
        ? prisma.weeklyClassSchedule.findUnique({ where: { id: session.credential.student.primaryScheduleId } })
        : Promise.resolve(null),
    ]);
    const student = session.credential.student.data as unknown as Student;
    const privateRoutine = routine ? { ...serializeRoutine(routine), studentIds: [studentId], students: [{ id: studentId, name: `${student.firstName} ${student.lastName}`.trim() }] } : null;
    const data: PortalData = {
      profile: { id: studentId, firstName: student.firstName, lastName: student.lastName, phone: student.phone, email: student.email, birthDate: student.birthDate, goal: student.goal, plan: student.plan, joinedAt: student.joinedAt, status: student.status, dueDate: student.dueDate },
      routine: privateRoutine,
      evaluations: evaluations.map(serializeEvaluation),
      payments: payments.map(serializePayment),
      events: events.map(serializeEvent),
      workoutSessions: workoutSessions.map((workout) => ({
        id: workout.id,
        routineId: workout.routineId,
        routineName: workout.routine.name,
        dayId: workout.dayId,
        dayNumber: workout.day.dayNumber,
        date: workout.date.toISOString().slice(0, 10),
        startTime: workout.startTime,
        durationMinutes: workout.durationMinutes,
        energyBefore: workout.energyBefore,
        difficulty: workout.difficulty,
        energyAfter: workout.energyAfter,
        finalComment: workout.finalComment,
        hasPain: workout.hasPain,
        painDetails: workout.painDetails,
        status: workout.status === "COMPLETED" ? "finalizado" as const : workout.status === "IN_PROGRESS" ? "en_progreso" as const : "pendiente" as const,
        exercises: workout.exercises.map((log) => {
          const older = workoutSessions
            .filter((candidate) => candidate.id !== workout.id && candidate.date <= workout.date)
            .flatMap((candidate) => candidate.exercises.filter((item) => item.exerciseId === log.exerciseId).map((item) => ({ candidate, item })))
            .sort((left, right) => right.candidate.date.getTime() - left.candidate.date.getTime());
          const history = older.slice(0, 8).map(({ candidate, item }) => {
            const best = [...item.sets].filter((set) => set.completed).sort((left, right) => Number(right.weight ?? 0) - Number(left.weight ?? 0))[0] ?? item.sets[0];
            return { date: candidate.date.toISOString().slice(0, 10), weight: best?.weight === null || best?.weight === undefined ? null : Number(best.weight), repetitions: best?.repetitions ?? null, effort: best?.effort === null || best?.effort === undefined ? null : Number(best.effort) };
          });
          return {
            id: log.id,
            exerciseId: log.exerciseId,
            exerciseName: log.exercise.name,
            observation: log.observation,
            sets: log.sets.map((set) => ({ id: set.id, setNumber: set.setNumber, weight: set.weight === null ? null : Number(set.weight), repetitions: set.repetitions, effort: set.effort === null ? null : Number(set.effort), completed: set.completed, observation: set.observation })),
            previous: history[0] ?? null,
            history,
          };
        }),
      })),
      comments: comments.map((comment) => ({
        id: comment.id,
        author: comment.author === "COACH" ? "entrenador" as const : "alumno" as const,
        context: ({ SESSION: "sesion", EXERCISE: "ejercicio", EVALUATION: "evaluacion", GENERAL: "general" } as const)[comment.context],
        category: ({ QUESTION: "consulta", DIFFICULTY: "dificultad", PAIN: "dolor", FEEDBACK: "devolucion" } as const)[comment.category],
        status: comment.status === "REVIEWED" ? "revisado" as const : "pendiente" as const,
        body: comment.body,
        contextLabel: comment.exercise?.name ?? ({ SESSION: "Sesión de entrenamiento", EVALUATION: "Evaluación", GENERAL: "General", EXERCISE: "Ejercicio" } as const)[comment.context],
        parentId: comment.parentId,
        createdAt: comment.createdAt.toISOString(),
      })),
      nextClass: nextClass ? { id: nextClass.id, label: nextClass.classType, startTime: nextClass.startTime } : null,
      weeklyWorkouts: workoutSessions.filter((workout) => workout.status === "COMPLETED" && workout.date >= weekStart).length,
      pendingResponses: comments.filter((comment) => comment.author === "STUDENT" && comment.status === "PENDING").length,
    };
    return Response.json(data);
  } catch (error) {
    console.error("Error al cargar datos del portal", error);
    return Response.json({ error: "No se pudo cargar tu información desde Neon." }, { status: 500 });
  }
}

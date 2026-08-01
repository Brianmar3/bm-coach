import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import { monthRange, serializeAttendance } from "@/lib/attendance";
import { argentinaDateKey, databaseDateKey } from "@/lib/payment-dates";
import { serializePayment, storedStudent } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { routineInclude, serializeRoutine } from "@/lib/rutinas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PANELS = ["attendance", "payments", "routine", "classes"] as const;
type Panel = (typeof PANELS)[number];

const weekdayOrder = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5 } as const;
const weekdayLabel = { MONDAY: "Lunes", TUESDAY: "Martes", WEDNESDAY: "Miércoles", THURSDAY: "Jueves", FRIDAY: "Viernes" } as const;

async function authorize() {
  const auth = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  return auth.ok ? null : adminAuthError(auth);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const failure = await authorize();
  if (failure) return Response.json({ error: failure.error }, { status: failure.status });

  const { id } = await context.params;
  const panel = new URL(request.url).searchParams.get("panel") as Panel | null;
  if (!panel || !PANELS.includes(panel)) return Response.json({ error: "El panel solicitado no es válido." }, { status: 400 });

  const studentRecord = await prisma.studentRecord.findUnique({ where: { id }, select: { id: true, data: true } });
  if (!studentRecord) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });

  if (panel === "attendance") {
    const month = argentinaDateKey().slice(0, 7);
    const range = monthRange(month)!;
    const [records, current] = await Promise.all([
      prisma.classAttendance.findMany({
        where: { studentId: id },
        include: { student: true },
        orderBy: [{ date: "desc" }, { scheduleStartTime: "asc" }],
        take: 10,
      }),
      prisma.classAttendance.groupBy({
        by: ["status"],
        where: { studentId: id, date: { gte: range.start, lt: range.end } },
        _count: { _all: true },
      }),
    ]);
    const count = (status: "PRESENT" | "ABSENT" | "JUSTIFIED") => current.find((row) => row.status === status)?._count._all ?? 0;
    const attended = count("PRESENT");
    const absent = count("ABSENT");
    const justified = count("JUSTIFIED");
    const total = attended + absent + justified;
    return Response.json({
      panel,
      month,
      summary: { attended, absent, justified, percentage: total ? Math.round((attended / total) * 1000) / 10 : 0 },
      history: records.map((record) => serializeAttendance(record, false)),
    });
  }

  if (panel === "payments") {
    const period = `${argentinaDateKey().slice(0, 7)}-01`;
    const [payments, obligation] = await Promise.all([
      prisma.studentPayment.findMany({
        where: { studentId: id },
        include: { student: true },
        orderBy: [{ paidDate: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
      prisma.monthlyStudentObligation.findUnique({
        where: { studentId_period: { studentId: id, period: new Date(`${period}T12:00:00.000Z`) } },
      }),
    ]);
    const student = storedStudent(studentRecord.data);
    return Response.json({
      panel,
      period,
      payments: payments.map(serializePayment),
      obligation: obligation ? {
        expectedAmount: Number(obligation.expectedAmount),
        paidAmount: Number(obligation.paidAmount),
        balance: Number(obligation.balance),
        status: obligation.status,
        dueDate: databaseDateKey(obligation.dueDate),
      } : null,
      account: { plan: student.plan ?? "", monthlyFee: Number(student.monthlyFee ?? 0), dueDate: student.dueDate ?? "" },
    });
  }

  if (panel === "routine") {
    const routine = await prisma.trainingRoutine.findFirst({
      where: { kind: "ASSIGNED", status: "ACTIVA", assignments: { some: { studentId: id, active: true } } },
      include: routineInclude,
      orderBy: { updatedAt: "desc" },
    });
    return Response.json({ panel, routine: routine ? serializeRoutine(routine) : null });
  }

  const schedules = await prisma.weeklyClassSchedule.findMany({
    where: { active: true, assignments: { some: { studentId: id, active: true } } },
    select: { id: true, dayOfWeek: true, startTime: true, endTime: true, classType: true },
  });
  schedules.sort((left, right) => weekdayOrder[left.dayOfWeek] - weekdayOrder[right.dayOfWeek] || left.startTime.localeCompare(right.startTime));
  return Response.json({ panel, schedules: schedules.map((schedule) => ({ ...schedule, dayLabel: weekdayLabel[schedule.dayOfWeek] })) });
}

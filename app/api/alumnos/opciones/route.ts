import { prisma } from "@/lib/prisma";
import { getStudentPlanOptions, weeklyScheduleLabel } from "@/lib/student-enrollment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [plans, schedules] = await Promise.all([
      getStudentPlanOptions(),
      prisma.weeklyClassSchedule.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }], select: { id: true, dayOfWeek: true, startTime: true, endTime: true, classType: true, active: true, capacity: true, _count: { select: { assignments: true } } } }),
    ]);
    return Response.json({
      plans,
      schedules: schedules.map((schedule) => ({ id: schedule.id, label: weeklyScheduleLabel(schedule), active: schedule.active, capacity: schedule.capacity, assigned: schedule._count.assignments })),
    });
  } catch (error) {
    console.error("Error al cargar opciones de alta", error);
    return Response.json({ error: "No se pudieron cargar los planes y horarios." }, { status: 500 });
  }
}

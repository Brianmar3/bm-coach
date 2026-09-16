import { prisma } from "@/lib/prisma";
import { getStudentPlanOptions, weeklyScheduleLabel } from "@/lib/student-enrollment";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const [plans, schedules] = await Promise.all([
      getStudentPlanOptions(),
      prisma.weeklyClassSchedule.findMany({ where: { workspaceId }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }], select: { id: true, dayOfWeek: true, startTime: true, endTime: true, classType: true, active: true, capacity: true, _count: { select: { assignments: { where: { active: true } } } } } }),
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

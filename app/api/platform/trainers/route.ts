import { platformOwnerApiAccess } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";
import { effectiveTrainerSubscriptionStatus } from "@/lib/trainer-subscription";
import { coachedStudentsWhere } from "@/lib/coached-students";
import { countActiveManagedStudents, trainerStudentCapacity } from "@/lib/trainer-plan-limits";
import { effectiveTrainerPlan } from "@/lib/trainer-subscription";

export async function GET() {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  const [trainers, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, phone: true, brandName: true, city: true, serviceType: true, onboardingCompleted: true, status: true, platformRole: true, createdAt: true, trainerSubscription: true, memberships: { where: { role: "OWNER", workspace: { type: "PROFESSIONAL" } }, select: { workspace: { select: { id: true, name: true, status: true, students: { where: coachedStudentsWhere, select: { data: true } } } } } } },
    }),
    prisma.trainerInvitation.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { id: true, firstName: true, lastName: true, email: true, expiresAt: true, createdAt: true } }),
  ]);
  return Response.json({ trainers: trainers.map((trainer) => {
    const subscription = trainer.trainerSubscription;
    const memberships = trainer.memberships.map(({ workspace }) => {
      const used = countActiveManagedStudents(workspace.students);
      const capacity = trainerStudentCapacity(subscription ? effectiveTrainerPlan(subscription) : "FREE", used);
      return { workspace: { id: workspace.id, name: workspace.name, status: workspace.status, _count: { students: used }, capacity } };
    });
    return { ...trainer, memberships, effectiveSubscriptionStatus: subscription ? effectiveTrainerSubscriptionStatus(subscription) : null };
  }), invitations });
}

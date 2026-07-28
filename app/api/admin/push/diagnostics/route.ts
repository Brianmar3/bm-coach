import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import type { Student } from "@/types/gestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!auth.ok) {
    const response = adminAuthError(auth);
    return Response.json({ error: response.error }, { status: response.status });
  }
  const students = await prisma.studentRecord.findMany({
    where: { pushSubscriptions: { some: {} } },
    select: {
      id: true,
      data: true,
      pushSubscriptions: { orderBy: { updatedAt: "desc" }, select: { active: true, updatedAt: true } },
      achievementNotifications: { where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, select: { error: true }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  return Response.json(students.map((record) => {
    const student = record.data as unknown as Student;
    return {
      id: record.id,
      name: `${student.firstName} ${student.lastName}`.trim(),
      activeDevices: record.pushSubscriptions.filter((item) => item.active).length,
      lastSubscriptionAt: record.pushSubscriptions[0]?.updatedAt.toISOString() ?? null,
      lastError: record.achievementNotifications[0]?.error ?? null,
    };
  }));
}

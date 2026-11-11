import { redirect } from "next/navigation";
import { PortalSection } from "@/componentes/portal-section";
import { requirePortalPageSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { isFeeReminder, studentFeeDestination } from "@/lib/student-notification-destination";

export default async function PortalPaymentsPage({ searchParams }: PageProps<"/portal/pagos">) {
  const { aviso } = await searchParams;
  if (aviso !== undefined) {
    if (typeof aviso !== "string" || !/^[\w-]{1,128}$/.test(aviso)) redirect("/portal");
    const session = await requirePortalPageSession(studentFeeDestination(aviso));
    const notice = await prisma.studentNotification.findFirst({
      where: { id: aviso, studentId: session.studentId },
      select: { eventKey: true },
    });
    if (!isFeeReminder(notice?.eventKey)) redirect("/portal");
  }
  return <PortalSection section="pagos" />;
}

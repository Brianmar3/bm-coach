import "server-only";

import { Prisma, type CoachEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendStudentPush } from "@/lib/push-notifications";

function publicationMessage(event: Pick<CoachEvent, "title" | "date" | "time">) {
  const date = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long" }).format(event.date);
  return [event.title.trim(), date, event.time ? `a las ${event.time}` : ""].filter(Boolean).join(" · ");
}

export async function notifyPublishedCoachEvent(event: CoachEvent) {
  if (!event.showToStudents || event.status !== "PENDIENTE") return;
  try {
    const students = await prisma.studentRecord.findMany({
      where: event.audience === "ALL" ? undefined : { serviceType: event.audience },
      select: { id: true },
    });
    const title = "Nuevo evento en BM Training";
    const message = publicationMessage(event);
    const url = `/portal#evento-${event.id}`;
    for (const student of students) {
      try {
        await prisma.studentNotification.create({ data: { studentId: student.id, type: "EVENT", eventKey: `coach-event:${event.id}:${student.id}`, title, message, url } });
        await sendStudentPush(student.id, { title, body: message, url, tag: `coach-event-${event.id}`, type: "EVENT", eventKey: `coach-event:${event.id}` });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
          console.error("No se pudo notificar un evento al alumno", { eventId: event.id, studentId: student.id, error });
        }
      }
    }
  } catch (error) {
    console.error("No se pudo publicar el evento a los alumnos", { eventId: event.id, error });
  }
}

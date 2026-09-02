import type { CoachEvent, StudentServiceType } from "@/types/gestion";

export function eventMatchesService(event: Pick<CoachEvent, "showToStudents" | "audience">, serviceType: StudentServiceType) {
  return event.showToStudents && (event.audience === "todos" || event.audience === serviceType);
}

export function visiblePortalEvents(events: CoachEvent[], serviceType: StudentServiceType, todayKey: string) {
  return events
    .filter((event) => event.status === "pendiente" && event.date >= todayKey && eventMatchesService(event, serviceType))
    .sort((left, right) => `${left.date}T${left.time || "23:59"}`.localeCompare(`${right.date}T${right.time || "23:59"}`));
}

export function portalEventDismissalKey(studentId: string, eventId: string) {
  return `bm-portal-event-dismissed:${studentId}:${eventId}`;
}

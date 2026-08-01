export type TrainerNotificationSection =
  | "achievements"
  | "records"
  | "routines"
  | "attendance";

export type TrainerNotificationNavigation = {
  type: string;
  url?: string | null;
  studentId?: string | null;
  eventKey?: string | null;
  entityId?: string | null;
};

export type NotificationOpenState = { opening: boolean };

function safeInternalUrl(value?: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

function pointEventKey(eventKey?: string | null) {
  if (!eventKey?.startsWith("points:")) return eventKey ?? "";
  const firstSeparator = eventKey.indexOf(":", "points:".length);
  return firstSeparator >= 0 ? eventKey.slice(firstSeparator + 1) : "";
}

function eventDestination(eventKey: string): { section: TrainerNotificationSection; entityId: string | null } | null {
  const mappings: Array<[string, TrainerNotificationSection]> = [
    ["personal-record:", "records"],
    ["record:quick-log:", "records"],
    ["record:workout-session:", "routines"],
    ["record:workout-exercise:", "routines"],
    ["record:routine-exercise:", "routines"],
    ["record:class-exercise:", "records"],
    ["attendance:", "attendance"],
    ["achievement:", "achievements"],
  ];
  const match = mappings.find(([prefix]) => eventKey.startsWith(prefix));
  if (!match) return null;
  return { section: match[1], entityId: eventKey.slice(match[0].length) || null };
}

function sectionForType(type: string): TrainerNotificationSection | null {
  if (["ACHIEVEMENT", "ACHIEVEMENT_UNLOCKED", "MILESTONE"].includes(type)) return "achievements";
  if (["PERSONAL_RECORD", "EXERCISE_LOGGED", "RECORD", "QUICK_LOG"].includes(type)) return "records";
  if (["WORKOUT_COMPLETED", "ROUTINE_COMPLETED", "WORKOUT_SESSION"].includes(type)) return "routines";
  if (type === "ATTENDANCE") return "attendance";
  return null;
}

export function studentNotificationProfileUrl(
  studentId: string,
  section?: TrainerNotificationSection | null,
  entityId?: string | null,
) {
  const params = new URLSearchParams({ studentId });
  if (section) params.set("section", section);
  if (entityId) params.set("entityId", entityId);
  return `/alumnos?${params.toString()}${section ? `#student-section-${section}` : ""}`;
}

export function resolveTrainerNotificationDestination(notification: TrainerNotificationNavigation) {
  const storedUrl = safeInternalUrl(notification.url);
  if (notification.type === "CLASS_RESPONSE" || notification.type === "PAYMENT") {
    return storedUrl ?? (notification.studentId ? studentNotificationProfileUrl(notification.studentId) : "/alumnos");
  }
  if (!notification.studentId) return storedUrl ?? "/alumnos";

  const event = eventDestination(pointEventKey(notification.eventKey));
  const section = event?.section ?? sectionForType(notification.type);
  const entityId = notification.entityId ?? event?.entityId ?? null;
  return studentNotificationProfileUrl(notification.studentId, section, entityId);
}

export async function openNotificationSafely(
  notification: { id: string; readAt: string | null; destination: string },
  state: NotificationOpenState,
  markRead: (id: string) => Promise<unknown>,
  navigate: (destination: string) => void,
) {
  if (state.opening) return false;
  state.opening = true;
  if (!notification.readAt) {
    try {
      await markRead(notification.id);
    } catch {
      // La lectura no debe bloquear la navegación al contenido asociado.
    }
  }
  navigate(notification.destination);
  return true;
}

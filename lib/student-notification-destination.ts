export type StudentNotificationNavigation = {
  type?: string | null;
  eventKey?: string | null;
  url?: string | null;
};

const PORTAL_FALLBACK = "/portal";
const ALLOWED_PORTAL_DESTINATIONS = [
  "/portal/pagos",
  "/portal/puntos",
  "/portal/ranking",
  "/portal/clases",
  "/portal/rutina",
  "/portal/entrenamiento",
  "/portal/evaluaciones",
  "/portal/registro",
  "/portal/nutricion",
  "/portal/progreso",
  "/portal",
] as const;

function isAllowedPortalPath(pathname: string) {
  return ALLOWED_PORTAL_DESTINATIONS.some((root) =>
    root === PORTAL_FALLBACK
      ? pathname === root
      : pathname === root || pathname.startsWith(`${root}/`),
  );
}

function normalizedToken(value?: string | null) {
  return value?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? "";
}

export function safePortalNotificationDestination(value?: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return null;
  try {
    const parsed = new URL(value, "https://bm-training.internal");
    if (parsed.origin !== "https://bm-training.internal") return null;
    if (!isAllowedPortalPath(parsed.pathname)) return null;
    if (parsed.pathname === PORTAL_FALLBACK && ["#puntos", "#logros"].includes(parsed.hash)) {
      return "/portal/puntos";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function getNotificationDestination(notification: StudentNotificationNavigation) {
  const type = normalizedToken(notification.type);
  const eventKey = normalizedToken(notification.eventKey);

  if (type === "PAYMENT" || eventKey.includes("PAYMENT") || eventKey.includes("CUOTA")) return "/portal/pagos";
  if (
    ["POINTS", "ACHIEVEMENT", "ACHIEVEMENT_UNLOCKED", "MILESTONE", "LOGRO"].includes(type)
    || eventKey.includes("POINTS")
    || eventKey.includes("ACHIEVEMENT")
    || eventKey.includes("LOGRO")
  ) return "/portal/puntos";
  if (type === "RANKING" || eventKey.includes("RANKING")) return "/portal/ranking";
  if (
    ["CLASS", "CLASSES", "ATTENDANCE", "CLASS_RESPONSE", "ASISTENCIA"].includes(type)
    || eventKey.includes("CLASS")
    || eventKey.includes("ATTENDANCE")
    || eventKey.includes("ASISTENCIA")
  ) return "/portal/clases";
  if (
    ["ROUTINE", "WORKOUT", "WORKOUT_COMPLETED", "ROUTINE_COMPLETED", "TRAINING"].includes(type)
    || eventKey.includes("ROUTINE")
    || eventKey.includes("WORKOUT")
  ) return "/portal/rutina";
  if (
    ["EVALUATION", "EVALUATION_UPDATED", "EVALUACION"].includes(type)
    || eventKey.includes("EVALUATION")
    || eventKey.includes("EVALUACION")
  ) return "/portal/evaluaciones";

  return safePortalNotificationDestination(notification.url) ?? PORTAL_FALLBACK;
}

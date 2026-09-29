import type { WeeklyMissionView } from "./weekly-mission.ts";
import type { PortalData } from "../types/portal.ts";
import { hasGroupClasses } from "./student-service.ts";

export function validWeeklyMission(value: unknown): value is WeeklyMissionView {
  if (!value || typeof value !== "object") return false;
  const mission = value as Partial<WeeklyMissionView>;
  return typeof mission.id === "string" && mission.id.length > 0
    && /^\d{4}-\d{2}-\d{2}$/.test(mission.weekStart ?? "")
    && /^\d{4}-\d{2}-\d{2}$/.test(mission.weekEnd ?? "")
    && Number.isInteger(mission.target) && (mission.target ?? 0) > 0
    && Number.isInteger(mission.progress) && (mission.progress ?? -1) >= 0
    && (mission.state === "ACTIVE" || mission.state === "COMPLETED");
}

export function mergePortalRefresh(previous: PortalData | null, incoming: PortalData, today: string) {
  const candidate = incoming.home.weeklyMission;
  if (validWeeklyMission(candidate)) return incoming;
  const lastValid = previous?.profile.id === incoming.profile.id && validWeeklyMission(previous.home.weeklyMission)
    ? previous.home.weeklyMission
    : null;
  if (!lastValid) {
    return candidate === null ? incoming : { ...incoming, home: { ...incoming.home, weeklyMission: null } };
  }
  const explicitlyUnavailable = !hasGroupClasses(incoming.profile.serviceType)
    || incoming.profile.status !== "activo"
    || today < lastValid.weekStart
    || today > lastValid.weekEnd;
  if (explicitlyUnavailable) return { ...incoming, home: { ...incoming.home, weeklyMission: null } };
  return { ...incoming, home: { ...incoming.home, weeklyMission: lastValid } };
}

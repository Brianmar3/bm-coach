export const LAST_PORTAL_COOKIE = "bm_coach_last_portal";
export const STUDENT_SESSION_COOKIE = "bm_coach_student_session";
export type PortalExperience = "student" | "admin";
export function parsePortalExperience(value: string | undefined): PortalExperience | null { return value === "student" || value === "admin" ? value : null; }
export function choosePortalExperience(input: { studentValid: boolean; adminValid: boolean; preferred: PortalExperience | null }) {
  if (input.preferred === "student" && input.studentValid) return "student" as const;
  if (input.preferred === "admin" && input.adminValid) return "admin" as const;
  if (input.studentValid) return "student" as const;
  if (input.adminValid) return "admin" as const;
  return null;
}
export function portalExperienceCookieOptions() { return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 30 * 24 * 60 * 60, priority: "medium" as const }; }
export function clearPortalExperienceCookieOptions() { return { ...portalExperienceCookieOptions(), maxAge: 0 }; }

export const STUDENT_LOGIN_URL = "/portal/login?mode=student";
export type InvitationOutcome = "USED" | "EXPIRED" | "REVOKED" | "INVALID" | "UNAVAILABLE";

export function invitationOutcomeContent(status: InvitationOutcome) {
  switch (status) {
    case "USED": return { title: "Esta invitación ya fue utilizada.", description: "Si ya creaste tu cuenta, ingresá a BM Training con tu usuario y contraseña.", login: true };
    case "EXPIRED": return { title: "Esta invitación venció.", description: "Pedile una nueva invitación a tu entrenador.", login: false };
    case "REVOKED": return { title: "Esta invitación fue revocada.", description: "Pedile una nueva invitación a tu entrenador.", login: false };
    case "UNAVAILABLE": return { title: "Invitación no disponible", description: "Este espacio no está disponible para nuevas altas.", login: false };
    default: return { title: "Invitación no válida.", description: "Revisá el enlace o pedile una nueva invitación a tu entrenador.", login: false };
  }
}

export function studentInvitationWhatsappText(url: string, displayName = "BM Training") {
  const invitationBrand = displayName.trim() || "BM Training";
  return `Hola 👋 Te invito a ${invitationBrand} para que podamos llevar tu entrenamiento y seguimiento desde la app.\n\nCompletá tu registro acá:\n${url}`;
}

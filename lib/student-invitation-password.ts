export const INVITATION_PASSWORD_HELP = "Mínimo 10 caracteres, con una mayúscula, una minúscula y un número.";

export function invitationPasswordRequirements(password: string) {
  return [
    { id: "length", label: "10 caracteres mínimo", met: password.length >= 10 },
    { id: "upper", label: "1 mayúscula", met: /[A-Z]/.test(password) },
    { id: "lower", label: "1 minúscula", met: /[a-z]/.test(password) },
    { id: "number", label: "1 número", met: /\d/.test(password) },
  ];
}

/** Scoped to invitation registration; existing login and password flows retain their policy. */
export function invitationPasswordValidationError(password: string) {
  const requirements = invitationPasswordRequirements(password);
  if (password.length > 128) return "La contraseña es demasiado larga.";
  if (!requirements[0].met) return "La contraseña debe tener al menos 10 caracteres.";
  if (requirements.some(item => !item.met)) return "La contraseña debe incluir mayúscula, minúscula y número.";
  return null;
}

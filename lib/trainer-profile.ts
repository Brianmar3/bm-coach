const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeTrainerEmail(value: string) {
  return value.trim().toLowerCase();
}

export function parseTrainerEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = normalizeTrainerEmail(value);
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

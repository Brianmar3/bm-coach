export const AUTH_SESSION_DAYS = 30;
export const AUTH_SESSION_MAX_AGE_SECONDS = AUTH_SESSION_DAYS * 24 * 60 * 60;

export function authSessionExpiresAt(now = new Date()) {
  return new Date(now.getTime() + AUTH_SESSION_MAX_AGE_SECONDS * 1000);
}

export function persistentAuthCookieOptions(expiresAt: Date, priority: "medium" | "high" = "high") {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    priority,
  };
}

export function clearAuthCookieOptions(priority: "medium" | "high" = "high") {
  return {
    ...persistentAuthCookieOptions(new Date(0), priority),
    maxAge: 0,
  };
}

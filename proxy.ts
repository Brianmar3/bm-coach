import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sameOrigin(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host") ?? request.nextUrl.host;
    return originHost === requestHost;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (/\.[^/]+$/.test(path)) return NextResponse.next();
  const portalRoute = path === "/portal" || path.startsWith("/portal/") || path === "/api/portal" || path.startsWith("/api/portal/");
  const authRoute = path === "/admin/login" || path === "/api/admin/auth/login" || path === "/api/admin/auth/logout" || path === "/api/admin/auth/session";
  if (portalRoute || authRoute) return NextResponse.next();

  const session = verifyAdminSessionValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session.ok) {
    const failure = adminAuthError(session);
    if (path.startsWith("/api/")) return NextResponse.json({ error: failure.error }, { status: failure.status });
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  if (!sameOrigin(request)) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Origen de solicitud inválido." }, { status: 403 });
    return new NextResponse("Origen de solicitud inválido.", { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

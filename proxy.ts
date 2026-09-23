import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import { LAST_PORTAL_COOKIE, portalExperienceCookieOptions, STUDENT_SESSION_COOKIE } from "@/lib/portal-experience";
import { prisma } from "@/lib/prisma";

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

async function sessionUserIsActive(userId: string | null) {
  if (!userId) return true;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  return user?.status === "ACTIVE";
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/sw.js" || path === "/manifest.webmanifest" || path === "/portal/manifest.webmanifest" || path.startsWith("/icons/")) return NextResponse.next();
  if (/\.[^/]+$/.test(path)) return NextResponse.next();
  const portalRoute = path === "/portal" || path.startsWith("/portal/") || path === "/api/portal" || path.startsWith("/api/portal/");
  const portalBrandingAsset = path === "/api/workspace/logo/image" && (request.method === "GET" || request.method === "HEAD");
  const exerciseLibraryRead = path.startsWith("/api/exercise-library") && SAFE_METHODS.has(request.method);
  const trainerInvitationRoute = path.startsWith("/trainer/invite/") || path.startsWith("/api/trainer/invitations/");
  const trainerPasswordResetRoute = path.startsWith("/trainer/reset-password/") || path.startsWith("/api/trainer/password-reset/");
  const authRoute = path === "/admin/login" || path === "/master" || path === "/api/admin/auth/login" || path === "/api/platform/auth/login" || path === "/api/admin/auth/logout" || path === "/api/admin/auth/session";
  if (portalRoute || portalBrandingAsset || authRoute || trainerInvitationRoute || trainerPasswordResetRoute || exerciseLibraryRead) {
    if (path === "/admin/login") {
      const adminSession = verifyAdminSessionValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
      if (adminSession.ok && await sessionUserIsActive(adminSession.userId)) {
        const requested = request.nextUrl.searchParams.get("next");
        const safeNext = requested?.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") ? requested : "/dashboard";
        const response = NextResponse.redirect(new URL(safeNext, request.url));
        response.cookies.set(LAST_PORTAL_COOKIE, "admin", portalExperienceCookieOptions());
        return response;
      }
    }
    const response = NextResponse.next();
    if ((path === "/portal" || (path.startsWith("/portal/") && path !== "/portal/login")) && request.cookies.has(STUDENT_SESSION_COOKIE)) response.cookies.set(LAST_PORTAL_COOKIE, "student", portalExperienceCookieOptions());
    return response;
  }

  const session = verifyAdminSessionValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session.ok) {
    const failure = adminAuthError(session);
    if (path.startsWith("/api/")) return NextResponse.json({ error: failure.error }, { status: failure.status });
    const login = new URL(path === "/platform" || path.startsWith("/platform/") ? "/master" : "/admin/login", request.url);
    login.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  if (session.userId) {
    if (!await sessionUserIsActive(session.userId)) {
      if (path.startsWith("/api/")) return NextResponse.json({ error: "La cuenta no está activa." }, { status: 401 });
      const login = new URL(path === "/platform" || path.startsWith("/platform/") ? "/master" : "/admin/login", request.url);
      login.searchParams.set("next", `${path}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
  }
  if (!sameOrigin(request)) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Origen de solicitud inválido." }, { status: 403 });
    return new NextResponse("Origen de solicitud inválido.", { status: 403 });
  }
  const response = NextResponse.next();
  response.cookies.set(LAST_PORTAL_COOKIE, "admin", portalExperienceCookieOptions());
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

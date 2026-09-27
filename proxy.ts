import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, PLATFORM_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue, verifyPlatformSessionValue } from "@/lib/admin-auth";
import { masterEntryDestination } from "@/lib/master-access";
import { LAST_PORTAL_COOKIE, portalExperienceCookieOptions, STUDENT_SESSION_COOKIE } from "@/lib/portal-experience";
import { prisma } from "@/lib/prisma";
import { trainerIdentityHasWorkspaceAccess } from "@/lib/trainer-session-access";

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

async function sessionUserAccess(userId: string | null) {
  if (!userId) return { active: true, platformRole: "TRAINER" as const, trainerWorkspaceValid: true };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, platformRole: true, memberships: { select: { role: true, status: true, workspace: { select: { status: true, type: true } } } } },
  });
  return { active: user?.status === "ACTIVE", platformRole: user?.platformRole ?? null, trainerWorkspaceValid: trainerIdentityHasWorkspaceAccess(user) };
}

async function studentSessionIsActive(token: string | undefined) {
  if (!token) return false;
  const session = await prisma.studentPortalSession.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    select: { expiresAt: true, credential: { select: { active: true } } },
  });
  return Boolean(session && session.expiresAt > new Date() && session.credential.active);
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/sw.js" || path === "/manifest.webmanifest" || path === "/portal/manifest.webmanifest" || path.startsWith("/icons/")) return NextResponse.next();
  if (/\.[^/]+$/.test(path)) return NextResponse.next();
  const portalRoute = path === "/portal" || path.startsWith("/portal/") || path === "/api/portal" || path.startsWith("/api/portal/");
  const portalBrandingAsset = path === "/api/workspace/logo/image" && (request.method === "GET" || request.method === "HEAD");
  const exerciseLibraryRead = path.startsWith("/api/exercise-library") && SAFE_METHODS.has(request.method);
  const trainerInvitationRoute = path.startsWith("/trainer/invite/") || path.startsWith("/api/trainer/invitations/");
  const studentInvitationRoute = path.startsWith("/join/student/") || path.startsWith("/api/student-invitations/");
  const trainerPasswordResetRoute = path.startsWith("/trainer/reset-password/") || path.startsWith("/api/trainer/password-reset/");
  const platformRoute = path === "/platform" || path.startsWith("/platform/") || path === "/api/platform" || path.startsWith("/api/platform/");
  const platformAuthRoute = path === "/api/platform/auth/login" || path === "/api/platform/auth/logout";
  const authRoute = path === "/admin/login" || path === "/api/admin/auth/login" || path === "/api/admin/auth/logout" || path === "/api/admin/auth/session";

  if (path === "/master") {
    const platformSession = verifyPlatformSessionValue(request.cookies.get(PLATFORM_SESSION_COOKIE)?.value);
    const platformAccess = platformSession.ok ? await sessionUserAccess(platformSession.userId) : null;
    const trainerSession = verifyAdminSessionValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    const trainerAccess = trainerSession.ok ? await sessionUserAccess(trainerSession.userId) : null;
    const destination = masterEntryDestination({
      platformOwnerValid: Boolean(platformAccess?.active && platformAccess.platformRole === "PLATFORM_OWNER"),
      trainerValid: Boolean(trainerAccess?.trainerWorkspaceValid),
      studentValid: await studentSessionIsActive(request.cookies.get(STUDENT_SESSION_COOKIE)?.value),
    });
    return destination ? NextResponse.redirect(new URL(destination, request.url)) : NextResponse.next();
  }

  if (platformAuthRoute) return NextResponse.next();

  if (platformRoute) {
    const session = verifyPlatformSessionValue(request.cookies.get(PLATFORM_SESSION_COOKIE)?.value);
    const access = session.ok ? await sessionUserAccess(session.userId) : null;
    if (!session.ok || !access?.active || access.platformRole !== "PLATFORM_OWNER") {
      if (path.startsWith("/api/")) {
        if (!session.ok) {
          const failure = adminAuthError(session);
          return NextResponse.json({ error: failure.error }, { status: failure.status });
        }
        return NextResponse.json({ error: "Acceso exclusivo del propietario de la plataforma." }, { status: 403 });
      }
      const trainerSession = verifyAdminSessionValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
      const trainerAccess = trainerSession.ok ? await sessionUserAccess(trainerSession.userId) : null;
      const destination = masterEntryDestination({
        platformOwnerValid: false,
        trainerValid: Boolean(trainerAccess?.trainerWorkspaceValid),
        studentValid: await studentSessionIsActive(request.cookies.get(STUDENT_SESSION_COOKIE)?.value),
      });
      if (destination) return NextResponse.redirect(new URL(destination, request.url));
      const login = new URL("/master", request.url);
      login.searchParams.set("next", `${path}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
    if (!sameOrigin(request)) {
      if (path.startsWith("/api/")) return NextResponse.json({ error: "Origen de solicitud inválido." }, { status: 403 });
      return new NextResponse("Origen de solicitud inválido.", { status: 403 });
    }
    return NextResponse.next();
  }

  if (portalRoute || portalBrandingAsset || authRoute || trainerInvitationRoute || studentInvitationRoute || trainerPasswordResetRoute || exerciseLibraryRead) {
    if (path === "/admin/login") {
      const adminSession = verifyAdminSessionValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
      const adminAccess = adminSession.ok ? await sessionUserAccess(adminSession.userId) : null;
      if (adminAccess?.trainerWorkspaceValid) {
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
    const access = await sessionUserAccess(session.userId);
    if (!access.trainerWorkspaceValid) {
      if (path.startsWith("/api/")) return NextResponse.json({ error: access.active ? "No hay un workspace de entrenador autorizado." : "La cuenta no está activa." }, { status: access.active ? 403 : 401 });
      const login = new URL("/admin/login", request.url);
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

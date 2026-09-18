import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function requireAdminApiResponse() {
  const auth = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!auth.ok) {
    const failure = adminAuthError(auth);
    return Response.json({ error: failure.error }, { status: failure.status });
  }
  if (auth.userId) {
    const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { status: true } });
    if (!user || user.status !== "ACTIVE") return Response.json({ error: "La cuenta no está activa." }, { status: 401 });
  }
  return null;
}

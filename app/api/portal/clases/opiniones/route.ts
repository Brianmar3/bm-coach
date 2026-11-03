import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { feedbackInput } from "@/lib/class-communication";
import { pendingClassFeedback, submitClassFeedback } from "@/lib/class-communication-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const workspaceId = session.credential.student.workspaceId;
  if (!workspaceId || session.credential.mustChangePassword) return Response.json({ error: "Primero completá el acceso a tu cuenta." }, { status: 403 });
  try { return Response.json({ invitation: await pendingClassFeedback(prisma, session.studentId, workspaceId) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { console.error("No se pudo cargar la invitación de clase", error); return Response.json({ error: "No se pudo cargar la invitación." }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const workspaceId = session.credential.student.workspaceId;
  if (!workspaceId || session.credential.mustChangePassword) return Response.json({ error: "Primero completá el acceso a tu cuenta." }, { status: 403 });
  let input;
  try { input = feedbackInput(await request.json()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Respuesta no válida." }, { status: 400 }); }
  try {
    const saved = await submitClassFeedback(prisma, session.studentId, workspaceId, input);
    return saved ? Response.json({ ok: true }) : Response.json({ error: "La clase no está disponible: el plazo de 24 horas venció, ya respondiste o no hay asistencia efectiva habilitada." }, { status: 409 });
  } catch (error) { console.error("No se pudo guardar la opinión de clase", error); return Response.json({ error: "No se pudo guardar tu opinión." }, { status: 500 }); }
}

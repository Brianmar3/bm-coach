import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";

export const runtime = "nodejs";

const unavailable = () =>
  Response.json(
    {
      error:
        "El registro de ejercicios dentro de clases ya no está disponible. Usá Registro rápido.",
      recordsUrl: "/portal/registro",
    },
    { status: 410 },
  );

async function authorize(request: Request) {
  if (!validRequestOrigin(request))
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session)
    return Response.json({ error: "Sesión vencida." }, { status: 401 });
  return null;
}

export async function POST(request: Request) {
  const denied = await authorize(request);
  return denied ?? unavailable();
}

export async function PATCH(request: Request) {
  const denied = await authorize(request);
  return denied ?? unavailable();
}

export async function DELETE(request: Request) {
  const denied = await authorize(request);
  return denied ?? unavailable();
}

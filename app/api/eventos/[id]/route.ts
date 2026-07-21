import { eventData, serializeEvent, validateEvent, type EventInput } from "@/lib/eventos";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function GET(_request: Request, context: RouteContext<"/api/eventos/[id]">) {
  try {
    const { id } = await context.params;
    const record = await prisma.coachEvent.findUnique({ where: { id } });
    if (!record) return Response.json({ error: "Evento no encontrado." }, { status: 404 });
    return Response.json(serializeEvent(record));
  } catch (error) {
    console.error("Error al consultar evento", error);
    return Response.json({ error: "No se pudo cargar el evento desde Neon." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/eventos/[id]">) {
  try {
    const { id } = await context.params;
    const input = (await request.json()) as EventInput;
    const validationError = validateEvent(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    const record = await prisma.coachEvent.update({ where: { id }, data: eventData(input) });
    return Response.json(serializeEvent(record));
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Evento no encontrado." }, { status: 404 });
    console.error("Error al actualizar evento", error);
    return Response.json({ error: "No se pudo actualizar el evento en Neon." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/eventos/[id]">) {
  try {
    const { id } = await context.params;
    await prisma.coachEvent.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Evento no encontrado." }, { status: 404 });
    console.error("Error al eliminar evento", error);
    return Response.json({ error: "No se pudo eliminar el evento de Neon." }, { status: 500 });
  }
}

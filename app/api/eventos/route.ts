import { eventData, serializeEvent, validateEvent, type EventInput } from "@/lib/eventos";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const records = await prisma.coachEvent.findMany({
      orderBy: [{ date: "asc" }, { time: "asc" }, { createdAt: "asc" }],
    });
    return Response.json(records.map(serializeEvent));
  } catch (error) {
    console.error("Error al consultar eventos", error);
    return Response.json({ error: "No se pudieron cargar los eventos desde Neon." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as EventInput;
    const validationError = validateEvent(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    const record = await prisma.coachEvent.create({ data: eventData(input) });
    return Response.json(serializeEvent(record), { status: 201 });
  } catch (error) {
    console.error("Error al crear evento", error);
    return Response.json({ error: "No se pudo guardar el evento en Neon." }, { status: 500 });
  }
}

import { prisma } from "@/lib/prisma";

type ClassPayload = { title: string; date: string; startTime: string; endTime: string; location: string; capacity: number; status: string; description: string; students: string[] };

function valid(payload: ClassPayload) { return payload.title.trim() && payload.date && payload.startTime && payload.endTime > payload.startTime && payload.location.trim() && Number.isInteger(payload.capacity) && payload.capacity > 0 && payload.students.length <= payload.capacity; }

export async function PUT(request: Request, context: RouteContext<"/api/clases/[id]">) {
  const { id } = await context.params;
  const payload = await request.json() as ClassPayload;
  if (!valid(payload)) return Response.json({ error: "Revisá los datos de la clase." }, { status: 400 });
  const item = await prisma.classSession.update({ where: { id }, data: { ...payload, date: new Date(`${payload.date}T12:00:00.000Z`), students: payload.students } });
  return Response.json({ ...item, date: item.date.toISOString().slice(0, 10), students: item.students });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/clases/[id]">) {
  const { id } = await context.params;
  await prisma.classSession.delete({ where: { id } });
  return new Response(null, { status: 204 });
}

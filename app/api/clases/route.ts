import { prisma } from "@/lib/prisma";

type ClassPayload = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  status: string;
  description: string;
  students: string[];
};

function validate(payload: ClassPayload) {
  if (!payload.title.trim() || !payload.date || !payload.startTime || !payload.endTime || !payload.location.trim()) return "Completá título, fecha, horario y ubicación.";
  if (payload.endTime <= payload.startTime) return "La hora de finalización debe ser posterior al inicio.";
  if (!Number.isInteger(payload.capacity) || payload.capacity < 1) return "La capacidad debe ser al menos 1.";
  if (payload.students.length > payload.capacity) return "No podés asignar más alumnos que la capacidad de la clase.";
  return null;
}

function serialize(item: { id: string; title: string; date: Date; startTime: string; endTime: string; location: string; capacity: number; status: string; description: string; students: unknown }) {
  return { ...item, date: item.date.toISOString().slice(0, 10), students: item.students as string[] };
}

export async function GET() {
  const items = await prisma.classSession.findMany({ orderBy: [{ date: "asc" }, { startTime: "asc" }] });
  return Response.json(items.map(serialize));
}

export async function POST(request: Request) {
  const payload = await request.json() as ClassPayload;
  const error = validate(payload);
  if (error) return Response.json({ error }, { status: 400 });
  const item = await prisma.classSession.create({ data: { ...payload, date: new Date(`${payload.date}T12:00:00.000Z`), students: payload.students } });
  return Response.json(serialize(item), { status: 201 });
}

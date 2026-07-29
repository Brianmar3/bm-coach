import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import type { Student } from "@/types/gestion";
import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { profileAvatarById } from "@/lib/profile-avatars";

export const runtime = "nodejs";
const MAX_BYTES = 3 * 1024 * 1024;

function detectedType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return { mime: "image/png", extension: "png" };
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}

async function removeOwnedBlob(url: string) {
  if (!url || !url.includes(".blob.vercel-storage.com/")) return;
  await del(url).catch((error) => console.error("No se pudo retirar la foto anterior", error));
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "La carga de fotos todavía no está configurada." }, { status: 503 });
  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return Response.json({ error: "Elegí una imagen de hasta 3 MB." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectedType(bytes);
  if (!type || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return Response.json({ error: "La foto debe ser JPG, PNG o WEBP válido." }, { status: 400 });
  const student = session.credential.student.data as unknown as Student;
  const blob = await put(`student-profile/${session.studentId}/${randomUUID()}.${type.extension}`, Buffer.from(bytes), { access: "public", contentType: type.mime, addRandomSuffix: false });
  const next = { ...student, profileImageUrl: blob.url };
  await prisma.studentRecord.update({ where: { id: session.studentId }, data: { data: next } });
  await removeOwnedBlob(student.profileImageUrl ?? "");
  return Response.json({ url: blob.url, message: "Foto actualizada correctamente." });
}

export async function PUT(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const input = await request.json().catch(() => null) as { avatarId?: unknown } | null;
  const avatar = typeof input?.avatarId === "string" ? profileAvatarById(input.avatarId) : undefined;
  if (!avatar) return Response.json({ error: "El avatar seleccionado no es válido." }, { status: 400 });
  const student = session.credential.student.data as unknown as Student;
  await prisma.studentRecord.update({
    where: { id: session.studentId },
    data: { data: { ...student, profileImageUrl: avatar.src } },
  });
  await removeOwnedBlob(student.profileImageUrl ?? "");
  return Response.json({ url: avatar.src, message: "Avatar actualizado correctamente." });
}

export async function DELETE(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const student = session.credential.student.data as unknown as Student;
  await prisma.studentRecord.update({ where: { id: session.studentId }, data: { data: { ...student, profileImageUrl: "" } } });
  await removeOwnedBlob(student.profileImageUrl ?? "");
  return Response.json({ message: "Foto eliminada correctamente." });
}

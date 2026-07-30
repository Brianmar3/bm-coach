import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import type { Student } from "@/types/gestion";
import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { profileAvatarById } from "@/lib/profile-avatars";

export const runtime = "nodejs";
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function json(
  body: { success: boolean; photoUrl?: string; url?: string; message?: string; error?: string },
  status = 200,
) {
  return Response.json(body, { status });
}

function detectedType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: "image/jpeg", extension: "jpg" };
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length >= 8 &&
    bytes.slice(0, 8).every((value, index) => value === png[index])
  )
    return { mime: "image/png", extension: "png" };
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return { mime: "image/webp", extension: "webp" };
  return null;
}

async function removeOwnedBlob(url: string) {
  if (!url || !url.includes(".blob.vercel-storage.com/")) return;
  await del(url).catch((error) =>
    console.error("No se pudo retirar la foto anterior", error),
  );
}

async function authorize(request: Request) {
  if (!validRequestOrigin(request))
    return {
      response: json({ success: false, error: "Origen no permitido." }, 403),
      session: null,
    };
  const session = await getPortalSession();
  if (!session)
    return {
      response: json({ success: false, error: "Sesión vencida." }, 401),
      session: null,
    };
  return { response: null, session };
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.response || !auth.session) return auth.response!;
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return json(
      {
        success: false,
        error: "El almacenamiento de imágenes no está configurado.",
      },
      503,
    );

  let uploadedUrl = "";
  try {
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0)
      return json({ success: false, error: "Seleccioná una imagen." }, 400);
    if (file.size > MAX_BYTES)
      return json(
        { success: false, error: "La imagen supera el máximo de 3 MB." },
        413,
      );
    if (
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      !ALLOWED_MIME_TYPES.has(file.type)
    )
      return json(
        {
          success: false,
          error: "El formato no está permitido. Elegí una imagen JPG, PNG o WEBP.",
        },
        415,
      );

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectedType(bytes);
    if (!type || type.mime !== file.type)
      return json(
        {
          success: false,
          error: "El archivo no contiene una imagen JPG, PNG o WEBP válida.",
        },
        415,
      );

    const student = auth.session.credential.student.data as unknown as Student;
    const blob = await put(
      `student-profile/${auth.session.studentId}/${randomUUID()}.${type.extension}`,
      Buffer.from(bytes),
      {
        access: "public",
        contentType: type.mime,
        addRandomSuffix: false,
      },
    );
    if (!blob.url)
      throw new Error("Vercel Blob no devolvió una URL para la imagen.");
    uploadedUrl = blob.url;
    await prisma.studentRecord.update({
      where: { id: auth.session.studentId },
      data: { data: { ...student, profileImageUrl: blob.url } },
    });
    await removeOwnedBlob(student.profileImageUrl ?? "");
    return json({
      success: true,
      photoUrl: blob.url,
      url: blob.url,
      message: "Foto de perfil actualizada.",
    });
  } catch (error) {
    if (uploadedUrl) await removeOwnedBlob(uploadedUrl);
    console.error("No se pudo guardar la foto de perfil", error);
    return json(
      {
        success: false,
        error: "No se pudo guardar la foto. Intentá nuevamente.",
      },
      500,
    );
  }
}

export async function PUT(request: Request) {
  const auth = await authorize(request);
  if (auth.response || !auth.session) return auth.response!;
  try {
    const input = (await request.json().catch(() => null)) as {
      avatarId?: unknown;
    } | null;
    const avatar =
      typeof input?.avatarId === "string"
        ? profileAvatarById(input.avatarId)
        : undefined;
    if (!avatar)
      return json(
        { success: false, error: "El avatar seleccionado no es válido." },
        400,
      );
    const student = auth.session.credential.student.data as unknown as Student;
    await prisma.studentRecord.update({
      where: { id: auth.session.studentId },
      data: { data: { ...student, profileImageUrl: avatar.src } },
    });
    await removeOwnedBlob(student.profileImageUrl ?? "");
    return json({
      success: true,
      photoUrl: avatar.src,
      url: avatar.src,
      message: "Avatar actualizado correctamente.",
    });
  } catch (error) {
    console.error("No se pudo guardar el avatar de perfil", error);
    return json(
      { success: false, error: "No se pudo guardar el avatar." },
      500,
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if (auth.response || !auth.session) return auth.response!;
  try {
    const student = auth.session.credential.student.data as unknown as Student;
    await prisma.studentRecord.update({
      where: { id: auth.session.studentId },
      data: { data: { ...student, profileImageUrl: "" } },
    });
    await removeOwnedBlob(student.profileImageUrl ?? "");
    return json({
      success: true,
      photoUrl: "",
      url: "",
      message: "Foto eliminada correctamente.",
    });
  } catch (error) {
    console.error("No se pudo eliminar la foto de perfil", error);
    return json(
      { success: false, error: "No se pudo eliminar la foto." },
      500,
    );
  }
}

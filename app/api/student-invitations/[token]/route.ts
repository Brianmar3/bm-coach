import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordValidationError, validRequestOrigin } from "@/lib/portal-auth";
import { duplicatePhone, normalizePhone, studentJsonData, type ParsedStudentInput } from "@/lib/student-enrollment";
import { recordInitialStudentHistory } from "@/lib/student-history";
import { assertTrainerCanAddStudent, TrainerStudentLimitError } from "@/lib/trainer-plan-limits-server";
import { activeStudentInvitation, invitationUnavailableMessage, studentInvitationWorkspaceAccess } from "@/lib/student-invitations-server";
import { parseStudentInvitationRegistration, studentInvitationTokenHash } from "@/lib/student-invitations";

export const runtime = "nodejs";

class RegistrationConflict extends Error { constructor(message: string) { super(message); } }

export async function POST(request: Request, context: RouteContext<"/api/student-invitations/[token]">) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const { token } = await context.params;
  const raw = await request.text();
  if (raw.length > 4096) return Response.json({ error: "Solicitud demasiado grande." }, { status: 413 });
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return Response.json({ error: "Datos inválidos." }, { status: 400 }); }
  const parsed = parseStudentInvitationRegistration(value);
  if (!parsed.input) return Response.json({ error: parsed.error }, { status: 400 });
  const input = parsed.input;
  const passwordError = passwordValidationError(input.password);
  if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
  const initial = await activeStudentInvitation(token);
  const unavailable = invitationUnavailableMessage(initial);
  if (unavailable) return Response.json({ error: unavailable }, { status: 410 });
  try {
    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction(async (tx) => {
      // Serializes invitation and capacity checks for this professional workspace.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${initial!.workspaceId}, 0))`;
      const invitation = await activeStudentInvitation(token, tx);
      const error = invitationUnavailableMessage(invitation);
      if (error) throw new RegistrationConflict(error);
      if (!await studentInvitationWorkspaceAccess(invitation!.workspaceId, invitation!.inviterId, tx)) throw new RegistrationConflict("Este espacio no está disponible para nuevas altas.");
      await assertTrainerCanAddStudent(invitation!.workspaceId, tx);
      if (await tx.studentPortalCredential.findUnique({ where: { username: input.username }, select: { studentId: true } })) throw new RegistrationConflict("Ese usuario ya existe. Elegí otro.");
      const phoneNormalized = normalizePhone(input.phone);
      if (await duplicatePhone(tx, invitation!.workspaceId, phoneNormalized)) throw new RegistrationConflict("Ya existe un alumno con ese teléfono en este espacio.");
      const claimed = await tx.studentInvitation.updateMany({ where: { id: invitation!.id, tokenHash: studentInvitationTokenHash(token), status: "PENDING", usedAt: null, expiresAt: { gt: new Date() } }, data: { status: "USED", usedAt: new Date() } });
      if (claimed.count !== 1) throw new RegistrationConflict("Este enlace ya fue utilizado o venció.");
      const joinedAt = new Date().toISOString().slice(0, 10);
      const studentInput: ParsedStudentInput = { firstName: input.firstName, lastName: input.lastName, phone: input.phone, birthDate: input.birthDate, email: "", weight: 0, height: 0, goal: "", plan: "", planId: "", monthlyFee: 0, joinedAt, dueDate: "", status: "activo", serviceType: "PERSONALIZED", notes: "", studentType: "Adulto", responsibleName: "", responsiblePhone: "", responsibleRelation: "", scheduleId: "", scheduleIds: [], flexibleSchedule: "" };
      const studentId = randomUUID();
      await tx.studentRecord.create({ data: { id: studentId, workspaceId: invitation!.workspaceId, phoneNormalized, serviceType: studentInput.serviceType, data: { ...studentJsonData(studentInput), onboardingCompleted: false }, portalCredential: { create: { username: input.username, passwordHash, active: true, mustChangePassword: false } } } });
      await recordInitialStudentHistory(tx, studentId, studentInput);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    return Response.json({ message: "Tu cuenta fue creada.", loginUrl: "/portal/login" }, { status: 201 });
  } catch (error) {
    if (error instanceof TrainerStudentLimitError) return Response.json({ error: "Este espacio alcanzó el máximo de alumnos permitido por su plan." }, { status: 409 });
    if (error instanceof RegistrationConflict) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "El usuario o el teléfono ya están registrados." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "Hubo otra alta simultánea. Intentá nuevamente." }, { status: 409 });
    console.error("No se pudo completar invitación de alumno", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "No se pudo crear la cuenta. Intentá nuevamente." }, { status: 500 });
  }
}

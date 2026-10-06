import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type OfflineIdentity = { studentId: string; workspaceId: string; sessionId: string };
export type OfflineProgramProof = OfflineIdentity & { issuedAt: string; expiresAt: string; assignment: unknown; sessionIds?: string[] };
function signature(value: string) {
  const secret = process.env.BM_COACH_ADMIN_TOKEN;
  if (!secret || secret.length < 32) throw new Error("No hay una clave segura para preparar entrenamientos offline.");
  return createHmac("sha256", secret).update(`bm-offline-program-v1:${value}`).digest("base64url");
}
export function signOfflineProgram(value: OfflineProgramProof) {
  const encoded = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}
export function verifyOfflineProgram(proof: string, identity: OfflineIdentity): OfflineProgramProof | null {
  try {
    if (typeof proof !== "string" || proof.length > 2_000_000) return null;
    const [encoded, provided, extra] = proof.split(".");
    if (!encoded || !provided || extra) return null;
    const expected = Buffer.from(signature(encoded));
    const actual = Buffer.from(provided);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString()) as OfflineProgramProof;
    // A new authenticated session of the SAME account may recover pending records.
    // The original session remains part of the download scope and idempotency key.
    return value.studentId === identity.studentId && value.workspaceId === identity.workspaceId && typeof value.sessionId === "string" && Number.isFinite(Date.parse(value.issuedAt)) && Number.isFinite(Date.parse(value.expiresAt)) && value.issuedAt < value.expiresAt ? value : null;
  } catch { return null; }
}
export function offlineWorkoutServerId(identity: OfflineIdentity, clientId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(clientId)) throw new Error("Identificador offline inválido.");
  return `offline_${createHash("sha256").update(`${identity.workspaceId}:${identity.studentId}:${identity.sessionId}:${clientId}`).digest("hex")}`;
}

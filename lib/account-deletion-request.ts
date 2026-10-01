import { createHash } from "node:crypto";

export const ACCOUNT_DELETION_BODY = "Solicitud administrativa: eliminación de cuenta y datos asociados.";

export function accountDeletionRequestId(studentId: string) {
  return `account-deletion-${createHash("sha256").update(studentId).digest("hex").slice(0, 32)}`;
}

export function isAccountDeletionRequest(record: { id: string; studentId: string }) {
  return record.id === accountDeletionRequestId(record.studentId);
}

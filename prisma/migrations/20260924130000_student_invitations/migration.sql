CREATE TYPE "StudentInvitationStatus" AS ENUM ('PENDING', 'USED', 'REVOKED');

CREATE TABLE "student_invitations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenCiphertext" TEXT NOT NULL,
    "status" "StudentInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_invitations_tokenHash_key" ON "student_invitations"("tokenHash");
CREATE INDEX "student_invitations_workspaceId_status_expiresAt_idx" ON "student_invitations"("workspaceId", "status", "expiresAt");
ALTER TABLE "student_invitations" ADD CONSTRAINT "student_invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_invitations" ADD CONSTRAINT "student_invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

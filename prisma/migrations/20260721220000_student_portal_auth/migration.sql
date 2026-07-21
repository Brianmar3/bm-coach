CREATE TABLE "student_portal_credentials" (
    "studentId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_portal_credentials_pkey" PRIMARY KEY ("studentId")
);

CREATE TABLE "student_portal_sessions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_portal_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_portal_credentials_username_key" ON "student_portal_credentials"("username");
CREATE UNIQUE INDEX "student_portal_sessions_tokenHash_key" ON "student_portal_sessions"("tokenHash");
CREATE INDEX "student_portal_sessions_studentId_idx" ON "student_portal_sessions"("studentId");
CREATE INDEX "student_portal_sessions_expiresAt_idx" ON "student_portal_sessions"("expiresAt");

ALTER TABLE "student_portal_credentials" ADD CONSTRAINT "student_portal_credentials_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_portal_sessions" ADD CONSTRAINT "student_portal_sessions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_portal_credentials"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;

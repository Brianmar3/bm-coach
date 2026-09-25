-- Native FCM device registrations remain separate from Web Push subscriptions.
CREATE TABLE "student_native_push_devices" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'ANDROID',
    "deviceLabel" TEXT,
    "userAgent" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_native_push_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trainer_native_push_devices" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL DEFAULT 'coach',
    "appId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'ANDROID',
    "deviceLabel" TEXT,
    "userAgent" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_native_push_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_native_push_devices_appId_token_key"
ON "student_native_push_devices"("appId", "token");

CREATE INDEX "student_native_push_devices_studentId_active_idx"
ON "student_native_push_devices"("studentId", "active");

CREATE UNIQUE INDEX "trainer_native_push_devices_appId_token_key"
ON "trainer_native_push_devices"("appId", "token");

CREATE INDEX "trainer_native_push_devices_workspaceId_active_idx"
ON "trainer_native_push_devices"("workspaceId", "active");

ALTER TABLE "student_native_push_devices"
ADD CONSTRAINT "student_native_push_devices_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trainer_native_push_devices"
ADD CONSTRAINT "trainer_native_push_devices_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

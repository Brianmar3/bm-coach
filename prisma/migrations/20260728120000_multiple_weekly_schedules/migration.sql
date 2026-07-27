-- Permite conservar asignaciones históricas cuando un alumno deja un horario.
-- Los registros existentes permanecen activos por defecto.
ALTER TABLE "weekly_class_assignments"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "endedAt" TIMESTAMP(3);

-- Conserva el horario principal legado como primera asignación cuando todavía
-- no existía una fila equivalente en la tabla intermedia.
INSERT INTO "weekly_class_assignments" ("scheduleId", "studentId", "assignedAt", "active", "endedAt")
SELECT "primaryScheduleId", "id", CURRENT_TIMESTAMP, true, NULL
FROM "students"
WHERE "primaryScheduleId" IS NOT NULL
ON CONFLICT ("scheduleId", "studentId") DO NOTHING;

CREATE INDEX IF NOT EXISTS "weekly_class_assignments_studentId_active_idx"
ON "weekly_class_assignments"("studentId", "active");

CREATE TYPE "ClassWeekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

CREATE TABLE "weekly_class_schedules" (
    "id" TEXT NOT NULL,
    "dayOfWeek" "ClassWeekday" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "classType" TEXT NOT NULL,
    "capacity" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_class_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "weekly_class_assignments" (
    "scheduleId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_class_assignments_pkey" PRIMARY KEY ("scheduleId", "studentId")
);

CREATE INDEX "weekly_class_schedules_dayOfWeek_startTime_idx"
    ON "weekly_class_schedules"("dayOfWeek", "startTime");

CREATE INDEX "weekly_class_schedules_active_idx"
    ON "weekly_class_schedules"("active");

CREATE INDEX "weekly_class_assignments_studentId_idx"
    ON "weekly_class_assignments"("studentId");

ALTER TABLE "weekly_class_assignments"
    ADD CONSTRAINT "weekly_class_assignments_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "weekly_class_schedules"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_class_assignments"
    ADD CONSTRAINT "weekly_class_assignments_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the dated-class table and seed recurring templates from compatible
-- Monday-to-Friday records. Historical and weekend records remain untouched.
INSERT INTO "weekly_class_schedules" (
    "id", "dayOfWeek", "startTime", "endTime", "classType", "capacity",
    "active", "createdAt", "updatedAt"
)
SELECT
    c."id",
    CASE EXTRACT(ISODOW FROM c."date")::INTEGER
        WHEN 1 THEN 'MONDAY'::"ClassWeekday"
        WHEN 2 THEN 'TUESDAY'::"ClassWeekday"
        WHEN 3 THEN 'WEDNESDAY'::"ClassWeekday"
        WHEN 4 THEN 'THURSDAY'::"ClassWeekday"
        WHEN 5 THEN 'FRIDAY'::"ClassWeekday"
    END,
    c."startTime",
    c."endTime",
    c."title",
    CASE WHEN c."capacity" > 0 THEN c."capacity" ELSE NULL END,
    LOWER(c."status") NOT IN ('cancelada', 'cancelado', 'finalizada', 'inactiva', 'inactivo'),
    c."createdAt",
    c."updatedAt"
FROM "classes" c
WHERE EXTRACT(ISODOW FROM c."date") BETWEEN 1 AND 5
ON CONFLICT ("id") DO NOTHING;

-- Old records stored names in JSON. Link only exact student IDs or exact full
-- names so ambiguous values are never assigned to the wrong student.
INSERT INTO "weekly_class_assignments" ("scheduleId", "studentId", "assignedAt")
SELECT DISTINCT c."id", s."id", c."createdAt"
FROM "classes" c
CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(c."students") = 'array' THEN c."students" ELSE '[]'::jsonb END
) AS legacy_student("value")
JOIN "students" s
  ON legacy_student."value" = s."id"
  OR LOWER(BTRIM(legacy_student."value")) = LOWER(BTRIM(CONCAT_WS(' ', s."data"->>'firstName', s."data"->>'lastName')))
WHERE EXTRACT(ISODOW FROM c."date") BETWEEN 1 AND 5
ON CONFLICT ("scheduleId", "studentId") DO NOTHING;

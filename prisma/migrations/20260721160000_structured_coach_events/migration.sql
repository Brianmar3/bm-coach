CREATE TYPE "CoachEventType" AS ENUM ('EVALUACION', 'REUNION', 'COMPETENCIA', 'RECORDATORIO');
CREATE TYPE "CoachEventStatus" AS ENUM ('PENDIENTE', 'COMPLETADO');

CREATE TABLE "coach_events" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "date" TIMESTAMP(3) NOT NULL,
  "time" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#facc15',
  "type" "CoachEventType" NOT NULL,
  "status" "CoachEventStatus" NOT NULL DEFAULT 'PENDIENTE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "coach_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coach_events_date_time_idx" ON "coach_events"("date", "time");
CREATE INDEX "coach_events_status_idx" ON "coach_events"("status");

CREATE TYPE "TrainingRoutineKind" AS ENUM ('ASSIGNED', 'TEMPLATE');

ALTER TABLE "training_routines"
ADD COLUMN "kind" "TrainingRoutineKind" NOT NULL DEFAULT 'ASSIGNED',
ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN "location" TEXT NOT NULL DEFAULT '',
ADD COLUMN "equipment" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "training_routine_days"
ADD COLUMN "objective" TEXT NOT NULL DEFAULT '',
ADD COLUMN "observations" TEXT NOT NULL DEFAULT '';

ALTER TABLE "training_routine_exercises"
ADD COLUMN "tempo" TEXT,
ADD COLUMN "alternativeExercise" TEXT,
ADD COLUMN "equipment" TEXT,
ADD COLUMN "optional" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "training_routines_kind_status_idx"
ON "training_routines"("kind", "status");

CREATE TABLE "physical_evaluations" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weight" DECIMAL(7,2),
    "height" DECIMAL(5,2),
    "bodyFatPercentage" DECIMAL(5,2),
    "muscleMass" DECIMAL(7,2),
    "visceralFat" DECIMAL(5,2),
    "waist" DECIMAL(7,2),
    "hip" DECIMAL(7,2),
    "chest" DECIMAL(7,2),
    "rightArm" DECIMAL(7,2),
    "leftArm" DECIMAL(7,2),
    "rightThigh" DECIMAL(7,2),
    "leftThigh" DECIMAL(7,2),
    "rightCalf" DECIMAL(7,2),
    "leftCalf" DECIMAL(7,2),
    "notes" TEXT NOT NULL DEFAULT '',
    "frontPhotoUrl" TEXT,
    "sidePhotoUrl" TEXT,
    "backPhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physical_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "physical_evaluations_studentId_date_idx" ON "physical_evaluations"("studentId", "date");

ALTER TABLE "physical_evaluations" ADD CONSTRAINT "physical_evaluations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

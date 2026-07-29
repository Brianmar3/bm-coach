CREATE TYPE "StudentServiceType" AS ENUM ('CLASSES', 'PERSONALIZED', 'MIXED');

ALTER TABLE "students"
ADD COLUMN "serviceType" "StudentServiceType" NOT NULL DEFAULT 'CLASSES';

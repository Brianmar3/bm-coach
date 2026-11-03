-- Additive only. No attendance states or historical rows are changed.
ALTER TABLE "trainer_notifications"
  ADD COLUMN "reaction" TEXT,
  ADD COLUMN "reactedAt" TIMESTAMP(3),
  ADD CONSTRAINT "trainer_notifications_reaction_check"
    CHECK ("reaction" IS NULL OR "reaction" IN ('RECEIVED', 'THANKS', 'SEE_YOU'));

ALTER TABLE "class_occurrence_attendances"
  ADD COLUMN "classRating" TEXT,
  ADD COLUMN "classComment" TEXT,
  ADD COLUMN "classFeedbackAt" TIMESTAMP(3),
  ADD COLUMN "classFeedbackSkippedAt" TIMESTAMP(3),
  ADD CONSTRAINT "class_occurrence_attendances_rating_check"
    CHECK ("classRating" IS NULL OR "classRating" IN ('EXCELLENT', 'GOOD', 'IMPROVE')),
  ADD CONSTRAINT "class_occurrence_attendances_comment_check"
    CHECK ("classComment" IS NULL OR char_length("classComment") <= 1000);

-- The existing UNIQUE (occurrenceId, studentId) enforces one opinion per student/class.

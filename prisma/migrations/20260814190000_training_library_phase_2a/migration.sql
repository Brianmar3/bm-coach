CREATE TYPE "TrainingLibraryItemStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "training_library_folders" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "status" "TrainingLibraryItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_library_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_library_tags" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_library_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_block_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "TrainingBlockType" NOT NULL,
  "content" JSONB NOT NULL,
  "folderId" TEXT,
  "status" "TrainingLibraryItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "isFavorite" BOOLEAN NOT NULL DEFAULT false,
  "lastUsedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_block_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_block_template_tags" (
  "blockTemplateId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  CONSTRAINT "training_block_template_tags_pkey" PRIMARY KEY ("blockTemplateId", "tagId")
);

CREATE UNIQUE INDEX "training_library_folders_normalizedName_key" ON "training_library_folders"("normalizedName");
CREATE INDEX "training_library_folders_status_name_idx" ON "training_library_folders"("status", "name");
CREATE UNIQUE INDEX "training_library_tags_normalizedName_key" ON "training_library_tags"("normalizedName");
CREATE INDEX "training_block_templates_status_updatedAt_idx" ON "training_block_templates"("status", "updatedAt");
CREATE INDEX "training_block_templates_folderId_status_idx" ON "training_block_templates"("folderId", "status");
CREATE INDEX "training_block_templates_type_status_idx" ON "training_block_templates"("type", "status");
CREATE INDEX "training_block_template_tags_tagId_idx" ON "training_block_template_tags"("tagId");

ALTER TABLE "training_block_templates" ADD CONSTRAINT "training_block_templates_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "training_library_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_block_template_tags" ADD CONSTRAINT "training_block_template_tags_blockTemplateId_fkey" FOREIGN KEY ("blockTemplateId") REFERENCES "training_block_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_block_template_tags" ADD CONSTRAINT "training_block_template_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "training_library_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

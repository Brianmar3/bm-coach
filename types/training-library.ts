import type { BlockInput } from "@/lib/rutinas";
import type { TrainingBlockType } from "@/types/gestion";

export type TrainingLibraryStatus = "active" | "archived";
export type TrainingLibraryView = "all" | "favorites" | "recent";

export type TrainingLibraryFolder = {
  id: string;
  name: string;
  status: TrainingLibraryStatus;
  blockCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TrainingLibraryBlock = {
  id: string;
  name: string;
  type: TrainingBlockType;
  content: BlockInput;
  folder: { id: string; name: string } | null;
  tags: string[];
  status: TrainingLibraryStatus;
  isFavorite: boolean;
  lastUsedAt: string;
  archivedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type TrainingLibraryBlockPayload = {
  name: string;
  folderId: string;
  tags: string[];
  block: BlockInput;
};

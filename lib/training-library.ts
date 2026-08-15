import type { BlockInput } from "./rutinas.ts";
import { validateBlock } from "./rutinas.ts";
import { canonicalTrainingLibraryBlock } from "./training-library-block-draft.ts";
import type { TrainingLibraryBlock, TrainingLibraryBlockPayload, TrainingLibraryFolder, TrainingLibraryStatus, TrainingLibraryView } from "../types/training-library.ts";

const maximumTags = 20;

export function normalizeLibraryText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
}

export function normalizedLibraryTags(values: string[]) {
  const unique = new Map<string, string>();
  for (const raw of values) {
    const name = raw.replace(/\s+/g, " ").trim();
    const normalized = normalizeLibraryText(name);
    if (name && normalized && !unique.has(normalized)) unique.set(normalized, name);
  }
  return [...unique.entries()].map(([normalizedName, name]) => ({ name, normalizedName }));
}

export function appendNormalizedLibraryTags(current: string[], input: string, maximum = maximumTags) {
  return normalizedLibraryTags([...current, ...input.split(",")])
    .filter((tag) => tag.name.length <= 60)
    .slice(0, maximum)
    .map((tag) => tag.name);
}

export function validateLibraryFolderName(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80) return "Ingresá un nombre de carpeta de hasta 80 caracteres.";
  return null;
}

export function validateLibraryBlockPayload(input: TrainingLibraryBlockPayload) {
  if (!input || typeof input !== "object") return "Los datos del bloque no son válidos.";
  if (!input.name?.trim() || input.name.trim().length > 120) return "Ingresá un nombre de bloque de hasta 120 caracteres.";
  if (typeof input.folderId !== "string") return "La carpeta seleccionada no es válida.";
  if (!Array.isArray(input.tags)) return "Las etiquetas no son válidas.";
  const tags = normalizedLibraryTags(input.tags);
  if (tags.length > maximumTags || tags.some((tag) => tag.name.length > 60)) return "Usá hasta 20 etiquetas de 60 caracteres.";
  if (!input.block || typeof input.block !== "object") return "El contenido del bloque no es válido.";
  return validateBlock({ ...input.block, name: input.name.trim(), order: 1 });
}

export function cleanLibraryBlockPayload(input: TrainingLibraryBlockPayload): TrainingLibraryBlockPayload {
  const name = input.name.trim();
  return {
    name,
    folderId: input.folderId.trim(),
    tags: normalizedLibraryTags(input.tags).map((tag) => tag.name),
    block: canonicalTrainingLibraryBlock(input.block, name),
  };
}

export function filterTrainingLibraryBlocks(blocks: TrainingLibraryBlock[], filters: { query: string; folderId: string; type: string; tag: string; status: TrainingLibraryStatus; view?: TrainingLibraryView }) {
  const query = normalizeLibraryText(filters.query);
  const tag = filters.tag === "all" ? "" : normalizeLibraryText(filters.tag);
  const view = filters.view ?? "all";
  return blocks.filter((block) => {
    if (block.status !== filters.status) return false;
    if (view === "favorites" && !block.isFavorite) return false;
    if (view === "recent" && !block.lastUsedAt) return false;
    if (filters.folderId === "unfiled" && block.folder) return false;
    if (filters.folderId && filters.folderId !== "all" && filters.folderId !== "unfiled" && block.folder?.id !== filters.folderId) return false;
    if (filters.type && filters.type !== "all" && block.type !== filters.type) return false;
    if (tag && !block.tags.some((value) => normalizeLibraryText(value) === tag)) return false;
    if (!query) return true;
    return normalizeLibraryText(`${block.name} ${block.type} ${block.folder?.name ?? ""} ${block.tags.join(" ")}`).includes(query);
  }).sort((left, right) => view === "recent"
    ? Date.parse(right.lastUsedAt) - Date.parse(left.lastUsedAt)
    : Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function trainingLibraryLastUsedLabel(value: string, now = new Date()) {
  if (!value) return "";
  const used = new Date(value);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const usedDay = new Date(used.getFullYear(), used.getMonth(), used.getDate());
  const days = Math.round((today.getTime() - usedDay.getTime()) / 86_400_000);
  if (days <= 0) return "Usado hoy";
  if (days === 1) return "Usado ayer";
  return `Usado hace ${days} días`;
}

export function serializeLibraryFolder(record: { id: string; name: string; status: "ACTIVE" | "ARCHIVED"; createdAt: Date; updatedAt: Date; _count: { blockTemplates: number } }): TrainingLibraryFolder {
  return { id: record.id, name: record.name, status: record.status === "ACTIVE" ? "active" : "archived", blockCount: record._count.blockTemplates, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() };
}

export function serializeLibraryBlock(record: {
  id: string; name: string; type: TrainingLibraryBlock["type"]; content: unknown; status: "ACTIVE" | "ARCHIVED"; isFavorite: boolean; lastUsedAt: Date | null; archivedAt: Date | null; createdAt: Date; updatedAt: Date;
  folder: { id: string; name: string } | null; tags: Array<{ tag: { name: string } }>;
}): TrainingLibraryBlock {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    content: record.content as BlockInput,
    folder: record.folder,
    tags: record.tags.map((item) => item.tag.name),
    status: record.status === "ACTIVE" ? "active" : "archived",
    isFavorite: record.isFavorite,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? "",
    archivedAt: record.archivedAt?.toISOString() ?? "",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

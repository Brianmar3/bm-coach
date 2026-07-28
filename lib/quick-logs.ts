import type { Prisma } from "@prisma/client";

export const QUICK_LOG_TYPES = ["WORKOUT", "NOTE", "PROGRESS", "PHOTO"] as const;
export const QUICK_LOG_CATEGORIES = ["técnica", "energía", "molestia", "alimentación", "descanso", "recordatorio", "general", "progreso físico", "ejercicio", "clase", "postura", "otra"] as const;
export const QUICK_LOG_METRICS = ["peso", "repeticiones", "series", "tiempo", "distancia", "técnica", "percepción personal"] as const;
export const MAX_QUICK_LOG_PHOTO_BYTES = 3 * 1024 * 1024;

export function detectedImageType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return { mime: "image/png", extension: "png" };
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}

export function quickLogJson(log: {
  id: string; type: string; title: string; content: string; category: string; date: Date; durationMinutes: number | null;
  exerciseName: string; metricType: string; previousValue: Prisma.Decimal | null; currentValue: Prisma.Decimal | null;
  unit: string; mood: string; hasPain: boolean; painDetails: string; createdAt: Date; updatedAt: Date;
  photos: Array<{ id: string; blobUrl: string; blobPathname: string; createdAt: Date }>;
}) {
  return {
    ...log,
    date: log.date.toISOString().slice(0, 10),
    previousValue: log.previousValue === null ? null : Number(log.previousValue),
    currentValue: log.currentValue === null ? null : Number(log.currentValue),
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
    photos: log.photos.map((photo) => ({ ...photo, createdAt: photo.createdAt.toISOString() })),
  };
}

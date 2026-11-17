import type { TrainingRoutineBlock } from "@prisma/client";

export type ClassNote = {
  name: string;
  modality: string;
  blocks: { name: string; text: string }[];
};

export function classModality(tags: string[]) {
  return tags.find((tag) => tag.toLocaleLowerCase("es").startsWith("tipo de clase:"))?.slice("tipo de clase:".length).trim() || "Otra";
}

export function classNoteSnapshot(routine: {
  name: string;
  tags: string[];
  days: { blocks: (Pick<TrainingRoutineBlock, "name" | "instructions" | "order"> & { exercises?: { name: string; sets?: number; repetitions?: string; observations?: string }[] })[]; warmup: string; observations: string }[];
}): ClassNote {
  const day = routine.days[0];
  const blocks = [...(day?.blocks ?? [])].sort((a, b) => a.order - b.order).map((block) => ({
    name: block.name,
    text: [block.instructions, ...(block.exercises ?? []).map((exercise) => `${exercise.name}${exercise.sets ? ` · ${exercise.sets} series` : ""}${exercise.repetitions ? ` · ${exercise.repetitions} repeticiones` : ""}${exercise.observations ? ` · ${exercise.observations}` : ""}`)].filter(Boolean).join("\n"),
  }));
  if (day?.warmup && !blocks.some((block) => block.name === "Entrada en calor")) blocks.unshift({ name: "Entrada en calor", text: day.warmup });
  if (day?.observations && !blocks.some((block) => block.name === "Observaciones")) blocks.push({ name: "Observaciones", text: day.observations });
  return { name: routine.name, modality: classModality(routine.tags), blocks };
}

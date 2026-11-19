export type RoutineCreationStep = "origin" | "blocks" | "assembly" | "blockBasics" | "scratch" | "class" | "routine";

export function previousRoutineCreationStep(step: RoutineCreationStep): RoutineCreationStep | null {
  if (step === "blockBasics") return "assembly";
  if (step === "assembly") return "blocks";
  if (step !== "origin") return "origin";
  return null;
}

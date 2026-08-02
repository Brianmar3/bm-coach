export type WorkoutStructuralInstruction = {
  label: "SUPERSERIE" | "BISERIE" | "TRISERIE" | "CIRCUITO" | "EJERCICIO COMPLEMENTARIO";
  text: string;
};

const explicitPatterns: Array<{
  pattern: RegExp;
  label: WorkoutStructuralInstruction["label"];
}> = [
  { pattern: /^superserie\b\s*[:\-–—]?\s*/i, label: "SUPERSERIE" },
  { pattern: /^biserie\b\s*[:\-–—]?\s*/i, label: "BISERIE" },
  { pattern: /^triserie\b\s*[:\-–—]?\s*/i, label: "TRISERIE" },
  { pattern: /^circuito\b\s*[:\-–—]?\s*/i, label: "CIRCUITO" },
  { pattern: /^ejercicio\s+complementario\b\s*[:\-–—]?\s*/i, label: "EJERCICIO COMPLEMENTARIO" },
];

function normalizedKey(value: string) {
  return value.toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
}

export function separateWorkoutInstructions(observations?: string | null) {
  const original = observations?.trim() ?? "";
  if (!original) return { structural: [] as WorkoutStructuralInstruction[], technicalText: "" };

  const structural: WorkoutStructuralInstruction[] = [];
  const technical: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of original.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let instruction: WorkoutStructuralInstruction | null = null;
    const explicit = explicitPatterns.find(({ pattern }) => pattern.test(line));
    if (explicit) {
      const text = line.replace(explicit.pattern, "").trim();
      instruction = { label: explicit.label, text: text || line };
    } else if (/^\+\s*/.test(line)) {
      instruction = { label: "EJERCICIO COMPLEMENTARIO", text: line.replace(/^\+\s*/, "").trim() };
    } else if (/^m[aá]s\s+/i.test(line)) {
      instruction = { label: "EJERCICIO COMPLEMENTARIO", text: line.replace(/^m[aá]s\s+/i, "").trim() };
    }

    if (!instruction?.text) {
      technical.push(line);
      continue;
    }

    const key = `${instruction.label}:${normalizedKey(instruction.text)}`;
    if (!seen.has(key)) {
      seen.add(key);
      structural.push(instruction);
    }
  }

  return { structural, technicalText: technical.join("\n") };
}

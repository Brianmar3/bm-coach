export type ListShortcut = { kind: "bullet" } | { kind: "ordered"; start: number };

export function listShortcut(beforeCaret: string): ListShortcut | null {
  if (beforeCaret === "*" || beforeCaret === "-") return { kind: "bullet" };
  const ordered = /^([1-9]\d{0,3})[.-]$/.exec(beforeCaret);
  return ordered ? { kind: "ordered", start: Number(ordered[1]) } : null;
}

export function separatorShortcut(beforeCaret: string, afterCaret: string) {
  return beforeCaret === "---" && afterCaret.length === 0;
}

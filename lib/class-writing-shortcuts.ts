export type ListShortcut = { kind: "bullet" } | { kind: "ordered"; start: number };

export function listShortcut(beforeCaret: string): ListShortcut | null {
  if (beforeCaret === "*" || beforeCaret === "-") return { kind: "bullet" };
  const ordered = /^([1-9]\d{0,3})[.-]$/.exec(beforeCaret);
  return ordered ? { kind: "ordered", start: Number(ordered[1]) } : null;
}

export function separatorShortcut(beforeCaret: string, afterCaret: string) {
  return beforeCaret === "---" && afterCaret.length === 0;
}

export function blockShortcut(beforeCaret: string): "h1" | "h2" | "h3" | "blockquote" | null {
  if (beforeCaret === ">") return "blockquote";
  if (beforeCaret === "#") return "h1";
  if (beforeCaret === "##") return "h2";
  if (beforeCaret === "###") return "h3";
  return null;
}

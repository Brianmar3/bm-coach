export function continueNumberedList(text: string, start: number, end: number) {
  if (start !== end) return null;
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const before = text.slice(lineStart, start);
  const after = text.slice(start).split("\n", 1)[0];
  const match = /^(\s*)(\d+)([.-])(\s*)(.*)$/.exec(before);
  if (!match || after.trim()) return null;
  const [, indent, number, separator, spacing, item] = match;
  if (!item.trim()) return { text: text.slice(0, lineStart) + indent + text.slice(start), cursor: lineStart + indent.length };
  const insertion = `\n${indent}${Number(number) + 1}${separator}${spacing || " "}`;
  return { text: text.slice(0, start) + insertion + text.slice(end), cursor: start + insertion.length };
}

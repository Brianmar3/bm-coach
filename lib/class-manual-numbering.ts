const manualPrefix = /^(\s*)(\d+)([.-])(\s+|$)/;

export function renumberManualLines(lines: string[]): string[] {
  if (!lines.length) return [];
  const first = manualPrefix.exec(lines[0]);
  if (!first) return lines;
  let expected = Number(first[2]);
  return lines.map((line) => {
    const match = manualPrefix.exec(line);
    if (!match || match[1] !== first[1] || match[3] !== first[3]) return line;
    const result = `${match[1]}${expected}${line.slice(match[1].length + match[2].length)}`;
    expected += 1;
    return result;
  });
}

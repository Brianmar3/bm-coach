export const CLASS_RICH_PREFIX = "BM_CLASS_RICH_V1:";

export type ClassRichNode = { t: "text"; x: string } | { t: "p" | "h1" | "h2" | "h3" | "blockquote" | "ul" | "ol" | "li" | "strong" | "em" | "u" | "s" | "br" | "hr"; c: ClassRichNode[]; a?: "left" | "center" | "right"; i?: number; n?: number };

const allowed = new Set(["p", "h1", "h2", "h3", "blockquote", "ul", "ol", "li", "strong", "em", "u", "s", "br", "hr"]);
const blocks = new Set(["p", "h1", "h2", "h3", "blockquote", "ul", "ol", "li"]);

function validNode(value: unknown, depth: number): value is ClassRichNode {
  if (depth > 16 || !value || typeof value !== "object") return false;
  const node = value as { t?: unknown; x?: unknown; c?: unknown; a?: unknown; i?: unknown; n?: unknown };
  if (node.t === "text") return typeof node.x === "string" && node.x.length <= 12000;
  return typeof node.t === "string" && allowed.has(node.t) && (node.a === undefined || ["left", "center", "right"].includes(String(node.a))) && (node.i === undefined || (Number.isInteger(node.i) && Number(node.i) >= 0 && Number(node.i) <= 8)) && (node.n === undefined || (node.t === "ol" && Number.isInteger(node.n) && Number(node.n) >= 1 && Number(node.n) <= 9999)) && Array.isArray(node.c) && node.c.length <= 500 && node.c.every((child) => validNode(child, depth + 1));
}

export function decodeClassRichText(value: string): ClassRichNode[] | null {
  if (!value.startsWith(CLASS_RICH_PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(value.slice(CLASS_RICH_PREFIX.length));
    if (!Array.isArray(parsed) || parsed.length > 500 || !parsed.every((node) => validNode(node, 0))) return null;
    return parsed;
  } catch { return null; }
}

export function encodeClassRichText(nodes: ClassRichNode[]) {
  return CLASS_RICH_PREFIX + JSON.stringify(nodes);
}

export function classRichPlainText(value: string): string {
  const nodes = decodeClassRichText(value);
  if (!nodes) return value;
  function walk(node: ClassRichNode): string {
    if (node.t === "text") return node.x;
    if (node.t === "br") return "\n";
    if (node.t === "hr") return "---\n";
    if (node.t === "ol" || node.t === "ul") return node.c.map((child, index) => child.t === "li" ? `${node.t === "ol" ? `${(node.n ?? 1) + index}.` : "•"} ${child.c.map(walk).join("")}\n` : walk(child)).join("");
    const content = node.c.map(walk).join("");
    return blocks.has(node.t) ? content + "\n" : content;
  }
  return nodes.map(walk).join("").replace(/\n+$/, "");
}

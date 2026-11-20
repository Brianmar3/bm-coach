"use client";

import { useEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { classRichPlainText, decodeClassRichText, encodeClassRichText, type ClassRichNode } from "@/lib/class-rich-text";

const blockTags = new Set(["DIV", "P", "H1", "H2", "H3", "BLOCKQUOTE", "UL", "OL", "LI"]);
const allowedTags = new Set(["p", "h1", "h2", "h3", "blockquote", "ul", "ol", "li", "strong", "em", "u", "s", "br"]);

function fromDom(node: Node): ClassRichNode[] {
  if (node.nodeType === Node.TEXT_NODE) return [{ t: "text", x: node.textContent ?? "" }];
  if (!(node instanceof HTMLElement)) return [];
  const tag = node.tagName.toLowerCase();
  const children = [...node.childNodes].flatMap(fromDom);
  const align = node.style.textAlign || node.getAttribute("align") || "";
  const a = align === "center" || align === "right" || align === "left" ? align : undefined;
  const margin = Number.parseFloat(node.style.marginLeft);
  const i = Number.isFinite(margin) && margin > 0 ? Math.min(8, Math.round(margin / 40)) : undefined;
  if (tag === "div") return [{ t: "p", c: children, a, i }];
  if (tag === "b") return [{ t: "strong", c: children }];
  if (tag === "i") return [{ t: "em", c: children }];
  if (tag === "strike" || tag === "del") return [{ t: "s", c: children }];
  if (tag === "span") {
    const marks: ClassRichNode["t"][] = [];
    if (node.style.fontWeight === "bold" || Number(node.style.fontWeight) >= 600) marks.push("strong");
    if (node.style.fontStyle === "italic") marks.push("em");
    if (node.style.textDecoration.includes("underline")) marks.push("u");
    if (node.style.textDecoration.includes("line-through")) marks.push("s");
    return marks.reduceRight<ClassRichNode[]>((current, mark) => [{ t: mark as "strong", c: current }], children);
  }
  if (allowedTags.has(tag)) return [{ t: tag as Exclude<ClassRichNode["t"], "text">, c: children, a, i }];
  return children;
}

function makeDom(node: ClassRichNode): Node {
  if (node.t === "text") return document.createTextNode(node.x);
  const element = document.createElement(node.t);
  if (node.a) element.style.textAlign = node.a;
  if (node.i) element.style.marginLeft = `${node.i * 40}px`;
  node.c.forEach((child) => element.appendChild(makeDom(child)));
  return element;
}

function fillEditor(element: HTMLElement, value: string) {
  element.replaceChildren();
  const rich = decodeClassRichText(value);
  if (rich) rich.forEach((node) => element.appendChild(makeDom(node)));
  else value.split("\n").forEach((line) => { const paragraph = document.createElement("div"); if (line) paragraph.textContent = line; else paragraph.appendChild(document.createElement("br")); element.appendChild(paragraph); });
}

function renderNodes(nodes: ClassRichNode[]): ReactNode {
  return nodes.map((node, index) => {
    if (node.t === "text") return node.x;
    const children = renderNodes(node.c);
    const style = { textAlign: node.a, marginLeft: node.i ? `${node.i * 40}px` : undefined };
    switch (node.t) {
      case "p": return <p key={index} style={style}>{children || <br />}</p>;
      case "h1": return <h1 key={index} style={style}>{children}</h1>;
      case "h2": return <h2 key={index} style={style}>{children}</h2>;
      case "h3": return <h3 key={index} style={style}>{children}</h3>;
      case "blockquote": return <blockquote key={index} style={style}>{children}</blockquote>;
      case "ul": return <ul key={index} style={style}>{children}</ul>;
      case "ol": return <ol key={index} style={style}>{children}</ol>;
      case "li": return <li key={index} style={style}>{children}</li>;
      case "strong": return <strong key={index}>{children}</strong>;
      case "em": return <em key={index}>{children}</em>;
      case "u": return <u key={index}>{children}</u>;
      case "s": return <s key={index}>{children}</s>;
      case "br": return <br key={index} />;
    }
  });
}

export function ClassNotesView({ value, className = "" }: { value: string; className?: string }) {
  const rich = decodeClassRichText(value);
  return <div className={`class-notes-content ${className}`}>{rich ? renderNodes(rich) : <p className="whitespace-pre-wrap">{value}</p>}</div>;
}

type Tool = { label: string; mark: string; command: string; argument?: string };
const tools: Tool[] = [
  { label: "Deshacer", mark: "↶", command: "undo" }, { label: "Rehacer", mark: "↷", command: "redo" },
  { label: "Texto normal", mark: "Tx", command: "formatBlock", argument: "p" },
  { label: "Título 1", mark: "H1", command: "formatBlock", argument: "h1" }, { label: "Título 2", mark: "H2", command: "formatBlock", argument: "h2" }, { label: "Título 3", mark: "H3", command: "formatBlock", argument: "h3" },
  { label: "Negrita", mark: "B", command: "bold" }, { label: "Cursiva", mark: "I", command: "italic" }, { label: "Subrayado", mark: "U", command: "underline" }, { label: "Tachado", mark: "S", command: "strikeThrough" },
  { label: "Lista numerada", mark: "1.", command: "insertOrderedList" }, { label: "Lista con viñetas", mark: "•", command: "insertUnorderedList" },
  { label: "Reducir sangría", mark: "⇤", command: "outdent" }, { label: "Aumentar sangría", mark: "⇥", command: "indent" },
  { label: "Alinear a la izquierda", mark: "☰", command: "justifyLeft" }, { label: "Centrar", mark: "≡", command: "justifyCenter" }, { label: "Alinear a la derecha", mark: "☷", command: "justifyRight" },
  { label: "Cita", mark: "❝", command: "formatBlock", argument: "blockquote" },
];

export function ClassNotesEditor({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectedRange = useRef<Range | null>(null);
  const emitted = useRef<string | null>(null);
  const numberHandled = useRef(false);
  useEffect(() => { if (editorRef.current && value !== emitted.current) fillEditor(editorRef.current, value); }, [value]);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const adjust = () => { if (editorRef.current?.contains(document.activeElement)) requestAnimationFrame(ensureCaretVisible); };
    viewport.addEventListener("resize", adjust);
    return () => viewport.removeEventListener("resize", adjust);
  }, []);
  function ensureCaretVisible() {
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const bottom = top + (viewport?.height ?? window.innerHeight);
    if (rect.bottom > bottom - 24) window.scrollBy({ top: rect.bottom - bottom + 32, behavior: "instant" });
    else if (rect.top < top + 58) window.scrollBy({ top: rect.top - top - 66, behavior: "instant" });
  }
  function emit() {
    if (!editorRef.current) return;
    const next = encodeClassRichText([...editorRef.current.childNodes].flatMap(fromDom));
    if (next.length > 36000 || classRichPlainText(next).length > 12000) { fillEditor(editorRef.current, emitted.current ?? value); return; }
    emitted.current = next;
    onChange(next);
    requestAnimationFrame(ensureCaretVisible);
  }
  function rememberSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) selectedRange.current = selection.getRangeAt(0).cloneRange();
  }
  function command(tool: Tool) {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (selection && selectedRange.current && editorRef.current.contains(selectedRange.current.commonAncestorContainer)) { selection.removeAllRanges(); selection.addRange(selectedRange.current); }
    document.execCommand(tool.command, false, tool.argument);
    rememberSelection(); emit();
  }
  function continueManualNumbering(preventDefault: () => void) {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.isCollapsed) return false;
    let block = selection.anchorNode instanceof HTMLElement ? selection.anchorNode : selection.anchorNode?.parentElement;
    if (!block || block.closest("li")) return false;
    while (block && block !== editorRef.current && !blockTags.has(block.tagName)) block = block.parentElement;
    if (!block || block === editorRef.current) return false;
    const range = selection.getRangeAt(0);
    const before = range.cloneRange(); before.selectNodeContents(block); before.setEnd(range.startContainer, range.startOffset);
    const after = range.cloneRange(); after.selectNodeContents(block); after.setStart(range.startContainer, range.startOffset);
    if (after.toString().trim()) return false;
    const match = /^(\s*)(\d+)([.-])(\s*)(.*)$/.exec(before.toString());
    if (!match) return false;
    preventDefault();
    const [, indent, number, separator, spacing, item] = match;
    if (!item.trim()) { block.textContent = indent; const end = document.createRange(); end.selectNodeContents(block); end.collapse(false); selection.removeAllRanges(); selection.addRange(end); emit(); return true; }
    const next = document.createElement("div"); next.textContent = `${indent}${Number(number) + 1}${separator}${spacing || " "}`;
    block.after(next); const cursor = document.createRange(); cursor.selectNodeContents(next); cursor.collapse(false); selection.removeAllRanges(); selection.addRange(cursor); emit(); return true;
  }
  function onNumberKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (continueManualNumbering(() => event.preventDefault())) { numberHandled.current = true; window.setTimeout(() => { numberHandled.current = false; }, 0); }
  }
  function onNumberBeforeInput(event: FormEvent<HTMLDivElement>) {
    const input = event.nativeEvent as InputEvent;
    if (input.isComposing || !["insertLineBreak", "insertParagraph"].includes(input.inputType)) return;
    if (numberHandled.current) { event.preventDefault(); return; }
    continueManualNumbering(() => event.preventDefault());
  }
  return <div className="class-notes-editor">
    <div role="toolbar" aria-label="Formato de la clase" className="class-notes-toolbar">{tools.map((tool) => <button key={tool.label} type="button" title={tool.label} aria-label={tool.label} disabled={disabled} onPointerDown={rememberSelection} onMouseDown={(event) => event.preventDefault()} onClick={() => command(tool)} className={tool.command === "bold" ? "font-black" : tool.command === "italic" ? "italic" : tool.command === "underline" ? "underline" : tool.command === "strikeThrough" ? "line-through" : ""}>{tool.mark}</button>)}</div>
    <div ref={editorRef} role="textbox" aria-label="Tu clase" aria-multiline="true" contentEditable={!disabled} suppressContentEditableWarning onInput={emit} onKeyDown={onNumberKeyDown} onBeforeInput={onNumberBeforeInput} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onTouchEnd={rememberSelection} onFocus={() => requestAnimationFrame(ensureCaretVisible)} onPaste={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); emit(); }} onDrop={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.dataTransfer.getData("text/plain")); emit(); }} className="class-notes-writing" />
    <p className="class-notes-count">{classRichPlainText(value).length}/12.000 caracteres</p>
  </div>;
}

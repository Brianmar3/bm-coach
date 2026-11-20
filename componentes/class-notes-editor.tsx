"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { classRichPlainText, decodeClassRichText, encodeClassRichText, type ClassRichNode } from "@/lib/class-rich-text";
import { renumberManualLines } from "@/lib/class-manual-numbering";

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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const selectedRange = useRef<Range | null>(null);
  const emitted = useRef<string | null>(null);
  const numberHandled = useRef(false);
  const caretFrame = useRef(0);
  const history = useRef<{ past: { value: string; start: number; end: number }[]; current: { value: string; start: number; end: number }; future: { value: string; start: number; end: number }[] }>({ past: [], current: { value, start: 0, end: 0 }, future: [] });
  const [historyState, setHistoryState] = useState({ undo: false, redo: false });
  useEffect(() => { if (editorRef.current && value !== emitted.current) { fillEditor(editorRef.current, value); history.current = { past: [], current: { value, start: 0, end: 0 }, future: [] }; setHistoryState({ undo: false, redo: false }); } }, [value]);
  function selectionOffsets() {
    const element = editorRef.current;
    const selection = window.getSelection();
    if (!element || !selection?.rangeCount || !element.contains(selection.anchorNode)) return { start: 0, end: 0 };
    const range = selection.getRangeAt(0);
    const start = range.cloneRange(); start.selectNodeContents(element); start.setEnd(range.startContainer, range.startOffset);
    const end = range.cloneRange(); end.selectNodeContents(element); end.setEnd(range.endContainer, range.endOffset);
    return { start: start.toString().length, end: end.toString().length };
  }
  function restoreOffsets(start: number, end: number) {
    const element = editorRef.current;
    if (!element) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const locate = (offset: number) => { let node: Node | null; let remaining = offset; while ((node = walker.nextNode())) { const length = node.textContent?.length ?? 0; if (remaining <= length) return { node, offset: remaining }; remaining -= length; } return null; };
    const first = locate(start); walker.currentNode = element; const last = locate(end);
    const range = document.createRange();
    if (first && last) { range.setStart(first.node, first.offset); range.setEnd(last.node, last.offset); }
    else { range.selectNodeContents(element); range.collapse(false); }
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    selectedRange.current = range.cloneRange();
  }
  function travel(direction: "undo" | "redo") {
    const state = history.current;
    const source = direction === "undo" ? state.past : state.future;
    const target = direction === "undo" ? state.future : state.past;
    const previous = source.pop(); if (!previous || !editorRef.current) return;
    target.push(state.current); state.current = previous;
    fillEditor(editorRef.current, previous.value); editorRef.current.focus(); restoreOffsets(previous.start, previous.end);
    emitted.current = previous.value; onChange(previous.value);
    setHistoryState({ undo: state.past.length > 0, redo: state.future.length > 0 });
    scheduleCaretVisible();
  }
  function scheduleCaretVisible() {
    cancelAnimationFrame(caretFrame.current);
    caretFrame.current = requestAnimationFrame(() => { caretFrame.current = requestAnimationFrame(ensureCaretVisible); });
  }
  function ensureCaretVisible() {
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
    const editor = editorRef.current;
    const range = selection.getRangeAt(0);
    const raw = range.getBoundingClientRect();
    const block = selection.anchorNode instanceof HTMLElement ? selection.anchorNode : selection.anchorNode?.parentElement;
    const line = block?.closest("div,p,h1,h2,h3,li,blockquote");
    const rect = raw.height > 0 ? raw : line?.getBoundingClientRect() ?? raw;
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const bottom = top + (viewport?.height ?? window.innerHeight);
    const toolbarTop = document.documentElement.classList.contains("class-notes-keyboard-open") ? (toolbarRef.current?.getBoundingClientRect().top ?? bottom) : bottom;
    const visibleBottom = Math.min(bottom, toolbarTop) - 16;
    const editorRect = editor.getBoundingClientRect();
    const lower = Math.min(visibleBottom, editorRect.bottom - 12);
    if (rect.bottom > lower && editor.scrollHeight > editor.clientHeight) {
      const before = editor.scrollTop;
      editor.scrollTop += rect.bottom - lower + 8;
      if (editor.scrollTop !== before) { scheduleCaretVisible(); return; }
    }
    if (rect.bottom > visibleBottom) window.scrollBy({ top: rect.bottom - visibleBottom + 8, behavior: "instant" });
    else if (rect.top < Math.max(top + 12, editorRect.top + 8)) {
      const delta = Math.max(top + 12, editorRect.top + 8) - rect.top;
      if (editor.scrollTop > 0) editor.scrollTop -= delta;
      else window.scrollBy({ top: -delta, behavior: "instant" });
    }
  }
  function manualBlock(node: Node | null): HTMLElement | null {
    let block = node instanceof HTMLElement ? node : node?.parentElement;
    if (block?.closest("li")) return null;
    while (block && block.parentElement !== editorRef.current) block = block.parentElement;
    return block?.parentElement === editorRef.current ? block : null;
  }
  function renumberManualBlocks(block: HTMLElement | null) {
    if (!block) return;
    const parse = (element: Element | null) => element instanceof HTMLElement ? /^(\s*)(\d+)([.-])(\s+|$)/.exec(element.textContent ?? "") : null;
    let first = block;
    let match = parse(first);
    if (!match) { first = block.previousElementSibling as HTMLElement; match = parse(first); }
    if (!first || !match) return;
    while (first.previousElementSibling) {
      const previous = parse(first.previousElementSibling);
      if (!previous || previous[1] !== match[1] || previous[3] !== match[3]) break;
      first = first.previousElementSibling as HTMLElement;
      match = previous;
    }
    const items: HTMLElement[] = [];
    for (let item: Element | null = first; item; item = item.nextElementSibling) {
      const current = parse(item);
      if (!current || current[1] !== match[1] || current[3] !== match[3]) break;
      items.push(item as HTMLElement);
    }
    const normalized = renumberManualLines(items.map((item) => item.textContent ?? ""));
    items.forEach((item, index) => {
      if (item.textContent !== normalized[index]) {
        const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
        const textNode = walker.nextNode();
        const expected = /^(\s*)(\d+)[.-]/.exec(normalized[index]);
        if (textNode?.textContent && expected) textNode.textContent = textNode.textContent.replace(/^(\s*)\d+(?=[.-])/, `$1${expected[2]}`);
      }
    });
  }
  function emit() {
    if (!editorRef.current) return;
    const next = encodeClassRichText([...editorRef.current.childNodes].flatMap(fromDom));
    if (next.length > 36000 || classRichPlainText(next).length > 12000) { fillEditor(editorRef.current, emitted.current ?? value); return; }
    if (next !== history.current.current.value) {
      history.current.past.push(history.current.current);
      if (history.current.past.length > 100) history.current.past.shift();
      history.current.current = { value: next, ...selectionOffsets() };
      history.current.future = [];
      setHistoryState({ undo: true, redo: false });
    }
    emitted.current = next;
    onChange(next);
    scheduleCaretVisible();
  }
  function rememberSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
      selectedRange.current = selection.getRangeAt(0).cloneRange();
      Object.assign(history.current.current, selectionOffsets());
    }
  }
  function command(tool: Tool) {
    if (disabled || !editorRef.current) return;
    if (tool.command === "undo" || tool.command === "redo") { travel(tool.command); return; }
    editorRef.current.focus();
    const selection = window.getSelection();
    if (selection && selectedRange.current && editorRef.current.contains(selectedRange.current.commonAncestorContainer)) { selection.removeAllRanges(); selection.addRange(selectedRange.current); }
    document.execCommand(tool.command, false, tool.argument);
    rememberSelection(); emit();
  }
  function continueManualNumbering(preventDefault: () => void) {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.isCollapsed) return false;
    const block = manualBlock(selection.anchorNode);
    if (!block || !blockTags.has(block.tagName)) return false;
    const range = selection.getRangeAt(0);
    const before = range.cloneRange(); before.selectNodeContents(block); before.setEnd(range.startContainer, range.startOffset);
    const after = range.cloneRange(); after.selectNodeContents(block); after.setStart(range.startContainer, range.startOffset);
    if (after.toString().trim()) return false;
    const match = /^(\s*)(\d+)([.-])(\s*)(.*)$/.exec(before.toString());
    if (!match) return false;
    preventDefault();
    const [, indent, number, separator, spacing, item] = match;
    if (!item.trim()) { block.textContent = indent; const end = document.createRange(); end.selectNodeContents(block); end.collapse(false); selection.removeAllRanges(); selection.addRange(end); renumberManualBlocks(block.nextElementSibling as HTMLElement); emit(); return true; }
    const next = document.createElement("div"); next.textContent = `${indent}${Number(number) + 1}${separator}${spacing || " "}`;
    block.after(next); const cursor = document.createRange(); cursor.selectNodeContents(next); cursor.collapse(false); selection.removeAllRanges(); selection.addRange(cursor); renumberManualBlocks(next); emit(); return true;
  }
  function onNumberKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); travel(event.shiftKey ? "redo" : "undo"); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); travel("redo"); return; }
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (continueManualNumbering(() => event.preventDefault())) { numberHandled.current = true; window.setTimeout(() => { numberHandled.current = false; }, 0); }
  }
  function onNumberBeforeInput(event: FormEvent<HTMLDivElement>) {
    const input = event.nativeEvent as InputEvent;
    if (input.inputType === "historyUndo" || input.inputType === "historyRedo") { event.preventDefault(); travel(input.inputType === "historyUndo" ? "undo" : "redo"); return; }
    if (input.isComposing || !["insertLineBreak", "insertParagraph"].includes(input.inputType)) return;
    if (numberHandled.current) { event.preventDefault(); return; }
    continueManualNumbering(() => event.preventDefault());
  }
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let baseline = Math.max(window.innerHeight, viewport?.height ?? 0);
    let frame = 0;
    const adjust = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const focused = document.activeElement === editorRef.current;
        const visibleHeight = (viewport?.height ?? window.innerHeight) + (viewport?.offsetTop ?? 0);
        if (!focused) baseline = Math.max(window.innerHeight, visibleHeight);
        const gap = Math.max(0, window.innerHeight - visibleHeight);
        const open = focused && window.matchMedia("(max-width: 639px)").matches && Math.max(baseline - visibleHeight, gap) > 120;
        root.classList.toggle("class-notes-keyboard-open", open);
        if (open) {
          root.style.setProperty("--class-notes-keyboard-gap", `${gap}px`);
          root.style.setProperty("--class-notes-toolbar-height", `${toolbarRef.current?.offsetHeight ?? 56}px`);
          root.style.setProperty("--class-notes-visible-height", `${viewport?.height ?? window.innerHeight}px`);
          requestAnimationFrame(ensureCaretVisible);
        } else {
          root.style.removeProperty("--class-notes-keyboard-gap");
          root.style.removeProperty("--class-notes-toolbar-height");
          root.style.removeProperty("--class-notes-visible-height");
        }
      });
    };
    viewport?.addEventListener("resize", adjust);
    viewport?.addEventListener("scroll", adjust);
    window.addEventListener("resize", adjust);
    window.addEventListener("focusin", adjust);
    window.addEventListener("focusout", adjust);
    window.addEventListener("orientationchange", adjust);
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(caretFrame.current); viewport?.removeEventListener("resize", adjust); viewport?.removeEventListener("scroll", adjust); window.removeEventListener("resize", adjust); window.removeEventListener("focusin", adjust); window.removeEventListener("focusout", adjust); window.removeEventListener("orientationchange", adjust); root.classList.remove("class-notes-keyboard-open"); root.style.removeProperty("--class-notes-keyboard-gap"); root.style.removeProperty("--class-notes-toolbar-height"); root.style.removeProperty("--class-notes-visible-height"); };
    // The viewport listeners read live DOM state; reattaching them on every text edit would interrupt Android scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="class-notes-editor">
    <div ref={toolbarRef} role="toolbar" aria-label="Formato de la clase" className="class-notes-toolbar">{tools.map((tool) => <button key={tool.label} type="button" title={tool.label} aria-label={tool.label} disabled={disabled || (tool.command === "undo" && !historyState.undo) || (tool.command === "redo" && !historyState.redo)} onPointerDown={(event) => { rememberSelection(); event.preventDefault(); }} onClick={() => command(tool)} className={tool.command === "bold" ? "font-black" : tool.command === "italic" ? "italic" : tool.command === "underline" ? "underline" : tool.command === "strikeThrough" ? "line-through" : ""}>{tool.mark}</button>)}</div>
    <div ref={editorRef} role="textbox" aria-label="Tu clase" aria-multiline="true" contentEditable={!disabled} suppressContentEditableWarning onInput={(event) => { if ((event.nativeEvent as InputEvent).inputType?.startsWith("delete")) renumberManualBlocks(manualBlock(window.getSelection()?.anchorNode ?? null)); emit(); }} onKeyDown={onNumberKeyDown} onBeforeInput={onNumberBeforeInput} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onTouchEnd={rememberSelection} onFocus={scheduleCaretVisible} onPaste={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); emit(); }} onDrop={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.dataTransfer.getData("text/plain")); emit(); }} className="class-notes-writing" />
    <p className="class-notes-count">{classRichPlainText(value).length}/12.000 caracteres</p>
  </div>;
}

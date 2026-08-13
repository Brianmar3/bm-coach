"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { filterTrainerCommands, nextCommandIndex, shouldIgnoreGlobalShortcut, studentCommandIntent, studentSearchTerms, trainerCommands, type StudentCommandIntent } from "@/lib/trainer-commands";

type StudentResult = { id: string; name: string; serviceType: "CLASSES" | "PERSONALIZED" | "MIXED"; status: string; plan: string; frequency: string };
type PaletteItem = { id: string; label: string; detail: string; symbol: string; href: string; category: "Acciones" | "Navegación" | "Alumnos"; shortcut?: string };

const serviceLabel = { CLASSES: "Clases", PERSONALIZED: "Personalizado", MIXED: "Mixto" } as const;

function studentHref(studentId: string, intent: StudentCommandIntent) {
  if (intent === "payment") return `/pagos?accion=nuevo&studentId=${encodeURIComponent(studentId)}`;
  if (intent === "attendance") return `/asistencias?studentId=${encodeURIComponent(studentId)}`;
  if (intent === "routine") return `/rutinas?studentId=${encodeURIComponent(studentId)}&view=active`;
  if (intent === "evaluation") return `/evaluaciones?studentId=${encodeURIComponent(studentId)}&accion=nueva`;
  return `/alumnos?studentId=${encodeURIComponent(studentId)}`;
}

function studentActionLabel(intent: StudentCommandIntent) {
  return intent === "payment" ? "Registrar pago" : intent === "attendance" ? "Tomar asistencia" : intent === "routine" ? "Abrir rutina" : intent === "evaluation" ? "Nueva evaluación" : "Abrir alumno";
}

export function TrainerCommandPalette() {
  const router = useRouter();
  const dialogId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const commandItems = useMemo<PaletteItem[]>(() => filterTrainerCommands(query).map((command) => ({ ...command, detail: command.category, category: command.category })), [query]);
  const intent = studentCommandIntent(query);
  const items = useMemo<PaletteItem[]>(() => [
    ...commandItems,
    ...students.map((student) => ({ id: `student-${student.id}-${intent}`, label: `${studentActionLabel(intent)} · ${student.name}`, detail: `${serviceLabel[student.serviceType]} · ${student.status} · ${student.plan || student.frequency || "Sin plan"}`, symbol: student.name.charAt(0).toUpperCase(), href: studentHref(student.id, intent), category: "Alumnos" as const, shortcut: undefined })),
  ], [commandItems, intent, students]);
  const selectedIndex = items.length ? Math.min(activeIndex, items.length - 1) : 0;

  function showPalette(initialQuery = "") {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery(initialQuery); setStudents([]); setHelp(false); setActiveIndex(0); setOpen(true);
  }

  function close() {
    setOpen(false); setQuery(""); setStudents([]); setHelp(false);
    requestAnimationFrame(() => previousFocus.current?.focus());
  }

  function execute(item: PaletteItem | undefined) {
    if (!item) return;
    setOpen(false); setQuery(""); setStudents([]);
    router.push(item.href);
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const paletteShortcut = (event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("es") === "k";
      if (paletteShortcut) { event.preventDefault(); if (open) close(); else showPalette(); return; }
      if (event.key === "Escape" && open) { event.preventDefault(); close(); return; }
      if (event.key === "Tab" && open) {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])') ?? []).filter((item) => !item.hasAttribute("disabled"));
        if (!controls.length) return;
        const current = controls.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey ? (current <= 0 ? controls.length - 1 : current - 1) : (current < 0 || current === controls.length - 1 ? 0 : current + 1);
        event.preventDefault(); controls[next]?.focus(); return;
      }
      if (open || shouldIgnoreGlobalShortcut(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "/") { event.preventDefault(); showPalette(); return; }
      if (event.key === "?") { event.preventDefault(); showPalette(); setHelp(true); return; }
      const command = trainerCommands.find((item) => item.shortcut?.toLocaleLowerCase("es") === event.key.toLocaleLowerCase("es"));
      if (command) { event.preventDefault(); router.push(command.href); }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [open, router]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (!open || help) return;
    const terms = studentSearchTerms(query);
    if (terms.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      fetch(`/api/admin/command-search?q=${encodeURIComponent(terms)}`, { cache: "no-store", signal: controller.signal })
        .then((response) => response.ok ? response.json() as Promise<StudentResult[]> : [])
        .then(setStudents)
        .catch((error: unknown) => { if (error instanceof Error && error.name !== "AbortError") setStudents([]); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [help, open, query]);

  if (!open) return <button type="button" onClick={() => showPalette()} aria-label="Abrir acciones rápidas" className="fixed right-28 top-[calc(env(safe-area-inset-top)+1rem)] z-50 hidden min-h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 text-xs text-zinc-400 shadow-xl transition hover:border-yellow-400/30 hover:text-yellow-200 lg:inline-flex"><span>Buscar o ejecutar</span><kbd className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px]">Ctrl K</kbd></button>;

  return <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/75 p-3 pt-[max(5rem,12vh)] backdrop-blur-sm" onPointerDown={close}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-title`} className="w-full max-w-2xl overflow-hidden rounded-2xl border border-yellow-400/20 bg-zinc-950 shadow-[0_25px_80px_rgba(0,0,0,.7)]" onPointerDown={(event) => event.stopPropagation()}>
      <header className="flex items-center gap-3 border-b border-zinc-800 p-3 sm:p-4"><span aria-hidden="true" className="text-yellow-400">⌕</span><div className="min-w-0 flex-1"><h2 id={`${dialogId}-title`} className="sr-only">BM Command</h2><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setStudents([]); setSearching(false); setHelp(false); setActiveIndex(0); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => nextCommandIndex(current, event.key, items.length)); }
        if (event.key === "Enter") { event.preventDefault(); execute(items[selectedIndex]); }
      }} placeholder="Buscar alumno o acción…" aria-label="Buscar alumno o acción" aria-controls={`${dialogId}-results`} aria-activedescendant={items[selectedIndex] ? `${dialogId}-${items[selectedIndex].id}` : undefined} className="w-full bg-transparent text-base text-white outline-none placeholder:text-zinc-600" /></div><button type="button" onClick={() => setHelp((value) => !value)} className="grid h-9 w-9 place-items-center rounded-lg text-sm text-zinc-400 hover:bg-zinc-800" aria-label="Ver atajos de teclado">?</button><button type="button" onClick={close} className="grid h-9 w-9 place-items-center rounded-lg text-lg text-zinc-400 hover:bg-zinc-800" aria-label="Cerrar BM Command">×</button></header>
      {help ? <ShortcutHelp /> : <div id={`${dialogId}-results`} role="listbox" aria-label="Resultados de BM Command" className="max-h-[min(65vh,32rem)] overflow-y-auto p-2 sm:p-3">
        {searching && <p className="px-3 py-2 text-xs text-zinc-500">Buscando alumnos…</p>}
        {items.length ? items.map((item, index) => <button id={`${dialogId}-${item.id}`} role="option" aria-selected={index === selectedIndex} key={item.id} type="button" onPointerMove={() => setActiveIndex(index)} onClick={() => execute(item)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${index === selectedIndex ? "bg-yellow-400/10 text-yellow-100" : "text-zinc-200 hover:bg-zinc-900"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-yellow-400/10 text-xs font-black text-yellow-300">{item.symbol}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.label}</span><span className="mt-0.5 block truncate text-xs text-zinc-500">{item.detail}</span></span>{item.shortcut && <kbd className="hidden rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-500 sm:block">{item.shortcut}</kbd>}</button>) : <p className="p-8 text-center text-sm text-zinc-500">No encontramos acciones ni alumnos.</p>}
      </div>}
      <footer className="hidden items-center gap-4 border-t border-zinc-800 px-4 py-2.5 text-[10px] text-zinc-600 sm:flex"><span>↑↓ navegar</span><span>Enter ejecutar</span><span>Esc cerrar</span><button type="button" onClick={() => setHelp(true)} className="ml-auto text-zinc-500 hover:text-yellow-300">Ver atajos</button></footer>
    </section>
  </div>;
}

function ShortcutHelp() {
  const shortcuts = [["Ctrl K", "Acciones rápidas"], ["/", "Buscar"], ["N", "Nuevo alumno"], ["P", "Registrar pago"], ["A", "Asistencia"], ["C", "Crear clase"], ["E", "Nueva evaluación"], ["R", "Rutinas"], ["Esc", "Cerrar"]];
  return <div className="grid gap-1 p-3 sm:grid-cols-2 sm:p-4">{shortcuts.map(([shortcut, label]) => <div key={shortcut} className="flex min-h-11 items-center justify-between rounded-lg px-3 text-sm text-zinc-300"><span>{label}</span><kbd className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400">{shortcut}</kbd></div>)}</div>;
}

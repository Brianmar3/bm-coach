"use client";
import { useEffect, useRef, useState } from "react";
import { DraftHistory, draftSignature } from "@/lib/routine-editor-state";
import type { ClassBaseRoutineDraft as Draft } from "@/lib/class-template-base";

type Recovery = { draft: Draft; baseline: string; savedAt: string; stale?: boolean };
export function useRoutineEditorSession(form: Draft, apply: (next: Draft) => void, resourceId: string, savedRevision: number) {
  const history = useRef(new DraftHistory(form));
  const baseline = useRef(draftSignature(form));
  const latest = useRef(form);
  const key = useRef("");
  const [, redraw] = useState(0);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [localState, setLocalState] = useState("Cambios pendientes");
  const [ready, setReady] = useState(false);
  const signature = draftSignature(form);
  const dirty = resourceId.startsWith("new-") || signature !== baseline.current;
  useEffect(() => { latest.current = form; }, [form]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/auth/session", { cache: "no-store" }).then(response => response.json()).then(identity => {
      if (cancelled || !identity.authenticated || !identity.userId || !identity.workspaceId) return;
      key.current = `bm:routine-draft:${identity.workspaceId}:${identity.userId}:${resourceId}`;
      try {
        const raw = localStorage.getItem(key.current);
        if (raw) {
          const found = JSON.parse(raw) as Recovery;
          if (found.draft?.days?.length && draftSignature(found.draft) !== baseline.current) setRecovery({ ...found, stale: !resourceId.startsWith("new-") && found.baseline !== baseline.current });
        }
        setReady(true);
      } catch { setLocalState("Copia local no disponible. Guardá antes de salir."); }
    }).catch(() => { if (!cancelled) setLocalState("Copia local no disponible. Guardá antes de salir."); });
    return () => { cancelled = true; };
  }, [resourceId]);
  const revision = useRef(savedRevision);
  useEffect(() => {
    if (revision.current === savedRevision) return;
    revision.current = savedRevision; baseline.current = draftSignature(form); history.current.reset(form);
    try { if (key.current) localStorage.removeItem(key.current); } catch { /* Browser storage can be unavailable. */ }
    setLocalState("Guardado en el servidor"); redraw(value => value + 1);
  }, [form, savedRevision]);
  useEffect(() => {
    if (!ready || recovery) return;
    if (!dirty) {
      try { if (key.current) localStorage.removeItem(key.current); } catch { /* Nothing pending on the server. */ }
      return;
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key.current, JSON.stringify({ draft: form, baseline: baseline.current, savedAt: new Date().toISOString() }));
        setLocalState("Copia local guardada · pendiente de publicar");
      } catch { setLocalState("No se pudo guardar la copia local. Guardá en el servidor."); }
    }, 650);
    return () => clearTimeout(timer);
  }, [dirty, form, ready, recovery]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (!resourceId.startsWith("new-") && draftSignature(latest.current) === baseline.current) return;
      try { if (key.current) localStorage.setItem(key.current, JSON.stringify({ draft: latest.current, baseline: baseline.current, savedAt: new Date().toISOString() })); } catch { /* The browser warning remains the fallback. */ }
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [resourceId]);
  const inputIds = useRef(new WeakMap<Element, string>());
  useEffect(() => {
    const saved = () => { try { if (key.current) localStorage.removeItem(key.current); } catch { /* Server saved successfully. */ } };
    window.addEventListener("bm:routine-saved", saved);
    return () => window.removeEventListener("bm:routine-saved", saved);
  }, []);
  function change(next: Draft) {
    const focused = document.activeElement;
    if (focused && !inputIds.current.has(focused)) inputIds.current.set(focused, crypto.randomUUID());
    const group = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ? inputIds.current.get(focused) ?? "" : "";
    setLocalState("Cambios pendientes");
    history.current.record(next, group); apply(next);
  }
  function undo() { apply(history.current.undo()); redraw(value => value + 1); }
  function redo() { apply(history.current.redo()); redraw(value => value + 1); }
  function discardRecovery() { setRecovery(null); discard(); }
  function restoreRecovery() { if (recovery) change(recovery.draft); setRecovery(null); }
  function discard() { try { if (key.current) localStorage.removeItem(key.current); } catch { /* No local copy. */ } }
  return { change, undo, redo, canUndo: history.current.past.length > 0, canRedo: history.current.future.length > 0, dirty, localState, recovery, restoreRecovery, discardRecovery, discard };
}

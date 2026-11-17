"use client";

import { useEffect, useRef, useState } from "react";

export type ClassDraftContent = { name: string; modality: string; text: string };
type StoredDraft = { content: ClassDraftContent; savedAt: number };
type DraftStatus = "loading" | "saved" | "pending" | "idle" | "unavailable";

export function useGroupClassDraft(key: string | null, content: ClassDraftContent, hydrate: (content: ClassDraftContent) => void, busy: boolean) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [retry, setRetry] = useState(0);
  const contentRef = useRef(content);
  const hydrateRef = useRef(hydrate);
  const baseline = useRef("");
  const localKey = useRef("");
  const verifiedOwner = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => { contentRef.current = content; hydrateRef.current = hydrate; }, [content, hydrate]);

  useEffect(() => { const onOnline = () => setRetry((value) => value + 1); window.addEventListener("online", onOnline); return () => window.removeEventListener("online", onOnline); }, []);

  useEffect(() => {
    if (!key) { let active = true; queueMicrotask(() => { if (active) { setReady(false); setStatus("idle"); } }); return () => { active = false; }; }
    let cancelled = false;
    let verified = false;
    localKey.current = "";
    queueMicrotask(() => { if (!cancelled) { setReady(false); setStatus("loading"); } });
    const load = async () => {
      try {
        const response = await fetch(`/api/clases/borradores?key=${encodeURIComponent(key)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo cargar el borrador.");
        const data = await response.json() as { owner: string; draft: { content: ClassDraftContent; updatedAt: string } | null };
        if (cancelled) return;
        verifiedOwner.current = data.owner;
        verified = true;
        localKey.current = `bm-class-draft:${data.owner}:${key}`;
        const local = readLocal(localKey.current);
        const useLocal = local && (!data.draft || local.savedAt > new Date(data.draft.updatedAt).getTime());
        const restored = useLocal ? local.content : data.draft?.content;
        if (restored) hydrateRef.current(restored);
        baseline.current = useLocal ? "" : JSON.stringify(restored ?? contentRef.current);
        setStatus(useLocal ? "pending" : data.draft ? "saved" : "idle");
      } catch {
        if (cancelled) return;
        const owner = verifiedOwner.current;
        verified = Boolean(owner);
        localKey.current = owner ? `bm-class-draft:${owner}:${key}` : "";
        const local = localKey.current ? readLocal(localKey.current) : null;
        if (local) hydrateRef.current(local.content);
        baseline.current = "";
        setStatus(owner ? "pending" : "unavailable");
      } finally { if (!cancelled) setReady(verified); }
    };
    void load();
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  }, [key, retry]);

  useEffect(() => {
    if (!key || !ready || busy) return;
    const serialized = JSON.stringify(content);
    if (serialized === baseline.current) return;
    const storageKey = localKey.current;
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify({ content, savedAt: Date.now() } satisfies StoredDraft));
    setStatus("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      inFlight.current = inFlight.current.catch(() => {}).then(async () => {
        const response = await fetch("/api/clases/borradores", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, content }) });
        if (!response.ok) throw new Error("Sin sincronizar");
        baseline.current = serialized;
        if (JSON.stringify(contentRef.current) === serialized) { if (storageKey) localStorage.removeItem(storageKey); setStatus("saved"); }
      }).catch(() => setStatus("pending"));
    }, 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [key, ready, busy, content]);

  async function clearSavedDraft() {
    if (!key) return;
    if (timer.current) clearTimeout(timer.current);
    await inFlight.current;
    const response = await fetch("/api/clases/borradores", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    if (!response.ok) throw new Error("La clase se guardó, pero no se pudo retirar el borrador automático.");
    if (localKey.current) localStorage.removeItem(localKey.current);
  }
  return { ready, status, clearSavedDraft };
}

function readLocal(key: string): StoredDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null") as StoredDraft | null;
    return value?.content && typeof value.content.text === "string" && typeof value.savedAt === "number" ? value : null;
  } catch { return null; }
}

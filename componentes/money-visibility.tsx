"use client";

import { useEffect, useState } from "react";
import { BmEyeIcon, BmEyeOffIcon } from "@/componentes/icons";
import { displayMoney, moneyVisibilityKey, readMoneyVisibility } from "@/lib/money-visibility";

const EVENT = "bm:money-visibility";
type Preference = { key: string | null; visible: boolean };

export function useMoneyVisibility() {
  // Remain masked until the current trainer and their saved preference are known.
  const [preference, setPreference] = useState<Preference>({ key: null, visible: false });

  useEffect(() => {
    let active = true;
    fetch("/api/admin/auth/session", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ authenticated: boolean; userId?: string; workspaceId?: string }> : null)
      .then((session) => {
        if (!active || !session?.authenticated || !session.userId || !session.workspaceId) return;
        const key = moneyVisibilityKey(session.workspaceId, session.userId);
        try { setPreference({ key, visible: readMoneyVisibility(localStorage, key) }); }
        catch { setPreference({ key, visible: false }); }
      }).catch(() => { /* Keep amounts masked when identity is unavailable. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function sync(event: Event) {
      const detail = (event as CustomEvent<Preference>).detail;
      if (detail?.key) setPreference((current) => current.key === detail.key ? detail : current);
    }
    function syncStorage(event: StorageEvent) {
      if (event.key) setPreference((current) => current.key === event.key ? { key: current.key, visible: event.newValue !== "hidden" } : current);
    }
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", syncStorage);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", syncStorage); };
  }, []);

  function toggle() {
    if (!preference.key) return;
    const next = { key: preference.key, visible: !preference.visible };
    try { localStorage.setItem(next.key, next.visible ? "visible" : "hidden"); }
    catch { return; }
    setPreference(next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }

  return { visible: preference.visible, ready: Boolean(preference.key), toggle, amount: (formatted: string) => displayMoney(formatted, preference.visible) };
}

export function MoneyVisibilityButton({ visible, ready, toggle }: { visible: boolean; ready: boolean; toggle: () => void }) {
  return <button type="button" onClick={toggle} disabled={!ready} aria-label={visible ? "Ocultar importes" : "Mostrar importes"} aria-pressed={visible} title={visible ? "Ocultar importes" : "Mostrar importes"} className="inline-grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl text-[var(--brand-text)] transition hover:bg-[var(--bm-accent-soft)] focus-visible:outline-2 focus-visible:outline-[var(--bm-accent)] disabled:opacity-50">
    {visible ? <BmEyeIcon size={21} /> : <BmEyeOffIcon size={21} />}
  </button>;
}

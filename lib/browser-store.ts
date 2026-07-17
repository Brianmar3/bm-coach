"use client";

import { useEffect, useState } from "react";

/**
 * Demo adapter. Its small surface lets a future API/Prisma adapter replace
 * browser storage without changing the modules' UI or their domain types.
 */
export function useBrowserStore<T>(key: string, initialValue: T[]) {
  const [items, setItems] = useState<T[]>(initialValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(key);
        if (saved) setItems(JSON.parse(saved) as T[]);
      } catch {
        // An invalid saved value should never prevent the module from loading.
      } finally {
        setReady(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key]);

  function save(next: T[]) {
    setItems(next);
    window.localStorage.setItem(key, JSON.stringify(next));
  }

  return { items, save, ready };
}

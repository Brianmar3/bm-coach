"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Prisma/PostgreSQL adapter. The UI remains optimistic while the server
 * persists each collection through the production API.
 */
export function useBrowserStore<T>(key: string, initialValue: T[]) {
  const [items, setItems] = useState<T[]>(initialValue);
  const [ready, setReady] = useState(false);
  const initialItems = useRef(initialValue);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      fetch(`/api/store/${encodeURIComponent(key)}`, { cache: "no-store" })
        .then(async (response) => response.ok ? response.json() as Promise<T[]> : Promise.reject())
        .then(setItems)
        .catch(() => setItems(initialItems.current))
        .finally(() => setReady(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key]);

  async function save(next: T[]) {
    const previous = items;
    setItems(next);
    const response = await fetch(`/api/store/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: next }),
    });
    if (!response.ok) {
      setItems(previous);
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "No se pudieron guardar los cambios.");
    }
    return response.json().catch(() => ({ ok: true })) as Promise<{ ok: boolean; settings?: T }>;
  }

  return { items, save, ready };
}

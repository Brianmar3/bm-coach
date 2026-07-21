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
      fetch(`/api/store/${encodeURIComponent(key)}`)
        .then(async (response) => response.ok ? response.json() as Promise<T[]> : Promise.reject())
        .then(setItems)
        .catch(() => setItems(initialItems.current))
        .finally(() => setReady(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key]);

  function save(next: T[]) {
    setItems(next);
    void fetch(`/api/store/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: next }),
    });
  }

  return { items, save, ready };
}

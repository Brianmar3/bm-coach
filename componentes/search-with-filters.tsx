"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function SearchWithFilters({ search, activeCount, children, className = "" }: { search: ReactNode; activeCount: number; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  useEffect(() => { if (open && document.activeElement === document.body && lastFocused.current?.matches(":disabled")) toggle.current?.focus(); });
  return <div className={`search-with-filters ${className}`} onFocusCapture={event => { lastFocused.current = event.target as HTMLElement; }} onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); toggle.current?.focus(); } }}>
    <div className="search-with-filters-field">
      <svg className="search-with-filters-magnifier" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
      <div className="search-with-filters-slot">{search}</div>
      <button ref={toggle} type="button" className="search-with-filters-toggle" aria-label={activeCount ? `Filtros, ${activeCount} activos` : "Filtros"} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4"/></svg>{activeCount > 0 && <span className="search-with-filters-badge" aria-hidden="true">{activeCount}</span>}</button>
    </div>
    <div id={id} className="search-with-filters-panel" hidden={!open}>{children}</div>
  </div>;
}

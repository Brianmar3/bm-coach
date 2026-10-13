"use client";

import { useId, useState, type ReactNode } from "react";
import { inputClass } from "@/componentes/module-shell";

export type TrainerFilter = { label: string; value: string; defaultValue: string; options: Array<readonly [string, string]>; change: (value: string) => void };

export function TrainerFilters({ search, filters }: { search: ReactNode; filters: TrainerFilter[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const active = filters.filter(filter => filter.value !== filter.defaultValue).length;
  return <div className="trainer-filters">
    <div className="trainer-filter-search">{search}</div>
    <button type="button" className="trainer-filter-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" /></svg>Filtros{active ? ` · ${active}` : ""}</button>
    <div id={id} className="trainer-filter-panel" data-open={open}>
      {filters.map(filter => <label key={filter.label}><span className="sr-only">{filter.label}</span><select className={inputClass} value={filter.value} onChange={event => filter.change(event.target.value)}>{filter.options.map(([value, label]) => <option key={value} value={value}>{filter.label}: {label}</option>)}</select></label>)}
      <button type="button" className="trainer-filter-clear" disabled={!active} onClick={() => filters.forEach(filter => filter.change(filter.defaultValue))}>Limpiar filtros</button>
    </div>
  </div>;
}

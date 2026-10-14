"use client";

import { type ReactNode } from "react";
import { SearchWithFilters } from "@/componentes/search-with-filters";
import { inputClass } from "@/componentes/module-shell";

export type TrainerFilter = { label: string; value: string; defaultValue: string; options: Array<readonly [string, string]>; change: (value: string) => void };

export function TrainerFilters({ search, filters }: { search: ReactNode; filters: TrainerFilter[] }) {
  const active = filters.filter(filter => filter.value !== filter.defaultValue).length;
  return <SearchWithFilters className="trainer-filters" search={search} activeCount={active}>
    <div className="trainer-filter-panel">
      {filters.map(filter => <label key={filter.label}><span className="sr-only">{filter.label}</span><select className={inputClass} value={filter.value} onChange={event => filter.change(event.target.value)}>{filter.options.map(([value, label]) => <option key={value} value={value}>{filter.label}: {label}</option>)}</select></label>)}
      <button type="button" className="trainer-filter-clear" disabled={!active} onClick={() => filters.forEach(filter => filter.change(filter.defaultValue))}>Limpiar filtros</button>
    </div>
  </SearchWithFilters>;
}

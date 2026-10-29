"use client";

import { inputClass } from "@/componentes/module-shell";
import { useComboboxNavigation } from "@/componentes/use-combobox-navigation";
import type { Student } from "@/types/gestion";

/** Shared multi-selection for routines and recurring classes; selection never leaves the search. */
export function StudentAssignmentOptions({ students, query, onQueryChange, selectedIds, toggle, isDisabled = () => false, detailed = false, autoFocus = false }: {
  students: Student[]; query: string; onQueryChange: (value: string) => void;
  selectedIds: string[]; toggle: (id: string) => void; isDisabled?: (student: Student) => boolean; detailed?: boolean; autoFocus?: boolean;
}) {
  const { attachRoot, attachList, attachInput, ...navigation } = useComboboxNavigation({ items: students, itemKey: (student) => student.id,
    queryKey: query, onSelect: (student) => toggle(student.id), isDisabled, initialOpen: true, closeOnSelect: false });
  return <div ref={attachRoot} {...navigation.rootProps} className="min-w-0">
    <label className="mt-3 block text-sm text-zinc-400">Buscar alumno<input ref={attachInput} {...navigation.inputProps} autoFocus={autoFocus} type="search" value={query}
      onChange={(event) => { onQueryChange(event.target.value); navigation.changed(); }} placeholder="Nombre, apellido o teléfono" className={`${inputClass} mt-1`} /></label>
    {navigation.open && <div ref={attachList} {...navigation.listProps} aria-label="Alumnos disponibles" aria-multiselectable="true" className="mt-2 max-h-64 min-w-0 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/70">
      {students.length ? students.map((student) => { const selected = selectedIds.includes(student.id); return <button key={student.id} type="button" {...navigation.optionProps(student)} role="option" aria-selected={selected}
        className={`flex min-h-11 w-full items-center gap-3 border-b border-zinc-800 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "bg-yellow-400/[.06]" : ""}`}>
        <span aria-hidden="true" className={`grid size-4 shrink-0 place-items-center rounded border text-xs ${selected ? "border-yellow-400 bg-yellow-400 text-zinc-950" : "border-zinc-500"}`}>{selected ? "✓" : ""}</span>
        <span className="min-w-0 flex-1 truncate">{student.firstName} {student.lastName}{detailed && <span className="mt-0.5 block text-xs text-zinc-500">{student.phone} · {student.status}</span>}</span>
        {!detailed && <span className="hidden truncate text-xs text-zinc-500 sm:block">{student.phone || "Sin teléfono"}</span>}
      </button>; }) : <p role="status" className="p-3 text-center text-sm text-zinc-500">No se encontraron alumnos</p>}
    </div>}
  </div>;
}

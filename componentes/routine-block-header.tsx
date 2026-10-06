import type { ReactNode } from "react";

export function RoutineBlockHeader({ typeLabel, name, exerciseCount, showContent, compact, nameInput, dragHandle, actions, toggle }: {
  typeLabel: string;
  name: string;
  exerciseCount: number;
  showContent: boolean;
  compact: boolean;
  nameInput: ReactNode;
  dragHandle?: ReactNode;
  actions?: ReactNode;
  toggle: () => void;
}) {
  return <header className="routine-block-header">
    <span className="routine-block-kind rounded-lg bg-yellow-400 px-2 py-1 text-xs font-black text-zinc-950">{typeLabel}</span>
    <div className="routine-block-name">{compact && !showContent
      ? <div><p className="break-words text-sm font-bold">{name || "Bloque sin nombre"}</p><p className="mt-0.5 text-xs text-zinc-400">{exerciseCount} ejercicios</p></div>
      : nameInput}</div>
    {dragHandle && <div className="routine-block-grip">{dragHandle}</div>}
    {compact && <button type="button" onClick={toggle} aria-expanded={showContent} className="routine-block-toggle min-h-11 rounded-lg border border-zinc-700 px-3 text-sm font-bold">{showContent ? "Ocultar ejercicios" : "Ver ejercicios"}</button>}
    {actions && <div className="routine-block-actions">{actions}</div>}
  </header>;
}

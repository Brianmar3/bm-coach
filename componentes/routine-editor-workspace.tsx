"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { routineSeriesMetrics } from "@/lib/routine-metrics";
import { reorderItems } from "@/lib/routine-editor-state";
import type { ClassBaseRoutineDraft as Draft } from "@/lib/class-template-base";

export function RoutineDayNavigator({ draft, selected, select, change, add }: { draft: Draft; selected: number; select: (day: number) => void; change: (draft: Draft) => void; add: () => void }) {
  const dragging = useRef<number | null>(null);
  function move(from: number, to: number) {
    const active = draft.days.find(day => day.dayNumber === selected)?.clientId;
    const days = reorderItems(draft.days, from, to).map((day, index) => ({ ...day, dayNumber: index + 1 }));
    change({ ...draft, days }); select(days.find(day => day.clientId === active)?.dayNumber ?? 1);
  }
  return <nav className="routine-workspace-days" aria-label="Días de la rutina"><p className="routine-workspace-eyebrow">SEMANA</p>{draft.days.map((day, index) => <div key={day.clientId} className="routine-workspace-day" data-selected={selected === day.dayNumber} onDragOver={event => { if (dragging.current !== null) { event.preventDefault(); event.currentTarget.dataset.drop = "true"; } }} onDragLeave={event => { delete event.currentTarget.dataset.drop; }} onDrop={event => { event.preventDefault(); delete event.currentTarget.dataset.drop; if (dragging.current !== null) move(dragging.current, index); dragging.current = null; }}>
    <button type="button" className="routine-day-grip" draggable aria-label={`Arrastrar día ${day.dayNumber}; flechas para reordenar`} onDragStart={event => { dragging.current = index; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", day.clientId); }} onDragEnd={() => { dragging.current = null; }} onKeyDown={event => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); move(index, index + (["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1)); } }}>⠿</button>
    <button type="button" aria-current={selected === day.dayNumber ? "step" : undefined} onClick={() => select(day.dayNumber)}><span>Día {day.dayNumber}</span><strong>{day.name}</strong><small>{day.blocks.length} bloques · {day.blocks.reduce((sum, block) => sum + block.exercises.length, 0)} ejercicios{day.estimatedMinutes ? ` · ~${day.estimatedMinutes} min` : ""}</small></button>
  </div>)}<button type="button" className="routine-workspace-add-day" disabled={draft.days.length >= 14} onClick={add}>+ Día</button></nav>;
}

export function RoutineLiveSummary({ draft }: { draft: Draft }) {
  const metrics = routineSeriesMetrics(draft);
  return <aside className="routine-workspace-summary" aria-label="Resumen de programación"><p className="routine-workspace-eyebrow">PROGRAMA EN VIVO</p><dl>{[["Días", metrics.totalDays], ["Bloques", metrics.totalBlocks], ["Ejercicios", metrics.totalExercises], ["Series de fuerza", metrics.totalSeries]].map(([title, number]) => <div key={title}><dt>{title}</dt><dd>{number}</dd></div>)}</dl>{metrics.programmedMinutes > 0 && <p className="routine-workspace-muted">{metrics.programmedMinutes} min de bloques cronometrados</p>}{metrics.weeklyDistribution.length > 0 && <><h3>Distribución de series</h3>{metrics.weeklyDistribution.map(item => <div className="routine-workspace-distribution" key={item.muscleGroup}><span>{item.muscleGroup}</span><strong>{item.series}</strong><meter min={0} max={100} value={item.percentage} aria-label={`${item.muscleGroup}: ${item.series} series`}/></div>)}</>}<p className="routine-workspace-muted">El resumen cuenta lo programado. Los minutos no estiman la duración de las series de fuerza.</p></aside>;
}

export function RoutineEditorDialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="routine-editor-confirm" onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key === "Tab") {
      const targets = [...(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,[tabindex="0"]') ?? [])];
      if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0]?.focus(); }
    }
  }}><section ref={ref} role="dialog" aria-modal="true" aria-label={title}><h2>{title}</h2>{children}</section></div>;
}

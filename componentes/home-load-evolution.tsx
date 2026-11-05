import Link from "next/link";
import { BmChevronRightIcon, BmProgressIcon } from "@/componentes/icons";
import { homeLoadEvolution } from "@/lib/home-load-evolution";
import type { PortalWorkoutSession } from "@/types/portal";

const kg = (weight: number) => `${weight.toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg`;

export function HomeLoadEvolution({ sessions }: { sessions: PortalWorkoutSession[] }) {
  const items = homeLoadEvolution(sessions);
  return <section aria-label="Evolución de cargas" className="rounded-[22px] border border-yellow-400/25 bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] sm:px-5">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.14em] text-[var(--brand-text)]"><BmProgressIcon size={18} />Evolución de cargas</h2><Link href="/portal/progreso" className="inline-flex min-h-8 items-center text-xs font-semibold text-[var(--brand-text)]">Ver progreso <BmChevronRightIcon size={16} /></Link></div>
    {!items.length ? <p className="py-2 text-sm text-[var(--foreground-muted)]">Registrá tus pesos para ver tu evolución</p> : <>
      <div className="divide-y divide-[var(--input-border)]">{items.map(item => {
        const last = item.points.at(-1)!;
        const previous = item.points.at(-2);
        const delta = previous ? last.weight - previous.weight : null;
        const min = Math.min(...item.points.map(point => point.weight));
        const max = Math.max(...item.points.map(point => point.weight));
        const points = item.points.map((point, index) => `${4 + index * 92 / Math.max(1, item.points.length - 1)},${28 - (point.weight - min) * 24 / (max - min || 1)}`).join(" ");
        return <div key={item.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_5rem] items-center gap-2 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto_8rem] sm:text-sm">
          <span className="min-w-0 break-words font-semibold">{item.name}</span><span className="text-right"><strong>{kg(last.weight)}</strong>{delta !== null && <span className="mt-0.5 block text-[10px] text-[var(--brand-text)]">{delta > 0 ? "+" : ""}{kg(delta)}</span>}</span>
          {item.points.length > 1 ? <svg viewBox="0 0 100 32" role="img" aria-label={`${item.name}: ${item.points.map(point => `${point.date}: ${kg(point.weight)}`).join("; ")}`} className="h-8 w-full overflow-visible text-[var(--brand-text)]"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />{points.split(" ").map((point, index) => <circle key={index} cx={point.split(",")[0]} cy={point.split(",")[1]} r="2" fill="currentColor" />)}</svg> : <span className="text-right text-[10px] text-[var(--foreground-muted)]">Un registro</span>}
        </div>;
      })}</div><p className="mt-1 text-[10px] leading-snug text-[var(--foreground-muted)]">Máximo por sesión · series completadas · historial reciente</p>
    </>}
  </section>;
}

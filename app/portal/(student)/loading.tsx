export default function StudentPortalLoading() {
  return (
    <div aria-label="Cargando contenido" aria-busy="true" className="animate-pulse space-y-3 motion-reduce:animate-none">
      <div className="h-28 rounded-3xl border border-white/[.05] bg-zinc-900/80" />
      <div className="h-20 rounded-3xl border border-white/[.04] bg-zinc-900/65" />
      <div className="h-44 rounded-3xl border border-white/[.05] bg-zinc-900/75" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-24 rounded-2xl border border-white/[.04] bg-zinc-900/60" />
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";

const modules = [
  ["Alumnos", "Gestionar alumnos.", "/alumnos"], ["Rutinas", "Crear rutinas.", "/rutinas"], ["Clases", "Organizar horarios.", "/clases"], ["Pagos", "Control de cuotas y vencimientos.", "/pagos"], ["Eventos", "Planificar actividades y encuentros.", "/eventos"], ["Evaluaciones", "Seguimiento físico.", "/evaluaciones"], ["Configuración", "Ajustes del sistema.", "/configuracion"],
];

export default function Home() { return <main className="min-h-screen bg-zinc-950 p-6 text-white md:p-10"><div className="mx-auto max-w-6xl"><header className="mb-10"><p className="text-sm font-bold uppercase tracking-[.2em] text-yellow-400">BM Coach</p><h1 className="mt-2 text-4xl font-bold">Panel de administración</h1><p className="mt-2 text-zinc-400">Todo tu trabajo de coaching, organizado en un solo lugar.</p></header><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{modules.map(([title, description, href]) => <Link key={href} href={href} className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:-translate-y-1 hover:border-yellow-400/70"><h2 className="text-xl font-semibold group-hover:text-yellow-400">{title}</h2><p className="mt-2 text-sm text-zinc-400">{description}</p><span className="mt-5 inline-block text-sm font-semibold text-yellow-400">Abrir módulo →</span></Link>)}</div></div></main>; }

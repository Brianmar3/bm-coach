"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChangePasswordCard } from "@/componentes/portal-section";
import { BmBackIcon } from "@/componentes/icons";

export function StudentProfileSettingsPage({ page }: { page: "security" | "privacy" | "preferences" | "help" }) {
  const reduced = useReducedMotion();
  const content = {
    security: { eyebrow: "Seguridad", title: "Cambiar contraseña", body: <ChangePasswordCard /> },
    privacy: { eyebrow: "Privacidad", title: "Tus datos en BM Training", body: <Info><p>Tus datos se muestran únicamente dentro de tu cuenta.</p><p>Los datos administrativos de plan, servicio y estado los gestiona tu entrenador.</p><p>Los cambios de información personal que realices también se reflejan en tu ficha del entrenador.</p></Info> },
    preferences: { eyebrow: "Preferencias", title: "Movimiento y accesibilidad", body: <Info><p>BM Training respeta las preferencias de movimiento configuradas en tu dispositivo.</p><p>Movimiento reducido: <strong className="text-zinc-100">{reduced ? "activado" : "desactivado"}</strong>.</p><p>Podés cambiar esta preferencia desde los ajustes de accesibilidad de tu dispositivo.</p></Info> },
    help: { eyebrow: "Ayuda", title: "¿Cómo podemos ayudarte?", body: <Info><p>Usá Inicio para ver tu próxima actividad, Rutina para registrar el entrenamiento y la campana para consultar novedades.</p><p>Para modificar datos administrativos o resolver una consulta sobre tu plan, contactá a tu entrenador.</p><Link href="/portal/comentarios" className="inline-flex min-h-11 items-center rounded-xl border border-yellow-400/45 px-4 font-bold text-yellow-300">Enviar un comentario</Link></Info> },
  }[page];
  return <div className="mx-auto max-w-3xl pb-4"><Link href="/portal/perfil" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-800 px-4 text-sm text-zinc-300"><BmBackIcon size={18} /> Volver al perfil</Link><header className="mt-5"><p className="text-xs font-black uppercase tracking-[.2em] text-yellow-400">{content.eyebrow}</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{content.title}</h1></header><div className="mt-5">{content.body}</div></div>;
}

function Info({ children }: { children: ReactNode }) { return <section className="space-y-4 rounded-[24px] border border-yellow-400/20 bg-[linear-gradient(145deg,#151515,#0a0a0a)] p-5 text-sm leading-relaxed text-zinc-400 sm:p-6">{children}</section>; }
function useReducedMotion() { const [reduced, setReduced] = useState(false); useEffect(() => { const media = window.matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setReduced(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []); return reduced; }

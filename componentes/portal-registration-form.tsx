"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, type FormEvent } from "react";
import { PasswordField } from "@/componentes/password-field";
import { BmProfileIcon } from "@/componentes/icons";

export function PortalRegistrationForm() {
  const router = useRouter();
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setSaving(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/portal/registro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(fields)) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No pudimos crear tu cuenta.");
      router.replace("/portal/onboarding"); router.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : "No pudimos crear tu cuenta."); }
    finally { pending.current = false; setSaving(false); }
  }
  return <main className="grid min-h-[100dvh] place-items-center bg-black p-4 text-white"><section className="w-full max-w-md rounded-3xl border border-yellow-400/25 bg-zinc-900 p-5 sm:p-7">
    <Image src="/bm-training-mark.png" width={72} height={72} alt="BM Training" className="mx-auto" priority />
    <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest text-yellow-400">Cuenta autogestionada</p><h1 className="mt-2 text-center text-2xl font-bold">Empezá con tu perfil</h1><p className="mt-2 text-sm text-zinc-300">Creá tu cuenta sin entrenador asignado. Después te vamos a pedir tus datos iniciales.</p>
    <form onSubmit={submit} className="mt-5 space-y-4"><fieldset disabled={saving} className="space-y-4">
      {([{ name: "firstName", label: "Nombre", type: "text", autoComplete: "given-name", max: 80 }, { name: "lastName", label: "Apellido", type: "text", autoComplete: "family-name", max: 80 }, { name: "email", label: "Correo electrónico", type: "email", autoComplete: "email", max: 254 }, { name: "phone", label: "Teléfono", type: "tel", autoComplete: "tel", max: 40 }] as const).map((field) => <label key={field.name} className="block text-sm font-semibold">{field.label}<input name={field.name} type={field.type} autoComplete={field.autoComplete} required maxLength={field.max} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20" /></label>)}
      <PasswordField id="register-password" name="password" label="Contraseña" autoComplete="new-password" required minLength={10} maxLength={128} />
      <p className="text-xs text-zinc-300">Entre 10 y 128 caracteres, con mayúscula, minúscula y número.</p>
      <PasswordField id="register-confirm" name="confirmPassword" label="Repetir contraseña" autoComplete="new-password" required minLength={10} maxLength={128} />
      {error && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      <button type="submit" aria-busy={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black disabled:opacity-60"><BmProfileIcon size={20} />{saving ? "Creando cuenta…" : "Crear mi cuenta"}</button>
    </fieldset></form><Link className="mt-4 flex min-h-11 items-center justify-center text-sm font-semibold text-yellow-400" href="/portal/login">Ya tengo cuenta · Iniciar sesión</Link>
  </section></main>;
}

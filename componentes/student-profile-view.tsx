/* eslint-disable @next/next/no-img-element -- profile image is a preserved Blob URL or a bundled avatar */

import Link from "next/link";
import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatars";
import { studentServiceLabel } from "@/lib/student-service";
import type { PortalProfile } from "@/types/portal";

const showDate = (value: string) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR")
    : "Sin definir";

export function StudentProfileView({ profile }: { profile: PortalProfile }) {
  const shown = profile.profileImageUrl || DEFAULT_PROFILE_AVATAR.src;

  return (
    <div>
      <header className="rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-[#0b0b0b] p-4 shadow-[0_14px_34px_rgba(0,0,0,.24)] sm:p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-yellow-400/30 bg-black shadow-[0_0_20px_rgba(250,204,21,.08)]">
            <img
              src={shown}
              alt={`Avatar de ${profile.firstName} ${profile.lastName}`}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">
              {profile.firstName} {profile.lastName}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {profile.plan || "Plan sin definir"}
            </p>
            <p className="mt-1 text-xs capitalize text-emerald-300">
              Alumno {profile.status}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-zinc-800 pt-4">
          <h2 className="text-sm font-bold">Elegir avatar</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Elegí el avatar que más te represente.
          </p>
          <Link
            href="/portal/perfil/avatar"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-yellow-400/25 bg-yellow-400/[.04] px-4 py-2 text-sm font-bold text-yellow-300 transition hover:border-yellow-400/45 focus:outline-none focus:ring-2 focus:ring-yellow-300"
          >
            Cambiar avatar
          </Link>
        </div>
      </header>

      <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-semibold">Información personal y deportiva</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Item title="Teléfono" value={profile.phone} />
          <Item title="Correo" value={profile.email || "Sin correo"} />
          <Item title="Fecha de nacimiento" value={showDate(profile.birthDate)} />
          <Item title="Objetivo" value={profile.goal || "No definido"} />
          <Item
            title="Tipo de servicio"
            value={studentServiceLabel(profile.serviceType)}
          />
          <Item title="Plan" value={profile.plan} />
          <Item title="Fecha de ingreso" value={showDate(profile.joinedAt)} />
          <Item title="Estado" value={profile.status} />
        </dl>
        <p className="mt-5 text-xs text-zinc-500">
          Para modificar estos datos, contactá a tu entrenador.
        </p>
      </section>

      <Link
        href="/portal/configuracion"
        className="mt-4 flex min-h-14 items-center justify-between rounded-2xl border border-yellow-400/15 bg-gradient-to-r from-zinc-900 to-[#0d0d0d] px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,.2)] transition hover:border-yellow-400/30 focus:outline-none focus:ring-2 focus:ring-yellow-300"
      >
        <span>
          <strong className="block text-yellow-300">Configuración</strong>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Cuenta, seguridad y notificaciones
          </span>
        </span>
        <span aria-hidden="true" className="ml-3 text-yellow-400">›</span>
      </Link>

    </div>
  );
}

function Item({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{title}</dt>
      <dd className="mt-1 capitalize">{value || "Sin definir"}</dd>
    </div>
  );
}

import { PlatformSettingsForm } from "@/componentes/platform-settings-form";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";
import { loadPlatformSettings } from "@/lib/platform-settings-server";

export default async function PlatformSettingsPage() {
  await requirePlatformOwnerPage();
  const settings = await loadPlatformSettings();
  return <main className="px-4 py-5 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl"><div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.22em] text-yellow-400">Administración de plataforma</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Configuración</h1><p className="mt-1 text-sm text-zinc-400">Valores generales para nuevas cuentas e invitaciones.</p></div><PlatformSettingsForm initial={{ platformName: settings.platformName, supportEmail: settings.supportEmail, invitationDays: settings.invitationDays, defaultTrainerPlan: settings.defaultTrainerPlan, initialPeriodMonths: settings.initialPeriodMonths }} /></div></main>;
}

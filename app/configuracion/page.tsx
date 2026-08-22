"use client";

import { FormEvent, useMemo, useState } from "react";

import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { PushNotificationsCard } from "@/componentes/push-notifications-card";
import { useBrowserStore } from "@/lib/browser-store";
import { planId, planSelectionKey, validateCoachPlans, validatePaymentMethods } from "@/lib/coach-plans";
import { emptyTransferDetails, normalizeTransferDetails, validateTransferDetails } from "@/lib/transfer-payment";
import type { CoachSettings } from "@/types/gestion";

const defaults: CoachSettings = {
  id: "main",
  systemName: "BM Training",
  coachName: "",
  phone: "",
  email: "",
  address: "",
  currency: "ARS",
  dueDay: 10,
  paymentMethods: ["Transferencia", "Efectivo"],
  transferDetails: emptyTransferDetails,
  plans: [
    { id: "default-plan-2", name: "2 días por semana", price: 0 },
    { id: "default-plan-3", name: "3 días por semana", price: 0 },
    { id: "default-plan-4", name: "4 días por semana", price: 0 },
    { id: "default-plan-5", name: "5 días por semana", price: 0 },
  ],
  primaryColor: "#000000",
  accentColor: "#facc15",
  compactMode: false,
};

export default function ConfiguracionPage() {
  const { items, save, ready } = useBrowserStore<CoachSettings>(
    "bm-coach-settings",
    [],
  );
  const [settings, setSettings] = useState<CoachSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [methodKeys, setMethodKeys] = useState(() => Array.from({ length: 64 }, () => crypto.randomUUID()));
  const stored = items[0];
  const hydratedPlans = useMemo(() => stored?.plans.map((plan) => ({
    ...plan,
    id: planId(plan) || crypto.randomUUID(),
  })) ?? [], [stored]);
  const value =
    settings ??
    (stored
      ? {
          ...stored,
          id: stored.id ?? "main",
          plans: hydratedPlans.length ? hydratedPlans : defaults.plans,
          transferDetails: normalizeTransferDetails(stored.transferDetails),
        }
      : defaults);
  function update<K extends keyof CoachSettings>(
    key: K,
    next: CoachSettings[K],
  ) {
    setSettings({ ...value, [key]: next });
    setSaved(false);
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateCoachPlans(value.plans) ?? validatePaymentMethods(value.paymentMethods) ?? validateTransferDetails(value.transferDetails);
    if (validationError) {
      setError(validationError);
      setSaved(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await save([value]);
      setSettings(result.settings ?? value);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar los cambios.");
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }

  function addPlan() {
    update("plans", [...value.plans, { id: crypto.randomUUID(), name: "Nuevo plan", price: 0 }]);
  }

  function addMethod() {
    setMethodKeys((current) => current.map((key, index) => index === value.paymentMethods.length ? crypto.randomUUID() : key));
    update("paymentMethods", [...value.paymentMethods, "Nuevo método"]);
  }

  return (
    <ModuleShell
      title="Configuración"
      subtitle="Personalizá tu sistema, cobros e identidad de marca."
      action={
        <button
          form="settings-form"
          disabled={saving}
          className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      }
    >
      <form id="settings-form" onSubmit={submit} className="space-y-6">
        {saved && (
          <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">
            Configuración guardada correctamente.
          </p>
        )}
        {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="font-semibold">Datos del sistema</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Nombre del sistema">
              <input
                value={value.systemName}
                onChange={(event) => update("systemName", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Nombre del entrenador">
              <input
                value={value.coachName}
                onChange={(event) => update("coachName", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Teléfono">
              <input
                value={value.phone}
                onChange={(event) => update("phone", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Correo">
              <input
                type="email"
                value={value.email}
                onChange={(event) => update("email", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Dirección">
              <input
                value={value.address}
                onChange={(event) => update("address", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Moneda">
              <select
                value={value.currency}
                onChange={(event) => update("currency", event.target.value)}
                className={inputClass}
              >
                <option value="ARS">Peso argentino (ARS)</option>
                <option value="USD">Dólar estadounidense (USD)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="font-semibold">Cobros y planes</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Día habitual de vencimiento">
              <input
                type="number"
                min="1"
                max="31"
                value={value.dueDay}
                onChange={(event) => update("dueDay", Number(event.target.value))}
                className={inputClass}
              />
            </Field>
            <div>
              <p className="text-sm">Métodos de pago disponibles</p>
              <div className="mt-2 space-y-2">
                {value.paymentMethods.map((method, index) => (
                  <div key={methodKeys[index] ?? `pending-method-${index}`} className="flex gap-2">
                    <input
                      value={method}
                      onChange={(event) =>
                        update(
                          "paymentMethods",
                          value.paymentMethods.map((current, currentIndex) =>
                            currentIndex === index ? event.target.value : current,
                          ),
                        )
                      }
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMethodKeys((current) => current.filter((_, currentIndex) => currentIndex !== index));
                        update(
                          "paymentMethods",
                          value.paymentMethods.filter(
                            (_, currentIndex) => currentIndex !== index,
                          ),
                        );
                      }}
                      className="text-red-300"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addMethod}
                  className="text-sm text-yellow-400"
                >
                  + Agregar método
                </button>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <p className="text-sm font-semibold">Datos para transferencias</p>
            <p className="mt-1 text-xs text-zinc-500">Se muestran al alumno de forma informativa. Configurá al menos alias o CBU/CVU.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Titular">
                <input value={value.transferDetails?.holder ?? ""} onChange={(event) => update("transferDetails", { ...normalizeTransferDetails(value.transferDetails), holder: event.target.value })} className={inputClass} />
              </Field>
              <Field label="Banco o billetera">
                <input value={value.transferDetails?.institution ?? ""} onChange={(event) => update("transferDetails", { ...normalizeTransferDetails(value.transferDetails), institution: event.target.value })} className={inputClass} />
              </Field>
              <Field label="Alias">
                <input value={value.transferDetails?.alias ?? ""} onChange={(event) => update("transferDetails", { ...normalizeTransferDetails(value.transferDetails), alias: event.target.value })} className={inputClass} />
              </Field>
              <Field label="CBU o CVU">
                <input inputMode="numeric" value={value.transferDetails?.accountNumber ?? ""} onChange={(event) => update("transferDetails", { ...normalizeTransferDetails(value.transferDetails), accountNumber: event.target.value })} className={inputClass} />
              </Field>
            </div>
          </div>
          <div className="mt-5">
            <p className="text-sm">Precios de planes</p>
            <div className="mt-2 space-y-2">
              {value.plans.map((plan, index) => (
                <div
                  key={`${planSelectionKey(plan)}:${index}`}
                  className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"
                >
                  <input
                    value={plan.name}
                    onChange={(event) =>
                      update(
                        "plans",
                        value.plans.map((current, currentIndex) =>
                          currentIndex === index
                            ? { ...current, name: event.target.value }
                            : current,
                        ),
                      )
                    }
                    placeholder="Nombre del plan"
                    className={inputClass}
                  />
                  <input
                    type="number"
                    min="0"
                    value={plan.price}
                    onChange={(event) =>
                      update(
                        "plans",
                        value.plans.map((current, currentIndex) =>
                          currentIndex === index
                            ? { ...current, price: Number(event.target.value) }
                            : current,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "plans",
                        value.plans.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      )
                    }
                    className="text-red-300"
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addPlan}
                className="mt-2 text-sm text-yellow-400"
              >
                + Agregar plan
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="font-semibold">Marca y preferencias</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Color principal">
              <input
                type="color"
                value={value.primaryColor}
                onChange={(event) => update("primaryColor", event.target.value)}
                className="mt-1 h-11 w-full rounded-lg bg-zinc-950 p-1"
              />
            </Field>
            <Field label="Color de acento">
              <input
                type="color"
                value={value.accentColor}
                onChange={(event) => update("accentColor", event.target.value)}
                className="mt-1 h-11 w-full rounded-lg bg-zinc-950 p-1"
              />
            </Field>
            <div>
              <p className="text-sm">Logo</p>
              <div className="mt-1 rounded-lg border border-dashed border-zinc-700 p-3 text-sm text-zinc-400">
                Logo actual: <code>/public/bm-training-logo.png</code>
              </div>
            </div>
            <label className="flex items-center gap-3 pt-6 text-sm">
              <input
                type="checkbox"
                checked={value.compactMode}
                onChange={(event) => update("compactMode", event.target.checked)}
              />
              Usar interfaz compacta
            </label>
          </div>
        </section>

        <PushNotificationsCard audience="trainer" />

        {!ready && (
          <p className="text-sm text-zinc-500">Cargando configuración…</p>
        )}
      </form>
    </ModuleShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

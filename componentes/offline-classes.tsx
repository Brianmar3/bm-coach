"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { offlineStore } from "@/lib/offline-training-store";
import { finishOfflineLogout, LOGOUT_PENDING, OFFLINE_ACCOUNT_REVISION, logoutOfflineTraining, prepareShell } from "@/lib/offline-training-client";
import { offlineScope } from "@/lib/offline-training-types";
import { canReadOfflineClasses, type OfflineClassesSnapshot, type OfflineClassScope } from "@/lib/offline-classes";

type ClassCopy = Pick<OfflineClassesSnapshot, "agenda" | "summary">;
const SaveClassCopy = createContext<(response: Response, copy: () => ClassCopy) => void>(() => {});
export const useSaveClassCopy = () => useContext(SaveClassCopy);

export function OfflineClassesBoundary({ scope, children }: { scope?: OfflineClassScope; children: ReactNode }) {
  const key = scope?.key;
  const expiresAt = scope?.expiresAt;
  const binding = useRef<Promise<boolean> | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!key || !expiresAt) return;
    const controller = new AbortController();
    const update = () => setOnline(navigator.onLine);
    const bind = () => {
      update();
      if (!navigator.onLine || localStorage.getItem(LOGOUT_PENDING)) return;
      const revision = localStorage.getItem(OFFLINE_ACCOUNT_REVISION);
      const isCurrent = () => !controller.signal.aborted && !localStorage.getItem(LOGOUT_PENDING)
        && localStorage.getItem(OFFLINE_ACCOUNT_REVISION) === revision;
      binding.current = (async () => {
        const response = await fetch("/api/portal/session", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return false;
        const { offlineIdentity: identity, mustChangePassword } = await response.json();
        if (!identity || mustChangePassword || !isCurrent()
          || offlineScope(identity.studentId, identity.workspaceId, identity.sessionId) !== key) return false;
        await offlineStore.bindClasses({ key, expiresAt, accountRevision: revision }, isCurrent);
        void prepareShell().catch(() => {});
        return isCurrent();
      })().catch(() => false);
    };
    bind();
    window.addEventListener("online", bind);
    window.addEventListener("offline", update);
    return () => {
      controller.abort();
      binding.current = null;
      window.removeEventListener("online", bind);
      window.removeEventListener("offline", update);
    };
  }, [key, expiresAt]);

  const save = useCallback((response: Response, copy: () => ClassCopy) => {
    if (!key || response.headers.get("X-BM-Offline-Scope") !== key) return;
    void binding.current?.then((bound) => {
      if (bound && !localStorage.getItem(LOGOUT_PENDING)) return offlineStore.saveClasses(key, copy());
    }).catch(() => {});
  }, [key]);

  if (key && !online) return <OfflineClassesPage scopeKey={key} />;
  return <SaveClassCopy.Provider value={save}>{children}</SaveClassCopy.Provider>;
}

const savedDate = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });
const classDate = new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeZone: "UTC" });

export function OfflineClassesPage({ scopeKey }: { scopeKey?: string }) {
  const [snapshot, setSnapshot] = useState<OfflineClassesSnapshot>();
  const [loaded, setLoaded] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const retry = useCallback(() => {
    void (async () => {
      if (navigator.onLine) await finishOfflineLogout();
      if (window.location.pathname === "/portal/offline") window.location.replace("/portal");
      else window.location.reload();
    })().catch(() => setLogoutError(true));
  }, []);

  useEffect(() => {
    let stopped = false;
    let revision = 0;
    const load = () => {
      const current = ++revision;
      void offlineStore.classes().catch(() => undefined).then((value) => {
        if (stopped || current !== revision) return;
        setSnapshot(!localStorage.getItem(LOGOUT_PENDING) && canReadOfflineClasses(value, scopeKey)
          && value.scope.accountRevision === localStorage.getItem(OFFLINE_ACCOUNT_REVISION) ? value : undefined);
        setLoaded(true);
      });
    };
    load();
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("bm-offline-training");
    if (channel) channel.onmessage = ({ data }) => { if (data === "logout" || data === "classes-cleared") { setSnapshot(undefined); load(); } };
    const accountChange = (event: StorageEvent) => {
      if (event.key === OFFLINE_ACCOUNT_REVISION || event.key === LOGOUT_PENDING || event.key === null) {
        ++revision;
        setSnapshot(undefined);
      }
    };
    window.addEventListener("storage", accountChange);
    window.addEventListener("pageshow", load);
    if (!scopeKey) window.addEventListener("online", retry);
    return () => {
      stopped = true;
      channel?.close();
      window.removeEventListener("storage", accountChange);
      window.removeEventListener("pageshow", load);
      window.removeEventListener("online", retry);
    };
  }, [retry, scopeKey]);

  return <main className="mx-auto max-w-2xl space-y-4 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
    <section className="rounded-2xl border border-zinc-500/30 bg-[var(--background)] p-5">
      <p className="text-sm font-bold text-[var(--brand-text)]">BM Training</p>
      <h1 className="mt-2 text-2xl font-bold">Sin conexión a internet</h1>
      <p role="status" className="mt-2 text-sm text-[var(--foreground-muted)]">{snapshot ? "Última información guardada. Puede haber cambiado desde entonces." : loaded ? "No hay información guardada para mostrar. Conectate para abrir el portal." : "Buscando información guardada…"}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={retry} className="min-h-11 rounded-xl border border-zinc-500/40 px-4 text-sm font-semibold">Reintentar</button>
        {snapshot && <button type="button" onClick={() => {
          void logoutOfflineTraining().then((closed) => { if (closed) window.location.assign("/portal/login"); }).catch(() => setLogoutError(true));
        }} className="min-h-11 px-2 text-sm">Cerrar sesión</button>}
      </div>
      {logoutError && <p role="alert" className="mt-2 text-sm">No se pudo completar el cierre de sesión. Reintentá.</p>}
    </section>
    {snapshot?.agenda && <section className="rounded-2xl border border-zinc-500/30 p-5">
      <h2 className="font-bold">Próximas clases al guardar</h2>
      <p className="mt-1 text-xs text-[var(--foreground-muted)]">{savedDate.format(new Date(snapshot.agenda.savedAt))}</p>
      {snapshot.agenda.classes.length ? <ul className="mt-2 divide-y divide-zinc-500/20">
        {snapshot.agenda.classes.map((item) => <li key={item.id} className="break-words py-2">
          <p className="font-semibold">{item.name}</p>
          <p className="text-sm text-[var(--foreground-muted)]">{classDate.format(new Date(`${item.date}T12:00:00Z`))} · {item.startTime}–{item.endTime}</p>
        </li>)}
      </ul> : <p className="mt-2 text-sm">No había próximas clases disponibles al guardar.</p>}
    </section>}
    {snapshot?.summary && <section className="rounded-2xl border border-zinc-500/30 p-5">
      <h2 className="font-bold">Asistencias y puntos del mes al guardar</h2>
      <p className="mt-1 text-xs text-[var(--foreground-muted)]">{savedDate.format(new Date(snapshot.summary.savedAt))}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><dt>Asistencias</dt><dd className="font-bold text-[var(--brand-text)]">{snapshot.summary.attendance}</dd></div>
        <div><dt>Puntos</dt><dd className="font-bold text-[var(--brand-text)]">{snapshot.summary.points}</dd></div>
      </dl>
    </section>}
  </main>;
}

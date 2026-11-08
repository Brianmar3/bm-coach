"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { offlineStore } from "@/lib/offline-training-store";
import { finishOfflineLogout, LOGOUT_PENDING, OFFLINE_ACCOUNT_REVISION, logoutOfflineTraining, prepareShell } from "@/lib/offline-training-client";
import { offlineScope } from "@/lib/offline-training-types";
import { canReadOfflineClasses, OFFLINE_EXERCISE_PAGE_SIZE, OFFLINE_EXERCISES_CHANGED, type SavedExercises, type OfflineClassesSnapshot, type OfflineClassScope } from "@/lib/offline-classes";
import { BmCalendarIcon, BmDumbbellIcon, BmHistoryIcon } from "@/componentes/icons";

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
    let exercisesRequest: AbortController | undefined;
    const refreshExercises = () => {
      if (!navigator.onLine) return;
      exercisesRequest?.abort();
      const request = new AbortController();
      exercisesRequest = request;
      const revision = localStorage.getItem(OFFLINE_ACCOUNT_REVISION);
      void binding.current?.then(async (bound) => {
        if (!bound || request.signal.aborted) return;
        const response = await fetch("/api/portal/offline-exercises", { cache: "no-store", signal: request.signal });
        if (!response.ok || response.headers.get("X-BM-Offline-Scope") !== key) return;
        const exercises = await response.json() as SavedExercises;
        if (request.signal.aborted || localStorage.getItem(LOGOUT_PENDING)
          || localStorage.getItem(OFFLINE_ACCOUNT_REVISION) !== revision) return;
        await offlineStore.saveClasses(key, { exercises });
      }).catch(() => {});
    };
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
      refreshExercises();
    };
    bind();
    window.addEventListener("online", bind);
    window.addEventListener("offline", update);
    window.addEventListener("focus", refreshExercises);
    window.addEventListener(OFFLINE_EXERCISES_CHANGED, refreshExercises);
    return () => {
      controller.abort();
      exercisesRequest?.abort();
      binding.current = null;
      window.removeEventListener("online", bind);
      window.removeEventListener("offline", update);
      window.removeEventListener("focus", refreshExercises);
      window.removeEventListener(OFFLINE_EXERCISES_CHANGED, refreshExercises);
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
const classDate = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const recordDate = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const weightFormat = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const localDay = (date: string) => new Date(`${date}T12:00:00Z`);
const panel = "rounded-2xl border border-[var(--input-border)] bg-[var(--background)] p-4";
const sectionTitle = "flex items-center gap-2 text-sm font-bold";

export function OfflineClassesPage({ scopeKey }: { scopeKey?: string }) {
  const [snapshot, setSnapshot] = useState<OfflineClassesSnapshot>();
  const [loaded, setLoaded] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [visibleExercises, setVisibleExercises] = useState(OFFLINE_EXERCISE_PAGE_SIZE);
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

  const updatedAt = [snapshot?.agenda?.savedAt, snapshot?.summary?.savedAt, snapshot?.exercises?.savedAt].filter(Boolean).sort().at(-1);
  const exercises = snapshot?.exercises;
  return <main className="mx-auto max-w-2xl space-y-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
    <section className={`${panel} border-t-2 border-t-yellow-400/60`}>
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-text)]">BM Training</p>
      <h1 className="mt-2 text-xl font-bold sm:text-2xl">Sin conexión a internet</h1>
      <p role="status" className="mt-1.5 text-sm leading-relaxed text-[var(--foreground-muted)]">{snapshot ? "Última información guardada. Podés consultarla sin conexión." : loaded ? "No hay información guardada para mostrar. Conectate para abrir el portal." : "Buscando información guardada…"}</p>
      {updatedAt && <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]"><BmHistoryIcon size={15} aria-hidden="true" /> Actualizado: <time dateTime={updatedAt}>{savedDate.format(new Date(updatedAt))}</time></p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <button type="button" onClick={retry} className="min-h-11 rounded-xl bg-yellow-400 px-3 text-sm font-bold text-zinc-950">Reintentar conexión</button>
        {snapshot && <button type="button" onClick={() => {
          void logoutOfflineTraining().then((closed) => { if (closed) window.location.assign("/portal/login"); }).catch(() => setLogoutError(true));
        }} className="min-h-11 px-2 text-sm">Cerrar sesión</button>}
      </div>
      {logoutError && <p role="alert" className="mt-2 text-sm">No se pudo completar el cierre de sesión. Reintentá.</p>}
    </section>
    {(snapshot?.agenda || snapshot?.summary) && <section className={panel}>
      {snapshot.agenda && <>
        <h2 className={sectionTitle}><BmCalendarIcon size={17} className="text-[var(--brand-text)]" aria-hidden="true" /> Próximas clases al guardar</h2>
        <time className="mt-1 block text-xs text-[var(--foreground-muted)]" dateTime={snapshot.agenda.savedAt}>{savedDate.format(new Date(snapshot.agenda.savedAt))}</time>
        {snapshot.agenda.classes.length ? <ul className="mt-1 divide-y divide-zinc-500/20">
          {snapshot.agenda.classes.map((item) => <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
            <span className="min-w-0 break-words font-semibold">{item.name}</span>
            <span className="text-xs text-[var(--foreground-muted)]">{classDate.format(localDay(item.date))} · {item.startTime}–{item.endTime}</span>
          </li>)}
        </ul> : <p className="mt-2 text-sm">No había próximas clases disponibles al guardar.</p>}
      </>}
      {snapshot.summary && <div className={snapshot.agenda ? "mt-2 border-t border-zinc-500/20 pt-3" : ""}>
        <h2 className={sectionTitle}>Asistencias y puntos del mes al guardar</h2>
        <time className="mt-1 block text-xs text-[var(--foreground-muted)]" dateTime={snapshot.summary.savedAt}>{savedDate.format(new Date(snapshot.summary.savedAt))}</time>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-xs text-[var(--foreground-muted)]">
          <div><dt>Asistencias</dt><dd className="text-lg font-bold text-[var(--brand-text)]">{snapshot.summary.attendance}</dd></div>
          <div><dt>Puntos</dt><dd className="text-lg font-bold text-[var(--brand-text)]">{snapshot.summary.points}</dd></div>
        </dl>
      </div>}
    </section>}
    {snapshot && <section className={panel}>
      <h2 className={sectionTitle}><BmDumbbellIcon size={17} className="text-[var(--brand-text)]" aria-hidden="true" /> Mis registros</h2>
      {!exercises ? <p className="mt-2 text-sm text-[var(--foreground-muted)]">Conectate para guardar tus registros en este dispositivo.</p> : <>
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">Cargas guardadas · <time dateTime={exercises.savedAt}>{savedDate.format(new Date(exercises.savedAt))}</time></p>
        {exercises.exercises.length === 0 ? <p className="mt-2 text-sm">Todavía no tenés ejercicios registrados</p> : <>
          <ul className="mt-1 divide-y divide-zinc-500/20">
            {exercises.exercises.slice(0, visibleExercises).map((item) => <li key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2">
              <span className="min-w-0 break-words text-sm font-semibold">{item.name}</span>
              <span className="max-w-28 break-words text-right text-sm font-bold tabular-nums text-[var(--brand-text)]">{weightFormat.format(item.weight)} {item.unit}</span>
              <span className="col-span-2 mt-0.5 text-xs text-[var(--foreground-muted)]">Último registro: <time dateTime={item.date}>{recordDate.format(localDay(item.date))}</time> · {item.sets} {item.sets === 1 ? "serie" : "series"} · {item.repetitions} reps en la última serie</span>
            </li>)}
          </ul>
          {visibleExercises < exercises.exercises.length && <button type="button" onClick={() => setVisibleExercises((count) => count + OFFLINE_EXERCISE_PAGE_SIZE)} className="mt-1 min-h-11 rounded-xl border border-[var(--input-border)] px-3 text-sm font-semibold text-[var(--brand-text)]">Ver más ejercicios</button>}
        </>}
      </>}
    </section>}
  </main>;
}

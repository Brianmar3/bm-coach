"use client";
import { offlineStore } from "./offline-training-store";
import { nextOfflineRecord, offlineRecordKey, type OfflineTrainingSnapshot, type OfflineWorkoutRecord } from "./offline-training-types";
import { syncOfflineQueue } from "./offline-training-sync";
import type { PortalWorkoutSession } from "@/types/portal";
import { validateWorkoutSessionInput } from "./workout-session-validation";
import { getWeekKey } from "./workout-week";

let snapshot: OfflineTrainingSnapshot | undefined;
let records: OfflineWorkoutRecord[] = [];
let writes: Promise<unknown> = Promise.resolve();
let refreshing: Promise<void> | null = null;
let lastError = "";
let generation = 0;
let shellPrepared = false;
const LOGOUT_PENDING = "bm-offline-logout-pending-v1";
const EVENT = "bm:offline-training";
function changed() { if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT)); }
export function offlineTrainingState() { return { snapshot, pending: records.filter((r) => r.scope === snapshot?.scope && r.pending).length, error: lastError }; }
export async function finishOfflineLogout() {
  if (!localStorage.getItem(LOGOUT_PENDING)) return;
  if (!navigator.onLine) throw new Error("El cierre de sesión se completará cuando vuelva internet.");
  const response = await fetch("/api/portal/logout", { method: "POST", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("No se pudo completar el cierre de sesión. Reintentá con conexión.");
  localStorage.removeItem(LOGOUT_PENDING);
}
export async function logoutOfflineTraining() {
  if (offlineTrainingState().pending && !window.confirm("Hay entrenamientos pendientes. Cerrar sesión borrará estos registros del dispositivo. ¿Continuar?")) return false;
  localStorage.setItem(LOGOUT_PENDING, "1");
  await clearOfflineTraining();
  await finishOfflineLogout().catch(() => {});
  return true;
}
async function prepareShell() {
  if (shellPrepared) return;
  if (!("serviceWorker" in navigator)) throw new Error("Este navegador no permite reabrir la rutina sin conexión.");
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("No se pudo activar la apertura offline. Reintentá con conexión.")), 10000); })]).finally(() => clearTimeout(timeout));
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); reject(new Error("No se pudo preparar la apertura offline. Reintentá con conexión.")); }, 15000);
    channel.port1.onmessage = (event) => { clearTimeout(timeout); channel.port1.close(); if (event.data?.ready) { shellPrepared = true; resolve(); } else reject(new Error("No se pudo descargar la pantalla offline. Reintentá con conexión.")); };
    registration.active?.postMessage({ type: "BM_PREPARE_OFFLINE" }, [channel.port2]);
  });
}
export function subscribeOfflineTraining(listener: () => void) { window.addEventListener(EVENT, listener); return () => window.removeEventListener(EVENT, listener); }
export async function hydrateOfflineTraining() {
  const epoch = generation;
  await writes.catch(() => {});
  const next = await offlineStore.snapshot();
  const nextRecords = await offlineStore.records();
  if (epoch !== generation) return snapshot;
  snapshot = localStorage.getItem(LOGOUT_PENDING) ? undefined : next; records = nextRecords; changed();
  return snapshot;
}
export function forgetOfflineTrainingMemory() { generation++; snapshot = undefined; records = []; lastError = ""; changed(); }
export async function clearOfflineTraining() {
  forgetOfflineTrainingMemory();
  await writes.catch(() => {}); await offlineStore.clear();
  // The small legacy drafts and timers must not survive account changes either.
  for (const key of Object.keys(localStorage)) if (/^(bm.*workout|bm.*timer|bm.*rest)/i.test(key)) localStorage.removeItem(key);
  if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel("bm-offline-training"); channel.postMessage("logout"); channel.close(); }
}
export function offlineWorkoutData() {
  if (!snapshot || localStorage.getItem(LOGOUT_PENDING)) return null;
  const local = records.filter((r) => r.scope === snapshot!.scope && r.payload.routineId === snapshot!.data.routine?.id);
  return { ...snapshot.data, workoutSessions: [...local.map((r) => ({ ...r.payload, id: r.serverId ?? r.payload.id })), ...snapshot.data.workoutSessions.filter((session) => !local.some((r) => r.serverId === session.id || offlineRecordKey(snapshot!.scope, session) === r.key))] };
}
export function offlineWorkoutDraft(routineId: string, dayId: string, week: string) {
  const record = records.find((r) => r.scope === snapshot?.scope && r.payload.routineId === routineId && r.payload.dayId === dayId && r.key === JSON.stringify([snapshot.scope, routineId, dayId, week]));
  return record?.payload.status === "en_progreso" ? JSON.stringify({ ...record.payload, id: record.serverId ?? record.payload.id }) : null;
}
export function hasOfflineTraining(studentId: string) { return snapshot?.studentId === studentId && !localStorage.getItem(LOGOUT_PENDING); }
export async function stageOfflineWorkout(payload: PortalWorkoutSession) {
  const current = snapshot;
  if (!current || localStorage.getItem(LOGOUT_PENDING)) throw new Error("No hay una rutina disponible sin conexión en esta cuenta.");
  const epoch = generation;
  const copy = structuredClone(payload);
  const key = offlineRecordKey(current.scope, copy);
  const next = nextOfflineRecord(records.find((r) => r.key === key), current, copy, crypto.randomUUID());
  records = [...records.filter((r) => r.key !== key), next]; changed();
  const write = writes.catch(() => {}).then(async () => {
    if (epoch !== generation) return;
    await offlineStore.updateRecord(key, (previous) => nextOfflineRecord(previous, current, copy, next.clientId));
  });
  writes = write;
  try { await write; } catch { lastError = "No se pudo guardar en este dispositivo. Liberá espacio antes de cerrar la app."; changed(); throw new Error(lastError); }
}
async function verifiedSession(current: OfflineTrainingSnapshot) {
  const response = await fetch("/api/portal/session", { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (response.status === 401) throw new Error("Ingresá nuevamente con la misma cuenta para sincronizar. Los registros siguen guardados.");
  if (!response.ok) throw new Error("No pudimos verificar la sesión. Los registros siguen guardados.");
  const body = await response.json() as { offlineIdentity?: { studentId: string; workspaceId: string; sessionId: string }; mustChangePassword?: boolean };
  const identity = body.offlineIdentity;
  if (!identity || identity.studentId !== current.studentId || identity.workspaceId !== current.workspaceId) { await clearOfflineTraining(); throw new Error("La cuenta cambió. Prepará su rutina con conexión."); }
  if (body.mustChangePassword) throw new Error("Actualizá tu contraseña para sincronizar. Los registros siguen guardados.");
}
export async function reconcileOfflineLogin(identity?: { studentId: string; workspaceId: string | null }) {
  const current = await hydrateOfflineTraining();
  if (current && identity && (current.studentId !== identity.studentId || current.workspaceId !== identity.workspaceId)) { await clearOfflineTraining(); return; }
  if (current) await verifiedSession(current);
}
async function flush() {
  const confirmations = new Map<string, { id?: string; [field: string]: unknown }>();
  await writes;
  const current = snapshot;
  if (!current || !navigator.onLine) return confirmations;
  await verifiedSession(current);
  const work = async () => {
    await syncOfflineQueue(current, offlineStore, async (record) => {
      if (snapshot?.scope !== current.scope) throw new Error("La cuenta cambió.");
      const response = await fetch("/api/portal/entrenamientos", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ ...record.payload, id: record.serverId ?? record.payload.id, offline: { clientSessionId: record.clientId, proof: record.proof } }) });
      const body = await response.json() as { id?: string; error?: string; reused?: boolean; status?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo sincronizar. Se reintentará.");
      confirmations.set(record.key, body);
      return body;
    });
  };
  if (navigator.locks) await navigator.locks.request("bm-offline-training-sync", work); else await work();
  records = await offlineStore.records(); lastError = ""; changed();
  return confirmations;
}
export function refreshOfflineTraining() {
  if (refreshing) return refreshing;
  const epoch = generation;
  refreshing = (async () => {
    try {
      await hydrateOfflineTraining();
      if (epoch !== generation) return;
      if (!navigator.onLine) return;
      if (localStorage.getItem(LOGOUT_PENDING)) { await finishOfflineLogout(); return; }
      await prepareShell();
      if (snapshot) await flush();
      // Finish pending/active workouts using their original program before downloading a replacement.
      if (records.some((r) => r.scope === snapshot?.scope && (r.pending || r.payload.status === "en_progreso" && getWeekKey(r.payload.date) === getWeekKey()))) return;
      const response = await fetch("/api/portal/offline", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if ([401, 403, 404].includes(response.status)) { if (snapshot) await clearOfflineTraining(); return; }
      if (!response.ok) throw new Error("No se pudo actualizar la copia sin conexión.");
      const next = await response.json() as OfflineTrainingSnapshot;
      if (epoch !== generation || localStorage.getItem(LOGOUT_PENDING)) return;
      if (snapshot && snapshot.scope !== next.scope) await clearOfflineTraining();
      await offlineStore.putSnapshot(next); snapshot = next; changed();
    } catch (error) { lastError = error instanceof Error ? error.message : "No se pudo sincronizar."; changed(); }
    finally { refreshing = null; }
  })();
  return refreshing;
}
export async function saveOfflineWorkout(payload: PortalWorkoutSession): Promise<{ id?: string; offlinePending?: boolean }> {
  const invalid = validateWorkoutSessionInput(payload);
  if (invalid) throw new Error(invalid);
  await stageOfflineWorkout(payload);
  let confirmation: { id?: string; [field: string]: unknown } | undefined;
  try { confirmation = (await flush()).get(offlineRecordKey(snapshot?.scope ?? "", payload)); } catch (error) { lastError = error instanceof Error ? error.message : "Pendiente de sincronización"; records = await offlineStore.records(); changed(); }
  const record = records.find((r) => r.key === offlineRecordKey(snapshot?.scope ?? "", payload));
  return { ...confirmation, id: record?.serverId, offlinePending: record?.pending ?? true };
}

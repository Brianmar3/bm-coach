import type { OfflineTrainingSnapshot, OfflineWorkoutRecord } from "./offline-training-types";

export type OfflineQueueStore = {
  records(): Promise<OfflineWorkoutRecord[]>;
  updateRecord(key: string, update: (record: OfflineWorkoutRecord | undefined) => OfflineWorkoutRecord | undefined): Promise<void>;
};
export async function syncOfflineQueue(snapshot: OfflineTrainingSnapshot, store: OfflineQueueStore, send: (record: OfflineWorkoutRecord) => Promise<{ id?: string }>) {
  const records = (await store.records()).filter((r) => r.scope === snapshot.scope && r.pending).sort((a, b) => a.payload.date.localeCompare(b.payload.date) || a.payload.startTime.localeCompare(b.payload.startTime) || a.updatedAt.localeCompare(b.updatedAt));
  for (const sent of records) {
    try {
      const response = await send(sent);
      if (!response.id) throw new Error("El servidor no confirmó el registro.");
      await store.updateRecord(sent.key, (current) => current && current.scope === sent.scope ? { ...current, serverId: response.id, payload: { ...current.payload, id: response.id }, pending: current.revision !== sent.revision, error: undefined } : current);
    } catch (error) {
      await store.updateRecord(sent.key, (current) => current && current.scope === sent.scope ? { ...current, pending: true, error: error instanceof Error ? error.message : "No se pudo sincronizar." } : current);
      throw error; // Keep chronological order and retry from the first unacknowledged record.
    }
  }
}

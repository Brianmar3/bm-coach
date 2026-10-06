import type { OfflineTrainingSnapshot, OfflineWorkoutRecord } from "./offline-training-types";
export const OFFLINE_DB = "bm-training-offline-v1";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("state"); request.result.createObjectStore("records", { keyPath: "key" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction<T>(store: "state" | "records", mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = operation(tx.objectStore(store));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? request.error); };
  });
}
export const offlineStore = {
  snapshot: () => transaction<OfflineTrainingSnapshot | undefined>("state", "readonly", (s) => s.get("active")),
  records: () => transaction<OfflineWorkoutRecord[]>("records", "readonly", (s) => s.getAll()),
  putSnapshot: (value: OfflineTrainingSnapshot) => transaction("state", "readwrite", (s) => s.put(value, "active")),
  putRecord: (value: OfflineWorkoutRecord) => transaction("records", "readwrite", (s) => s.put(value)),
  async clear() {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["state", "records"], "readwrite");
      tx.objectStore("state").clear(); tx.objectStore("records").clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    });
  },
  async updateRecord(key: string, update: (record: OfflineWorkoutRecord | undefined) => OfflineWorkoutRecord | undefined) {
    const db = await database();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("records", "readwrite"); const store = tx.objectStore("records"); const request = store.get(key);
      request.onsuccess = () => { const value = update(request.result); if (value) store.put(value); };
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    });
  },
};

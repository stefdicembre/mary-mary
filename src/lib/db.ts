// Saving to the phone. Uses IndexedDB, the browser's built-in storage,
// which keeps data even when the app is closed or the phone restarts.

import type { GardenData } from "./types";

const DB_NAME = "mary-mary";
const STORE = "garden";
const KEY = "main";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadGarden(): Promise<GardenData | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as GardenData | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function saveGarden(data: GardenData): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(data, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Asks the browser not to clear Mary Mary's data when space runs low. */
export async function askToKeepData(): Promise<void> {
  try {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch {
    // Not supported everywhere; nothing to do.
  }
}

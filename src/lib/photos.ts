// Photos for the garden diary. They're shrunk before saving (phone photos are
// huge) and kept in their own part of the phone's storage, apart from the
// garden data, so the app stays quick.

import { newId } from "./data";
import { PHOTO_STORE, openDb } from "./db";

const MAX_SIDE = 1600;

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(PHOTO_STORE, mode);
        const req = fn(t.objectStore(PHOTO_STORE));
        t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
        t.onerror = () => reject(t.error);
      }),
  );
}

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Shrinks a photo to at most 1600 pixels on its longest side, as a JPEG. */
export async function shrink(file: Blob): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo"))), "image/jpeg", 0.82));
}

export async function savePhoto(file: Blob): Promise<string> {
  const blob = await shrink(file);
  const id = newId("photo");
  await tx("readwrite", (s) => s.put(blob, id));
  return id;
}

const urls = new Map<string, string>();

/** A web address for showing a saved photo, or undefined if it's gone. */
export async function photoUrl(id: string): Promise<string | undefined> {
  if (urls.has(id)) return urls.get(id);
  const blob = await tx<Blob>("readonly", (s) => s.get(id));
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}

export async function allPhotoIds(): Promise<string[]> {
  return ((await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys())) ?? []).map(String);
}

/** Removes photos nothing refers to any more (e.g. from a deleted diary entry, once Undo has passed). */
export async function tidyPhotos(inUse: Set<string>): Promise<number> {
  const ids = await allPhotoIds();
  const unused = ids.filter((id) => !inUse.has(id));
  if (unused.length) await tx("readwrite", (s) => unused.forEach((id) => s.delete(id)));
  return unused.length;
}

function toDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/** Every photo as text, for the backup file. */
export async function exportPhotos(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of ids) {
    const blob = await tx<Blob>("readonly", (s) => s.get(id));
    if (blob) out[id] = await toDataUrl(blob);
  }
  return out;
}

export async function importPhotos(photos: Record<string, string>): Promise<void> {
  for (const [id, data] of Object.entries(photos)) {
    if (!/^data:image\//.test(data)) continue;
    const blob = await (await fetch(data)).blob();
    await tx("readwrite", (s) => s.put(blob, id));
    urls.delete(id);
  }
}

// The phone side of urgent alerts (v0.9). See alerts.ts for how the whole thing fits together.
// The push code is kept on the phone (IndexedDB), never in backups: it's only useful to GitHub.

import { loadExtra, saveExtra } from "./db";
import type { PushCode } from "./alerts";
import { todayISO } from "./dates";

const KEY = "push";

export interface SavedPush {
  code: PushCode;
  /** Stef said the code is in GitHub. */
  inGitHub: boolean;
}

export type PushSupport = "ok" | "not-installed" | "not-supported";

/** Alerts need the app opened from its Home Screen icon (iPhone, iOS 16.4 or later). */
export function pushSupport(): PushSupport {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const hasApi = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (hasApi && standalone) return "ok";
  if (!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) return "not-installed";
  return hasApi ? "ok" : "not-supported";
}

export const permission = (): NotificationPermission | "unknown" => ("Notification" in window ? Notification.permission : "unknown");

export async function savedPush(): Promise<SavedPush | undefined> {
  try {
    return await loadExtra<SavedPush>(KEY);
  } catch {
    return undefined;
  }
}

export const savePush = (p: SavedPush | undefined) => saveExtra(KEY, p);

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * Asks for permission, makes a fresh pair of keys and signs the phone up for alerts.
 * Must be called straight from a button tap (iPhones insist).
 */
export async function turnOn(place: { lat: number; lon: number; place: string }, protect: string[]): Promise<SavedPush> {
  const answer = await Notification.requestPermission();
  if (answer !== "granted") throw new Error("denied");
  const reg = await navigator.serviceWorker.ready;
  const old = await reg.pushManager.getSubscription();
  if (old) await old.unsubscribe().catch(() => undefined);

  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const publicKey = await crypto.subtle.exportKey("raw", keys.publicKey);
  const jwk = await crypto.subtle.exportKey("jwk", keys.privateKey);
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
  const json = sub.toJSON();

  const code: PushCode = {
    v: 1,
    sub: { endpoint: json.endpoint!, keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth } },
    vapid: { publicKey: b64url(publicKey), privateKey: jwk.d! },
    lat: place.lat,
    lon: place.lon,
    place: place.place,
    protect,
    madeOn: todayISO(),
  };
  const saved = { code, inGitHub: false };
  await savePush(saved);
  return saved;
}

/** Makes a new code with the same phone sign-up but today's place and tender plants. */
export async function refreshCode(saved: SavedPush, place: { lat: number; lon: number; place: string }, protect: string[]): Promise<SavedPush> {
  const next = { code: { ...saved.code, lat: place.lat, lon: place.lon, place: place.place, protect, madeOn: todayISO() }, inGitHub: false };
  await savePush(next);
  return next;
}

export async function turnOff(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {
    // Nothing to undo.
  }
  await savePush(undefined);
}

/** The GitHub repo the app is published from, e.g. https://github.com/stefdicembre/mary-mary */
export function repoUrl(): string {
  const m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);
  const name = location.pathname.split("/").filter(Boolean)[0];
  return m && name ? `https://github.com/${m[1]}/${name}` : "https://github.com/stefdicembre/mary-mary";
}

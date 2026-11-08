// Urgent alerts on the lock screen (v0.9).
//
// How it works, in short:
//  • On the phone, Settings → Notifications asks the iPhone for permission and makes a
//    "push code": where to send alerts, the keys to sign them with, the garden's place
//    and the tender plants to mention. Stef pastes it into GitHub once, as a secret.
//  • Twice a day, GitHub runs scripts/notify.ts. It reads the forecast for the garden
//    and, if there's frost tonight, a heatwave or a storm, sends an alert to the phone.
//
// This file is the plain logic both sides share, so it can be tested.

import { adviceFor } from "./weather";
import type { Advice, Forecast } from "./weather";
import { emptyGarden } from "./data";
import { andList } from "./layout";

/** Everything GitHub needs to send alerts. Kept as a GitHub secret, never in the repo. */
export interface PushCode {
  v: 1;
  /** Where Apple (or another browser maker) delivers alerts for this phone. */
  sub: { endpoint: string; keys: { p256dh: string; auth: string } };
  /** Keys alerts are signed with, made on the phone (base64url). */
  vapid: { publicKey: string; privateKey: string };
  lat: number;
  lon: number;
  place: string;
  /** Tender plants to name in frost alerts, e.g. "Dahlia (The Sunset Border)". */
  protect: string[];
  madeOn: string; // YYYY-MM-DD
}

export interface Alert {
  /** Same key = same alert, so it's only sent once, e.g. "frost:2026-11-08". */
  key: string;
  title: string;
  body: string;
  /** Where tapping it opens the app. */
  url: string;
}

const B64URL = /^[A-Za-z0-9_-]+$/;

/** Reads a push code pasted into GitHub. Throws a plain-English message if it's wrong. */
export function parsePushCode(text: string | undefined): PushCode {
  if (!text || !text.trim()) throw new Error("There's no push code yet. In Mary Mary, go to Settings → Notifications and copy the code into GitHub as MARY_MARY_PUSH.");
  let c: any;
  try {
    c = JSON.parse(text.trim());
  } catch {
    throw new Error("The push code isn't complete. Copy it again from Mary Mary's Settings and paste the whole thing.");
  }
  const ok =
    c &&
    c.v === 1 &&
    typeof c.sub?.endpoint === "string" &&
    c.sub.endpoint.startsWith("https://") &&
    B64URL.test(c.sub?.keys?.p256dh ?? "") &&
    B64URL.test(c.sub?.keys?.auth ?? "") &&
    B64URL.test(c.vapid?.publicKey ?? "") &&
    B64URL.test(c.vapid?.privateKey ?? "") &&
    typeof c.lat === "number" &&
    typeof c.lon === "number";
  if (!ok) throw new Error("That doesn't look like a Mary Mary push code. Copy it again from Settings → Notifications.");
  return { ...c, place: String(c.place ?? ""), protect: Array.isArray(c.protect) ? c.protect.map(String) : [] };
}

/** "Dahlia, Pelargonium and 2 more" */
function someOf(names: string[], max = 3): string {
  if (names.length <= max) return andList(names);
  const rest = names.length - (max - 1);
  return `${names.slice(0, max - 1).join(", ")} and ${rest} more`;
}

function alertFrom(a: Advice, protect: string[]): Alert {
  let body = a.text;
  if (a.kind === "frost" && protect.length) body = `Protect before dark: ${someOf(protect)}. Fleece them, or move pots against the house wall or under cover.`;
  return { key: `${a.kind}:${a.date}`, title: a.title, body, url: "#/weather" };
}

/**
 * The urgent alerts worth sending now. Uses the same rules as the Weather screen:
 * a frost of 0°C or below, 30°C or more, or gusts of 55mph or more.
 *
 *  • Morning check (before noon): frost tonight, heat or a storm today.
 *  • Afternoon check: frost tonight, a storm today or tomorrow, heat tomorrow.
 */
export function urgentAlerts(f: Forecast, protect: string[], today: string, hour: number): Alert[] {
  const tomorrow = nextDay(today);
  const morning = hour < 12;
  return adviceFor(f, emptyGarden(false), today)
    .filter((a) => a.urgent)
    .filter((a) => {
      if (a.kind === "frost") return a.date === today;
      if (a.kind === "heat") return morning ? a.date === today : a.date === tomorrow;
      if (a.kind === "wind") return a.date === today || (!morning && a.date === tomorrow);
      return false;
    })
    .map((a) => alertFrom(a, protect));
}

/** The alerts not already sent, and the updated list of sent keys (only the last fortnight kept). */
export function notYetSent(alerts: Alert[], sent: string[], today: string): { send: Alert[]; sent: string[] } {
  const cutoff = addDays(today, -14);
  const kept = sent.filter((k) => (k.split(":")[1] ?? "") >= cutoff);
  const send = alerts.filter((a) => !kept.includes(a.key));
  return { send, sent: [...kept, ...send.map((a) => a.key)] };
}

/** True when the push code was made for a different place or a different list of tender plants. */
export function codeIsOutOfDate(code: Pick<PushCode, "place" | "protect">, place: string | undefined, protect: string[]): boolean {
  if ((place ?? "") !== code.place) return true;
  const a = [...code.protect].sort().join("|");
  const b = [...protect].sort().join("|");
  return a !== b;
}

export const TEST_ALERT: Alert = {
  key: "test",
  title: "Mary Mary alerts are working",
  body: "You'll hear from me only for frost, storms and heatwaves. Tap to see the weather.",
  url: "#/weather",
};

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const nextDay = (iso: string) => addDays(iso, 1);

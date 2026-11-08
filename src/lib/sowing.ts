// Sowing and frost dates (v0.8).
//
// Mary Mary works out when frosts usually end in spring and start in autumn for
// this garden, from about ten years of past weather near it (Open-Meteo's free
// weather history, no key). Sowing, planting out and frost jobs then follow
// those dates instead of one timetable for the whole country.
//
// "Frost" here means a night that dropped to 2°C or below. Weather records
// measure the air about 2 m up, and the ground is often a few degrees colder,
// so 2°C is a sensible sign of a ground frost that can hurt tender plants.
// The dates are the ones frost was over by (spring) or held off until (autumn)
// in 8 years out of 10, so they lean towards being safe. General advice: a cold
// dip or a frost pocket can still catch you out.

import type { CatPlant } from "./catalogue";
import type { FrostDates, GardenSettings } from "./types";

/** [3, 4, 5, 9, 10] → "Mar to May, Sep to Oct"; [11, 12, 1, 2] → "Nov to Feb". */
export function monthRanges(months: number[]): string {
  const set = new Set(months);
  if (set.size === 12) return "any time";
  // Start each run at a month whose previous month isn't in the list (handles Dec → Jan).
  const runs: number[][] = [];
  for (let m = 1; m <= 12; m++) {
    if (!set.has(m) || set.has(m === 1 ? 12 : m - 1)) continue;
    const run = [m];
    let n = m;
    while (set.has(n === 12 ? 1 : n + 1) && run.length < 12) {
      n = n === 12 ? 1 : n + 1;
      run.push(n);
    }
    runs.push(run);
  }
  return runs.map((r) => (r.length === 1 ? SHORT_M[r[0] - 1] : `${SHORT_M[r[0] - 1]} to ${SHORT_M[r[r.length - 1] - 1]}`)).join(", ");
}
const SHORT_M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The general timetable for most of England and Wales, used until local dates are known. */
export const TYPICAL_FROST = { lastSpring: "05-15", firstAutumn: "10-15" };

export const FROST_LINE = 2; // °C overnight low that counts as a frost risk
const MIN_YEARS = 5;

export interface FrostInfo {
  lastSpring: string; // MM-DD
  firstAutumn: string; // MM-DD
  source: "history" | "you" | "typical";
  years?: number;
  place?: string;
}

/** The frost dates to use for this garden. */
export function frostFor(settings: GardenSettings): FrostInfo {
  const f = settings.frost;
  if (f && validMMDD(f.lastSpring) && validMMDD(f.firstAutumn)) return { ...f };
  return { ...TYPICAL_FROST, source: "typical" };
}

// ── Day-of-year arithmetic on a plain 365-day year ──────────────

const DAYS_BEFORE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function validMMDD(s?: string): boolean {
  if (!s || !/^\d{2}-\d{2}$/.test(s)) return false;
  const m = +s.slice(0, 2);
  const d = +s.slice(3, 5);
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

/** "05-15" → 135 (1 = 1 January). 29 February counts as 28 February. */
export function dayOfYear(mmdd: string): number {
  const m = +mmdd.slice(0, 2);
  const d = Math.min(+mmdd.slice(3, 5), [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]);
  return DAYS_BEFORE[m - 1] + d;
}

/** 135 → "05-15". Kept within the year. */
export function fromDayOfYear(doy: number): string {
  const n = Math.max(1, Math.min(365, Math.round(doy)));
  let m = 11;
  while (DAYS_BEFORE[m] >= n) m--;
  const d = n - DAYS_BEFORE[m];
  return `${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const monthOf = (doy: number) => +fromDayOfYear(doy).slice(0, 2);

/** "05-15" → "mid May". Days 1–10 are early, 11–20 mid, 21 on late. */
export function dateWords(mmdd: string, short = false): string {
  const m = +mmdd.slice(0, 2);
  const d = +mmdd.slice(3, 5);
  const part = d <= 10 ? "early" : d <= 20 ? "mid" : "late";
  return `${part} ${(short ? SHORT : MONTH_NAMES)[m - 1]}`;
}

/** "In 8 years out of 10" style: the spread between two frost dates, in whole weeks. */
export function weeksBetween(a: string, b: string): number {
  return Math.round((dayOfYear(b) - dayOfYear(a)) / 7);
}

// ── Working the dates out from past weather ─────────────────────

export interface DailyLows {
  time: string[]; // YYYY-MM-DD
  min: Array<number | null>;
}

/**
 * From daily overnight lows over several years, the date frost is usually over by
 * in spring and the date it usually holds off until in autumn (8 years in 10).
 * Returns undefined if there's too little to go on.
 */
export function workOutFrost(d: DailyLows, line = FROST_LINE): { lastSpring: string; firstAutumn: string; years: number } | undefined {
  type Year = { days: number; last: number; first: number };
  const years = new Map<number, Year>();
  for (let i = 0; i < d.time.length; i++) {
    const t = d.time[i];
    const v = d.min[i];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || typeof v !== "number" || !isFinite(v)) continue;
    const y = +t.slice(0, 4);
    const doy = dayOfYear(t.slice(5));
    const yr = years.get(y) ?? { days: 0, last: 0, first: 366 };
    yr.days++;
    if (v <= line) {
      // Spring: the last frosty night before the end of July. Autumn: the first from August.
      if (doy < 213) yr.last = Math.max(yr.last, doy);
      else yr.first = Math.min(yr.first, doy);
    }
    years.set(y, yr);
  }
  const full = Array.from(years.values()).filter((y) => y.days >= 330);
  if (full.length < MIN_YEARS) return undefined;
  const lasts = full.map((y) => y.last || 1).sort((a, b) => a - b);
  const firsts = full.map((y) => Math.min(y.first, 365)).sort((a, b) => a - b);
  // Spring: frost was over by this date in 8 years out of 10.
  const spring = lasts[Math.min(lasts.length - 1, Math.ceil(lasts.length * 0.8) - 1)];
  // Autumn: frost held off until at least this date in 8 years out of 10.
  const autumn = firsts[Math.floor(firsts.length * 0.2)];
  return { lastSpring: fromDayOfYear(spring + 1), firstAutumn: fromDayOfYear(autumn), years: full.length };
}

/** Ten full years of daily lows, ending last December. */
export function historyUrl(lat: number, lon: number, today: string): string {
  const y = +today.slice(0, 4) - 1;
  const p = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    start_date: `${y - 9}-01-01`,
    end_date: `${y}-12-31`,
    daily: "temperature_2m_min",
    timezone: "Europe/London",
  });
  return `https://archive-api.open-meteo.com/v1/archive?${p}`;
}

/** Fetches the history and works the dates out. Throws a friendly message if it can't. */
export async function fetchFrostDates(loc: { lat: number; lon: number; place: string }, today: string): Promise<FrostDates> {
  let j: any;
  try {
    const r = await fetch(historyUrl(loc.lat, loc.lon, today));
    if (!r.ok) throw new Error(String(r.status));
    j = await r.json();
  } catch {
    throw new Error("Couldn't reach the weather history just now. Mary Mary will try again later.");
  }
  const worked = workOutFrost({ time: j?.daily?.time ?? [], min: j?.daily?.temperature_2m_min ?? [] });
  if (!worked) throw new Error("There wasn't enough past weather for your place to work out frost dates.");
  return { ...worked, source: "history", place: loc.place, workedOutOn: today };
}

/** Whether to (re)work out the dates: none yet, or worked out for somewhere else. Dates set by hand are kept. */
export function needsFrostDates(settings: GardenSettings): boolean {
  const loc = settings.location;
  if (!loc) return false;
  const f = settings.frost;
  if (!f) return true;
  if (f.source === "you") return false;
  return f.place !== loc.place;
}

/** "About 2 weeks later than the usual mid May" or "" when it's about the same. */
export function compareWithTypical(f: FrostInfo): string {
  const w = weeksBetween(TYPICAL_FROST.lastSpring, f.lastSpring);
  if (f.source === "typical" || Math.abs(w) < 1) return "";
  return `About ${Math.abs(w)} week${Math.abs(w) === 1 ? "" : "s"} ${w > 0 ? "later" : "earlier"} than the general UK advice of ${dateWords(TYPICAL_FROST.lastSpring)}.`;
}

// ── Timings: sow indoors, sow outside, plant out ────────────────

/** Fixed months, or weeks either side of the last spring frost (or the first autumn one). */
export type When = { months: number[] } | { spring: [number, number] } | { autumn: [number, number] };

export interface Sowing {
  indoors?: When;
  outside?: When;
  plantOut?: When;
  note?: string;
}

/**
 * How each plant grown from seed is started, for most of the UK. Weeks are from the
 * last spring frost: -8 is eight weeks before it, 4 is four weeks after.
 * Plants not listed are bought as plants, bulbs or sets and just have planting months.
 */
export const SOWING: Record<string, Sowing> = {
  "cosmos-purity": { indoors: { spring: [-8, -4] }, outside: { spring: [0, 4] }, plantOut: { spring: [0, 4] } },
  "sweet-pea": { indoors: { months: [10, 11, 2, 3] }, outside: { months: [3, 4] }, plantOut: { spring: [-6, -1] }, note: "Hardy enough to go out a few weeks before the last frost." },
  "pelargonium": { plantOut: { spring: [0, 5] } },
  "nasturtium": { indoors: { spring: [-4, -2] }, outside: { spring: [0, 6] }, plantOut: { spring: [0, 4] } },
  "runner-bean": { indoors: { spring: [-4, -1] }, outside: { spring: [0, 5] }, plantOut: { spring: [0, 4] } },
  "courgette": { indoors: { spring: [-4, -1] }, outside: { spring: [0, 3] }, plantOut: { spring: [0, 4] } },
  "tomato": { indoors: { spring: [-10, -6] }, plantOut: { spring: [-3, 4] }, note: "Into an unheated greenhouse a few weeks before the last frost, or outside after it." },
  "chilli": { indoors: { months: [1, 2, 3] }, plantOut: { spring: [-2, 4] }, note: "Best in a greenhouse or on a sunny windowsill." },
  "cucumber": { indoors: { spring: [-8, -4] }, plantOut: { spring: [-2, 4] }, note: "Needs a greenhouse in most of the UK." },
  "basil": { indoors: { spring: [-10, -2] }, plantOut: { spring: [2, 7] }, note: "Only outside once nights stay warm." },
  "salad-leaves": { outside: { months: [3, 4, 5, 6, 7, 8, 9] }, note: "A short row every few weeks." },
  "beetroot": { outside: { months: [4, 5, 6, 7] } },
  "kale-nero": { indoors: { months: [4, 5] }, outside: { months: [4, 5] }, plantOut: { months: [6, 7] } },
  "broad-bean-aquadulce": { outside: { months: [10, 11, 2, 3] } },
};

export type StepKind = "indoors" | "outside" | "plantOut" | "plant";

export interface Step {
  kind: StepKind;
  label: string; // "Sow indoors"
  months: number[];
  words: string; // "early Mar to early Apr"
}

const LABELS: Record<StepKind, string> = { indoors: "Sow indoors", outside: "Sow outside", plantOut: "Plant out", plant: "Plant" };

/** A When as day-of-year from and to, for weeks around a frost date. */
function daySpan(w: When, f: FrostInfo): [number, number] | undefined {
  if ("spring" in w) {
    const base = dayOfYear(f.lastSpring);
    return [Math.max(1, base + w.spring[0] * 7), Math.min(365, base + w.spring[1] * 7)];
  }
  if ("autumn" in w) {
    const base = dayOfYear(f.firstAutumn);
    return [Math.max(1, base + w.autumn[0] * 7), Math.min(365, base + w.autumn[1] * 7)];
  }
  return undefined;
}

/** The months a When covers, for this garden's frost dates. */
export function whenMonths(w: When, f: FrostInfo): number[] {
  if ("months" in w) return w.months;
  const [a, b] = daySpan(w, f)!;
  const out: number[] = [];
  for (let m = monthOf(a); m <= monthOf(b); m++) out.push(m);
  return out;
}

/** Words for a When: "early Mar to early Apr", or "Mar to May". */
export function whenWords(w: When, f: FrostInfo): string {
  if ("months" in w) return monthRanges(w.months);
  const [a, b] = daySpan(w, f)!;
  const from = dateWords(fromDayOfYear(a), true);
  const to = dateWords(fromDayOfYear(b), true);
  return from === to ? from : `${from} to ${to}`;
}

/** The steps for growing a catalogue plant, in order. */
export function stepsFor(c: CatPlant, f: FrostInfo): Step[] {
  const s = SOWING[c.id];
  const make = (kind: StepKind, w: When): Step => ({ kind, label: LABELS[kind], months: whenMonths(w, f), words: whenWords(w, f) });
  if (!s) return [make("plant", { months: c.plant })];
  const out: Step[] = [];
  if (s.indoors) out.push(make("indoors", s.indoors));
  if (s.outside) out.push(make("outside", s.outside));
  if (s.plantOut) out.push(make("plantOut", s.plantOut));
  return out.length ? out : [make("plant", { months: c.plant })];
}

/** Every month something can be started for this plant: sowing or planting. */
export function startMonths(c: CatPlant, f: FrostInfo): number[] {
  return Array.from(new Set(stepsFor(c, f).flatMap((s) => s.months))).sort((a, b) => a - b);
}

/** Start and end dates (YYYY-MM-DD) of a frost-linked window in a given year. */
export function windowIn(w: When, f: FrostInfo, year: number): { from: string; to: string } | undefined {
  const span = daySpan(w, f);
  if (!span) return undefined;
  return { from: `${year}-${fromDayOfYear(span[0])}`, to: `${year}-${fromDayOfYear(span[1])}` };
}

/** Fills {last} and {first} in a sentence with this garden's frost dates. */
export function fillFrost(text: string, f: FrostInfo): string {
  return text.replace(/\{last\}/g, dateWords(f.lastSpring)).replace(/\{first\}/g, dateWords(f.firstAutumn));
}

/** The step to think about next for a plant, from this month: "Sow indoors early Mar to early Apr". */
export function nextStep(c: CatPlant, f: FrostInfo, month: number): Step {
  const steps = stepsFor(c, f);
  const wait = (s: Step) => Math.min(...s.months.map((m) => (m - month + 12) % 12));
  return [...steps].sort((a, b) => wait(a) - wait(b))[0];
}

/** "Worked out from 10 years of weather near Leith" and similar. */
export function frostSourceWords(f: FrostInfo): string {
  if (f.source === "history") return `Worked out from ${f.years ?? 10} years of past weather${f.place ? ` near ${f.place}` : ""}.`;
  if (f.source === "you") return "You set these dates.";
  return "General dates for most of England and Wales. Add your postcode in Settings and Mary Mary will work out your own.";
}

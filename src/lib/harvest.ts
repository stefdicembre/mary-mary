// Harvest log: what's been picked, how much, and how this year compares with last.
// Fruit, veg and herbs only. Amounts are easy sizes (a handful, a bowlful) or a count,
// with a weight if it was weighed.

import { newId } from "./data";
import type { GardenData, Harvest, HarvestSize, Plant } from "./types";

export const SIZES: Array<{ value: HarvestSize; label: string }> = [
  { value: "few", label: "A few" },
  { value: "handful", label: "A handful" },
  { value: "bowl", label: "A bowlful" },
  { value: "trug", label: "A trugful" },
];

const sizeLabel = (s: HarvestSize) => SIZES.find((x) => x.value === s)!.label;

/** The plant sections that give something to pick and eat. */
export const EDIBLE_SECTIONS = ["Fruit", "Vegetables", "Herbs"];

export const isEdible = (p: Pick<Plant, "section">) => EDIBLE_SECTIONS.includes(p.section);

/** Garden plants that can be picked from: edible and not lost. */
export function pickablePlants(g: GardenData): Plant[] {
  return g.plants.filter((p) => isEdible(p) && p.status !== "lost").sort((a, b) => a.name.localeCompare(b.name));
}

/** "Tomato 'Gardener's Delight'" */
export const plantLabel = (p: Pick<Plant, "name" | "variety">) => (p.variety ? `${p.name} '${p.variety}'` : p.name);

/** What a picking is called on screen: its plant's name now, or the name it was given. */
export function cropName(g: GardenData, h: Harvest): string {
  const p = h.plantId ? g.plants.find((x) => x.id === h.plantId) : undefined;
  return p ? plantLabel(p) : h.name;
}

/** "Tomatoes", "tomato" and "Tomato 'Sungold'" all count as the same crop. */
export function cropKey(name: string): string {
  const w = name.replace(/'.*$/, "").trim().toLowerCase();
  if (/ies$/.test(w)) return w.replace(/ies$/, "y");
  if (/oes$/.test(w)) return w.replace(/es$/, "");
  if (/[^s]s$/.test(w)) return w.slice(0, -1);
  return w;
}

/** "450 g", "1.2 kg" */
export function weightText(grams: number): string {
  if (grams < 1000) return `${Math.round(grams)} g`;
  const kg = Math.round(grams / 100) / 10;
  return `${kg} kg`;
}

/** Turns what was typed in the weight box into grams. "1,5" kg → 1500. */
export function parseWeight(text: string, unit: "g" | "kg"): number | undefined {
  const n = Number(text.trim().replace(",", "."));
  if (!text.trim() || !isFinite(n) || n <= 0) return undefined;
  return Math.round(unit === "kg" ? n * 1000 : n);
}

/** "A bowlful · 1.2 kg", "6", or "" if no amount was given. */
export function amountText(h: Pick<Harvest, "size" | "count" | "grams">): string {
  const parts: string[] = [];
  if (h.size) parts.push(sizeLabel(h.size));
  if (h.count) parts.push(String(h.count));
  if (h.grams) parts.push(weightText(h.grams));
  return parts.join(" · ");
}

/** The words for the garden diary. */
export function harvestDiaryText(g: GardenData, h: Harvest): string {
  const area = h.areaId ? g.areas.find((a) => a.id === h.areaId)?.name : undefined;
  const amount = amountText(h).replace(/^A /, "a ").replace(" · ", ", ");
  let text = `Picked ${cropName(g, h)}${amount ? `: ${amount}` : ""}${area ? `, from ${area}` : ""}.`;
  if (h.note) text += ` "${h.note}"`;
  return text;
}

// ── Changes ─────────────────────────────────────────────────────

export interface HarvestInput {
  date: string;
  plantId?: string;
  name: string;
  size?: HarvestSize;
  count?: number;
  grams?: number;
  note?: string;
  taskId?: string;
  addToDiary: boolean;
}

function clean(g: GardenData, input: HarvestInput) {
  const plant = input.plantId ? g.plants.find((p) => p.id === input.plantId) : undefined;
  const name = (plant ? plant.name : input.name).trim();
  return {
    date: input.date,
    plantId: plant?.id,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    areaId: plant?.areaId,
    size: input.size,
    count: input.count && input.count > 0 ? Math.round(input.count) : undefined,
    grams: input.grams && input.grams > 0 ? Math.round(input.grams) : undefined,
    note: input.note?.trim() || undefined,
  };
}

export function addHarvest(g: GardenData, input: HarvestInput): [GardenData, string] {
  const c = clean(g, input);
  if (!c.name) return [g, ""];
  const id = newId("harvest");
  const h: Harvest = { ...c, id, taskId: input.taskId, createdAt: new Date().toISOString() };
  let journal = g.journal;
  if (input.addToDiary) {
    h.journalEntryId = newId("diary");
    journal = [...journal, { id: h.journalEntryId, date: h.date, text: harvestDiaryText(g, h), plantIds: h.plantId ? [h.plantId] : [], areaIds: h.areaId ? [h.areaId] : [] }];
  }
  return [{ ...g, harvests: [...g.harvests, h], journal }, id];
}

/**
 * Change a picking. Its diary entry follows along if Mary Mary wrote it and it hasn't been
 * edited since; turning the diary on adds one, and it's never taken away by editing.
 */
export function updateHarvest(g: GardenData, id: string, input: HarvestInput): GardenData {
  const old = g.harvests.find((h) => h.id === id);
  if (!old) return g;
  const c = clean(g, input);
  if (!c.name) return g;
  const h: Harvest = { ...old, ...c, id };
  let journal = g.journal;
  const entry = old.journalEntryId ? journal.find((j) => j.id === old.journalEntryId) : undefined;
  if (entry) {
    if (entry.text === harvestDiaryText(g, old)) {
      journal = journal.map((j) =>
        j.id === entry.id ? { ...j, date: h.date, text: harvestDiaryText(g, h), plantIds: h.plantId ? [h.plantId] : [], areaIds: h.areaId ? [h.areaId] : [] } : j,
      );
    }
  } else if (input.addToDiary) {
    h.journalEntryId = newId("diary");
    journal = [...journal, { id: h.journalEntryId, date: h.date, text: harvestDiaryText(g, h), plantIds: h.plantId ? [h.plantId] : [], areaIds: h.areaId ? [h.areaId] : [] }];
  } else {
    h.journalEntryId = undefined;
  }
  return { ...g, harvests: g.harvests.map((x) => (x.id === id ? h : x)), journal };
}

/** Takes a picking out of the log, with the diary line Mary Mary wrote for it. */
export function removeHarvest(g: GardenData, id: string): GardenData {
  const h = g.harvests.find((x) => x.id === id);
  if (!h) return g;
  return {
    ...g,
    harvests: g.harvests.filter((x) => x.id !== id),
    journal: h.journalEntryId ? g.journal.filter((j) => j.id !== h.journalEntryId) : g.journal,
  };
}

// ── Looking back ────────────────────────────────────────────────

/** Pickings, newest first, for one year (or all years). */
export function harvestsIn(g: GardenData, year?: number): Harvest[] {
  return g.harvests
    .filter((h) => !year || h.date.startsWith(`${year}-`))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** The years that have pickings, newest first. */
export function harvestYears(g: GardenData): number[] {
  return Array.from(new Set(g.harvests.map((h) => Number(h.date.slice(0, 4))))).sort((a, b) => b - a);
}

export interface CropTotal {
  key: string;
  name: string;
  times: number;
  count: number;
  grams: number;
  last: string;
  /** Times picked last year, up to the same day. */
  lastYearByNow: number;
  /** Times picked in the whole of last year. */
  lastYear: number;
}

/** Each crop's year so far, most picked first. `today` decides "by now" for last year. */
export function cropTotals(g: GardenData, year: number, today: string): CropTotal[] {
  const map = new Map<string, CropTotal>();
  for (const h of harvestsIn(g, year)) {
    const name = cropName(g, h);
    const key = cropKey(name);
    const t = map.get(key) ?? { key, name: name.replace(/\s+'.*$/, ""), times: 0, count: 0, grams: 0, last: h.date, lastYearByNow: 0, lastYear: 0 };
    t.times += 1;
    t.count += h.count ?? 0;
    t.grams += h.grams ?? 0;
    if (h.date > t.last) t.last = h.date;
    if (h.plantId) t.name = name.replace(/\s+'.*$/, ""); // a garden plant's name wins over typed ones
    map.set(key, t);
  }
  const sameDay = `${year - 1}${today.slice(4)}`;
  for (const h of harvestsIn(g, year - 1)) {
    const t = map.get(cropKey(cropName(g, h)));
    if (!t) continue;
    t.lastYear += 1;
    if (h.date <= sameDay) t.lastYearByNow += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.times - a.times || a.name.localeCompare(b.name));
}

/** "Picked 6 times · 23 in all · 2.1 kg" */
export function totalText(t: Pick<CropTotal, "times" | "count" | "grams">): string {
  const parts = [t.times === 1 ? "Picked once" : `Picked ${t.times} times`];
  if (t.count) parts.push(`${t.count} in all`);
  if (t.grams) parts.push(weightText(t.grams));
  return parts.join(" · ");
}

/** A plant's own pickings this year, for its page. */
export function plantHarvests(g: GardenData, plantId: string, year: number): Harvest[] {
  return harvestsIn(g, year).filter((h) => h.plantId === plantId);
}

/** Crop names picked before that aren't garden plants, for one-tap choosing. */
export function recentOtherCrops(g: GardenData, limit = 6): string[] {
  const plants = new Set(pickablePlants(g).map((p) => cropKey(p.name)));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of harvestsIn(g)) {
    if (h.plantId && g.plants.some((p) => p.id === h.plantId)) continue;
    const k = cropKey(h.name);
    if (plants.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(h.name);
    if (out.length >= limit) break;
  }
  return out;
}

/** Was this job about picking? Then Done recently offers "+ Harvest". */
export const isPickingJob = (title: string) => /^(pick|harvest|dig up)\b/i.test(title.trim());

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Every picking as a spreadsheet (opens in Excel or Numbers). */
export function harvestsToCSV(g: GardenData): string {
  const areaName = (id?: string) => (id ? (g.areas.find((a) => a.id === id)?.name ?? "") : "");
  const header = ["Date", "What", "Area", "Amount", "Count", "Weight (g)", "Notes"];
  const rows = harvestsIn(g)
    .slice()
    .reverse()
    .map((h) => [h.date, cropName(g, h), areaName(h.areaId), h.size ? sizeLabel(h.size) : "", h.count, h.grams, h.note].map(csvCell).join(","));
  return [header.join(","), ...rows].join("\r\n") + "\r\n";
}

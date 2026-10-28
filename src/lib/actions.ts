// Every change to the garden goes through one of these small functions.
// Each takes the current data and returns a new copy (nothing is changed in place),
// which keeps things predictable and easy to test.

import { newId } from "./data";
import { setbackSummary } from "./reasons";
import type { Area, GardenData, GardenSettings, JournalEntry, Plant, ReasonKey, Setback, SetbackOutcome } from "./types";

export function addArea(g: GardenData, a: Omit<Area, "id" | "createdAt">): [GardenData, string] {
  const id = newId("area");
  const area: Area = { ...a, id, createdAt: new Date().toISOString() };
  return [{ ...g, areas: [...g.areas, area] }, id];
}

export function updateArea(g: GardenData, id: string, changes: Partial<Area>): GardenData {
  return { ...g, areas: g.areas.map((a) => (a.id === id ? { ...a, ...changes, id } : a)) };
}

/** Only empty areas can be removed, so no plant is ever orphaned. */
export function removeArea(g: GardenData, id: string): GardenData {
  if (g.plants.some((p) => p.areaId === id && p.status !== "lost")) return g;
  return { ...g, areas: g.areas.filter((a) => a.id !== id), planned: g.planned.filter((p) => p.areaId !== id) };
}

export function addPlant(g: GardenData, p: Omit<Plant, "id" | "createdAt" | "status">): [GardenData, string] {
  const id = newId("plant");
  const plant: Plant = { ...p, id, status: "growing", createdAt: new Date().toISOString() };
  return [{ ...g, plants: [...g.plants, plant] }, id];
}

export function updatePlant(g: GardenData, id: string, changes: Partial<Plant>): GardenData {
  return { ...g, plants: g.plants.map((p) => (p.id === id ? { ...p, ...changes, id } : p)) };
}

/** For mistakes only. Plants that died stay in "Didn't make it" instead. */
export function deletePlant(g: GardenData, id: string): GardenData {
  return {
    ...g,
    plants: g.plants.filter((p) => p.id !== id),
    setbacks: g.setbacks.filter((s) => s.plantId !== id),
    journal: g.journal
      .map((j) => ({ ...j, plantIds: j.plantIds.filter((x) => x !== id) }))
      .filter((j) => !(j.setbackId && g.setbacks.some((s) => s.id === j.setbackId && s.plantId === id))),
  };
}

export interface SetbackInput {
  plantId: string;
  date: string;
  outcome: SetbackOutcome;
  reasons: ReasonKey[];
  details: Partial<Record<ReasonKey, string>>;
  inOwnWords?: string;
  addToDiary: boolean;
}

function diaryText(plant: Plant, areaName: string, s: Pick<Setback, "outcome" | "reasons" | "details" | "inOwnWords">) {
  const what =
    s.outcome === "struggling"
      ? `${plant.name} is struggling in ${areaName}`
      : s.outcome === "died"
        ? `${plant.name} didn't make it in ${areaName}`
        : `Pulled out ${plant.name} from ${areaName}`;
  const why = setbackSummary(s);
  let text = why ? `${what}: ${why}.` : `${what}.`;
  if (s.inOwnWords) text += ` "${s.inOwnWords}"`;
  return text;
}

export function logSetback(g: GardenData, input: SetbackInput): GardenData {
  const plant = g.plants.find((p) => p.id === input.plantId);
  if (!plant) return g;
  const areaName = g.areas.find((a) => a.id === plant.areaId)?.name ?? "the garden";
  const setbackId = newId("setback");
  const words = input.inOwnWords?.trim() || undefined;
  const setback: Setback = {
    id: setbackId,
    plantId: plant.id,
    areaId: plant.areaId,
    date: input.date,
    outcome: input.outcome,
    reasons: input.reasons,
    details: input.details,
    inOwnWords: words,
  };
  let journal = g.journal;
  if (input.addToDiary) {
    const entryId = newId("diary");
    setback.journalEntryId = entryId;
    journal = [
      ...journal,
      {
        id: entryId,
        date: input.date,
        text: diaryText(plant, areaName, setback),
        plantIds: [plant.id],
        areaIds: [plant.areaId],
        setbackId,
      },
    ];
  }
  const lost = input.outcome !== "struggling";
  const plants = g.plants.map((p) =>
    p.id === plant.id
      ? { ...p, status: lost ? ("lost" as const) : ("struggling" as const), doesWell: false, lostOn: lost ? input.date : undefined }
      : p,
  );
  return { ...g, plants, setbacks: [...g.setbacks, setback], journal };
}

/** It perked up (or came back to life). History is kept. */
export function markRecovered(g: GardenData, plantId: string): GardenData {
  return updatePlant(g, plantId, { status: "growing", lostOn: undefined });
}

export function updateSettings(g: GardenData, changes: Partial<GardenSettings>): GardenData {
  return { ...g, settings: { ...g.settings, ...changes } };
}

/** Earlier setbacks for the same kind of plant, anywhere in the garden. */
export function pastSetbacksFor(g: GardenData, plantName: string): Setback[] {
  const key = plantName.trim().toLowerCase();
  if (!key) return [];
  const ids = new Set(g.plants.filter((p) => p.name.trim().toLowerCase() === key).map((p) => p.id));
  return g.setbacks.filter((s) => ids.has(s.plantId)).sort((a, b) => b.date.localeCompare(a.date));
}

// ── Planting plan ────────────────────────────────────────────────

export function addPlanned(
  g: GardenData,
  p: { areaId: string; catalogueId?: string; name: string; section: string; plantMonth?: number },
  today: string,
): GardenData {
  if (p.catalogueId && g.planned.some((x) => x.areaId === p.areaId && x.catalogueId === p.catalogueId)) return g;
  return { ...g, planned: [...g.planned, { ...p, id: newId("planned"), addedOn: today }] };
}

export function removePlanned(g: GardenData, id: string): GardenData {
  return { ...g, planned: g.planned.filter((p) => p.id !== id) };
}

/** It's in the ground: turn the planned plant into a real one. */
export function plantPlanned(g: GardenData, id: string, today: string): GardenData {
  const p = g.planned.find((x) => x.id === id);
  if (!p) return g;
  // "Tulip 'Ballerina'" → name "Tulip", variety "Ballerina"
  const m = p.name.match(/^(.*?)\s+'(.+)'$/);
  const [next] = addPlant(removePlanned(g, id), {
    name: m ? m[1] : p.name,
    variety: m ? m[2] : undefined,
    areaId: p.areaId,
    section: p.section,
    plantedOn: today,
  });
  return next;
}

export function notForMe(g: GardenData, areaId: string, catalogueId: string, undo = false): GardenData {
  const key = `${areaId}:${catalogueId}`;
  const list = g.notForMe.filter((k) => k !== key);
  return { ...g, notForMe: undo ? list : [...list, key] };
}

// ── Garden diary ─────────────────────────────────────────────────

export function addEntry(g: GardenData, e: Omit<JournalEntry, "id">): [GardenData, string] {
  const id = newId("diary");
  return [{ ...g, journal: [...g.journal, { ...e, id }] }, id];
}

export function updateEntry(g: GardenData, id: string, changes: Partial<JournalEntry>): GardenData {
  return { ...g, journal: g.journal.map((j) => (j.id === id ? { ...j, ...changes, id } : j)) };
}

/** Removes a diary entry. The setback or job it came from stays. */
export function removeEntry(g: GardenData, id: string): GardenData {
  return {
    ...g,
    journal: g.journal.filter((j) => j.id !== id),
    setbacks: g.setbacks.map((s) => (s.journalEntryId === id ? { ...s, journalEntryId: undefined } : s)),
  };
}

export interface DiaryFilter {
  areaId?: string;
  plantId?: string;
  text?: string;
}

/** Diary entries, newest first, filtered by area, plant or words (including plant and area names). */
export function diaryEntries(g: GardenData, f: DiaryFilter = {}): JournalEntry[] {
  const words = (f.text ?? "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  const plantArea = (pid: string) => g.plants.find((p) => p.id === pid)?.areaId;
  return g.journal
    .filter((j) => !f.areaId || j.areaIds.includes(f.areaId) || j.plantIds.some((pid) => plantArea(pid) === f.areaId))
    .filter((j) => !f.plantId || j.plantIds.includes(f.plantId))
    .filter((j) => {
      if (!words.length) return true;
      const hay = [
        j.text,
        ...j.plantIds.map((pid) => {
          const p = g.plants.find((x) => x.id === pid);
          return p ? `${p.name} ${p.variety ?? ""} ${p.latinName ?? ""}` : "";
        }),
        ...j.areaIds.map((aid) => g.areas.find((a) => a.id === aid)?.name ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

/** Every photo id the garden still refers to. */
export function photosInUse(g: GardenData): Set<string> {
  return new Set(g.journal.flatMap((j) => j.photoIds ?? []));
}

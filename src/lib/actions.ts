// Every change to the garden goes through one of these small functions.
// Each takes the current data and returns a new copy (nothing is changed in place),
// which keeps things predictable and easy to test.

import { newId } from "./data";
import { setbackSummary } from "./reasons";
import type { Area, GardenData, GardenSettings, Plant, ReasonKey, Setback, SetbackOutcome } from "./types";

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
  return { ...g, areas: g.areas.filter((a) => a.id !== id) };
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

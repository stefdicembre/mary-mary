// Creating, checking and exporting the garden data.

import type { Area, AreaKind, GardenData } from "./types";

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export const SECTIONS = [
  "Trees and shrubs",
  "Climbers",
  "Roses",
  "Perennials",
  "Annuals and bedding",
  "Bulbs",
  "Grasses",
  "Dahlias",
  "Herbs",
  "Fruit",
  "Vegetables",
  "To identify",
];

export const AREA_KINDS: Array<{ kind: AreaKind; label: string }> = [
  { kind: "border", label: "Border" },
  { kind: "bed", label: "Bed" },
  { kind: "pots", label: "Pots or courtyard" },
  { kind: "greenhouse", label: "Greenhouse" },
  { kind: "veg", label: "Veg patch or allotment" },
  { kind: "water", label: "Pond or pool area" },
  { kind: "lawn", label: "Lawn" },
  { kind: "other", label: "Somewhere else" },
];

// Stef's areas, from the wireframes. Offered on first run; easy to rename or remove.
const STARTER_AREAS: Array<[string, AreaKind]> = [
  ["The Courtyard", "pots"],
  ["The Pastel Border", "border"],
  ["Path bed", "bed"],
  ["The Pool area", "water"],
  ["The Cove", "other"],
  ["The Sunset Border", "border"],
  ["The allotment", "veg"],
  ["The greenhouse", "greenhouse"],
];

export function emptyGarden(withStarterAreas: boolean): GardenData {
  const now = new Date().toISOString();
  const areas: Area[] = withStarterAreas
    ? STARTER_AREAS.map(([name, kind], i) => ({ id: `area_start${i}`, name, kind, createdAt: now }))
    : [];
  return {
    version: 1,
    settings: { gardenName: "Stef and Cath's garden", yourName: "Stef" },
    areas,
    plants: [],
    setbacks: [],
    journal: [],
  };
}

/** Checks a backup file looks like Mary Mary data before restoring it. */
export function isGardenData(x: unknown): x is GardenData {
  if (!x || typeof x !== "object") return false;
  const g = x as Record<string, unknown>;
  return (
    g.version === 1 &&
    typeof g.settings === "object" &&
    Array.isArray(g.areas) &&
    Array.isArray(g.plants) &&
    Array.isArray(g.setbacks) &&
    Array.isArray(g.journal)
  );
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** All plants as a spreadsheet-friendly CSV (opens in Excel or Numbers). */
export function plantsToCSV(data: GardenData): string {
  const areaName = (id: string) => data.areas.find((a) => a.id === id)?.name ?? "";
  const header = ["Name", "Variety", "Latin name", "Area", "Section", "Status", "Planted on", "Source", "Notes"];
  const rows = data.plants.map((p) =>
    [p.name, p.variety, p.latinName, areaName(p.areaId), p.section, p.status, p.plantedOn, p.source, p.notes]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\r\n") + "\r\n";
}

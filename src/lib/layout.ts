// The garden map and bed plans: where the areas are, and what's planted where.
// Like actions.ts, every change takes the garden and returns a new copy.

import { newId } from "./data";
import type { AreaKind, BedPlan, BedSpot, Box, FeatureKind, GardenData, GardenMap, MapFeature, North } from "./types";

// ── The whole-garden map ─────────────────────────────────────────

export const MAP_MIN = 4;
export const MAP_MAX = 60;

export function defaultMap(): GardenMap {
  return { width: 12, length: 20, north: "up", areas: {}, features: [] };
}

/** A sensible starting size for each kind of area, in metres (width × length). */
const AREA_SIZE: Record<AreaKind, [number, number]> = {
  border: [2, 6],
  bed: [3, 2],
  pots: [3, 3],
  greenhouse: [3, 2],
  veg: [4, 5],
  water: [4, 3],
  lawn: [6, 6],
  other: [3, 3],
};

export const FEATURES: Array<{ kind: FeatureKind; label: string; size: [number, number] }> = [
  { kind: "house", label: "House", size: [8, 4] },
  { kind: "patio", label: "Patio", size: [4, 3] },
  { kind: "path", label: "Path", size: [1, 6] },
  { kind: "shed", label: "Shed", size: [2, 2] },
  { kind: "tree", label: "Tree", size: [2, 2] },
  { kind: "compost", label: "Compost", size: [1, 1] },
  { kind: "other", label: "Something else", size: [2, 2] },
];

const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Keeps a box inside the garden and at least one square big. */
export function clampBox(b: Box, width: number, length: number): Box {
  const w = clampN(b.w, 1, width);
  const h = clampN(b.h, 1, length);
  return { w, h, x: clampN(b.x, 0, width - w), y: clampN(b.y, 0, length - h) };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function allBoxes(m: GardenMap): Box[] {
  return [...Object.values(m.areas), ...m.features];
}

/** The first empty spot (top-left first) that fits a w × h box. */
export function findSpace(m: GardenMap, w: number, h: number): Box {
  const size = clampBox({ x: 0, y: 0, w, h }, m.width, m.length);
  const taken = allBoxes(m);
  for (let y = 0; y + size.h <= m.length; y++) {
    for (let x = 0; x + size.w <= m.width; x++) {
      const b = { ...size, x, y };
      if (!taken.some((t) => overlaps(t, b))) return b;
    }
  }
  return size; // garden full: put it top-left, it can be moved
}

function withMap(g: GardenData, map: GardenMap): GardenData {
  return { ...g, map };
}

export function placeArea(g: GardenData, areaId: string): GardenData {
  const area = g.areas.find((a) => a.id === areaId);
  if (!area || g.map.areas[areaId]) return g;
  const [w, h] = AREA_SIZE[area.kind];
  const box = findSpace(g.map, w, h);
  return withMap(g, { ...g.map, areas: { ...g.map.areas, [areaId]: box } });
}

/** Puts every area that isn't on the map yet onto it, in order. */
export function placeAllAreas(g: GardenData): GardenData {
  return g.areas.reduce((acc, a) => placeArea(acc, a.id), g);
}

/** What's selected on the map: an area or a feature. */
export type MapRef = { areaId: string } | { featureId: string };

export function boxOf(m: GardenMap, ref: MapRef): Box | undefined {
  if ("areaId" in ref) return m.areas[ref.areaId];
  return m.features.find((f) => f.id === ref.featureId);
}

export function setBox(g: GardenData, ref: MapRef, box: Box): GardenData {
  const b = clampBox(box, g.map.width, g.map.length);
  if ("areaId" in ref) {
    if (!g.map.areas[ref.areaId]) return g;
    return withMap(g, { ...g.map, areas: { ...g.map.areas, [ref.areaId]: b } });
  }
  return withMap(g, { ...g.map, features: g.map.features.map((f) => (f.id === ref.featureId ? { ...f, ...b } : f)) });
}

export function nudge(g: GardenData, ref: MapRef, dx: number, dy: number, dw = 0, dh = 0): GardenData {
  const b = boxOf(g.map, ref);
  if (!b) return g;
  return setBox(g, ref, { x: b.x + dx, y: b.y + dy, w: b.w + dw, h: b.h + dh });
}

/** Turns an area round (swaps width and length), keeping it in the garden. */
export function turn(g: GardenData, ref: MapRef): GardenData {
  const b = boxOf(g.map, ref);
  if (!b) return g;
  return setBox(g, ref, { x: b.x, y: b.y, w: b.h, h: b.w });
}

export function removeFromMap(g: GardenData, ref: MapRef): GardenData {
  if ("areaId" in ref) {
    const areas = { ...g.map.areas };
    delete areas[ref.areaId];
    return withMap(g, { ...g.map, areas });
  }
  return withMap(g, { ...g.map, features: g.map.features.filter((f) => f.id !== ref.featureId) });
}

export function addFeature(g: GardenData, kind: FeatureKind): [GardenData, string] {
  const def = FEATURES.find((f) => f.kind === kind) ?? FEATURES[FEATURES.length - 1];
  const id = newId("feature");
  const box = findSpace(g.map, def.size[0], def.size[1]);
  const feature: MapFeature = { id, kind, label: def.label, ...box };
  return [withMap(g, { ...g.map, features: [...g.map.features, feature] }), id];
}

export function renameFeature(g: GardenData, id: string, label: string): GardenData {
  const name = label.trim();
  if (!name) return g;
  return withMap(g, { ...g.map, features: g.map.features.map((f) => (f.id === id ? { ...f, label: name } : f)) });
}

/** Changes the garden's size. Anything that would fall off the edge is brought back in. */
export function setMapSize(g: GardenData, width: number, length: number): GardenData {
  const W = clampN(width, MAP_MIN, MAP_MAX);
  const L = clampN(length, MAP_MIN, MAP_MAX);
  const areas: Record<string, Box> = {};
  for (const [id, b] of Object.entries(g.map.areas)) areas[id] = clampBox(b, W, L);
  const features = g.map.features.map((f) => ({ ...f, ...clampBox(f, W, L) }));
  return withMap(g, { ...g.map, width: W, length: L, areas, features });
}

const NORTH_ORDER: North[] = ["up", "right", "down", "left"];

export function turnNorth(g: GardenData): GardenData {
  const next = NORTH_ORDER[(NORTH_ORDER.indexOf(g.map.north) + 1) % 4];
  return withMap(g, { ...g.map, north: next });
}

export const NORTH_DEGREES: Record<North, number> = { up: 0, right: 90, down: 180, left: 270 };

// ── Bed plans: what's planted where inside an area ───────────────

export const BED_MIN = 1;
export const BED_MAX = 16;

/** A new bed plan sized from the area's shape on the map (two squares to a metre), or 6 × 4. */
export function defaultBedPlan(g: GardenData, areaId: string): BedPlan {
  const b = g.map.areas[areaId];
  if (!b) return { cols: 6, rows: 4, spots: [] };
  return { cols: clampN(b.w * 2, 2, 12), rows: clampN(b.h * 2, 2, BED_MAX), spots: [] };
}

export function bedPlanFor(g: GardenData, areaId: string): BedPlan {
  return g.bedPlans[areaId] ?? defaultBedPlan(g, areaId);
}

function withBed(g: GardenData, areaId: string, plan: BedPlan): GardenData {
  return { ...g, bedPlans: { ...g.bedPlans, [areaId]: plan } };
}

/** What can go in a square: a plant, or a planned plant. */
export type BedItem = { plantId: string } | { plannedId: string };

const sameItem = (s: BedSpot, item: BedItem) =>
  "plantId" in item ? s.plantId === item.plantId : s.plannedId === item.plannedId;

/**
 * Puts a plant in a square. If it was already somewhere it moves.
 * If the square was taken, the two swap (or the other goes back to "not placed yet").
 */
export function placeInBed(g: GardenData, areaId: string, x: number, y: number, item: BedItem): GardenData {
  const plan = bedPlanFor(g, areaId);
  if (x < 0 || y < 0 || x >= plan.cols || y >= plan.rows) return g;
  const mine = plan.spots.find((s) => sameItem(s, item));
  const there = plan.spots.find((s) => s.x === x && s.y === y);
  if (mine && there && mine.id === there.id) return g;
  let spots = plan.spots.filter((s) => s !== mine && s !== there);
  if (there && mine) spots = [...spots, { ...there, x: mine.x, y: mine.y }];
  const placed: BedSpot = { id: mine?.id ?? newId("spot"), x, y, ...item };
  return withBed(g, areaId, { ...plan, spots: [...spots, placed] });
}

export function removeFromBed(g: GardenData, areaId: string, spotId: string): GardenData {
  const plan = g.bedPlans[areaId];
  if (!plan) return g;
  return withBed(g, areaId, { ...plan, spots: plan.spots.filter((s) => s.id !== spotId) });
}

/** Changes the number of squares. Plants that fall outside go back to "not placed yet". */
export function setBedSize(g: GardenData, areaId: string, cols: number, rows: number): GardenData {
  const plan = bedPlanFor(g, areaId);
  const c = clampN(cols, BED_MIN, BED_MAX);
  const r = clampN(rows, BED_MIN, BED_MAX);
  return withBed(g, areaId, { cols: c, rows: r, spots: plan.spots.filter((s) => s.x < c && s.y < r) });
}

/** When a planned plant is planted, its square carries over to the real plant. */
export function plannedBecamePlant(g: GardenData, plannedId: string, plantId: string): GardenData {
  const bedPlans: Record<string, BedPlan> = {};
  for (const [areaId, plan] of Object.entries(g.bedPlans)) {
    bedPlans[areaId] = {
      ...plan,
      spots: plan.spots.map((s) => (s.plannedId === plannedId ? { id: s.id, x: s.x, y: s.y, plantId } : s)),
    };
  }
  return { ...g, bedPlans };
}

/**
 * Tidies up after other changes: drops squares for plants that were deleted or moved
 * to another area, planned plants taken off the plan, and areas that were removed.
 * Lost plants keep their square, shown faintly as "was here".
 */
export function tidyBedPlans(g: GardenData): GardenData {
  let changed = false;
  const bedPlans: Record<string, BedPlan> = {};
  const areaIds = new Set(g.areas.map((a) => a.id));
  for (const [areaId, plan] of Object.entries(g.bedPlans)) {
    if (!areaIds.has(areaId)) {
      changed = true;
      continue;
    }
    const spots = plan.spots.filter((s) =>
      s.plantId
        ? g.plants.some((p) => p.id === s.plantId && p.areaId === areaId)
        : g.planned.some((p) => p.id === s.plannedId && p.areaId === areaId),
    );
    if (spots.length !== plan.spots.length) changed = true;
    bedPlans[areaId] = { ...plan, spots };
  }
  const mapAreas = Object.keys(g.map.areas).filter((id) => !areaIds.has(id));
  if (!changed && mapAreas.length === 0) return g;
  const areas = { ...g.map.areas };
  for (const id of mapAreas) delete areas[id];
  return { ...g, bedPlans, map: { ...g.map, areas } };
}

/** A short label for a square: "Dahlia 'Bishop'" → "Dahlia". */
export function shortLabel(name: string): string {
  const first = name.replace(/'.*$/, "").trim();
  return first.length > 11 ? first.slice(0, 10) + "…" : first;
}

// ── From a plant to its square (v0.7) ────────────────────────────

/** Where a plant sits on its area's bed plan, if it has a square. */
export function whereIs(g: GardenData, plantId: string): { areaId: string; plan: BedPlan; spot: BedSpot } | undefined {
  const plant = g.plants.find((p) => p.id === plantId);
  if (!plant) return undefined;
  const plan = g.bedPlans[plant.areaId];
  const spot = plan?.spots.find((s) => s.plantId === plantId);
  return plan && spot ? { areaId: plant.areaId, plan, spot } : undefined;
}

/** A plant's or planned plant's full name for a square: "Dahlia 'Bishop'". */
export function spotName(g: GardenData, s: { plantId?: string; plannedId?: string }): string {
  if (s.plantId) {
    const p = g.plants.find((x) => x.id === s.plantId);
    return p ? (p.variety ? `${p.name} '${p.variety}'` : p.name) : "";
  }
  return g.planned.find((x) => x.id === s.plannedId)?.name ?? "";
}

/**
 * What's in the squares around one square (including corners), nearest first.
 * Plants that didn't make it are left out: they're not there any more.
 */
export function neighbours(g: GardenData, areaId: string, x: number, y: number): BedSpot[] {
  const plan = g.bedPlans[areaId];
  if (!plan) return [];
  const lost = (s: BedSpot) => !!s.plantId && g.plants.find((p) => p.id === s.plantId)?.status === "lost";
  return plan.spots
    .filter((s) => !(s.x === x && s.y === y) && Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1 && !lost(s))
    .sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - (Math.abs(b.x - x) + Math.abs(b.y - y)) || a.y - b.y || a.x - b.x);
}

/**
 * Roughly where a square is on the plan, as drawn:
 * "in the top left corner", "along the top", "down the left side", "in the middle".
 */
export function positionWords(plan: { cols: number; rows: number }, x: number, y: number): string {
  const third = (n: number, size: number) => (size === 1 ? 1 : Math.round((n / (size - 1)) * 2));
  const across = ["left", "", "right"][third(x, plan.cols)];
  const down = ["top", "", "bottom"][third(y, plan.rows)];
  if (across && down) return `in the ${down} ${across} corner`;
  if (down) return `along the ${down}`;
  if (across) return `down the ${across} side`;
  return "in the middle";
}

/** Joins names in plain English: "A", "A and B", "A, B and C". */
export function andList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

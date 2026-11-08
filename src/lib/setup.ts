// First-time setup (v1.0): turns the answers from the setup screens into a garden.
// Everything here is plain logic, so it can be tested without a phone.

import { CATALOGUE } from "./catalogue";
import type { CatPlant } from "./catalogue";
import { defaultMap, tidyBedPlans } from "./layout";
import { makePlan, PRIORITIES } from "./plan";
import type { Priority } from "./plan";
import { newId, upgrade } from "./data";
import type { Area, AreaKind, Aspect, Gardener, GardenData, Plant } from "./types";

/** "What matters most": the wireframe's five, in its order. */
export const LIKES = ["Growing food", "Flowers and colour", "Wildlife", "Low maintenance", "Trying new things"];

export const TIMES: Array<{ value: NonNullable<Gardener["time"]>; label: string }> = [
  { value: "under1", label: "Under 1 hr" },
  { value: "1to3", label: "1–3 hrs" },
  { value: "3plus", label: "3+ hrs" },
];

export const DAYS: Array<[string, string]> = [
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
  ["S", "Sunday"],
];

/** Quick ideas for areas. Tapping one adds it, ready to rename. */
export const AREA_IDEAS: Array<{ name: string; kind: AreaKind }> = [
  { name: "The border", kind: "border" },
  { name: "Patio pots", kind: "pots" },
  { name: "Raised bed", kind: "bed" },
  { name: "Veg patch", kind: "veg" },
  { name: "The allotment", kind: "veg" },
  { name: "The greenhouse", kind: "greenhouse" },
  { name: "The lawn", kind: "lawn" },
  { name: "The pond", kind: "water" },
];

export const GARDEN_NAME_IDEAS = ["Our garden", "The back garden", "The cottage garden"];

export interface SetupArea {
  key: string; // stays the same while the name is edited
  name: string;
  kind: AreaKind;
  aspect?: Aspect;
  soil?: string;
}

/** Something already growing, added during setup. */
export interface SetupPlant {
  key: string;
  areaKey: string;
  name: string;
  /** "I'm not sure": the gardener's description, kept exactly as written. */
  describedAs?: string;
}

/** A starter plant chosen during setup, to be planted later. */
export interface SetupPlanned {
  areaKey: string;
  catalogueId: string;
}

export interface SetupAnswers {
  gardenName: string;
  people: Gardener[];
  postcode?: string;
  location?: GardenData["settings"]["location"];
  areas: SetupArea[];
  plants: SetupPlant[];
  planned: SetupPlanned[];
  likes: string[]; // from LIKES, plus anything typed in
}

export const blankAnswers = (): SetupAnswers => ({
  gardenName: "",
  people: [{ name: "", days: [] }],
  areas: [],
  plants: [],
  planned: [],
  likes: [],
});

const norm = (s: string) => s.toLowerCase().replace(/[‘’']/g, "").replace(/\s+/g, " ").trim();

/** Finds a catalogue plant from a typed name: "lavender" finds Lavender 'Hidcote'. */
export function findInCatalogue(name: string): CatPlant | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const exact = CATALOGUE.find((c) => norm(c.name) === n || (c.latin && norm(c.latin) === n));
  if (exact) return exact;
  // "Lavender" matches "Lavender 'Hidcote'"; "rosemary" matches "Rosemary".
  return CATALOGUE.find((c) => {
    const base = norm(c.name.replace(/\s*['‘].*$/, "").replace(/\s*\(.*\)$/, ""));
    return base === n || (n.length >= 5 && base.startsWith(n));
  });
}

/** "Stef", "Stef and Cath", "Stef, Cath and Jo". */
export function namesList(names: string[]): string {
  const n = names.map((x) => x.trim()).filter(Boolean);
  if (n.length <= 1) return n[0] ?? "";
  return `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

/** The "You're all set" title on the last screen. */
export function doneTitle(people: Gardener[]): string {
  const n = namesList(people.map((p) => p.name));
  return n ? `You're all set, ${n}` : "You're all set";
}

/** The likes Mary Mary's planting plan understands. Growing food is handled separately. */
export function prioritiesFrom(likes: string[]): Priority[] {
  return PRIORITIES.filter((p) => likes.includes(p.label)).map((p) => p.value);
}

export type Room = "small" | "border" | "big" | "unsure";

export const ROOMS: Array<{ value: Room; title: string; sub: string }> = [
  { value: "small", title: "A pot or a small patch", sub: "About a metre across, or a couple of pots" },
  { value: "border", title: "A border", sub: "A few metres long" },
  { value: "big", title: "A big space", sub: "More than five metres, or a whole bed" },
  { value: "unsure", title: "Not sure yet", sub: "Mary Mary will start small" },
];

const EDIBLE = ["Herbs", "Fruit", "Vegetables"];

/**
 * "Not much planted yet?": a few easy, forgiving plants for one area.
 * Uses the same planner as the planting plan, then keeps the list short.
 */
export function starterIdeas(
  area: SetupArea,
  opts: { room?: Room; likes: string[]; month: number; leaveOut?: string[] },
): CatPlant[] {
  const count = opts.room === "border" ? 5 : opts.room === "big" ? 6 : 3;
  const a: Area = { id: "setup", name: area.name, kind: area.kind, aspect: area.aspect, soil: area.soil, createdAt: "" };
  const g: GardenData = upgrade({
    version: 1,
    settings: { gardenName: "", yourName: "" },
    areas: [a],
    plants: [],
    setbacks: [],
    journal: [],
    planned: [],
    notForMe: [],
    tasks: [],
    snoozed: {},
    map: defaultMap(),
    bedPlans: {},
    supplies: [],
    harvests: [],
  });
  const soil = area.soil === "Not sure" ? undefined : area.soil;
  // Easy plants first: setup is about a gentle start.
  const priorities = Array.from(new Set<Priority>(["easy", ...prioritiesFrom(opts.likes)]));
  const plan = makePlan(g, a, { goal: "refresh", soil, priorities, month: opts.month });
  let list = plan.groups.flatMap((gr) => gr.items.map((s) => s.plant));
  // makePlan stops at ten; "Growing food" brings edible plants to the front.
  if (opts.likes.includes("Growing food")) {
    list = [...list.filter((p) => EDIBLE.includes(p.section)), ...list.filter((p) => !EDIBLE.includes(p.section))];
  }
  const leave = new Set(opts.leaveOut ?? []);
  return list.slice(0, count).filter((p) => !leave.has(p.id));
}

/** Which section a plant added by name goes in. */
function sectionFor(name: string, kind: AreaKind): { section: string; latin?: string; name: string } {
  const c = findInCatalogue(name);
  if (c) return { section: c.section, latin: c.latin, name: name.trim() };
  return { section: kind === "veg" ? "Vegetables" : "Perennials", name: name.trim() };
}

/** Builds the whole garden from the setup answers. */
export function gardenFromSetup(ans: SetupAnswers, today: string, now = new Date().toISOString()): GardenData {
  const people = ans.people
    .map((p) => ({ ...p, name: p.name.trim() }))
    .filter((p, i) => i === 0 || p.name);
  const areaIds = new Map<string, string>();
  const areas: Area[] = ans.areas
    .filter((a) => a.name.trim())
    .map((a) => {
      const id = newId("area");
      areaIds.set(a.key, id);
      return {
        id,
        name: a.name.trim(),
        kind: a.kind,
        ...(a.aspect ? { aspect: a.aspect } : {}),
        ...(a.soil && a.soil !== "Not sure" ? { soil: a.soil } : {}),
        createdAt: now,
      };
    });
  const kindOf = (id: string) => areas.find((a) => a.id === id)?.kind ?? "other";

  const plants: Plant[] = ans.plants
    .filter((p) => areaIds.has(p.areaKey) && (p.name.trim() || p.describedAs?.trim()))
    .map((p) => {
      const areaId = areaIds.get(p.areaKey)!;
      if (p.describedAs !== undefined) {
        return {
          id: newId("plant"),
          name: p.name.trim() || "Not sure yet",
          areaId,
          section: "To identify",
          notes: p.describedAs.trim(),
          status: "growing" as const,
          createdAt: now,
        };
      }
      const s = sectionFor(p.name, kindOf(areaId));
      return {
        id: newId("plant"),
        name: s.name,
        ...(s.latin ? { latinName: s.latin } : {}),
        areaId,
        section: s.section,
        status: "growing" as const,
        createdAt: now,
      };
    });

  const seen = new Set<string>();
  const planned = ans.planned
    .filter((p) => areaIds.has(p.areaKey))
    .filter((p) => {
      const k = `${p.areaKey}:${p.catalogueId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .flatMap((p) => {
      const c = CATALOGUE.find((x) => x.id === p.catalogueId);
      if (!c) return [];
      return [{ id: newId("planned"), areaId: areaIds.get(p.areaKey)!, catalogueId: c.id, name: c.name, section: c.section, addedOn: today }];
    });

  const yourName = people[0]?.name ?? "";
  const g: GardenData = {
    version: 1,
    settings: {
      gardenName: ans.gardenName.trim() || (yourName ? `${yourName}'s garden` : "My garden"),
      yourName,
      ...(ans.postcode?.trim() ? { postcode: ans.postcode.trim() } : {}),
      ...(ans.location && ans.postcode?.trim() && ans.location.forPostcode === ans.postcode.trim() ? { location: ans.location } : {}),
      gardeners: people.map((p) => ({ name: p.name, ...(p.time ? { time: p.time } : {}), days: p.days ?? [] })),
      likes: Array.from(new Set(ans.likes.map((l) => l.trim()).filter(Boolean))),
      setUpOn: today,
    },
    areas,
    plants,
    setbacks: [],
    journal: [],
    planned,
    notForMe: [],
    tasks: [],
    snoozed: {},
    map: defaultMap(),
    bedPlans: {},
    supplies: [],
    harvests: [],
  };
  return tidyBedPlans(upgrade(g));
}

/** A brand new phone: an empty garden that asks to be set up. */
export function newInstall(): GardenData {
  return upgrade({
    version: 1,
    settings: { gardenName: "My garden", yourName: "", needsSetup: true },
    areas: [],
    plants: [],
    setbacks: [],
    journal: [],
    planned: [],
    notForMe: [],
    tasks: [],
    snoozed: {},
    map: defaultMap(),
    bedPlans: {},
    supplies: [],
    harvests: [],
  });
}

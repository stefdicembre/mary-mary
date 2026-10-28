// The planting planner: suggests plants for an area from the built-in catalogue,
// using what Mary Mary knows about the area and what went wrong there before.
// It suggests gently and never blocks: anything left out is explained.

import { CATALOGUE } from "./catalogue";
import type { CatPlant, Place, Sun } from "./catalogue";
import { COLOUR_SCHEMES } from "./data";
import type { Area, AreaKind, Aspect, GardenData } from "./types";

export type Goal = "gaps" | "refresh";
export type Priority = "colour" | "wildlife" | "easy" | "new";

export const PRIORITIES: Array<{ value: Priority; label: string; tag: string }> = [
  { value: "colour", label: "Flowers and colour", tag: "Lots of colour" },
  { value: "wildlife", label: "Wildlife", tag: "Good for wildlife" },
  { value: "easy", label: "Low maintenance", tag: "Easy care" },
  { value: "new", label: "Trying new things", tag: "Something new" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function sunFor(aspect?: Aspect): Sun | undefined {
  if (!aspect) return undefined;
  if (aspect === "S" || aspect === "SW" || aspect === "SE" || aspect === "W") return "full";
  if (aspect === "E" || aspect === "NW") return "part";
  return "shade";
}

const PLACES: Record<AreaKind, Place[]> = {
  border: ["border"],
  bed: ["border"],
  pots: ["pots"],
  greenhouse: ["greenhouse"],
  veg: ["veg"],
  water: ["water", "border", "pots"],
  lawn: ["lawn"],
  other: ["border", "pots"],
};

/** What went wrong in this area before, boiled down. */
export interface Lessons {
  wind: number;
  wet: number;
  dry: number;
  frost: number;
  heat: number;
  slugs: number;
  lostHere: Array<{ name: string; why: string }>;
}

export function lessonsFor(g: GardenData, areaId: string): Lessons {
  const l: Lessons = { wind: 0, wet: 0, dry: 0, frost: 0, heat: 0, slugs: 0, lostHere: [] };
  for (const s of g.setbacks.filter((x) => x.areaId === areaId)) {
    const w = s.details.weather;
    if (w === "Wind") l.wind++;
    if (w === "Frost") l.frost++;
    if (w === "Heat") l.heat++;
    if (s.details.water === "Too wet") l.wet++;
    if (s.details.water === "Too dry") l.dry++;
    if (s.details.pests === "Slugs and snails") l.slugs++;
    if (s.outcome !== "struggling") {
      const p = g.plants.find((x) => x.id === s.plantId);
      const why = [w, s.details.water, s.details.pests].filter(Boolean).join(", ").toLowerCase();
      if (p) l.lostHere.push({ name: p.name, why });
    }
  }
  return l;
}

export interface Suggestion {
  plant: CatPlant;
  month: number; // the next planting month
  tags: string[];
  note?: string; // extra line, e.g. why it suits what was learned here
}

export interface PlanGroup {
  key: string;
  title: string;
  sub: string;
  items: Suggestion[];
}

export interface Plan {
  groups: PlanGroup[];
  leftOut: string[];
  soilNote: string;
}

function seasonOf(m: number): { name: string; range: string } {
  if (m === 12 || m <= 2) return { name: "winter", range: "December to February" };
  if (m <= 5) return { name: "spring", range: "March to May" };
  if (m <= 8) return { name: "summer", range: "June to August" };
  return { name: "autumn", range: "September to November" };
}

/** Months from now until this plant can next go in (0 = this month). */
function wait(p: CatPlant, now: number): { month: number; months: number } {
  let best = { month: p.plant[0], months: 99 };
  for (const m of p.plant) {
    const d = (m - now + 12) % 12;
    if (d < best.months) best = { month: m, months: d };
  }
  return best;
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’']/g, "").trim();

export function makePlan(
  g: GardenData,
  area: Area,
  opts: { goal: Goal; soil?: string; priorities: Priority[]; month: number },
): Plan {
  const places = PLACES[area.kind];
  const sun = area.kind === "greenhouse" ? undefined : sunFor(area.aspect);
  const lessons = lessonsFor(g, area.id);
  const isEdible = area.kind === "veg" || area.kind === "greenhouse";
  const scheme = COLOUR_SCHEMES.find((c) => c.value === area.colours);
  const schemeColours = scheme && !isEdible ? scheme.colours : [];
  const soil = opts.soil && opts.soil !== "Not sure" ? opts.soil : undefined;

  const growingHere = g.plants.filter((p) => p.areaId === area.id && p.status !== "lost");
  const plannedHere = g.planned.filter((p) => p.areaId === area.id);
  const already = (c: CatPlant) =>
    growingHere.some((p) => {
      const full = norm(`${p.name} ${p.variety ? `'${p.variety}'` : ""}`);
      const n = norm(c.name);
      return n === norm(p.name) || n === full || (p.variety && n.includes(norm(p.variety)));
    }) || plannedHere.some((p) => p.catalogueId === c.id);

  const leftOut: string[] = [];
  const picked: Array<{ s: Suggestion; score: number; wait: number }> = [];

  for (const c of CATALOGUE) {
    if (!c.places.some((p) => places.includes(p))) continue;
    if (sun && !c.sun.includes(sun)) continue;
    if (g.notForMe.includes(`${area.id}:${c.id}`)) continue;
    if (already(c)) continue;
    if (schemeColours.length && !c.colours.some((x) => schemeColours.includes(x) || x === "green")) continue;
    if (opts.goal === "gaps" && ["Trees and shrubs", "Roses", "Climbers"].includes(c.section) && !isEdible) continue;

    // Things that would likely fail here: leave out, and say why.
    if (soil && c.avoidSoil?.includes(soil)) {
      leftOut.push(`${c.name}, which struggles in ${soil.toLowerCase()} soil`);
      continue;
    }
    const lostBefore = lessons.lostHere.find((x) => norm(c.name).startsWith(norm(x.name)) || norm(x.name) === norm(c.latin ?? ""));
    if (lostBefore) {
      leftOut.push(`${c.name}, because your ${lostBefore.name.toLowerCase()} didn't make it here${lostBefore.why ? ` (${lostBefore.why})` : ""}`);
      continue;
    }
    if (lessons.frost && !c.hardy && !isEdible) {
      leftOut.push(`${c.name}, which isn't frost-hardy and frost has caused trouble here`);
      continue;
    }
    if (lessons.wet && c.dry && !c.damp) {
      leftOut.push(`${c.name}, which dislikes wet soil`);
      continue;
    }
    if (lessons.slugs && c.slugMagnet) {
      leftOut.push(`${c.name}, which slugs love`);
      continue;
    }

    const tags: string[] = [];
    let score = 0;
    const notes: string[] = [];
    for (const pr of opts.priorities) {
      const hit =
        (pr === "colour" && c.colours.some((x) => x !== "green")) ||
        (pr === "wildlife" && c.wildlife) ||
        (pr === "easy" && c.easy) ||
        (pr === "new" && c.unusual);
      if (hit) {
        score += 2;
        tags.push(PRIORITIES.find((p) => p.value === pr)!.tag);
      }
    }
    if (lessons.wind) {
      if (c.wind) {
        score += 3;
        tags.push("Copes with wind");
        notes.push("Stands up to wind, which has caused trouble here before.");
      } else score -= 2;
    }
    if (lessons.wet && c.damp) {
      score += 2;
      tags.push("Copes with damp");
    }
    if ((lessons.dry || lessons.heat) && c.dry) {
      score += 2;
      tags.push("Copes with dry spells");
    }
    if (lessons.slugs && c.slugs) {
      score += 2;
      tags.push("Slugs tend to leave it");
    }
    if (soil === "Clay" && c.damp) score += 1;
    if ((soil === "Sandy" || soil === "Chalky") && c.dry) score += 1;

    const w = wait(c, opts.month);
    picked.push({ s: { plant: c, month: w.month, tags, note: notes[0] }, score, wait: w.months });
  }

  // Sooner first within a score band, and keep the list short enough to act on.
  picked.sort((a, b) => b.score - a.score || a.wait - b.wait || a.s.plant.name.localeCompare(b.s.plant.name));
  const limit = opts.goal === "gaps" ? 6 : 10;
  const chosen = picked.slice(0, limit);

  const groups = new Map<string, PlanGroup>();
  for (const { s, wait: months } of chosen.sort((a, b) => a.wait - b.wait)) {
    let key: string, title: string, sub: string;
    if (months === 0) {
      key = "now";
      title = `Now, in ${MONTHS[s.month - 1]}`;
      sub = "Plant these over the next few weeks";
    } else if (months === 1) {
      key = "next";
      title = `Next month, in ${MONTHS[s.month - 1]}`;
      sub = "Add them to your plans and get them ready";
    } else {
      const se = seasonOf(s.month);
      key = `season-${se.name}`;
      title = `In ${se.name}, ${se.range}`;
      sub = se.name === "spring" ? "Once the soil warms up" : "Later in the year";
    }
    if (!groups.has(key)) groups.set(key, { key, title, sub, items: [] });
    groups.get(key)!.items.push(s);
  }

  const soilNote = soil
    ? `Chosen with ${soil.toLowerCase()} soil in mind.`
    : "Chosen to cope with most soils. Add your soil on the area page whenever you know it, and the plan will take it into account.";

  return { groups: Array.from(groups.values()), leftOut: Array.from(new Set(leftOut)).slice(0, 4), soilNote };
}

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  return runs.map((r) => (r.length === 1 ? SHORT[r[0] - 1] : `${SHORT[r[0] - 1]} to ${SHORT[r[r.length - 1] - 1]}`)).join(", ");
}

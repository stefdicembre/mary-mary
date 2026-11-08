// Supplies: what's in the shed and what's running low.
// Mary Mary lowers a supply when a job that uses it is ticked off.
// A small job (tying in a climber) uses a bit: three of those and it drops a level.
// A big job (mulching the borders) drops it a level straight away.
// The gardener can always correct her.

import { newId } from "./data";
import type { JobItem } from "./jobs";
import type { GardenData, Supply, SupplyLevel, SupplyUse } from "./types";

/** Something a job needs. `what` is shown on screen; `match` are extra words to look for in supply names. */
export interface JobUse {
  what: string;
  match?: string[];
  /** A big job that uses a lot of it. */
  lots?: boolean;
}

export const LEVELS: Array<{ value: SupplyLevel; label: string }> = [
  { value: "plenty", label: "Plenty" },
  { value: "low", label: "Running low" },
  { value: "out", label: "None left" },
];

export const levelLabel = (l: SupplyLevel) => LEVELS.find((x) => x.value === l)!.label;

/** Common shed things, offered as one-tap suggestions when adding. */
export const SUPPLY_SUGGESTIONS = [
  "Fleece",
  "Garden twine",
  "Multipurpose compost",
  "Seed compost",
  "Bone meal",
  "Plant ties",
  "Bamboo canes",
  "Slug pellets",
  "Bird seed",
  "Tomato feed",
  "Horticultural grit",
  "Netting",
  "Bubble wrap",
  "Straw",
  "Mulch",
];

const SMALL = 1;
const BIG = 3;
const STEP = 3; // wear needed to drop a level

const lower = (l: SupplyLevel): SupplyLevel => (l === "plenty" ? "low" : "out");
const raise = (l: SupplyLevel): SupplyLevel => (l === "out" ? "low" : "plenty");

// Words that say nothing about what a supply is.
const FILLER = new Set(["garden", "plant", "plants", "multipurpose", "general", "purpose", "the", "and", "for", "bag", "bags", "box", "roll", "pack", "big", "small", "large", "new", "old", "some", "organic", "peat", "free"]);

const wordStart = (text: string, word: string) => {
  const esc = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${esc}`).test(text.toLowerCase());
};

/** The words that make a supply's name: "Garden twine" → ["twine"]. */
export function keyWords(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !FILLER.has(w))
    .map((w) => (w.length > 4 ? w.replace(/([^s])s$/, "$1") : w)); // "canes" → "cane", "ties" stays
}

/** Does this supply meet one of a job's needs? */
function meets(supply: Supply, use: JobUse): boolean {
  return [use.what, ...(use.match ?? [])].some((w) => wordStart(supply.name, w));
}

/** Which supplies a job will use, and how much. */
export function suppliesForJob(g: GardenData, job: Pick<JobItem, "uses" | "title" | "why" | "kind">): SupplyUse[] {
  const out: SupplyUse[] = [];
  for (const s of g.supplies) {
    let amount = 0;
    for (const u of job.uses ?? []) if (meets(s, u)) amount = Math.max(amount, u.lots ? BIG : SMALL);
    // The gardener's own jobs: look for the supply in the title or "Anything you'll need?".
    if (!amount && job.kind === "mine") {
      const text = `${job.title} ${job.why ?? ""}`;
      if (keyWords(s.name).some((w) => wordStart(text, w))) amount = SMALL;
    }
    if (amount) out.push({ supplyId: s.id, amount });
  }
  return out;
}

/** This week's jobs that need a supply. */
export function neededFor(g: GardenData, supply: Supply, jobs: JobItem[]): JobItem[] {
  return jobs.filter((j) => suppliesForJob(g, j).some((u) => u.supplyId === supply.id));
}

/** Supplies running low or gone, that a job this week needs. */
export function shortForJobs(g: GardenData, jobs: JobItem[]): Array<{ supply: Supply; jobs: JobItem[] }> {
  return g.supplies
    .filter((s) => s.level !== "plenty")
    .map((supply) => ({ supply, jobs: neededFor(g, supply, jobs) }))
    .filter((x) => x.jobs.length > 0);
}

// ── Changes ─────────────────────────────────────────────────────

export function addSupply(g: GardenData, name: string, level: SupplyLevel = "plenty"): [GardenData, string] {
  const id = newId("supply");
  const clean = name.trim();
  const s: Supply = { id, name: clean.charAt(0).toUpperCase() + clean.slice(1), level, wear: 0, createdAt: new Date().toISOString() };
  return [{ ...g, supplies: [...g.supplies, s] }, id];
}

/** The gardener sets the level: this is the truth, so Mary Mary's count starts again. */
export function setSupplyLevel(g: GardenData, id: string, level: SupplyLevel): GardenData {
  return { ...g, supplies: g.supplies.map((s) => (s.id === id ? { ...s, level, wear: 0, lowered: undefined } : s)) };
}

export function renameSupply(g: GardenData, id: string, name: string): GardenData {
  const n = name.trim();
  if (!n) return g;
  return { ...g, supplies: g.supplies.map((s) => (s.id === id ? { ...s, name: n } : s)) };
}

export function removeSupply(g: GardenData, id: string): GardenData {
  return { ...g, supplies: g.supplies.filter((s) => s.id !== id) };
}

/**
 * A job was done: use up what it needed. Returns the new garden and what was used
 * (only what actually counted, so Undo puts back exactly that).
 */
export function spendSupplies(g: GardenData, uses: SupplyUse[], jobTitle: string, today: string): [GardenData, SupplyUse[]] {
  const used: SupplyUse[] = [];
  const supplies = g.supplies.map((s) => {
    const u = uses.find((x) => x.supplyId === s.id);
    if (!u || s.level === "out") return s;
    used.push(u);
    let level: SupplyLevel = s.level;
    let wear = s.wear;
    wear += u.amount;
    let dropped = false;
    while (wear >= STEP && level !== "out") {
      level = lower(level);
      wear -= STEP;
      dropped = true;
    }
    if (level === "out") wear = 0;
    return { ...s, level, wear, lowered: dropped ? { by: jobTitle, on: today } : s.lowered };
  });
  return [{ ...g, supplies }, used];
}

/** Undo a done job: put back what it used. */
export function returnSupplies(g: GardenData, used: SupplyUse[] = []): GardenData {
  if (!used.length) return g;
  const supplies = g.supplies.map((s) => {
    const u = used.find((x) => x.supplyId === s.id);
    if (!u) return s;
    let level: SupplyLevel = s.level;
    let wear = s.wear;
    wear -= u.amount;
    let raised = false;
    while (wear < 0 && level !== "plenty") {
      level = raise(level);
      wear += STEP;
      raised = true;
    }
    return { ...s, level, wear: Math.max(0, wear), lowered: raised ? undefined : s.lowered };
  });
  return { ...g, supplies };
}

/** A plain list for the shops: "Garden twine (running low)". */
export function shoppingList(g: GardenData): string {
  return g.supplies
    .filter((s) => s.level !== "plenty")
    .map((s) => `${s.name} (${levelLabel(s.level).toLowerCase()})`)
    .join("\n");
}

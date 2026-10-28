// Jobs: Mary Mary's seasonal calendar for UK gardens, plus the gardener's own jobs.
// Seasonal jobs only appear when they fit this garden (e.g. "lift the dahlias" only
// if there are dahlias). Timings are general advice for most of England and Wales.

import { newId } from "./data";
import type { Advice } from "./weather";
import type { AreaKind, GardenData, Task } from "./types";

export interface SeasonalJob {
  id: string;
  title: string;
  months: number[]; // when it's due (1 to 12)
  minutes: number;
  why: string;
  /** Only when the garden has one of these plants (start of a word in the name, e.g. "dahlia"). */
  plants?: string[];
  /** Only when the garden has an area of one of these kinds. */
  kinds?: AreaKind[];
}

export const SEASONAL: SeasonalJob[] = [
  // Winter
  { id: "feed-birds", title: "Top up the bird feeders and keep the water ice-free", months: [12, 1, 2], minutes: 5, why: "Birds need help most in the cold months, and they eat pests later." },
  { id: "hellebore-leaves", title: "Cut off old hellebore leaves", months: [12, 1], minutes: 10, why: "Shows off the flowers and stops leaf spot spreading.", plants: ["hellebore", "helleborus"] },
  { id: "check-tubers", title: "Check stored dahlia tubers for rot", months: [1, 2, 3], minutes: 10, why: "Throw out any soft or mouldy ones before they spread it.", plants: ["dahlia"] },
  { id: "prune-fruit-trees", title: "Prune apple and pear trees", months: [12, 1, 2], minutes: 45, why: "Winter is the time, while the trees are dormant.", plants: ["apple", "pear", "malus", "pyrus"] },
  { id: "plan-veg", title: "Plan the veg plot and order seeds", months: [1, 2], minutes: 30, why: "Moving crops round each year helps keep pests and diseases down.", kinds: ["veg"] },
  { id: "clean-pots", title: "Wash pots and seed trays", months: [1, 2], minutes: 30, why: "Clean pots mean healthier seedlings in spring.", kinds: ["greenhouse", "pots"] },
  { id: "clean-tools", title: "Clean, sharpen and oil the tools", months: [12, 1], minutes: 30, why: "Sharp, clean tools make cleaner cuts and last for years." },
  { id: "bare-root", title: "Plant bare-root roses, hedging and fruit", months: [11, 12, 1, 2, 3], minutes: 30, why: "They're cheaper bare-root and settle in well while dormant. Not when the ground is frozen.", plants: ["roses?\\b", "rosa\\b", "raspberr", "hedge"] },

  // Late winter and spring
  { id: "cut-back-grasses", title: "Cut back grasses and last year's perennial stems", months: [2, 3], minutes: 30, why: "Make way for new growth before it starts. Leave evergreen grasses, just comb them." },
  { id: "prune-clematis", title: "Prune late-flowering clematis to knee height", months: [2, 3], minutes: 10, why: "Late summer clematis flower on new growth, so a hard cut now means more flowers.", plants: ["clematis"] },
  { id: "prune-roses", title: "Prune the roses", months: [2, 3], minutes: 30, why: "Cut back by about a third to an outward-facing bud, and take out dead or crossing stems.", plants: ["roses?\\b", "rosa\\b"] },
  { id: "prune-raspberries", title: "Cut autumn raspberry canes to the ground", months: [2], minutes: 15, why: "Autumn raspberries fruit on new canes each year.", plants: ["raspberr"] },
  { id: "cut-dogwood", title: "Cut back dogwood stems", months: [3], minutes: 15, why: "Fresh stems have the brightest winter colour. Every other year is fine.", plants: ["dogwood", "cornus"] },
  { id: "chit-potatoes", title: "Chit seed potatoes on a cool windowsill", months: [2, 3], minutes: 10, why: "Sprouting them first gives an earlier crop.", kinds: ["veg"] },
  { id: "sow-tomatoes", title: "Sow tomatoes and chillies indoors", months: [2, 3], minutes: 20, why: "They need a long, warm season to ripen.", kinds: ["greenhouse"] },
  { id: "mulch-borders", title: "Mulch the borders with compost", months: [3, 4], minutes: 45, why: "A layer while the soil is damp keeps moisture in and weeds down." },
  { id: "divide-perennials", title: "Lift and divide crowded clumps of perennials", months: [3, 4, 9, 10], minutes: 30, why: "Gives free plants and keeps them flowering well." },
  { id: "slug-watch", title: "Protect new shoots from slugs", months: [3, 4, 5], minutes: 10, why: "Young shoots are most at risk in damp spring weather. Check after rain, at dusk.", plants: ["hosta", "delphinium", "dahlia", "lettuce", "salad", "courgette", "basil"] },
  { id: "plant-potatoes", title: "Plant potatoes", months: [3, 4], minutes: 30, why: "First earlies from mid-March, main crops in April.", kinds: ["veg"] },
  { id: "feed-shrubs", title: "Feed roses, shrubs and fruit", months: [3, 4], minutes: 20, why: "A general feed as growth starts sets them up for the year." },
  { id: "stake-perennials", title: "Put in supports for tall perennials", months: [4, 5], minutes: 20, why: "Much easier now than once they've flopped." },
  { id: "harden-off", title: "Harden off young plants", months: [4, 5], minutes: 5, why: "Put them out by day and in at night for a week or two before planting out.", kinds: ["greenhouse"] },
  { id: "sow-salad", title: "Sow salad leaves and beetroot", months: [4, 5, 6, 7], minutes: 15, why: "Sow a little every few weeks for a steady supply.", kinds: ["veg"] },
  { id: "tie-in-climbers", title: "Tie in climbers", months: [4, 5, 6], minutes: 15, why: "New shoots grow fast. Tie them in sideways for more flowers.", plants: ["clematis", "roses?\\b", "honeysuckle", "jasmine", "climbing", "wisteria", "sweet pea"] },

  // Late spring and summer
  { id: "plant-out-tender", title: "Plant out tender plants after the last frost", months: [5, 6], minutes: 30, why: "In most of the UK the last frost has usually passed by late May.", plants: ["dahlia", "cosmos", "pelargonium", "tomato", "courgette", "runner bean", "basil", "canna"] },
  { id: "net-brassicas", title: "Net cabbages and kale against caterpillars", months: [5, 6, 7], minutes: 20, why: "Cabbage white butterflies lay eggs from May.", plants: ["cabbage", "kale", "broccoli", "sprout", "cauliflower", "brassica"] },
  { id: "chelsea-chop", title: "Cut back late perennials by a third (the 'Chelsea chop')", months: [5], minutes: 20, why: "Makes sedums, asters and heleniums bushier, with more flowers.", plants: ["sedum", "aster", "helenium", "phlox", "rudbeckia", "echinacea"] },
  { id: "deadhead", title: "Deadhead roses and perennials", months: [6, 7, 8, 9], minutes: 15, why: "Snipping off faded flowers keeps new ones coming." },
  { id: "tomato-sideshoots", title: "Pinch out tomato side-shoots and feed weekly", months: [6, 7, 8], minutes: 10, why: "Puts the plant's energy into fruit.", plants: ["tomato"] },
  { id: "water-pots", title: "Water pots and new plants in dry spells", months: [6, 7, 8], minutes: 15, why: "Pots dry out fast. Water in the evening so less is lost to the sun.", kinds: ["pots", "greenhouse"] },
  { id: "pick-veg", title: "Pick courgettes and beans often", months: [7, 8, 9], minutes: 10, why: "The more you pick, the more they make.", plants: ["courgette", "runner bean", "french bean", "bean"] },
  { id: "trim-lavender", title: "Trim lavender after flowering", months: [8], minutes: 15, why: "Cut back to just above the woody stems to keep it compact.", plants: ["lavender", "lavandula"] },
  { id: "shear-catmint", title: "Shear catmint and hardy geraniums", months: [7], minutes: 10, why: "A cut after the first flush brings fresh leaves and a second round of flowers.", plants: ["catmint", "nepeta", "geranium"] },
  { id: "cuttings", title: "Take cuttings of tender perennials", months: [8, 9], minutes: 20, why: "Young plants are easy to overwinter indoors.", plants: ["pelargonium", "salvia", "fuchsia", "penstemon", "osteospermum"] },

  // Autumn
  { id: "plant-bulbs", title: "Plant spring bulbs (daffodils, crocus, alliums)", months: [9, 10], minutes: 30, why: "Daffodils like to go in early. Plant at about three times the bulb's depth." },
  { id: "plant-tulips", title: "Plant tulips", months: [11], minutes: 20, why: "Planting in cold soil in November helps keep tulip fire disease away." },
  { id: "winter-bedding", title: "Plant wallflowers and winter violas", months: [9, 10], minutes: 20, why: "Colour for pots through winter and into spring.", kinds: ["pots", "border"] },
  { id: "tender-inside", title: "Bring tender plants under cover", months: [10], minutes: 20, why: "Before the first frost, usually mid to late October.", plants: ["pelargonium", "citrus", "lemon", "canna", "begonia", "aeonium", "agave", "succulent"] },
  { id: "lift-dahlias", title: "Lift and store the dahlias", months: [10, 11], minutes: 30, why: "Once the first frost blackens the leaves. In milder gardens, a thick mulch can be enough instead.", plants: ["dahlia"] },
  { id: "wrap-banana", title: "Wrap the banana's trunk for winter", months: [11], minutes: 20, why: "Fleece and straw around the stem protects next year's growth from frost.", plants: ["musa", "banana"] },
  { id: "leaves", title: "Rake up leaves and make leaf mould", months: [10, 11, 12], minutes: 20, why: "Bag them up damp with a few holes. In two years they make lovely free compost. Leave some under hedges for wildlife." },
  { id: "plant-garlic", title: "Plant garlic and autumn onion sets", months: [10, 11], minutes: 20, why: "Garlic needs winter cold to form good bulbs.", kinds: ["veg"] },
  { id: "greenhouse-clean", title: "Clean the greenhouse glass and insulate for winter", months: [10, 11], minutes: 60, why: "Every bit of winter light counts, and bubble wrap keeps the frost off.", kinds: ["greenhouse"] },
  { id: "pot-protection", title: "Raise pots on feet and wrap any that could crack", months: [11, 12], minutes: 15, why: "Stops pots sitting in water and freezing solid.", kinds: ["pots"] },
  { id: "check-ties", title: "Check tree ties and stakes before winter gales", months: [11], minutes: 15, why: "Loosen tight ties and firm in anything rocking in the wind." },
];

/** A job as shown on screen, whichever kind it is. */
export interface JobItem {
  key: string; // seasonal: "<id>:<season year>"; own: task id; weather: "weather-frost:<date>"
  kind: "seasonal" | "mine" | "weather";
  title: string;
  why?: string;
  where: string;
  areaId?: string;
  minutes?: number;
  dueOn?: string;
  overdue?: boolean;
  lastChance?: boolean; // seasonal job in its last month
  taskId?: string;
}

const wordStart = (name: string, word: string) => new RegExp(`(^|[^a-z])${word}`).test(name.toLowerCase());

/** Which "year" a seasonal job belongs to, so a Dec–Feb job done in January counts for that winter. */
export function seasonYear(job: SeasonalJob, today: string): number {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const wraps = job.months.includes(12) && job.months.includes(1);
  return wraps && m <= 6 ? y - 1 : y;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + days * 86400000);
  return d.toISOString().slice(0, 10);
}

function whereFor(g: GardenData, job: SeasonalJob): { where: string; areaId?: string } {
  const areaName = (id: string) => g.areas.find((a) => a.id === id)?.name ?? "";
  if (job.plants) {
    const hits = g.plants.filter((p) => p.status !== "lost" && job.plants!.some((w) => wordStart(p.name, w) || wordStart(p.latinName ?? "", w)));
    const areas = Array.from(new Set(hits.map((p) => p.areaId))).filter((id) => areaName(id));
    if (areas.length === 1) return { where: areaName(areas[0]), areaId: areas[0] };
    if (areas.length > 1) return { where: `${areaName(areas[0])} and ${areas.length - 1} more` };
  }
  if (job.kinds) {
    const a = g.areas.filter((x) => job.kinds!.includes(x.kind));
    if (a.length === 1) return { where: a[0].name, areaId: a[0].id };
    if (a.length > 1) return { where: a.map((x) => x.name).slice(0, 2).join(" and ") };
  }
  return { where: "Anywhere in the garden" };
}

export function fits(g: GardenData, job: SeasonalJob): boolean {
  if (job.plants) {
    const has = g.plants.some((p) => p.status !== "lost" && job.plants!.some((w) => wordStart(p.name, w) || wordStart(p.latinName ?? "", w)));
    if (!has) return false;
  }
  if (job.kinds && !g.areas.some((a) => job.kinds!.includes(a.kind))) return false;
  return true;
}

export function seasonalKey(job: SeasonalJob, today: string): string {
  return `${job.id}:${seasonYear(job, today)}`;
}

export interface JobLists {
  thisWeek: JobItem[];
  later: JobItem[];
  done: Task[];
}

export function jobLists(g: GardenData, today: string, advice: Advice[] = []): JobLists {
  const month = Number(today.slice(5, 7));
  const weekEnd = addDays(today, 7);
  const doneKeys = new Set(g.tasks.filter((t) => t.doneOn && t.seasonalKey).map((t) => t.seasonalKey!));
  const snoozed = (key: string) => !!g.snoozed[key] && g.snoozed[key] > today;
  const areaName = (id?: string) => (id ? g.areas.find((a) => a.id === id)?.name : undefined);

  const thisWeek: JobItem[] = [];
  const later: JobItem[] = [];

  // Weather first: a frost warning becomes a job for today.
  const frost = advice.find((a) => a.kind === "frost" && a.urgent);
  if (frost) {
    const key = `weather-frost:${frost.date}`;
    if (!doneKeys.has(key) && !snoozed(key))
      thisWeek.push({
        key,
        kind: "weather",
        title: frost.protect?.length ? `Protect tender plants from frost (${frost.protect.length})` : "Protect tender pots and new plants from frost",
        why: frost.title,
        where: frost.protect?.length === 1 ? frost.protect[0] : "Around the garden",
        minutes: 15,
      });
  }

  // The gardener's own jobs.
  for (const t of g.tasks.filter((x) => !x.doneOn && !x.seasonalKey && !x.extra)) {
    const item: JobItem = {
      key: t.id,
      kind: "mine",
      title: t.title,
      why: t.notes,
      where: areaName(t.areaId) ?? "Anywhere in the garden",
      areaId: t.areaId,
      minutes: t.minutes,
      dueOn: t.dueOn,
      overdue: !!t.dueOn && t.dueOn < today,
      taskId: t.id,
    };
    if (snoozed(t.id) || (t.dueOn && t.dueOn > weekEnd)) later.push(item);
    else thisWeek.push(item);
  }

  // Seasonal jobs from the calendar.
  for (const job of SEASONAL.filter((j) => fits(g, j))) {
    const key = seasonalKey(job, today);
    if (doneKeys.has(key)) continue;
    const w = whereFor(g, job);
    const base: JobItem = { key, kind: "seasonal", title: job.title, why: job.why, minutes: job.minutes, ...w };
    if (job.months.includes(month)) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const item = { ...base, lastChance: !job.months.includes(nextMonth) };
      if (snoozed(key)) later.push(item);
      else thisWeek.push(item);
    }
  }

  const rank = (j: JobItem) => (j.kind === "weather" ? 0 : j.overdue ? 1 : j.kind === "mine" ? 2 : j.lastChance ? 3 : 4);
  thisWeek.sort((a, b) => rank(a) - rank(b) || (a.dueOn ?? "9").localeCompare(b.dueOn ?? "9"));
  later.sort((a, b) => (a.dueOn ?? "9").localeCompare(b.dueOn ?? "9"));

  const since = addDays(today, -14);
  const done = g.tasks.filter((t) => t.doneOn && t.doneOn >= since).sort((a, b) => b.doneOn!.localeCompare(a.doneOn!) || b.createdAt.localeCompare(a.createdAt));
  return { thisWeek, later, done };
}

/** The seasonal jobs coming up next month, to look ahead. */
export function nextMonthJobs(g: GardenData, today: string): SeasonalJob[] {
  const month = Number(today.slice(5, 7));
  const next = month === 12 ? 1 : month + 1;
  return SEASONAL.filter((j) => fits(g, j) && j.months.includes(next) && !j.months.includes(month));
}

/** "One thing at a time": a quick job, if there is one. */
export function oneQuickJob(items: JobItem[], skip: string[] = []): JobItem | undefined {
  // The shortest job (urgent weather jobs first), so it really is one small thing.
  const open = items.filter((j) => !skip.includes(j.key));
  return [...open].sort((a, b) => Number(b.kind === "weather") - Number(a.kind === "weather") || (a.minutes ?? 30) - (b.minutes ?? 30))[0];
}

// ── Changes ─────────────────────────────────────────────────────

export function completeJob(g: GardenData, job: JobItem, today: string): [GardenData, string] {
  if (job.taskId) {
    return [{ ...g, tasks: g.tasks.map((t) => (t.id === job.taskId ? { ...t, doneOn: today } : t)) }, job.taskId];
  }
  const id = newId("task");
  const t: Task = { id, title: job.title, areaId: job.areaId, minutes: job.minutes, doneOn: today, seasonalKey: job.key, createdAt: new Date().toISOString() };
  return [{ ...g, tasks: [...g.tasks, t] }, id];
}

/** "Not now": hide it for a week. Seasonal jobs come back if still in season. */
export function snoozeJob(g: GardenData, key: string, today: string, days = 7): GardenData {
  return { ...g, snoozed: { ...g.snoozed, [key]: addDays(today, days) } };
}

export function addTask(g: GardenData, t: Omit<Task, "id" | "createdAt">): [GardenData, string] {
  const id = newId("task");
  return [{ ...g, tasks: [...g.tasks, { ...t, id, createdAt: new Date().toISOString() }] }, id];
}

export function deleteTask(g: GardenData, id: string): GardenData {
  const snoozed = { ...g.snoozed };
  delete snoozed[id];
  return { ...g, tasks: g.tasks.filter((t) => t.id !== id), snoozed };
}

/** Undo a done job: own jobs go back on the list, seasonal records are removed. */
export function undoDone(g: GardenData, taskId: string): GardenData {
  const t = g.tasks.find((x) => x.id === taskId);
  if (!t) return g;
  if (t.seasonalKey || t.extra) return { ...g, tasks: g.tasks.filter((x) => x.id !== taskId) };
  return { ...g, tasks: g.tasks.map((x) => (x.id === taskId ? { ...x, doneOn: undefined } : x)) };
}

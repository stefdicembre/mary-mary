import { test } from "node:test";
import assert from "node:assert/strict";
import { addPlant, updateSettings } from "./actions";
import { CATALOGUE } from "./catalogue";
import { emptyGarden } from "./data";
import { jobLists, nextMonthJobs } from "./jobs";
import { makePlan } from "./plan";
import {
  compareWithTypical,
  dateWords,
  dayOfYear,
  fromDayOfYear,
  frostFor,
  historyUrl,
  monthRanges,
  needsFrostDates,
  startMonths,
  stepsFor,
  workOutFrost,
} from "./sowing";
import type { FrostDates } from "./types";

const cat = (id: string) => CATALOGUE.find((c) => c.id === id)!;

/** Ten years of made-up lows: mild, with one frosty night in spring and one in autumn each year. */
function fakeYears(springDoy: (i: number) => number, autumnDoy: (i: number) => number, years = 10) {
  const time: string[] = [];
  const min: Array<number | null> = [];
  for (let i = 0; i < years; i++) {
    const y = 2016 + i;
    for (let d = 1; d <= 365; d++) {
      time.push(`${y}-${fromDayOfYear(d)}`);
      min.push(d === springDoy(i) || d === autumnDoy(i) ? -1 : 8);
    }
  }
  return { time, min };
}

test("dates in the year turn into words", () => {
  assert.equal(dayOfYear("01-01"), 1);
  assert.equal(dayOfYear("05-15"), 135);
  assert.equal(fromDayOfYear(135), "05-15");
  assert.equal(fromDayOfYear(365), "12-31");
  assert.equal(dayOfYear("02-29"), dayOfYear("02-28"));
  assert.equal(dateWords("05-15"), "mid May");
  assert.equal(dateWords("04-03", true), "early Apr");
  assert.equal(dateWords("10-25"), "late October");
  assert.equal(monthRanges([11, 12, 1, 2]), "Nov to Feb");
});

test("frost dates are worked out from past weather, leaning towards safe", () => {
  // Last spring frost on day 100 to 109, first autumn frost on day 290 to 299.
  const r = workOutFrost(fakeYears((i) => 100 + i, (i) => 290 + i))!;
  assert.equal(r.years, 10);
  // Over by then in 8 years out of 10: the day after the 8th-latest last frost (day 107).
  assert.equal(r.lastSpring, fromDayOfYear(108));
  // Held off until then in 8 years out of 10: the 3rd-earliest first frost (day 292).
  assert.equal(r.firstAutumn, fromDayOfYear(292));
  // A frost-free spring counts as early, and missing days are skipped.
  const mild = fakeYears(() => 0, () => 300);
  mild.min[5] = null;
  assert.equal(workOutFrost(mild)!.lastSpring, fromDayOfYear(2));
  // Too little history: no guess.
  assert.equal(workOutFrost(fakeYears((i) => 100 + i, () => 290, 3)), undefined);
  // 2°C counts as a frost risk, 3°C doesn't.
  const edge = fakeYears(() => 0, () => 300);
  edge.min[dayOfYear("05-01") - 1] = 2;
  assert.equal(workOutFrost(edge)!.years, 10);
  assert.equal(workOutFrost(edge)!.lastSpring, fromDayOfYear(2), "only one year had it, so 8 in 10 were frost-free");
});

test("the history covers the last ten full years", () => {
  const u = historyUrl(51.5, -0.12, "2026-11-08");
  assert.ok(u.startsWith("https://archive-api.open-meteo.com/v1/archive?"));
  assert.ok(u.includes("start_date=2016-01-01") && u.includes("end_date=2025-12-31"));
  assert.ok(u.includes("daily=temperature_2m_min"));
});

test("general dates until local ones are known, and dates set by hand are kept", () => {
  let g = emptyGarden(true);
  assert.equal(frostFor(g.settings).source, "typical");
  assert.equal(needsFrostDates(g.settings), false, "no place yet");
  g = updateSettings(g, { location: { lat: 55.9, lon: -3.2, place: "Leith", forPostcode: "EH6" } });
  assert.equal(needsFrostDates(g.settings), true);
  const worked: FrostDates = { lastSpring: "05-28", firstAutumn: "10-08", source: "history", years: 10, place: "Leith" };
  g = updateSettings(g, { frost: worked });
  assert.equal(needsFrostDates(g.settings), false);
  assert.equal(frostFor(g.settings).lastSpring, "05-28");
  assert.equal(compareWithTypical(frostFor(g.settings)), "About 2 weeks later than the general UK advice of mid May.");
  // Moving garden works them out again, unless they were set by hand.
  g = updateSettings(g, { location: { lat: 50.4, lon: -5.0, place: "Truro", forPostcode: "TR1" } });
  assert.equal(needsFrostDates(g.settings), true);
  g = updateSettings(g, { frost: { lastSpring: "04-20", firstAutumn: "11-10", source: "you" } });
  assert.equal(needsFrostDates(g.settings), false);
  // A broken date falls back to the general one.
  g = updateSettings(g, { frost: { lastSpring: "13-40", firstAutumn: "11-10", source: "you" } });
  assert.equal(frostFor(g.settings).source, "typical");
});

test("sowing and planting out follow the frost dates", () => {
  const usual = frostFor(emptyGarden(true).settings);
  const tom = stepsFor(cat("tomato"), usual);
  assert.deepEqual(tom.map((s) => s.label), ["Sow indoors", "Plant out"]);
  assert.equal(tom[0].words, "early Mar to early Apr");
  assert.deepEqual(tom[0].months, [3, 4]);
  // Three weeks later up north: everything moves with it.
  const late = { ...usual, lastSpring: "06-05", source: "history" as const };
  assert.equal(stepsFor(cat("tomato"), late)[0].words, "late Mar to late Apr");
  assert.equal(stepsFor(cat("courgette"), late).find((s) => s.kind === "plantOut")!.words, "early Jun to early Jul");
  // Plants bought as plants or bulbs keep their planting months.
  const tulip = stepsFor(cat("tulip-ballerina"), late);
  assert.deepEqual(tulip.map((s) => [s.label, s.words]), [["Plant", "Nov"]]);
  // Fixed sowing months stay put.
  assert.equal(stepsFor(cat("salad-leaves"), late)[0].words, "Mar to Sep");
  // Every month there's something to start: sowing or planting.
  assert.deepEqual(startMonths(cat("courgette"), usual), [4, 5, 6]);
});

test("frost jobs follow this garden's dates", () => {
  let g = emptyGarden(true);
  [g] = addPlant(g, { name: "Dahlia", areaId: g.areas[5].id, section: "Dahlias" });
  const due = (day: string) => jobLists(g, day).thisWeek.find((j) => j.title.startsWith("Plant out tender"));
  // General dates: from mid May.
  assert.ok(due("2027-05-20"));
  assert.ok(due("2027-05-20")!.why!.includes("mid May"));
  // A colder garden: not until early June.
  g = updateSettings(g, { frost: { lastSpring: "06-05", firstAutumn: "10-01", source: "history", place: "Hilltop" } });
  assert.equal(due("2027-05-20"), undefined);
  assert.ok(due("2027-05-30"), "shows a week before");
  assert.ok(due("2027-06-10")!.why!.includes("early June"));
  assert.ok(nextMonthJobs(g, "2027-05-01").some((j) => j.id === "plant-out-tender"), "coming up soon");
  // Autumn: lifting dahlias starts at the first frost.
  const lift = (day: string) => jobLists(g, day).thisWeek.find((j) => j.title === "Lift and store the dahlias");
  assert.ok(lift("2027-10-03"));
  assert.equal(lift("2027-11-20"), undefined, "over by then here");
});

test("the planting plan uses the frost dates", () => {
  let g = emptyGarden(true);
  const veg = g.areas.find((a) => a.kind === "veg")!;
  const when = (month: number) =>
    makePlan(g, veg, { goal: "refresh", priorities: [], month }).groups.flatMap((gr) => gr.items).find((s) => s.plant.id === "courgette");
  // In April courgettes can be started now (sown indoors), not next month.
  assert.equal(when(4)?.month, 4);
  // Much colder: not yet in April (it waits for May, so it's no longer a "now" plant).
  g = updateSettings(g, { frost: { lastSpring: "06-20", firstAutumn: "10-01", source: "you" } });
  assert.notEqual(when(4)?.month, 4);
  assert.equal(when(5)?.month, 5);
});

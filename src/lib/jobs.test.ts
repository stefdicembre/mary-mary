import { test } from "node:test";
import assert from "node:assert/strict";
import { addPlant } from "./actions";
import { emptyGarden } from "./data";
import { SEASONAL, addDays, addTask, completeJob, deleteTask, fits, jobLists, nextMonthJobs, oneQuickJob, seasonYear, snoozeJob, undoDone } from "./jobs";
import type { Advice } from "./weather";

const OCT = "2026-10-28";

test("dates move by days, across months and years", () => {
  assert.equal(addDays("2026-10-28", 7), "2026-11-04");
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("seasonal jobs only appear when they fit the garden", () => {
  let g = emptyGarden(true);
  const titles = () => jobLists(g, OCT).thisWeek.map((j) => j.title);
  assert.ok(!titles().includes("Lift and store the dahlias"), "no dahlias yet");
  [g] = addPlant(g, { name: "Dahlia", variety: "Bishop of Llandaff", areaId: g.areas[5].id, section: "Dahlias" });
  const lift = jobLists(g, OCT).thisWeek.find((j) => j.title === "Lift and store the dahlias")!;
  assert.ok(lift);
  assert.equal(lift.where, "The Sunset Border");
  assert.equal(lift.lastChance, false, "still in season in November");
  // Allotment and greenhouse jobs appear because those areas exist
  assert.ok(titles().includes("Plant garlic and autumn onion sets"));
  assert.ok(titles().includes("Clean the greenhouse glass and insulate for winter"));
  // Rosemary isn't a rose
  [g] = addPlant(g, { name: "Rosemary", areaId: g.areas[0].id, section: "Herbs" });
  assert.ok(!fits(g, SEASONAL.find((j) => j.id === "prune-roses")!));
  [g] = addPlant(g, { name: "Rose", areaId: g.areas[0].id, section: "Roses" });
  assert.ok(fits(g, SEASONAL.find((j) => j.id === "prune-roses")!));
});

test("done seasonal jobs stay done for the season, and undo brings them back", () => {
  let g = emptyGarden(true);
  const job = jobLists(g, OCT).thisWeek.find((j) => j.title.startsWith("Rake up leaves"))!;
  let taskId: string;
  [g, taskId] = completeJob(g, job, OCT);
  assert.ok(!jobLists(g, OCT).thisWeek.some((j) => j.key === job.key));
  assert.ok(!jobLists(g, "2026-12-01").thisWeek.some((j) => j.title.startsWith("Rake up leaves")), "still done in December");
  assert.equal(jobLists(g, OCT).done[0].title, job.title);
  g = undoDone(g, taskId);
  assert.ok(jobLists(g, OCT).thisWeek.some((j) => j.key === job.key));
});

test("winter jobs that span New Year count once", () => {
  const birds = SEASONAL.find((j) => j.id === "feed-birds")!;
  assert.equal(seasonYear(birds, "2026-12-10"), 2026);
  assert.equal(seasonYear(birds, "2027-01-15"), 2026);
  const bulbs = SEASONAL.find((j) => j.id === "plant-bulbs")!;
  assert.equal(seasonYear(bulbs, "2026-10-01"), 2026);
});

test("Not now hides a job for a week", () => {
  let g = emptyGarden(true);
  const job = jobLists(g, OCT).thisWeek.find((j) => j.title.startsWith("Rake up leaves"))!; // in season Oct to Dec
  g = snoozeJob(g, job.key, OCT);
  assert.ok(!jobLists(g, OCT).thisWeek.some((j) => j.key === job.key));
  assert.ok(jobLists(g, OCT).later.some((j) => j.key === job.key));
  assert.ok(jobLists(g, addDays(OCT, 7)).thisWeek.some((j) => j.key === job.key), "back after a week");
  // A job whose season ends while snoozed simply waits for next year
  const divide = jobLists(emptyGarden(true), OCT).thisWeek.find((j) => j.title.startsWith("Lift and divide"))!;
  assert.ok(divide.lastChance, "October is the last month for dividing this autumn");
});

test("own jobs: due this week, later, overdue first", () => {
  let g = emptyGarden(true);
  let a: string;
  [g, a] = addTask(g, { title: "Fix the shed door", dueOn: addDays(OCT, -2) });
  [g] = addTask(g, { title: "Order compost", dueOn: addDays(OCT, 3) });
  [g] = addTask(g, { title: "Repaint the bench", dueOn: addDays(OCT, 30) });
  const lists = jobLists(g, OCT);
  assert.equal(lists.thisWeek[0].title, "Fix the shed door");
  assert.ok(lists.thisWeek[0].overdue);
  assert.equal(lists.thisWeek[1].title, "Order compost");
  assert.ok(lists.later.some((j) => j.title === "Repaint the bench"));
  g = deleteTask(g, a);
  assert.ok(!jobLists(g, OCT).thisWeek.some((j) => j.title === "Fix the shed door"));
});

test("an urgent frost warning becomes today's first job", () => {
  const g = emptyGarden(true);
  const frost: Advice = { kind: "frost", date: OCT, when: "Tonight", urgent: true, title: "Frost tonight, down to −2°C", text: "", protect: ["Dahlia (The Sunset Border)"] };
  const first = jobLists(g, OCT, [frost]).thisWeek[0];
  assert.equal(first.kind, "weather");
  assert.equal(first.where, "Dahlia (The Sunset Border)");
});

test("one thing at a time picks something quick", () => {
  const g = emptyGarden(true);
  const items = jobLists(g, OCT).thisWeek;
  const one = oneQuickJob(items)!;
  assert.equal(one.minutes, Math.min(...items.map((j) => j.minutes ?? 30)), "the shortest job");
  const other = oneQuickJob(items, [one.key])!;
  assert.notEqual(other.key, one.key);
});

test("looking ahead to next month", () => {
  const g = emptyGarden(true);
  assert.ok(nextMonthJobs(g, OCT).some((j) => j.id === "plant-tulips"));
});

test("every seasonal job is well formed", () => {
  const ids = new Set<string>();
  for (const j of SEASONAL) {
    assert.ok(!ids.has(j.id), j.id);
    ids.add(j.id);
    assert.ok(j.months.length && j.months.every((m) => m >= 1 && m <= 12), j.id);
    assert.ok(j.minutes > 0 && j.why.length > 10, j.id);
  }
});

import { addEntry, diaryEntries, logSetback, photosInUse, removeEntry } from "./actions";

test("diary: newest first, filter by area or plant, search names too", () => {
  let g = emptyGarden(true);
  const sunset = g.areas[5].id;
  const court = g.areas[0].id;
  let dahlia: string;
  [g, dahlia] = addPlant(g, { name: "Dahlia", variety: "Bishop of Llandaff", areaId: sunset, section: "Dahlias" });
  [g] = addEntry(g, { date: "2026-10-01", text: "First frost nipped the leaves", plantIds: [dahlia], areaIds: [] });
  [g] = addEntry(g, { date: "2026-10-20", text: "Swept the decking", plantIds: [], areaIds: [court], photoIds: ["photo_a"] });
  g = logSetback(g, { plantId: dahlia, date: "2026-10-25", outcome: "struggling", reasons: ["pests"], details: { pests: "Slugs and snails" }, addToDiary: true });

  assert.deepEqual(diaryEntries(g).map((e) => e.date), ["2026-10-25", "2026-10-20", "2026-10-01"]);
  assert.equal(diaryEntries(g, { areaId: sunset }).length, 2, "entries about plants count for their area");
  assert.equal(diaryEntries(g, { plantId: dahlia }).length, 2);
  assert.equal(diaryEntries(g, { text: "llandaff" }).length, 2, "search finds plant varieties");
  assert.equal(diaryEntries(g, { text: "courtyard" }).length, 1, "search finds area names");
  assert.equal(diaryEntries(g, { text: "frost leaves" }).length, 1);
  assert.deepEqual([...photosInUse(g)], ["photo_a"]);

  const setbackEntry = g.journal.find((j) => j.setbackId)!;
  g = removeEntry(g, setbackEntry.id);
  assert.equal(g.setbacks[0].journalEntryId, undefined, "the setback stays, unlinked");
  assert.equal(g.journal.length, 2);
});

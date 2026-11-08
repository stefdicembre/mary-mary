import { test } from "node:test";
import assert from "node:assert/strict";
import { addPlant } from "./actions";
import { emptyGarden, upgrade } from "./data";
import { addTask, completeJob, jobLists, undoDone } from "./jobs";
import { addSupply, keyWords, neededFor, removeSupply, setSupplyLevel, shoppingList, shortForJobs, suppliesForJob } from "./supplies";
import type { GardenData } from "./types";

const NOV = "2026-11-08";

function withBanana(): GardenData {
  let g = emptyGarden(true);
  [g] = addPlant(g, { name: "Musa basjoo", areaId: g.areas[5].id, section: "Trees and shrubs" });
  [g] = addSupply(g, "fleece");
  [g] = addSupply(g, "Garden twine", "low");
  [g] = addSupply(g, "Multipurpose compost");
  [g] = addSupply(g, "Slug pellets");
  return g;
}
const byName = (g: GardenData, n: string) => g.supplies.find((s) => s.name === n)!;
const wrap = (g: GardenData) => jobLists(g, NOV).thisWeek.find((j) => j.title.startsWith("Wrap the banana"))!;

test("supplies are added with a capital letter and the level chosen", () => {
  const g = withBanana();
  assert.equal(g.supplies[0].name, "Fleece");
  assert.equal(byName(g, "Garden twine").level, "low");
  assert.deepEqual(keyWords("Garden twine"), ["twine"]);
  assert.deepEqual(keyWords("Bamboo canes"), ["bamboo", "cane"]);
});

test("Mary Mary knows which supplies a job needs", () => {
  const g = withBanana();
  const job = wrap(g);
  const ids = suppliesForJob(g, job).map((u) => u.supplyId);
  assert.ok(ids.includes(byName(g, "Fleece").id));
  assert.ok(ids.includes(byName(g, "Garden twine").id));
  assert.ok(!ids.includes(byName(g, "Slug pellets").id));
  assert.deepEqual(neededFor(g, byName(g, "Fleece"), jobLists(g, NOV).thisWeek).map((j) => j.title), [job.title]);
  // Twine is low and needed this week, so Home can mention it
  assert.deepEqual(shortForJobs(g, jobLists(g, NOV).thisWeek).map((x) => x.supply.name), ["Garden twine"]);
});

test("own jobs find supplies in their title or notes", () => {
  let g = withBanana();
  [g] = addTask(g, { title: "Pot up the hyacinths", notes: "compost and a trowel" });
  const job = jobLists(g, NOV).thisWeek.find((j) => j.title === "Pot up the hyacinths")!;
  assert.deepEqual(suppliesForJob(g, job).map((u) => u.supplyId), [byName(g, "Multipurpose compost").id]);
});

test("small jobs add up, and Undo puts supplies back", () => {
  let g = withBanana();
  // Twine is low: one small job isn't enough to finish it
  let taskId: string;
  [g, taskId] = completeJob(g, wrap(g), NOV);
  assert.equal(byName(g, "Garden twine").level, "low");
  assert.equal(byName(g, "Garden twine").wear, 1);
  assert.equal(byName(g, "Fleece").level, "plenty");
  g = undoDone(g, taskId);
  assert.equal(byName(g, "Garden twine").wear, 0);
  assert.equal(byName(g, "Fleece").wear, 0);
});

test("a supply drops a level after three small uses, and Undo raises it again", () => {
  let g = withBanana();
  const tasks: string[] = [];
  for (let i = 0; i < 3; i++) {
    let id: string;
    [g, id] = addTask(g, { title: `Tie in the rose ${i}`, notes: "twine" });
    const job = jobLists(g, NOV).thisWeek.find((j) => j.taskId === id)!;
    [g] = completeJob(g, job, NOV);
    tasks.push(id);
  }
  const twine = byName(g, "Garden twine");
  assert.equal(twine.level, "out");
  assert.equal(twine.lowered?.by, "Tie in the rose 2");
  assert.match(shoppingList(g), /Garden twine \(none left\)/);
  g = undoDone(g, tasks[2]);
  assert.equal(byName(g, "Garden twine").level, "low");
  assert.equal(byName(g, "Garden twine").lowered, undefined);
});

test("a big job drops a level at once", () => {
  let g = withBanana();
  const job = { key: "x", kind: "seasonal" as const, title: "Mulch the borders with compost", where: "", uses: [{ what: "compost", lots: true }] };
  [g] = completeJob(g, job, NOV);
  assert.equal(byName(g, "Multipurpose compost").level, "low");
  assert.equal(byName(g, "Multipurpose compost").lowered?.by, job.title);
});

test("setting the level by hand starts the count again; removing works; old backups get supplies", () => {
  let g = withBanana();
  [g] = completeJob(g, wrap(g), NOV);
  g = setSupplyLevel(g, byName(g, "Garden twine").id, "plenty");
  assert.equal(byName(g, "Garden twine").wear, 0);
  g = removeSupply(g, byName(g, "Fleece").id);
  assert.equal(g.supplies.length, 3);
  const old = { ...emptyGarden(false) } as Partial<GardenData>;
  delete old.supplies;
  assert.deepEqual(upgrade(old as GardenData).supplies, []);
});

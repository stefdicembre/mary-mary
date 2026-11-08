import { test } from "node:test";
import assert from "node:assert/strict";
import { addPlant, deletePlant, removeEntry } from "./actions";
import { emptyGarden, upgrade } from "./data";
import {
  addHarvest,
  amountText,
  cropKey,
  cropTotals,
  harvestDiaryText,
  harvestYears,
  harvestsIn,
  harvestsToCSV,
  isPickingJob,
  parseWeight,
  pickablePlants,
  plantHarvests,
  recentOtherCrops,
  removeHarvest,
  totalText,
  updateHarvest,
  weightText,
} from "./harvest";
import type { GardenData } from "./types";

const TODAY = "2026-11-08";

function veg(): { g: GardenData; tom: string; cour: string; rose: string } {
  let g = emptyGarden(true);
  let tom: string, cour: string, rose: string;
  [g, tom] = addPlant(g, { name: "Tomato", variety: "Sungold", areaId: g.areas[7].id, section: "Vegetables" });
  [g, cour] = addPlant(g, { name: "Courgette", areaId: g.areas[6].id, section: "Vegetables" });
  [g, rose] = addPlant(g, { name: "Rose", areaId: g.areas[1].id, section: "Roses" });
  return { g, tom, cour, rose };
}

test("only fruit, veg and herbs can be picked", () => {
  const { g } = veg();
  assert.deepEqual(pickablePlants(g).map((p) => p.name), ["Courgette", "Tomato"]);
});

test("a picking is logged from a plant, with its area and an easy size", () => {
  const { g: g0, tom } = veg();
  const [g, id] = addHarvest(g0, { date: TODAY, plantId: tom, name: "", size: "bowl", grams: 1250, addToDiary: false });
  const h = g.harvests.find((x) => x.id === id)!;
  assert.equal(h.name, "Tomato");
  assert.equal(h.areaId, g.areas[7].id);
  assert.equal(amountText(h), "A bowlful · 1.3 kg");
  assert.equal(g.journal.length, 0, "the diary is off by default");
});

test("something that isn't a garden plant can be typed in", () => {
  const { g: g0 } = veg();
  const [g] = addHarvest(g0, { date: TODAY, name: "  blackberries ", count: 0, addToDiary: false });
  assert.equal(g.harvests[0].name, "Blackberries");
  assert.equal(g.harvests[0].count, undefined, "a count of 0 means no count");
  assert.deepEqual(recentOtherCrops(g), ["Blackberries"]);
  const [same] = addHarvest(g0, { date: TODAY, name: "   ", addToDiary: false });
  assert.equal(same.harvests.length, 0, "a picking needs a name");
});

test("Add to diary writes a linked entry, which follows edits and goes with the picking", () => {
  const { g: g0, cour } = veg();
  let [g, id] = addHarvest(g0, { date: TODAY, plantId: cour, name: "", count: 3, note: "First big ones", addToDiary: true });
  const h = g.harvests[0];
  const entry = g.journal.find((j) => j.id === h.journalEntryId)!;
  assert.equal(entry.text, 'Picked Courgette: 3, from The allotment. "First big ones"');
  assert.deepEqual(entry.plantIds, [cour]);

  g = updateHarvest(g, id, { date: TODAY, plantId: cour, name: "", count: 4, addToDiary: true });
  assert.equal(g.journal.find((j) => j.id === h.journalEntryId)!.text, "Picked Courgette: 4, from The allotment.");

  g = removeHarvest(g, id);
  assert.equal(g.harvests.length, 0);
  assert.equal(g.journal.length, 0);
});

test("a diary entry the gardener rewrote isn't overwritten", () => {
  const { g: g0, cour } = veg();
  let [g, id] = addHarvest(g0, { date: TODAY, plantId: cour, name: "", size: "few", addToDiary: true });
  const eid = g.harvests[0].journalEntryId!;
  g = { ...g, journal: g.journal.map((j) => (j.id === eid ? { ...j, text: "Cath's favourite" } : j)) };
  g = updateHarvest(g, id, { date: TODAY, plantId: cour, name: "", size: "trug", addToDiary: true });
  assert.equal(g.journal[0].text, "Cath's favourite");
  assert.equal(g.harvests[0].size, "trug");
});

test("turning the diary on when editing adds an entry", () => {
  const { g: g0, cour } = veg();
  let [g, id] = addHarvest(g0, { date: TODAY, plantId: cour, name: "", addToDiary: false });
  g = updateHarvest(g, id, { date: TODAY, plantId: cour, name: "", size: "handful", addToDiary: true });
  assert.equal(g.journal.length, 1);
  assert.equal(g.journal[0].text, "Picked Courgette: a handful, from The allotment.");
});

test("year totals add up by crop and compare with last year", () => {
  const { g: g0, tom } = veg();
  let g = g0;
  [g] = addHarvest(g, { date: "2026-08-01", plantId: tom, name: "", count: 10, grams: 400, addToDiary: false });
  [g] = addHarvest(g, { date: "2026-09-01", name: "Tomatoes", grams: 700, addToDiary: false });
  [g] = addHarvest(g, { date: "2026-09-02", name: "Runner beans", size: "handful", addToDiary: false });
  [g] = addHarvest(g, { date: "2025-07-20", name: "tomato", addToDiary: false });
  [g] = addHarvest(g, { date: "2025-12-01", name: "Tomato", addToDiary: false });

  const t = cropTotals(g, 2026, TODAY);
  assert.equal(t[0].name, "Tomato", "variety dropped, plurals joined");
  assert.equal(t[0].times, 2);
  assert.equal(t[0].count, 10);
  assert.equal(t[0].grams, 1100);
  assert.equal(t[0].lastYear, 2);
  assert.equal(t[0].lastYearByNow, 1);
  assert.equal(totalText(t[0]), "Picked 2 times · 10 in all · 1.1 kg");
  assert.equal(totalText(t[1]), "Picked once");
  assert.deepEqual(harvestYears(g), [2026, 2025]);
  assert.equal(harvestsIn(g, 2026)[0].date, "2026-09-02", "newest first");
  assert.equal(plantHarvests(g, tom, 2026).length, 1);
});

test("crop names, weights and picking jobs", () => {
  assert.equal(cropKey("Raspberries"), "raspberry");
  assert.equal(cropKey("Potatoes"), "potato");
  assert.equal(cropKey("Tomato 'Sungold'"), "tomato");
  assert.equal(cropKey("Cress"), "cress");
  assert.equal(weightText(450), "450 g");
  assert.equal(weightText(2049), "2 kg");
  assert.equal(parseWeight("1,5", "kg"), 1500);
  assert.equal(parseWeight("", "g"), undefined);
  assert.equal(parseWeight("lots", "g"), undefined);
  assert.ok(isPickingJob("Pick courgettes and beans often"));
  assert.ok(!isPickingJob("Prune the roses"));
});

test("deleting a plant keeps its pickings; removing a diary entry unlinks it", () => {
  const { g: g0, tom } = veg();
  let [g] = addHarvest(g0, { date: TODAY, plantId: tom, name: "", addToDiary: true });
  g = removeEntry(g, g.harvests[0].journalEntryId!);
  assert.equal(g.harvests[0].journalEntryId, undefined);
  g = deletePlant(g, tom);
  assert.equal(g.harvests.length, 1);
  assert.equal(g.harvests[0].plantId, undefined);
  assert.match(harvestDiaryText(g, g.harvests[0]), /^Picked Tomato/);
});

test("older backups get an empty harvest log, and the CSV has a row per picking", () => {
  const { harvests: _h, ...old } = emptyGarden(false);
  assert.deepEqual(upgrade(old as GardenData).harvests, []);
  const { g: g0, cour } = veg();
  const [g] = addHarvest(g0, { date: TODAY, plantId: cour, name: "", size: "trug", count: 5, note: "Huge, one marrow", addToDiary: false });
  const csv = harvestsToCSV(g).trim().split("\r\n");
  assert.equal(csv[0], "Date,What,Area,Amount,Count,Weight (g),Notes");
  assert.equal(csv[1], `${TODAY},Courgette,The allotment,A trugful,5,,"Huge, one marrow"`);
});

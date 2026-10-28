import { test } from "node:test";
import assert from "node:assert/strict";
import { greeting, longDate, shortDate, todayISO } from "./dates";
import { guessReasons, setbackSummary } from "./reasons";
import { emptyGarden, isGardenData, plantsToCSV } from "./data";
import { addPlant, logSetback, markRecovered, pastSetbacksFor, removeArea } from "./actions";

test("today uses UK time, not UTC", () => {
  // 23:30 UTC on 30 June is already 1 July in London (BST).
  assert.equal(todayISO(new Date("2026-06-30T23:30:00Z")), "2026-07-01");
  // In winter London is on UTC.
  assert.equal(todayISO(new Date("2026-12-31T23:30:00Z")), "2026-12-31");
});

test("greeting follows UK hours", () => {
  assert.equal(greeting(new Date("2026-10-28T08:00:00Z")), "Good morning");
  assert.equal(greeting(new Date("2026-10-28T13:00:00Z")), "Good afternoon");
  assert.equal(greeting(new Date("2026-10-28T19:00:00Z")), "Good evening");
  // 11:30 UTC in summer is 12:30 in London.
  assert.equal(greeting(new Date("2026-07-01T11:30:00Z")), "Good afternoon");
});

test("dates read the UK way", () => {
  assert.equal(longDate(new Date("2026-10-28T12:00:00Z")), "Wednesday 28 October");
  assert.equal(shortDate("2026-03-05"), "5 Mar 2026");
  assert.equal(shortDate(undefined), "");
  assert.equal(shortDate("rubbish"), "");
});

test("reasons are guessed from the gardener's own words", () => {
  assert.deepEqual(guessReasons("the caterpillars ate all the leaves"), [{ key: "pests", detail: "Caterpillars" }]);
  assert.deepEqual(guessReasons("Got too wet"), [{ key: "water", detail: "Too wet" }]);
  assert.deepEqual(guessReasons("got scorched"), [{ key: "weather", detail: "Heat" }]);
  assert.deepEqual(guessReasons("I forgot to water it"), [{ key: "neglect", detail: undefined }]);
  // Word starts only: no false alarms from "carrot", "drain" or "window".
  assert.deepEqual(guessReasons("planted next to the carrots by the drain under the window"), []);
});

test("setback summary", () => {
  assert.equal(setbackSummary({ reasons: ["weather", "pests"], details: { weather: "Wind", pests: "Caterpillars" } }), "Wind, Caterpillars");
  assert.equal(setbackSummary({ reasons: ["dontKnow"], details: {} }), "not sure why");
  assert.equal(setbackSummary({ reasons: ["disease"], details: {} }), "Disease");
});

test("logging a setback flags the plant and writes the diary", () => {
  let g = emptyGarden(true);
  const areaId = g.areas[5].id; // The Sunset Border
  let id: string;
  [g, id] = addPlant(g, { name: "Musa basjoo", areaId, section: "Trees and shrubs" });
  g = logSetback(g, {
    plantId: id,
    date: "2026-10-28",
    outcome: "struggling",
    reasons: ["weather"],
    details: { weather: "Wind" },
    inOwnWords: "  leaves shredded again  ",
    addToDiary: true,
  });
  const plant = g.plants.find((p) => p.id === id)!;
  assert.equal(plant.status, "struggling");
  assert.equal(g.setbacks.length, 1);
  assert.equal(g.setbacks[0].inOwnWords, "leaves shredded again");
  assert.equal(g.journal.length, 1);
  assert.equal(g.journal[0].text, 'Musa basjoo is struggling in The Sunset Border: Wind. "leaves shredded again"');
  assert.equal(g.setbacks[0].journalEntryId, g.journal[0].id);

  g = logSetback(g, { plantId: id, date: "2026-11-02", outcome: "died", reasons: ["weather"], details: { weather: "Frost" }, addToDiary: false });
  const lost = g.plants.find((p) => p.id === id)!;
  assert.equal(lost.status, "lost");
  assert.equal(lost.lostOn, "2026-11-02");
  assert.equal(g.journal.length, 1, "diary left alone when switched off");
  assert.equal(pastSetbacksFor(g, "musa BASJOO").length, 2);

  g = markRecovered(g, id);
  assert.equal(g.plants.find((p) => p.id === id)!.status, "growing");
  assert.equal(g.setbacks.length, 2, "history is kept");
});

test("areas with plants can't be removed", () => {
  let g = emptyGarden(true);
  const areaId = g.areas[0].id;
  [g] = addPlant(g, { name: "Lemon magnolia", areaId, section: "Trees and shrubs" });
  assert.equal(removeArea(g, areaId).areas.length, 8);
  assert.equal(removeArea(g, g.areas[1].id).areas.length, 7);
});

test("export and restore", () => {
  let g = emptyGarden(true);
  [g] = addPlant(g, { name: "Dahlia", variety: 'Bishop of "Llandaff"', areaId: g.areas[5].id, section: "Dahlias", notes: "Lift, then store" });
  const csv = plantsToCSV(g);
  assert.ok(csv.startsWith("Name,Variety,Latin name,Area"));
  assert.ok(csv.includes('Dahlia,"Bishop of ""Llandaff""",,The Sunset Border,Dahlias,growing,,,"Lift, then store"'));
  assert.ok(isGardenData(JSON.parse(JSON.stringify(g))));
  assert.equal(isGardenData({ version: 2 }), false);
});

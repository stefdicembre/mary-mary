import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyGarden, isGardenData, upgrade } from "./data";
import { addPlant, deletePlant, plantPlanned, updatePlant } from "./actions";
import {
  addFeature,
  bedPlanFor,
  clampBox,
  findSpace,
  nudge,
  overlaps,
  placeAllAreas,
  placeInBed,
  removeFromBed,
  setBedSize,
  setMapSize,
  shortLabel,
  tidyBedPlans,
  turn,
  turnNorth,
  whereIs,
  spotName,
  neighbours,
  positionWords,
  andList,
} from "./layout";
import type { GardenData } from "./types";

test("a new garden has an empty map", () => {
  const g = emptyGarden(true);
  assert.equal(g.map.width, 12);
  assert.equal(g.map.length, 20);
  assert.deepEqual(g.map.areas, {});
  assert.deepEqual(g.bedPlans, {});
});

test("older backups without a map still load and get one", () => {
  const old = emptyGarden(true) as Partial<GardenData>;
  delete old.map;
  delete old.bedPlans;
  assert.ok(isGardenData(old));
  const g = upgrade(old as GardenData);
  assert.equal(g.map.north, "up");
  assert.deepEqual(g.bedPlans, {});
});

test("placing all areas puts each one inside the garden without overlapping", () => {
  const g = placeAllAreas(emptyGarden(true));
  const boxes = Object.values(g.map.areas);
  assert.equal(boxes.length, g.areas.length);
  for (const b of boxes) {
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= g.map.width && b.y + b.h <= g.map.length);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlaps(boxes[i], boxes[j]));
});

test("boxes stay in the garden when moved, grown or turned", () => {
  let g = placeAllAreas(emptyGarden(true));
  const id = g.areas[0].id;
  g = nudge(g, { areaId: id }, -50, -50);
  assert.equal(g.map.areas[id].x, 0);
  assert.equal(g.map.areas[id].y, 0);
  g = nudge(g, { areaId: id }, 0, 0, 100, 100);
  assert.equal(g.map.areas[id].w, g.map.width);
  assert.equal(g.map.areas[id].h, g.map.length);
  g = nudge(g, { areaId: id }, 0, 0, -100, -100);
  assert.equal(g.map.areas[id].w, 1);
  assert.deepEqual(clampBox({ x: 11, y: 0, w: 3, h: 2 }, 12, 20), { x: 9, y: 0, w: 3, h: 2 });
  g = nudge(g, { areaId: id }, 0, 0, 3, 0); // 4 × 1
  g = turn(g, { areaId: id });
  assert.equal(g.map.areas[id].w, 1);
  assert.equal(g.map.areas[id].h, 4);
});

test("shrinking the garden brings things back inside", () => {
  let g = placeAllAreas(emptyGarden(true));
  g = setMapSize(g, 2, 3); // below the minimum, so 4 × 4
  assert.equal(g.map.width, 4);
  assert.equal(g.map.length, 4);
  for (const b of Object.values(g.map.areas)) assert.ok(b.x + b.w <= 4 && b.y + b.h <= 4);
});

test("features find free space and north turns round", () => {
  let g = placeAllAreas(emptyGarden(true));
  let shed: string;
  [g, shed] = addFeature(g, "shed");
  const f = g.map.features.find((x) => x.id === shed)!;
  assert.equal(f.label, "Shed");
  for (const b of Object.values(g.map.areas)) assert.ok(!overlaps(b, f));
  assert.deepEqual(findSpace({ width: 4, length: 4, north: "up", areas: { a: { x: 0, y: 0, w: 4, h: 3 } }, features: [] }, 2, 1), {
    x: 0,
    y: 3,
    w: 2,
    h: 1,
  });
  g = turnNorth(turnNorth(turnNorth(turnNorth(turnNorth(g)))));
  assert.equal(g.map.north, "right");
});

test("bed plan: place, move, swap and take off", () => {
  let g = emptyGarden(true);
  const areaId = g.areas[1].id;
  let rose: string, lav: string;
  [g, rose] = addPlant(g, { name: "Rose", areaId, section: "Roses" });
  [g, lav] = addPlant(g, { name: "Lavender", areaId, section: "Herbs" });
  assert.equal(bedPlanFor(g, areaId).cols, 6); // not on the map yet: 6 × 4
  g = placeInBed(g, areaId, 0, 0, { plantId: rose });
  g = placeInBed(g, areaId, 2, 1, { plantId: lav });
  g = placeInBed(g, areaId, 3, 3, { plantId: rose }); // move
  let spots = g.bedPlans[areaId].spots;
  assert.equal(spots.length, 2);
  assert.deepEqual(spots.find((s) => s.plantId === rose)!.x, 3);
  g = placeInBed(g, areaId, 2, 1, { plantId: rose }); // onto lavender: they swap
  spots = g.bedPlans[areaId].spots;
  assert.deepEqual([spots.find((s) => s.plantId === lav)!.x, spots.find((s) => s.plantId === lav)!.y], [3, 3]);
  assert.deepEqual([spots.find((s) => s.plantId === rose)!.x, spots.find((s) => s.plantId === rose)!.y], [2, 1]);
  assert.equal(placeInBed(g, areaId, 9, 9, { plantId: rose }), g); // off the edge: nothing happens
  g = removeFromBed(g, areaId, spots.find((s) => s.plantId === rose)!.id);
  assert.equal(g.bedPlans[areaId].spots.length, 1);
  g = setBedSize(g, areaId, 3, 3); // lavender at (3,3) falls outside
  assert.equal(g.bedPlans[areaId].spots.length, 0);
});

test("bed plan size follows the area's shape on the map", () => {
  const g = placeAllAreas(emptyGarden(true));
  const border = g.areas.find((a) => a.kind === "border")!;
  const plan = bedPlanFor(g, border.id);
  assert.equal(plan.cols, g.map.areas[border.id].w * 2);
  assert.equal(plan.rows, g.map.areas[border.id].h * 2);
});

test("a planned plant keeps its square when it's planted", () => {
  let g = emptyGarden(true);
  const areaId = g.areas[0].id;
  g = { ...g, planned: [{ id: "pl1", areaId, name: "Tulip 'Ballerina'", section: "Bulbs", addedOn: "2026-11-08" }] };
  g = placeInBed(g, areaId, 1, 1, { plannedId: "pl1" });
  g = tidyBedPlans(plantPlanned(g, "pl1", "2026-11-08"));
  const tulip = g.plants.find((p) => p.name === "Tulip")!;
  assert.deepEqual(g.bedPlans[areaId].spots.map((s) => [s.plantId, s.x, s.y]), [[tulip.id, 1, 1]]);
});

test("squares are tidied when a plant is deleted or moved, but lost plants keep theirs", () => {
  let g = emptyGarden(true);
  const [a, b] = [g.areas[0].id, g.areas[1].id];
  let x: string, y: string, z: string;
  [g, x] = addPlant(g, { name: "Fern", areaId: a, section: "Perennials" });
  [g, y] = addPlant(g, { name: "Hosta", areaId: a, section: "Perennials" });
  [g, z] = addPlant(g, { name: "Salvia", areaId: a, section: "Perennials" });
  g = placeInBed(g, a, 0, 0, { plantId: x });
  g = placeInBed(g, a, 1, 0, { plantId: y });
  g = placeInBed(g, a, 2, 0, { plantId: z });
  g = tidyBedPlans(deletePlant(g, x));
  g = tidyBedPlans(updatePlant(g, y, { areaId: b }));
  g = tidyBedPlans(updatePlant(g, z, { status: "lost" }));
  assert.deepEqual(g.bedPlans[a].spots.map((s) => s.plantId), [z]);
});

test("short labels for squares", () => {
  assert.equal(shortLabel("Dahlia 'Bishop of Llandaff'"), "Dahlia");
  assert.equal(shortLabel("Chrysanthemum"), "Chrysanthe…");
});

test("a plant can find its square and what's around it", () => {
  let g = emptyGarden(true);
  const areaId = g.areas[0].id;
  let rose: string, lav: string, sage: string, far: string;
  [g, rose] = addPlant(g, { name: "Rose", variety: "Gertrude Jekyll", areaId, section: "Roses" });
  [g, lav] = addPlant(g, { name: "Lavender", areaId, section: "Herbs" });
  [g, sage] = addPlant(g, { name: "Sage", areaId, section: "Herbs" });
  [g, far] = addPlant(g, { name: "Fern", areaId, section: "Perennials" });
  assert.equal(whereIs(g, rose), undefined); // no square yet
  g = { ...g, planned: [{ id: "pl1", areaId, name: "Tulip", section: "Bulbs", addedOn: "2026-11-08" }] };
  g = placeInBed(g, areaId, 2, 1, { plantId: rose });
  g = placeInBed(g, areaId, 3, 2, { plantId: lav }); // corner
  g = placeInBed(g, areaId, 2, 0, { plantId: sage }); // straight above
  g = placeInBed(g, areaId, 1, 1, { plannedId: "pl1" }); // straight left
  g = placeInBed(g, areaId, 5, 3, { plantId: far }); // not next to it
  const w = whereIs(g, rose)!;
  assert.deepEqual([w.areaId, w.spot.x, w.spot.y], [areaId, 2, 1]);
  assert.equal(spotName(g, w.spot), "Rose 'Gertrude Jekyll'");
  assert.deepEqual(neighbours(g, areaId, 2, 1).map((s) => spotName(g, s)), ["Sage", "Tulip", "Lavender"]);
  g = tidyBedPlans(updatePlant(g, sage, { status: "lost" }));
  assert.deepEqual(neighbours(g, areaId, 2, 1).map((s) => spotName(g, s)), ["Tulip", "Lavender"]);
  assert.ok(whereIs(g, sage)); // lost plants still know where they were
  assert.equal(andList(["A", "B", "C"]), "A, B and C");
});

test("rough position words for a square", () => {
  const plan = { cols: 6, rows: 4 };
  assert.equal(positionWords(plan, 0, 0), "in the top left corner");
  assert.equal(positionWords(plan, 5, 3), "in the bottom right corner");
  assert.equal(positionWords(plan, 2, 1), "in the middle");
  assert.equal(positionWords(plan, 0, 2), "down the left side");
  assert.equal(positionWords(plan, 3, 0), "along the top");
  assert.equal(positionWords({ cols: 1, rows: 1 }, 0, 0), "in the middle");
});

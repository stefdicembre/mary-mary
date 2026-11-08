import { test } from "node:test";
import assert from "node:assert/strict";
import { blankAnswers, doneTitle, findInCatalogue, gardenFromSetup, namesList, newInstall, prioritiesFrom, starterIdeas } from "./setup";
import type { SetupAnswers } from "./setup";
import { isGardenData } from "./data";

test("setup: names read naturally", () => {
  assert.equal(namesList(["Stef"]), "Stef");
  assert.equal(namesList(["Stef", " Cath "]), "Stef and Cath");
  assert.equal(namesList(["Stef", "", "Cath", "Jo"]), "Stef, Cath and Jo");
  assert.equal(doneTitle([{ name: "", days: [] }]), "You're all set");
  assert.equal(doneTitle([{ name: "Stef", days: [] }, { name: "Cath", days: [] }]), "You're all set, Stef and Cath");
});

test("setup: typed names find catalogue plants", () => {
  assert.match(findInCatalogue("lavender")?.name ?? "", /Lavender/);
  assert.equal(findInCatalogue("Rosemary")?.name, "Rosemary");
  assert.equal(findInCatalogue("zzz"), undefined);
  assert.equal(findInCatalogue("  "), undefined);
});

test("setup: likes become planting-plan priorities", () => {
  assert.deepEqual(prioritiesFrom(["Growing food", "Wildlife", "Low maintenance", "Lawn care"]), ["wildlife", "easy"]);
});

test("setup: a new phone asks to be set up and has no areas", () => {
  const g = newInstall();
  assert.equal(g.settings.needsSetup, true);
  assert.equal(g.areas.length, 0);
  assert.ok(isGardenData(g));
});

test("setup: answers become a garden", () => {
  const a: SetupAnswers = {
    ...blankAnswers(),
    gardenName: "  Our garden ",
    people: [
      { name: "Stef", time: "1to3", days: ["Saturday"] },
      { name: "Cath", days: [] },
      { name: "  ", days: [] }, // empty extra people are dropped
    ],
    postcode: "ME14 1XX",
    location: { lat: 51.2, lon: 0.5, place: "Maidstone", forPostcode: "ME14 1XX" },
    areas: [
      { key: "a1", name: "Sunny border", kind: "border", aspect: "S", soil: "Clay" },
      { key: "a2", name: "Veg patch", kind: "veg", soil: "Not sure" },
      { key: "a3", name: "   ", kind: "other" }, // unnamed: left out
    ],
    plants: [
      { key: "p1", areaKey: "a1", name: "lavender" },
      { key: "p2", areaKey: "a1", name: "Not sure yet", describedAs: "Tall, purple, spiky flowers" },
      { key: "p3", areaKey: "a2", name: "Mystery squash" },
      { key: "p4", areaKey: "a3", name: "Orphan" }, // its area was left out
    ],
    planned: [
      { areaKey: "a1", catalogueId: "lavender-hidcote" },
      { areaKey: "a1", catalogueId: "lavender-hidcote" }, // twice: kept once
      { areaKey: "a1", catalogueId: "no-such-plant" },
    ],
    likes: ["Wildlife", "Lawn care ", "Wildlife"],
  };
  const g = gardenFromSetup(a, "2026-11-08", "2026-11-08T12:00:00Z");
  assert.equal(g.settings.gardenName, "Our garden");
  assert.equal(g.settings.yourName, "Stef");
  assert.equal(g.settings.needsSetup, undefined);
  assert.equal(g.settings.setUpOn, "2026-11-08");
  assert.equal(g.settings.location?.place, "Maidstone");
  assert.deepEqual(g.settings.gardeners?.map((p) => p.name), ["Stef", "Cath"]);
  assert.deepEqual(g.settings.likes, ["Wildlife", "Lawn care"]);

  assert.deepEqual(g.areas.map((x) => x.name), ["Sunny border", "Veg patch"]);
  const border = g.areas[0];
  assert.equal(border.aspect, "S");
  assert.equal(border.soil, "Clay");
  assert.equal(g.areas[1].soil, undefined); // "Not sure" isn't saved as a soil

  assert.equal(g.plants.length, 3);
  const lav = g.plants.find((p) => p.name === "lavender")!;
  assert.equal(lav.section, "Trees and shrubs");
  assert.ok(lav.latinName, "found in the catalogue, so it gets its Latin name");
  const unsure = g.plants.find((p) => p.section === "To identify")!;
  assert.equal(unsure.notes, "Tall, purple, spiky flowers");
  assert.equal(g.plants.find((p) => p.name === "Mystery squash")!.section, "Vegetables");
  assert.ok(g.plants.every((p) => p.status === "growing"));

  const lavCat = findInCatalogue("lavender")!;
  if (lavCat.id === "lavender-hidcote") {
    assert.equal(g.planned.length, 1);
    assert.equal(g.planned[0].areaId, border.id);
  }
  assert.ok(isGardenData(g));
});

test("setup: no garden name falls back gently", () => {
  assert.equal(gardenFromSetup({ ...blankAnswers(), people: [{ name: "Jo", days: [] }] }, "2026-11-08").settings.gardenName, "Jo's garden");
  assert.equal(gardenFromSetup(blankAnswers(), "2026-11-08").settings.gardenName, "My garden");
  // A location for a different postcode isn't kept.
  const g = gardenFromSetup(
    { ...blankAnswers(), postcode: "LS1", location: { lat: 1, lon: 1, place: "X", forPostcode: "ME14" } },
    "2026-11-08",
  );
  assert.equal(g.settings.location, undefined);
});

test("setup: starter ideas are few, easy and follow the spot", () => {
  const sunny = starterIdeas({ key: "a", name: "Front", kind: "border", aspect: "S" }, { likes: [], month: 4 });
  assert.equal(sunny.length, 3);
  assert.ok(sunny.every((p) => p.sun.includes("full")));
  const shady = starterIdeas({ key: "a", name: "Back", kind: "border", aspect: "N" }, { room: "border", likes: [], month: 4 });
  assert.ok(shady.length > 3 && shady.length <= 5);
  assert.ok(shady.every((p) => p.sun.includes("shade")));
  // Clay: nothing that struggles in clay.
  const clay = starterIdeas({ key: "a", name: "B", kind: "border", aspect: "S", soil: "Clay" }, { room: "big", likes: [], month: 4 });
  assert.ok(clay.every((p) => !p.avoidSoil?.includes("Clay")));
  // "Not for me" takes one off without a replacement popping in.
  const again = starterIdeas({ key: "a", name: "Front", kind: "border", aspect: "S" }, { likes: [], month: 4, leaveOut: [sunny[0].id] });
  assert.equal(again.length, 2);
  // Growing food puts edible plants first, where there are any.
  const food = starterIdeas({ key: "a", name: "Pots", kind: "pots", aspect: "S" }, { room: "big", likes: ["Growing food"], month: 4 });
  const edible = (s: string) => ["Herbs", "Fruit", "Vegetables"].includes(s);
  if (food.some((p) => edible(p.section))) assert.ok(edible(food[0].section));
});

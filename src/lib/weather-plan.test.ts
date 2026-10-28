import { test } from "node:test";
import assert from "node:assert/strict";
import { addPlant, addPlanned, logSetback, notForMe, plantPlanned } from "./actions";
import { CATALOGUE, isTender } from "./catalogue";
import { emptyGarden, upgrade } from "./data";
import { makePlan, monthRanges, sunFor } from "./plan";
import { adviceFor, dayLabel, deg, describe, nightLows } from "./weather";
import type { Forecast } from "./weather";
import { parseForecast } from "./weatherApi";

/** A week of forecast starting on Wednesday 28 Oct 2026, with sensible defaults. */
function forecast(over: Partial<Forecast["daily"]> = {}, nightTemps?: number[]): Forecast {
  const date = ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"];
  const time: string[] = [];
  const temp: number[] = [];
  // nightTemps[i] is the low for the night that starts on day i.
  const night = (i: number) => (i >= 0 ? nightTemps?.[i] ?? 6 : 6);
  date.forEach((d, i) => {
    for (let h = 0; h < 24; h++) {
      time.push(`${d}T${String(h).padStart(2, "0")}:00`);
      temp.push(h >= 18 ? night(i) : h <= 9 ? night(i - 1) : 12);
    }
  });
  return {
    fetchedAt: "2026-10-28T12:00:00Z",
    place: "Testville",
    current: { temp: 12, code: 2, windMph: 8 },
    hourly: { time, temp, rainChance: time.map(() => 10), code: time.map(() => 2) },
    daily: {
      date,
      code: date.map(() => 2),
      max: date.map(() => 13),
      min: date.map(() => 6),
      rainChance: date.map(() => 20),
      rainMm: date.map(() => 0),
      gustMph: date.map(() => 20),
      ...over,
    },
  };
}

test("weather words and labels", () => {
  assert.equal(describe(0).words, "Sunny");
  assert.equal(describe(63).sky, "rain");
  assert.equal(describe(73).sky, "snow");
  assert.equal(dayLabel("2026-10-28", "2026-10-28"), "Today");
  assert.equal(dayLabel("2026-10-29", "2026-10-28"), "Tomorrow");
  assert.equal(dayLabel("2026-10-30", "2026-10-28"), "Friday");
  assert.equal(deg(-0.4), "0°");
  assert.equal(deg(-1.2), "−1°");
});

test("night lows use the evening and next morning", () => {
  const f = forecast({}, [6, 6, -1, 6, 6, 6, 6]);
  const lows = nightLows(f);
  assert.equal(lows.find((n) => n.date === "2026-10-30")!.low, -1);
  assert.equal(lows.find((n) => n.date === "2026-10-28")!.low, 6);
});

test("frost warning names tender plants", () => {
  let g = emptyGarden(true);
  [g] = addPlant(g, { name: "Dahlia", areaId: g.areas[5].id, section: "Dahlias" });
  [g] = addPlant(g, { name: "Hardy geranium", areaId: g.areas[5].id, section: "Perennials" });
  const f = forecast({}, [-2, 6, 6, 6, 6, 6, 6]);
  const advice = adviceFor(f, g, "2026-10-28");
  const frost = advice.find((a) => a.kind === "frost")!;
  assert.ok(frost.urgent);
  assert.equal(frost.when, "Tonight");
  assert.match(frost.title, /Frost tonight, down to −2°C/);
  assert.deepEqual(frost.protect, ["Dahlia (The Sunset Border)"]);
});

test("light frost later in the week isn't urgent", () => {
  const g = emptyGarden(true);
  const advice = adviceFor(forecast({}, [6, 6, 6, 1.5, 6, 6, 6]), g, "2026-10-28");
  const frost = advice.find((a) => a.kind === "frost")!;
  assert.equal(frost.urgent, false);
  assert.equal(frost.when, "Saturday night");
  assert.match(frost.title, /light frost/);
});

test("rain, wind and heat advice", () => {
  const g = emptyGarden(true);
  const a = adviceFor(forecast({ rainMm: [0, 12, 0, 0, 0, 0, 0], gustMph: [20, 20, 58, 20, 20, 20, 20], max: [13, 13, 13, 13, 31, 13, 13] }), g, "2026-10-28");
  const kinds = a.map((x) => x.kind);
  assert.ok(kinds.includes("rain"));
  assert.ok(kinds.includes("wind"));
  assert.ok(kinds.includes("heat"));
  assert.match(a.find((x) => x.kind === "rain")!.title, /Rain tomorrow/);
  assert.equal(a.find((x) => x.kind === "wind")!.urgent, false, "Friday is too far off to be urgent");
  assert.equal(adviceFor(forecast(), g, "2026-10-28").length, 0, "a calm week says nothing");
});

test("a warm dry spell is mentioned, a cold dry one isn't", () => {
  const g = emptyGarden(true);
  const warm = forecast({ rainChance: [5, 5, 5, 5, 5, 5, 5], max: [22, 22, 22, 22, 22, 22, 22] });
  assert.ok(adviceFor(warm, g, "2026-10-28").some((a) => a.kind === "dry"));
  const cold = forecast({ rainChance: [5, 5, 5, 5, 5, 5, 5] });
  assert.ok(!adviceFor(cold, g, "2026-10-28").some((a) => a.kind === "dry"));
});

test("Open-Meteo replies are read safely", () => {
  const f = parseForecast({ current: { temperature_2m: 9.5, weather_code: 3 }, daily: { time: ["2026-10-28"], temperature_2m_max: [12] } }, "Here");
  assert.equal(f.current.temp, 9.5);
  assert.equal(f.daily.max[0], 12);
  assert.deepEqual(f.daily.min, []);
});

test("tender plant names", () => {
  assert.ok(isTender("Dahlia"));
  assert.ok(isTender("Musa basjoo"));
  assert.ok(isTender("Cherry tomato"));
  assert.ok(!isTender("Hardy geranium"));
  assert.ok(!isTender("Rose"));
});

test("catalogue entries are complete", () => {
  const ids = new Set<string>();
  for (const c of CATALOGUE) {
    assert.ok(!ids.has(c.id), `duplicate ${c.id}`);
    ids.add(c.id);
    assert.ok(c.plant.length > 0 && c.plant.every((m) => m >= 1 && m <= 12), `${c.id} months`);
    assert.ok(c.sun.length && c.places.length && c.colours.length && c.why.length > 20, `${c.id} fields`);
  }
});

test("month ranges read naturally", () => {
  assert.equal(monthRanges([3, 4, 5, 9, 10]), "Mar to May, Sep to Oct");
  assert.equal(monthRanges([11, 12, 1, 2, 3]), "Nov to Mar");
  assert.equal(monthRanges([11]), "Nov");
  assert.equal(sunFor("W"), "full");
  assert.equal(sunFor("N"), "shade");
});

test("planting plan follows the area and what went wrong there", () => {
  let g = emptyGarden(true);
  const sunset = { ...g.areas[5], aspect: "W" as const };
  g = { ...g, areas: g.areas.map((a) => (a.id === sunset.id ? sunset : a)) };
  assert.equal(sunset.colours, "hot", "Sunset Border gets hot colours from the wireframes");
  let musa: string;
  [g, musa] = addPlant(g, { name: "Musa basjoo", areaId: sunset.id, section: "Trees and shrubs" });
  g = logSetback(g, { plantId: musa, date: "2026-10-01", outcome: "struggling", reasons: ["weather"], details: { weather: "Wind" }, addToDiary: false });

  const plan = makePlan(g, sunset, { goal: "gaps", priorities: ["wildlife"], month: 10 });
  const items = plan.groups.flatMap((x) => x.items);
  assert.ok(items.length > 0 && items.length <= 6);
  // Hot colours only (or foliage)
  for (const s of items) assert.ok(s.plant.colours.some((c) => ["orange", "red", "yellow", "bronze", "green"].includes(c)), s.plant.name);
  // Wind lesson: the top suggestion copes with wind
  const top = [...items].sort((a, b) => b.tags.length - a.tags.length)[0];
  assert.ok(top.tags.includes("Copes with wind"));
  // Gaps means no shrubs or roses
  assert.ok(items.every((s) => !["Trees and shrubs", "Roses", "Climbers"].includes(s.plant.section)));
  // Now (October) comes first
  assert.equal(plan.groups[0].title, "Now, in October");

  // Clay soil leaves out plants that dislike it, and says so
  const clay = makePlan(g, sunset, { goal: "refresh", soil: "Clay", priorities: [], month: 10 });
  assert.ok(clay.groups.flatMap((x) => x.items).every((s) => !s.plant.avoidSoil?.includes("Clay")));
  assert.ok(clay.soilNote.includes("clay"));

  // "Not for me" and planned plants aren't suggested again
  const first = items[0].plant.id;
  const g2 = notForMe(g, sunset.id, first);
  assert.ok(!makePlan(g2, sunset, { goal: "gaps", priorities: ["wildlife"], month: 10 }).groups.flatMap((x) => x.items).some((s) => s.plant.id === first));
});

test("veg plots get veg, greenhouses get greenhouse crops", () => {
  const g = emptyGarden(true);
  const allot = g.areas.find((a) => a.kind === "veg")!;
  const veg = makePlan(g, allot, { goal: "refresh", priorities: [], month: 10 }).groups.flatMap((x) => x.items);
  assert.ok(veg.length > 0);
  assert.ok(veg.every((s) => s.plant.places.includes("veg")));
  assert.ok(veg.some((s) => s.plant.id === "garlic"), "garlic goes in during October");
  const gh = g.areas.find((a) => a.kind === "greenhouse")!;
  assert.ok(makePlan(g, gh, { goal: "refresh", priorities: [], month: 4 }).groups.flatMap((x) => x.items).some((s) => s.plant.id === "tomato"));
});

test("planned plants become real plants", () => {
  let g = emptyGarden(true);
  const area = g.areas[5].id;
  g = addPlanned(g, { areaId: area, catalogueId: "tulip-ballerina", name: "Tulip 'Ballerina'", section: "Bulbs", plantMonth: 11 }, "2026-10-28");
  g = addPlanned(g, { areaId: area, catalogueId: "tulip-ballerina", name: "Tulip 'Ballerina'", section: "Bulbs", plantMonth: 11 }, "2026-10-28");
  assert.equal(g.planned.length, 1, "no duplicates");
  g = plantPlanned(g, g.planned[0].id, "2026-11-10");
  assert.equal(g.planned.length, 0);
  const p = g.plants[0];
  assert.equal(p.name, "Tulip");
  assert.equal(p.variety, "Ballerina");
  assert.equal(p.plantedOn, "2026-11-10");
});

test("older saved gardens are upgraded", () => {
  const old = { ...emptyGarden(false) } as Record<string, unknown>;
  delete old.planned;
  delete old.notForMe;
  const g = upgrade(old as never);
  assert.deepEqual(g.planned, []);
  assert.deepEqual(g.notForMe, []);
});

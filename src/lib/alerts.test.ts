import { test } from "node:test";
import assert from "node:assert/strict";
import { codeIsOutOfDate, notYetSent, parsePushCode, urgentAlerts } from "./alerts";
import type { Forecast } from "./weather";

/** A week from Wednesday 28 Oct 2026. nightTemps[i] is the low for the night starting on day i. */
function forecast(over: Partial<Forecast["daily"]> = {}, nightTemps?: number[]): Forecast {
  const date = ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"];
  const time: string[] = [];
  const temp: number[] = [];
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
const TODAY = "2026-10-28";

test("alerts: frost tonight names the tender plants, light frost and later frost don't alert", () => {
  const [a, ...rest] = urgentAlerts(forecast({}, [-1]), ["Dahlia (The Sunset Border)", "Pelargonium (Pots)"], TODAY, 15);
  assert.equal(rest.length, 0);
  assert.equal(a.key, "frost:2026-10-28");
  assert.equal(a.title, "Frost tonight, down to −1°C");
  assert.match(a.body, /^Protect before dark: Dahlia \(The Sunset Border\) and Pelargonium \(Pots\)\./);
  assert.equal(a.url, "#/weather");
  // Lots of tender plants: three names at most.
  const many = urgentAlerts(forecast({}, [-1]), ["A", "B", "C", "D", "E"], TODAY, 7)[0];
  assert.match(many.body, /A, B and 3 more\./);
  // No tender plants: the general advice.
  assert.match(urgentAlerts(forecast({}, [-1]), [], TODAY, 15)[0].body, /tender pots under cover/);
  // A light frost (1°C) isn't urgent; frost tomorrow night waits for tomorrow's check.
  assert.equal(urgentAlerts(forecast({}, [1]), [], TODAY, 15).length, 0);
  assert.equal(urgentAlerts(forecast({}, [6, -2]), [], TODAY, 15).length, 0);
});

test("alerts: heat and storms depend on the time of the check", () => {
  const hotToday = forecast({ max: [31, 13, 13, 13, 13, 13, 13] });
  assert.equal(urgentAlerts(hotToday, [], TODAY, 7).length, 1, "morning: hot today");
  assert.equal(urgentAlerts(hotToday, [], TODAY, 15).length, 0, "afternoon: too late for today's heat");
  const hotTomorrow = forecast({ max: [13, 31, 13, 13, 13, 13, 13] });
  assert.equal(urgentAlerts(hotTomorrow, [], TODAY, 7).length, 0);
  assert.equal(urgentAlerts(hotTomorrow, [], TODAY, 15)[0].key, "heat:2026-10-29");
  const warm = forecast({ max: [28, 28, 13, 13, 13, 13, 13] });
  assert.equal(urgentAlerts(warm, [], TODAY, 15).length, 0, "27–29°C is advice, not urgent");

  const stormTomorrow = forecast({ gustMph: [20, 60, 20, 20, 20, 20, 20] });
  assert.equal(urgentAlerts(stormTomorrow, [], TODAY, 7).length, 0);
  const s = urgentAlerts(stormTomorrow, [], TODAY, 15)[0];
  assert.equal(s.key, "wind:2026-10-29");
  assert.equal(s.title, "Strong winds tomorrow, gusts up to 60mph");
  assert.equal(urgentAlerts(forecast({ gustMph: [58, 20, 20, 20, 20, 20, 20] }), [], TODAY, 15).length, 1, "storm today, afternoon");
  assert.equal(urgentAlerts(forecast({ gustMph: [50, 20, 20, 20, 20, 20, 20] }), [], TODAY, 7).length, 0, "45–54mph isn't urgent");
  // Heavy rain is never a lock-screen alert.
  assert.equal(urgentAlerts(forecast({ rainMm: [30, 0, 0, 0, 0, 0, 0] }), [], TODAY, 7).length, 0);
});

test("alerts: each one is sent once, and old keys are forgotten", () => {
  const frost = { key: "frost:2026-10-28", title: "", body: "", url: "" };
  const first = notYetSent([frost], ["wind:2026-10-01", "heat:2026-10-20"], TODAY);
  assert.deepEqual(first.send, [frost]);
  assert.deepEqual(first.sent, ["heat:2026-10-20", "frost:2026-10-28"]);
  const again = notYetSent([frost], first.sent, TODAY);
  assert.equal(again.send.length, 0);
});

test("push code: read back, with plain-English errors", () => {
  const good = {
    v: 1,
    sub: { endpoint: "https://web.push.apple.com/abc", keys: { p256dh: "BAbc_-1", auth: "xyz" } },
    vapid: { publicKey: "BPub", privateKey: "priv" },
    lat: 51.5,
    lon: -0.1,
    place: "Testville",
    protect: ["Dahlia"],
    madeOn: TODAY,
  };
  assert.equal(parsePushCode(JSON.stringify(good)).place, "Testville");
  assert.equal(parsePushCode(`  ${JSON.stringify(good)}\n`).protect[0], "Dahlia");
  assert.throws(() => parsePushCode(""), /no push code yet/);
  assert.throws(() => parsePushCode(JSON.stringify(good).slice(0, 40)), /isn't complete/);
  assert.throws(() => parsePushCode(JSON.stringify({ ...good, lat: "51" })), /doesn't look like/);
  assert.throws(() => parsePushCode(JSON.stringify({ ...good, sub: { ...good.sub, endpoint: "http://x" } })), /doesn't look like/);
});

test("push code: out of date when the place or tender plants change", () => {
  const code = { place: "Testville", protect: ["Dahlia", "Canna"] };
  assert.equal(codeIsOutOfDate(code, "Testville", ["Canna", "Dahlia"]), false);
  assert.equal(codeIsOutOfDate(code, "Elsewhere", ["Canna", "Dahlia"]), true);
  assert.equal(codeIsOutOfDate(code, "Testville", ["Dahlia"]), true);
});

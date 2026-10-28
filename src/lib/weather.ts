// Weather: what the forecast looks like, and what it means for the garden.
// The forecast comes from Open-Meteo (free, no account). See weatherApi.ts.

import { isTender } from "./catalogue";
import type { GardenData } from "./types";

export interface Forecast {
  fetchedAt: string; // ISO date-time
  place: string;
  current: { temp: number; code: number; windMph: number };
  hourly: { time: string[]; temp: number[]; rainChance: number[]; code: number[] };
  daily: {
    date: string[]; // YYYY-MM-DD
    code: number[];
    max: number[];
    min: number[];
    rainChance: number[];
    rainMm: number[];
    gustMph: number[];
  };
}

export type Sky = "sun" | "partly" | "cloud" | "fog" | "rain" | "snow" | "thunder";

/** Open-Meteo's weather codes (WMO), in plain words. */
export function describe(code: number): { words: string; sky: Sky } {
  if (code === 0) return { words: "Sunny", sky: "sun" };
  if (code === 1) return { words: "Mostly sunny", sky: "sun" };
  if (code === 2) return { words: "Sunny spells", sky: "partly" };
  if (code === 3) return { words: "Cloudy", sky: "cloud" };
  if (code === 45 || code === 48) return { words: "Foggy", sky: "fog" };
  if (code >= 51 && code <= 57) return { words: "Drizzle", sky: "rain" };
  if (code === 61 || code === 80) return { words: "Light rain", sky: "rain" };
  if (code === 63 || code === 81) return { words: "Rain", sky: "rain" };
  if (code === 65 || code === 82) return { words: "Heavy rain", sky: "rain" };
  if (code === 66 || code === 67) return { words: "Freezing rain", sky: "rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { words: "Snow", sky: "snow" };
  if (code >= 95) return { words: "Thunderstorms", sky: "thunder" };
  return { words: "Mixed", sky: "cloud" };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Today", "Tomorrow" or the weekday, for a YYYY-MM-DD date. */
export function dayLabel(date: string, today: string): string {
  const d = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  const t = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const diff = Math.round((d - t) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return WEEKDAYS[new Date(d).getUTCDay()];
}

export const round = (n: number) => {
  const r = Math.round(n);
  return r === 0 ? 0 : r; // avoids "-0"
};
export const deg = (n: number) => `${round(n) < 0 ? "−" : ""}${Math.abs(round(n))}°`;

export type AdviceKind = "frost" | "heat" | "wind" | "rain" | "dry";

export interface Advice {
  kind: AdviceKind;
  date: string;
  when: string; // "Tonight", "Tomorrow", "Thursday"
  urgent: boolean; // needs action within a day or so
  title: string;
  text: string;
  protect?: string[]; // plants to look after, e.g. "Dahlia (The Sunset Border)"
}

/** Plants in the garden that need protecting from frost. */
export function tenderPlants(g: GardenData): string[] {
  const area = (id: string) => g.areas.find((a) => a.id === id)?.name ?? "";
  const frostBefore = new Set(
    g.setbacks.filter((s) => s.reasons.includes("weather") && s.details.weather === "Frost").map((s) => s.plantId),
  );
  return g.plants
    .filter((p) => p.status !== "lost" && (isTender(p.name) || isTender(p.latinName ?? "") || frostBefore.has(p.id)))
    .map((p) => `${p.name}${area(p.areaId) ? ` (${area(p.areaId)})` : ""}`);
}

/**
 * The lowest temperature each night, from 6pm on that date to 9am the next morning.
 * Nights the hourly forecast doesn't fully cover use the next day's daily low instead.
 */
export function nightLows(f: Forecast): Array<{ date: string; low: number }> {
  const out: Array<{ date: string; low: number }> = [];
  for (let i = 0; i < f.daily.date.length; i++) {
    const date = f.daily.date[i];
    const next = f.daily.date[i + 1];
    let low = Infinity;
    let hours = 0;
    f.hourly.time.forEach((t, h) => {
      const inEvening = t.startsWith(date) && t.slice(11, 13) >= "18";
      const inMorning = !!next && t.startsWith(next) && t.slice(11, 13) <= "09";
      if (inEvening || inMorning) {
        low = Math.min(low, f.hourly.temp[h]);
        hours++;
      }
    });
    if (hours >= 12) out.push({ date, low });
    else if (next) out.push({ date, low: f.daily.min[i + 1] });
  }
  return out;
}

/** Turns the forecast into a short list of things worth knowing or doing. */
export function adviceFor(f: Forecast, g: GardenData, today: string): Advice[] {
  const out: Advice[] = [];
  const d = f.daily;
  const days = d.date.map((date, i) => ({ date, i })).filter((x) => x.date >= today);
  const soon = (date: string) => dayLabel(date, today) === "Today" || dayLabel(date, today) === "Tomorrow";

  // Frost: the first cold night, using hourly temperatures from 6pm to 9am the next morning.
  const nights = nightLows(f).filter((n) => n.date >= today);
  const frosty = nights.filter((n) => n.low <= 2);
  if (frosty.length) {
    const first = frosty[0];
    const hard = first.low <= 0;
    const label = dayLabel(first.date, today);
    const when = label === "Today" ? "Tonight" : label === "Tomorrow" ? "Tomorrow night" : `${label} night`;
    const more = frosty.length - 1;
    const protect = tenderPlants(g);
    out.push({
      kind: "frost",
      date: first.date,
      when,
      urgent: hard && soon(first.date),
      title: hard ? `Frost ${when.toLowerCase()}, down to ${deg(first.low)}C` : `Chance of a light frost ${when.toLowerCase()} (${deg(first.low)}C)`,
      text:
        (protect.length
          ? "Fleece tender plants or move pots against the house wall or under cover before dark."
          : "Move tender pots under cover or against the house wall, and fleece anything newly planted.") +
        (more > 0 ? ` Cold again on ${more} more ${more === 1 ? "night" : "nights"} this week.` : ""),
      protect: protect.length ? protect : undefined,
    });
  }

  // Heat
  const hot = days.find((x) => d.max[x.i] >= 27);
  if (hot) {
    const max = d.max[hot.i];
    const label = dayLabel(hot.date, today);
    out.push({
      kind: "heat",
      date: hot.date,
      when: label,
      urgent: max >= 30 && soon(hot.date),
      title: `${label === "Today" ? "Hot today" : `Hot ${label === "Tomorrow" ? "tomorrow" : `on ${label}`}`}, up to ${deg(max)}C`,
      text: "Water pots, the greenhouse and new plants early in the morning or in the evening. Open the greenhouse vents and door, and give seedlings some shade.",
    });
  }

  // Wind
  const windy = days.find((x) => d.gustMph[x.i] >= 45);
  if (windy) {
    const gust = Math.round(d.gustMph[windy.i]);
    const label = dayLabel(windy.date, today);
    out.push({
      kind: "wind",
      date: windy.date,
      when: label,
      urgent: gust >= 55 && soon(windy.date),
      title: `Strong winds ${label === "Today" ? "today" : label === "Tomorrow" ? "tomorrow" : `on ${label}`}, gusts up to ${gust}mph`,
      text: "Tie in climbers and tall plants, move light pots somewhere sheltered, and check the greenhouse door and vents are secure.",
    });
  }

  // Rain today or tomorrow: no need to water outside.
  const wet = days.slice(0, 2).find((x) => d.rainMm[x.i] >= 5 || d.rainChance[x.i] >= 80);
  if (wet) {
    const label = dayLabel(wet.date, today);
    const heavy = d.rainMm[wet.i] >= 20;
    out.push({
      kind: "rain",
      date: wet.date,
      when: label,
      urgent: false,
      title: `${heavy ? "Heavy rain" : "Rain"} ${label === "Today" ? "today" : "tomorrow"}`,
      text: heavy
        ? "No need to water beds and borders. Lift pots off their saucers so they don't sit in water, and check the greenhouse gutter is clear."
        : "No need to water beds and borders. Pots under cover and the greenhouse may still need a drink.",
    });
  }

  // A dry, warm spell (only worth saying in the growing season).
  const nextFive = days.slice(0, 5);
  if (nextFive.length === 5 && !wet && nextFive.every((x) => d.rainChance[x.i] < 30 && d.rainMm[x.i] < 1) && nextFive.some((x) => d.max[x.i] >= 18)) {
    out.push({
      kind: "dry",
      date: nextFive[0].date,
      when: "This week",
      urgent: false,
      title: "A dry few days ahead",
      text: "Keep an eye on pots, new plants and anything in the greenhouse: they dry out first. Water in the evening so less is lost to the sun.",
    });
  }

  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.date.localeCompare(b.date));
}

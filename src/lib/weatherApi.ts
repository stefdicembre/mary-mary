// Fetching the weather. Two free services, no accounts or keys:
//  • postcodes.io turns a UK postcode into a location
//  • Open-Meteo gives the forecast (and finds towns by name)
// The last forecast is saved on the phone so it still shows without signal.

import { loadExtra, saveExtra } from "./db";
import type { Forecast } from "./weather";

export interface Place {
  lat: number;
  lon: number;
  place: string;
}

const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const OUTCODE = /^[A-Z]{1,2}\d[A-Z\d]?$/i;

/** Finds where a postcode or town is. Throws a friendly message if it can't. */
export async function findPlace(query: string): Promise<Place> {
  const q = query.trim();
  if (!q) throw new Error("Add a town or postcode first.");
  try {
    if (FULL_POSTCODE.test(q)) {
      const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(q.replace(/\s+/g, ""))}`);
      if (r.ok) {
        const j = await r.json();
        const res = j.result;
        return { lat: res.latitude, lon: res.longitude, place: res.admin_ward || res.admin_district || q.toUpperCase() };
      }
    } else if (OUTCODE.test(q)) {
      const r = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(q)}`);
      if (r.ok) {
        const j = await r.json();
        const res = j.result;
        return { lat: res.latitude, lon: res.longitude, place: (res.admin_district && res.admin_district[0]) || q.toUpperCase() };
      }
    }
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&countryCode=GB`);
    if (r.ok) {
      const j = await r.json();
      const hit = j.results && j.results[0];
      if (hit) return { lat: hit.latitude, lon: hit.longitude, place: hit.name };
    }
  } catch {
    throw new Error("Couldn't reach the internet to look that up. Try again when you have signal.");
  }
  throw new Error("Couldn't find that place. Try a full postcode, like SW1A 1AA, or a town name.");
}

export function forecastUrl(lat: number, lon: number): string {
  const p = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: "temperature_2m,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_gusts_10m_max",
    timezone: "Europe/London",
    wind_speed_unit: "mph",
    forecast_days: "7",
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

/** Turns Open-Meteo's reply into Mary Mary's own shape (so a change on their side is fixed in one place). */
export function parseForecast(j: any, place: string, now = new Date()): Forecast {
  const n = (v: unknown) => (typeof v === "number" ? v : 0);
  return {
    fetchedAt: now.toISOString(),
    place,
    current: { temp: n(j.current?.temperature_2m), code: n(j.current?.weather_code), windMph: n(j.current?.wind_speed_10m) },
    hourly: {
      time: j.hourly?.time ?? [],
      temp: (j.hourly?.temperature_2m ?? []).map(n),
      rainChance: (j.hourly?.precipitation_probability ?? []).map(n),
      code: (j.hourly?.weather_code ?? []).map(n),
    },
    daily: {
      date: j.daily?.time ?? [],
      code: (j.daily?.weather_code ?? []).map(n),
      max: (j.daily?.temperature_2m_max ?? []).map(n),
      min: (j.daily?.temperature_2m_min ?? []).map(n),
      rainChance: (j.daily?.precipitation_probability_max ?? []).map(n),
      rainMm: (j.daily?.precipitation_sum ?? []).map(n),
      gustMph: (j.daily?.wind_gusts_10m_max ?? []).map(n),
    },
  };
}

const KEY = "weather";
const FRESH_MINUTES = 60;

export async function savedForecast(): Promise<Forecast | undefined> {
  try {
    return await loadExtra<Forecast>(KEY);
  } catch {
    return undefined;
  }
}

/** The forecast for a place: the saved one if it's under an hour old, otherwise a fresh one. */
export async function getForecast(loc: Place, force = false): Promise<Forecast> {
  const saved = await savedForecast();
  const samePlace = saved && saved.place === loc.place;
  if (!force && saved && samePlace && Date.now() - Date.parse(saved.fetchedAt) < FRESH_MINUTES * 60000) return saved;
  const r = await fetch(forecastUrl(loc.lat, loc.lon));
  if (!r.ok) throw new Error(`Forecast unavailable (${r.status})`);
  const f = parseForecast(await r.json(), loc.place);
  await saveExtra(KEY, f).catch(() => undefined);
  return f;
}

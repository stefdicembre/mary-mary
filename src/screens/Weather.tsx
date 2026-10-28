import { useState } from "react";
import { todayISO } from "../lib/dates";
import { adviceFor, dayLabel, deg, describe, nightLows } from "../lib/weather";
import type { Advice, Forecast } from "../lib/weather";
import { SkyIcon } from "../icons";
import { href } from "../router";
import { useStore } from "../store";
import { BackBar } from "../ui";
import { useWeather } from "../weatherStore";

/** The current hour in the UK, as Open-Meteo writes it: "2026-10-28T14:00". */
export function londonHour(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:00`;
}

const hourWords = (t: string) => {
  const h = Number(t.slice(11, 13));
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
};

const timeWords = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)).replace(" ", "");

/** A clear sky after dark shows the moon, not the sun. */
const skyAt = (code: number, time: string) => {
  const sky = describe(code).sky;
  const h = Number(time.slice(11, 13));
  return sky === "sun" && (h >= 19 || h < 7) ? "moon" : sky;
};

const TAG_STYLE: Record<Advice["kind"], string> = {
  frost: "blue",
  rain: "blue",
  wind: "blue",
  heat: "amber",
  dry: "amber",
};

export function UrgentCard({ a, compact }: { a: Advice; compact?: boolean }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const heat = a.kind === "heat" || a.kind === "dry";
  return (
    <div className={`urgent ${heat ? "hot" : ""}`} role="alert">
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span className="urgent-badge">
          <SkyIcon sky={a.kind === "frost" ? "frost" : a.kind === "heat" ? "sun" : a.kind === "wind" ? "cloud" : "rain"} size={24} />
        </span>
        <div className="stack-sm" style={{ gap: 4 }}>
          <p className="urgent-kicker">{a.kind === "frost" ? "Frost warning" : a.kind === "heat" ? "Heat warning" : a.kind === "wind" ? "Wind warning" : "Weather"}</p>
          <p className="urgent-title">{a.title}</p>
          {!compact && <p className="urgent-text">{a.text}</p>}
        </div>
      </div>
      {!compact && a.protect && (
        <div className="urgent-list">
          {a.protect.map((p) => (
            <button key={p} type="button" className="check-row" aria-pressed={!!done[p]} onClick={() => setDone({ ...done, [p]: !done[p] })}>
              <span className={`tick ${done[p] ? "on" : ""}`} aria-hidden="true">
                {done[p] && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </span>
              <span style={done[p] ? { color: "var(--faint)", textDecoration: "line-through" } : undefined}>Protect {p}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WeatherScreen() {
  const { garden } = useStore();
  const { forecast: f, status, refresh } = useWeather();
  const today = todayISO();

  if (status === "no-place") {
    return (
      <>
        <BackBar to="#/" label="Home" />
        <h1>Weather</h1>
        <div className="card stack">
          <p className="body">Add your town or postcode in Settings and Mary Mary will show your local forecast, with frost and heatwave warnings for the garden.</p>
          <a className="btn" href={href({ page: "settings" })}>
            Add my postcode
          </a>
        </div>
      </>
    );
  }

  if (!f) {
    return (
      <>
        <BackBar to="#/" label="Home" />
        <h1>Weather</h1>
        <p className="empty">{status === "offline" ? "Couldn't get the forecast. Check you have signal, then try again." : "Getting the forecast…"}</p>
        {status === "offline" && (
          <button type="button" className="btn outline" onClick={refresh}>
            Try again
          </button>
        )}
      </>
    );
  }

  const advice = adviceFor(f, garden, today);
  const urgent = advice.filter((a) => a.urgent);
  const other = advice.filter((a) => !a.urgent);
  const nowHour = londonHour();
  const start = Math.max(0, f.hourly.time.findIndex((t) => t >= nowHour));
  const hours = [0, 3, 6, 9, 12].map((k) => start + k).filter((i) => i < f.hourly.time.length);
  const lows = new Map(nightLows(f).map((n) => [n.date, n.low]));
  const frostNights = new Set(Array.from(lows).filter(([, low]) => low <= 0).map(([d]) => d));
  const now = describe(f.current.code);

  return (
    <>
      <BackBar
        to="#/"
        label="Home"
        right={
          <button type="button" className="text-btn" onClick={refresh} disabled={status === "loading"}>
            {status === "loading" ? "Updating…" : "Refresh"}
          </button>
        }
      />

      {urgent.map((a) => (
        <UrgentCard key={a.kind} a={a} />
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span className="wx-big" aria-hidden="true">
          <SkyIcon sky={now.sky} size={50} />
        </span>
        <div className="stack-sm">
          <p className="sub">Now in {f.place}</p>
          <p className="wx-temp">{deg(f.current.temp)}C</p>
          <p className="body" style={{ margin: 0 }}>
            {now.words}
            {f.current.windMph >= 15 ? `, breezy (${Math.round(f.current.windMph)}mph)` : ""}
          </p>
        </div>
      </div>
      <p className="hint" style={{ marginTop: -8 }}>
        {status === "offline" ? `No signal, so this is the forecast from ${timeWords(f.fetchedAt)}.` : `Updated ${timeWords(f.fetchedAt)}`}
      </p>

      <div className="card wx-hours">
        {hours.map((i) => (
          <div key={f.hourly.time[i]} className="wx-hour">
            <span className="k">{i === start ? "Now" : hourWords(f.hourly.time[i])}</span>
            <SkyIcon sky={skyAt(f.hourly.code[i], f.hourly.time[i])} size={22} />
            <span className="t">{deg(f.hourly.temp[i])}</span>
            <span className="r">{Math.round(f.hourly.rainChance[i])}%</span>
          </div>
        ))}
      </div>

      <div className="stack">
        <h2>How does this affect the garden?</h2>
        {other.length === 0 && urgent.length === 0 && <p className="empty">Nothing to worry about this week. A good week to get on with the usual jobs.</p>}
        {other.map((a) => (
          <div key={a.kind} className="card" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px" }}>
            <span className={`tag ${TAG_STYLE[a.kind]}`} style={{ flex: "none", marginTop: 2 }}>
              {a.when}
            </span>
            <span className="stack-sm" style={{ gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{a.title}</span>
              <span style={{ fontSize: 13, lineHeight: 1.45, color: "var(--muted)" }}>{a.text}</span>
            </span>
          </div>
        ))}
        {urgent.length > 0 && <p className="hint">Warnings for the next day or two are at the top.</p>}
      </div>

      <div className="stack">
        <h2>The week ahead</h2>
        <div className="list">
          {f.daily.date.map((d, i) =>
            d < today ? null : (
              <div key={d} className={`wx-day ${frostNights.has(d) ? "frost" : ""}`}>
                <span className="day">{dayLabel(d, today) === "Today" ? "Today" : dayLabel(d, today) === "Tomorrow" ? "Tmrw" : dayLabel(d, today).slice(0, 3)}</span>
                <SkyIcon sky={describe(f.daily.code[i]).sky} size={22} />
                <span className="what">
                  {describe(f.daily.code[i]).words}
                  {frostNights.has(d) ? ", frost at night" : ""}
                </span>
                <span className="rain">{Math.round(f.daily.rainChance[i])}%</span>
                <span className="temps">
                  {deg(f.daily.max[i])} / {deg(lows.get(d) ?? f.daily.min[i])}
                </span>
              </div>
            ),
          )}
        </div>
        <p className="hint">
          Daytime highs and overnight lows in °C. Blue figures are the chance of rain. Forecast from{" "}
          <a href="https://open-meteo.com" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
          .
        </p>
      </div>
    </>
  );
}

/** Small round weather button for the top of Home. */
export function WeatherBadge({ f, status }: { f?: Forecast; status: string }) {
  if (status === "no-place") {
    return (
      <a href={href({ page: "settings" })} className="wx-badge" aria-label="Add your postcode for the weather">
        <span className="circle">
          <SkyIcon sky="partly" size={30} />
        </span>
        <span className="t" style={{ fontWeight: 600, fontSize: 11 }}>
          Add place
        </span>
      </a>
    );
  }
  const d = f ? describe(f.current.code) : undefined;
  return (
    <a href={href({ page: "weather" })} className="wx-badge" aria-label={f ? `Weather: ${deg(f.current.temp)}C, ${d!.words}` : "Weather"}>
      <span className="circle">{d ? <SkyIcon sky={d.sky} size={32} /> : <SkyIcon sky="partly" size={30} />}</span>
      <span className="t">{f ? `${deg(f.current.temp)}C` : "…"}</span>
    </a>
  );
}

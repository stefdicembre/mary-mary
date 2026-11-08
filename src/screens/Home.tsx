import { greeting, longDate } from "../lib/dates";
import { setbackSummary } from "../lib/reasons";
import { AreaIcon, IconCog, IconMenu, IconNext, IconPlus } from "../icons";
import { href } from "../router";
import { useStore } from "../store";
import { adviceFor } from "../lib/weather";
import { todayISO } from "../lib/dates";
import { useWeather } from "../weatherStore";
import { UrgentCard, WeatherBadge } from "./Weather";
import { JobRow, useJobs } from "./Jobs";
import { completeJob, oneQuickJob } from "../lib/jobs";
import { IconLeaf } from "../icons";
import { useState } from "react";
import { shortForJobs } from "../lib/supplies";
import { IconBox } from "../icons";

/** "The allotment" → "Allotment", to fit under the circle. */
const shortName = (n: string) => {
  const s = n.replace(/^The /i, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "Running low on fleece. You'll need it for: Wrap the banana's trunk." */
function shortText(short: ReturnType<typeof shortForJobs>): string {
  const names = short.map((x) => x.supply.name.toLowerCase());
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const allOut = short.every((x) => x.supply.level === "out");
  const jobs = Array.from(new Set(short.flatMap((x) => x.jobs.map((j) => j.title))));
  const it = names.length === 1 ? "it" : "them";
  const head = allOut ? `Out of ${list}.` : `Running low on ${list}.`;
  return jobs.length === 1 ? `${head} You'll need ${it} for: ${jobs[0]}.` : `${head} You'll need ${it} for ${jobs.length} jobs this week.`;
}

export function Home() {
  const { garden, saveError, update } = useStore();
  const jobs = useJobs();
  const [gentle, setGentle] = useState<"closed" | "open" | "done">("closed");
  const [skipped, setSkipped] = useState<string[]>([]);
  const quick = oneQuickJob(jobs.thisWeek, skipped);
  const { forecast, status } = useWeather();
  const urgent = forecast ? adviceFor(forecast, garden, todayISO()).filter((a) => a.urgent) : [];
  const now = new Date();
  const short = shortForJobs(garden, jobs.thisWeek);
  const struggling = garden.plants.filter((p) => p.status === "struggling");
  const areaName = (id: string) => garden.areas.find((a) => a.id === id)?.name ?? "";
  const latestSetback = (plantId: string) =>
    garden.setbacks.filter((s) => s.plantId === plantId).sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <>
      <div className="topbar">
        <a className="icon-btn" href={href({ page: "menu" })} aria-label="Menu">
          <IconMenu />
        </a>
        <a className="icon-btn" href={href({ page: "settings" })} aria-label="Settings">
          <IconCog />
        </a>
      </div>

      <div className="row" style={{ alignItems: "center" }}>
        <div className="stack-sm" style={{ minWidth: 0 }}>
          <h1>Mary Mary</h1>
          <p className="sub">{garden.settings.gardenName}</p>
        </div>
        <WeatherBadge f={forecast} status={status} />
      </div>

      <div className="stack-sm">
        <h2 style={{ fontSize: 20 }}>{greeting(now)}</h2>
        <p className="sub">{longDate(now)}</p>
      </div>

      {urgent.map((a) => (
        <a key={a.kind} href={href({ page: "weather" })} style={{ textDecoration: "none" }}>
          <UrgentCard a={a} compact />
        </a>
      ))}

      {saveError && (
        <div className="panel-amber" role="alert">
          <p>Mary Mary couldn't save your last change on this phone. Try again, and save a backup from Settings.</p>
        </div>
      )}

      {quick && gentle === "closed" && (
        <div className="gentle">
          <span className="icon" aria-hidden="true">
            <IconLeaf size={20} />
          </span>
          <div className="stack-sm" style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>One thing at a time</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>One small job. No lists, no pressure.</p>
          </div>
          <button type="button" className="btn outline small" onClick={() => setGentle("open")}>
            Let's go
          </button>
        </div>
      )}
      {quick && gentle === "open" && (
        <div className="gentle" style={{ alignItems: "flex-start" }}>
          <span className="icon" aria-hidden="true">
            <IconLeaf size={20} />
          </span>
          <div className="stack-sm" style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{quick.title}</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
              {quick.where}
              {quick.minutes ? ` · about ${quick.minutes} min` : ""}
            </p>
            <div className="btn-row" style={{ marginTop: 6 }}>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  update((g) => completeJob(g, quick, jobs.today)[0], "Done. Lovely work.", true);
                  setGentle("done");
                }}
              >
                Done
              </button>
              <button type="button" className="btn quiet" style={{ minHeight: 40 }} onClick={() => setSkipped([...skipped, quick.key])}>
                Something else
              </button>
            </div>
          </div>
        </div>
      )}
      {gentle === "done" && (
        <div className="gentle">
          <span className="icon" aria-hidden="true">
            <IconLeaf size={20} />
          </span>
          <p style={{ margin: 0, fontSize: 14, flex: 1 }}>That's it. Have a look at this week's jobs if you're in the mood for more.</p>
        </div>
      )}

      <div className="stack">
        <div className="row">
          <p className="label">This week's jobs</p>
          <a href={href({ page: "jobs" })} className="text-btn" style={{ textDecoration: "none", minHeight: 32, display: "flex", alignItems: "center" }}>
            See all ({jobs.thisWeek.length})
          </a>
        </div>
        {jobs.thisWeek.length === 0 ? (
          <p className="empty">All done for this week. Lovely work.</p>
        ) : (
          <div className="list">
            {jobs.thisWeek.slice(0, 3).map((j) => (
              <JobRow key={j.key} job={j} compact />
            ))}
          </div>
        )}
        {short.length > 0 && (
          <a className="short-note" href={href({ page: "supplies" })}>
            <IconBox />
            <p>{shortText(short)}</p>
          </a>
        )}
      </div>

      {struggling.length > 0 && (
        <div className="stack">
          <p className="label">Needs a look</p>
          <div className="list">
            {struggling.map((p) => {
              const s = latestSetback(p.id);
              const why = s ? setbackSummary(s) : "";
              return (
                <a key={p.id} className="list-item" href={href({ page: "plant", id: p.id })}>
                  <span className="grow">
                    <span className="title">{p.name}</span>
                    <span className="meta">{areaName(p.areaId)}</span>
                    <span className="mark-struggle">Struggling{why ? ` · ${why}` : ""}</span>
                  </span>
                  <IconNext />
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="stack">
        <div className="row">
          <p className="label">Our garden</p>
          <a href={href({ page: "map" })} className="text-btn" style={{ textDecoration: "none", minHeight: 32, display: "flex", alignItems: "center" }}>
            See the map
          </a>
        </div>
        <div className="areas">
          {garden.areas.map((a) => {
            const flagged = garden.plants.some((p) => p.areaId === a.id && p.status === "struggling");
            return (
              <a key={a.id} className="area-tile" href={href({ page: "area", id: a.id })}>
                <span className="circle">
                  <AreaIcon kind={a.kind} />
                  {flagged && <span className="dot" title="Something here is struggling" />}
                </span>
                <span className="name">{shortName(a.name)}</span>
              </a>
            );
          })}
          <a className="area-tile" href={href({ page: "newArea" })}>
            <span className="circle add">
              <IconPlus size={22} />
            </span>
            <span className="name">Add area</span>
          </a>
        </div>
        {garden.areas.length === 0 && (
          <p className="empty">Start by adding the parts of your garden: a border, the pots, the greenhouse.</p>
        )}
      </div>
    </>
  );
}

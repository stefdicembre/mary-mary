import { useState } from "react";
import { deletePlant, markRecovered, updatePlant } from "../lib/actions";
import { shortDate, todayISO } from "../lib/dates";
import { amountText, isEdible, plantHarvests, totalText } from "../lib/harvest";
import { andList, neighbours, positionWords, spotName, whereIs } from "../lib/layout";
import { lessonFor, setbackSummary } from "../lib/reasons";
import { go, href } from "../router";
import { useStore } from "../store";
import { BackBar, NotFound } from "../ui";

const SOURCE_WORDS: Record<string, string> = {
  seed: "Grown from seed",
  plug: "Plug plant",
  cutting: "Cutting",
  shop: "Bought",
  gift: "Gift",
};

const OUTCOME_TITLES = { struggling: "Struggling", died: "Didn't make it", removed: "Pulled out" } as const;

export function PlantPage({ id }: { id: string }) {
  const { garden, update } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const plant = garden.plants.find((p) => p.id === id);
  if (!plant) return <NotFound what="plant" />;

  const area = garden.areas.find((a) => a.id === plant.areaId);
  const history = garden.setbacks.filter((s) => s.plantId === id).sort((a, b) => b.date.localeCompare(a.date));
  const areaName = (aid: string) => garden.areas.find((a) => a.id === aid)?.name ?? "";
  const lessons = Array.from(
    new Set(history.flatMap((s) => s.reasons.filter((r) => r !== "dontKnow").map((r) => lessonFor(r, s.details[r])))),
  ).filter(Boolean);

  return (
    <>
      <BackBar
        to={area ? href({ page: "area", id: area.id }) : "#/"}
        label={area?.name ?? "Home"}
        right={
          <a className="text-btn" href={href({ page: "editPlant", id })} style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            Edit
          </a>
        }
      />

      <div className="stack-sm">
        <h1 style={{ fontSize: 24, color: "var(--ink)" }}>
          {plant.name}
          {plant.variety ? ` '${plant.variety}'` : ""}
        </h1>
        {plant.latinName && <p className="sub" style={{ fontStyle: "italic" }}>{plant.latinName}</p>}
        <p className="sub">
          {plant.section} · {area?.name}
        </p>
      </div>

      <div>
        {plant.status === "growing" && <span className="tag green">{plant.doesWell ? "Does well here" : "Growing"}</span>}
        {plant.status === "struggling" && <span className="tag amber">Struggling</span>}
        {plant.status === "lost" && <span className="tag amber">Didn't make it{plant.lostOn ? `, ${shortDate(plant.lostOn)}` : ""}</span>}
      </div>

      {(plant.plantedOn || plant.source || plant.notes) && (
        <div className="card stack" style={{ gap: 6 }}>
          {plant.plantedOn && <p className="body">Planted {shortDate(plant.plantedOn)}</p>}
          {plant.source && <p className="body">{SOURCE_WORDS[plant.source]}</p>}
          {plant.notes && <p className="body">{plant.notes}</p>}
        </div>
      )}

      {plant.status !== "lost" && (
        <div className="stack">
          <h2>How does it do here?</h2>
          <div className="chips">
            <button
              type="button"
              className="chip"
              aria-pressed={plant.status === "growing" && !!plant.doesWell}
              onClick={() =>
                update(
                  (g) => (plant.status === "struggling" ? updatePlant(markRecovered(g, id), id, { doesWell: true }) : updatePlant(g, id, { doesWell: !plant.doesWell })),
                  plant.doesWell ? undefined : "Marked as doing well here",
                )
              }
            >
              Does well here
            </button>
            <a className="chip" href={href({ page: "setback", id, outcome: "struggling" })} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }} aria-pressed={plant.status === "struggling"}>
              Not doing well
            </a>
            <a className="chip" href={href({ page: "setback", id, outcome: "died" })} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              Didn't make it
            </a>
          </div>
          {plant.status === "struggling" && (
            <button type="button" className="btn outline" onClick={() => update((g) => markRecovered(g, id), `Lovely, ${plant.name} has perked up`, true)}>
              It's perked up
            </button>
          )}
        </div>
      )}

      {plant.status === "lost" && (
        <div className="stack">
          <p className="body">It's kept in "Didn't make it" with its history, so Mary Mary can learn from it.</p>
          <button type="button" className="btn outline" onClick={() => update((g) => markRecovered(g, id), `${plant.name} is back in ${area?.name ?? "the garden"}`, true)}>
            It came back after all
          </button>
        </div>
      )}

      {area && (() => {
        const where = whereIs(garden, id);
        const lost = plant.status === "lost";
        if (!where && lost) return null;
        const to = href({ page: "bedPlan", areaId: area.id, plantId: id });
        if (!where) {
          return (
            <div className="stack">
              <h2>Where it is</h2>
              <div className="card stack" style={{ gap: 6 }}>
                <p className="body">It isn't on the bed plan for {area.name} yet.</p>
                <p className="hint">Handy in winter, when it's died back and you can't see it.</p>
                <a className="btn outline small" href={to} style={{ alignSelf: "flex-start" }}>
                  Give it a square
                </a>
              </div>
            </div>
          );
        }
        const { plan, spot } = where;
        const taken = new Set(plan.spots.map((s) => `${s.x},${s.y}`));
        const next = neighbours(garden, area.id, spot.x, spot.y).map((s) => spotName(garden, s)).filter(Boolean);
        const shown = next.slice(0, 3);
        const more = next.length - shown.length;
        const cells = [];
        for (let y = 0; y < plan.rows; y++)
          for (let x = 0; x < plan.cols; x++) {
            const me = x === spot.x && y === spot.y;
            cells.push(<i key={`${x},${y}`} className={me ? `me${lost ? " lost" : ""}` : taken.has(`${x},${y}`) ? "taken" : undefined} />);
          }
        return (
          <div className="stack">
            <h2>Where it {lost ? "was" : "is"}</h2>
            <a className="card where-card" href={to} aria-label={`See ${plant.name} on the ${area.name} bed plan`}>
              <span className="mini-bed" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${plan.cols}, 1fr)` }}>
                {cells}
              </span>
              <span className="stack">
                <span className="body" style={{ fontWeight: 600 }}>
                  {(() => {
                    const w = positionWords(plan, spot.x, spot.y);
                    return lost ? `Was ${w}` : w.charAt(0).toUpperCase() + w.slice(1);
                  })()}{" "}
                  of {area.name}
                </span>
                {shown.length > 0 && (
                  <span className="hint">
                    Next to {andList(more > 0 ? [...shown, `${more} more`] : shown)}
                  </span>
                )}
                <span className="hint" style={{ color: "var(--green)", fontWeight: 600 }}>See it on the bed plan ›</span>
              </span>
            </a>
          </div>
        );
      })()}

      {(isEdible(plant) || garden.harvests.some((h) => h.plantId === id)) && (() => {
        const year = Number(todayISO().slice(0, 4));
        const picks = plantHarvests(garden, id, year);
        const grams = picks.reduce((n, h) => n + (h.grams ?? 0), 0);
        const count = picks.reduce((n, h) => n + (h.count ?? 0), 0);
        return (
          <div className="stack">
            <h2>Harvest</h2>
            <div className="card stack" style={{ gap: 6 }}>
              {picks.length === 0 ? (
                <p className="body">Nothing picked from it yet this year.</p>
              ) : (
                <>
                  <p className="body" style={{ fontWeight: 600 }}>{totalText({ times: picks.length, count, grams })} this year</p>
                  <p className="hint">
                    Last picked {shortDate(picks[0].date)}
                    {amountText(picks[0]) ? `: ${amountText(picks[0]).toLowerCase()}` : ""}
                  </p>
                </>
              )}
              <div className="btn-row" style={{ marginTop: 4 }}>
                {plant.status !== "lost" && (
                  <a className="btn outline small" href={href({ page: "harvestNew", plantId: id })}>
                    + I picked some
                  </a>
                )}
                {garden.harvests.length > 0 && (
                  <a className="btn quiet" href={href({ page: "harvest" })} style={{ flex: "none" }}>
                    Harvest log
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {history.length > 0 && (
        <div className="stack">
          <h2>What's happened</h2>
          <div className="history">
            {history.map((s) => {
              const why = setbackSummary(s);
              return (
                <div key={s.id} className="item">
                  <span className="when">
                    {shortDate(s.date)}
                    {s.areaId !== plant.areaId && areaName(s.areaId) ? ` · in ${areaName(s.areaId)}` : ""}
                  </span>
                  <span className="what">
                    {OUTCOME_TITLES[s.outcome]}
                    {why ? `: ${why}` : ""}
                  </span>
                  {s.inOwnWords && <span className="words">"{s.inOwnWords}"</span>}
                </div>
              );
            })}
          </div>
          {lessons.length > 0 && (
            <div className="panel-green">
              <p className="k">Tips for next time</p>
              {lessons.map((l) => (
                <p key={l} className="v">
                  {l}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="btn-row">
        <a className="btn outline small" href={href({ page: "diaryNew", plantId: id })}>
          + Add to the diary
        </a>
        {garden.journal.some((j) => j.plantIds.includes(id)) && (
          <a className="btn quiet" href={href({ page: "diary", plantId: id })} style={{ flex: "none" }}>
            See its diary ({garden.journal.filter((j) => j.plantIds.includes(id)).length})
          </a>
        )}
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        {!confirmDelete ? (
          <button type="button" className="btn quiet" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setConfirmDelete(true)}>
            Added by mistake? Delete it
          </button>
        ) : (
          <div className="card stack">
            <p className="body">
              Delete {plant.name} completely, with its history? If it died, use "Didn't make it" instead so Mary Mary can learn from it.
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  update((g) => deletePlant(g, id), `${plant.name} deleted`, true);
                  go(area ? { page: "area", id: area.id } : { page: "home" }, true);
                }}
              >
                Delete
              </button>
              <button type="button" className="btn quiet" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

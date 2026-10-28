import { useState } from "react";
import { deletePlant, markRecovered, updatePlant } from "../lib/actions";
import { shortDate } from "../lib/dates";
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
                  (g) => (plant.status === "struggling" ? updatePlant(markRecovered(g, id), { doesWell: true }) : updatePlant(g, id, { doesWell: !plant.doesWell })),
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

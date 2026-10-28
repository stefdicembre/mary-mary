import { useState } from "react";
import { plantPlanned, removePlanned } from "../lib/actions";
import { todayISO } from "../lib/dates";
import { AREA_KINDS, SECTIONS } from "../lib/data";
import { shortDate } from "../lib/dates";
import { reasonLabel, setbackSummary } from "../lib/reasons";
import type { ReasonKey } from "../lib/types";
import { AreaIcon, IconNext, IconPlus } from "../icons";
import { href } from "../router";
import { useStore } from "../store";
import { BackBar, NotFound } from "../ui";
import { aspectText } from "./AreaForm";
import { COLOUR_SCHEMES } from "../lib/data";

export function AreaPage({ id }: { id: string }) {
  const { garden, update } = useStore();
  const [showLost, setShowLost] = useState(false);
  const area = garden.areas.find((a) => a.id === id);
  if (!area) return <NotFound what="area" />;

  const here = garden.plants.filter((p) => p.areaId === id);
  const planned = garden.planned.filter((p) => p.areaId === id).sort((a, b) => (a.plantMonth ?? 13) - (b.plantMonth ?? 13));
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const growing = here.filter((p) => p.status !== "lost");
  const lost = here.filter((p) => p.status === "lost");
  const setbacksHere = garden.setbacks.filter((s) => s.areaId === id);
  const latest = (plantId: string) =>
    garden.setbacks.filter((s) => s.plantId === plantId).sort((a, b) => b.date.localeCompare(a.date))[0];

  // Sections in the usual order, then any custom ones.
  const used = Array.from(new Set(growing.map((p) => p.section)));
  const order = [...SECTIONS.filter((s) => used.includes(s)), ...used.filter((s) => !SECTIONS.includes(s))];

  // "This bed: 3 setbacks, 2 from too wet"
  const counts = new Map<string, number>();
  for (const s of setbacksHere) {
    for (const r of s.reasons) {
      if (r === "dontKnow") continue;
      const label = reasonLabel(r as ReasonKey, s.details[r as ReasonKey]);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const topReasons = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, n]) => `${n} from ${label.toLowerCase()}`);

  return (
    <>
      <BackBar
        to="#/"
        label="Home"
        right={
          <a className="text-btn" href={href({ page: "editArea", id })} style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            Edit
          </a>
        }
      />

      <div className="hero" aria-hidden="true">
        <AreaIcon kind={area.kind} size={84} />
      </div>

      <div className="stack-sm">
        <h1>{area.name}</h1>
        <p className="sub">
          {AREA_KINDS.find((k) => k.kind === area.kind)?.label}
          {area.colours ? ` · ${COLOUR_SCHEMES.find((c) => c.value === area.colours)?.label}` : ""}
        </p>
      </div>

      <div className="facts">
        <div className="fact">
          <p className="k">Aspect</p>
          <p className="v">{aspectText(area.aspect)}</p>
        </div>
        <div className="fact">
          <p className="k">Soil</p>
          <p className="v">{area.soil ?? "Not set"}</p>
        </div>
        <div className="fact">
          <p className="k">Plants</p>
          <p className="v">{growing.length}</p>
        </div>
      </div>

      <div className="stack">
        <div className="row">
          <h2>What's growing here</h2>
          <a className="btn outline small" href={href({ page: "newPlant", areaId: id })}>
            <IconPlus size={16} />
            Add a plant
          </a>
        </div>
        {growing.length === 0 && <p className="empty">Nothing planted here yet. Tap Add a plant whenever you're ready.</p>}
        {order.map((section) => (
          <div key={section} className="stack" style={{ gap: 6 }}>
            <p className="label" style={{ fontSize: 12 }}>
              {section}
            </p>
            <div className="list">
              {growing
                .filter((p) => p.section === section)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => {
                  const s = p.status === "struggling" ? latest(p.id) : undefined;
                  const why = s ? setbackSummary(s) : "";
                  return (
                    <a key={p.id} className="list-item" href={href({ page: "plant", id: p.id })}>
                      <span className="grow">
                        <span className="title">
                          {p.name}
                          {p.variety ? ` '${p.variety}'` : ""}
                        </span>
                        {p.notes && <span className="meta">{p.notes}</span>}
                        {p.status === "struggling" && <span className="mark-struggle">Struggles here{why ? ` · ${why}` : ""}</span>}
                        {p.status === "growing" && p.doesWell && <span className="mark-well">Does well here</span>}
                      </span>
                      <IconNext />
                    </a>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {planned.length > 0 && (
        <div className="stack">
          <h2>Planned</h2>
          <div className="list">
            {planned.map((p) => (
              <div key={p.id} className="list-item" style={{ flexWrap: "wrap" }}>
                <span className="grow">
                  <span className="title">{p.name}</span>
                  <span className="meta">{p.plantMonth ? `Plant in ${MONTHS[p.plantMonth - 1]}` : p.section}</span>
                </span>
                <button type="button" className="btn small" onClick={() => update((g) => plantPlanned(g, p.id, todayISO()), `${p.name} planted. Lovely.`, true)}>
                  Planted it
                </button>
                <button type="button" className="btn quiet" style={{ minHeight: 40 }} aria-label={`Remove ${p.name} from planned`} onClick={() => update((g) => removePlanned(g, p.id), `${p.name} taken off the plan`, true)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <a className="btn outline full" href={href({ page: "plan", areaId: id })}>
        Suggest a planting plan
      </a>

      {setbacksHere.length > 0 && (
        <div className="panel-amber">
          <p style={{ fontWeight: 700 }}>Learned here</p>
          <p>
            {setbacksHere.length} {setbacksHere.length === 1 ? "setback" : "setbacks"} so far
            {topReasons.length ? `: ${topReasons.join(", ")}` : ""}. Worth bearing in mind when choosing plants for {area.name}.
          </p>
        </div>
      )}

      {lost.length > 0 && (
        <div className="stack">
          <button type="button" className="btn quiet" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setShowLost(!showLost)} aria-expanded={showLost}>
            {showLost ? "Hide" : "Show"} what didn't make it here ({lost.length})
          </button>
          {showLost && (
            <div className="list">
              {lost.map((p) => {
                const s = latest(p.id);
                return (
                  <a key={p.id} className="list-item" href={href({ page: "plant", id: p.id })}>
                    <span className="grow">
                      <span className="title">{p.name}</span>
                      <span className="meta">
                        {shortDate(p.lostOn)}
                        {s && setbackSummary(s) ? ` · ${setbackSummary(s)}` : ""}
                      </span>
                    </span>
                    <IconNext />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      {area.notes && (
        <div className="panel-green">
          <p className="k">Plans and notes</p>
          <p className="v">{area.notes}</p>
        </div>
      )}
    </>
  );
}

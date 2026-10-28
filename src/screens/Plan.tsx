import { useState } from "react";
import { addPlanned, notForMe, removePlanned, updateArea } from "../lib/actions";
import { COLOUR_SCHEMES } from "../lib/data";
import { todayISO } from "../lib/dates";
import { PRIORITIES, lessonsFor, makePlan, monthRanges } from "../lib/plan";
import type { Goal, Priority } from "../lib/plan";
import { href } from "../router";
import { useStore } from "../store";
import { BackBar, Chips, NotFound } from "../ui";
import { aspectText } from "./AreaForm";

const SOILS: Array<[string, string]> = [
  ["Sandy", "Gritty and light. Drains quickly, so it can dry out in summer."],
  ["Clay", "Sticky when wet and hard when dry. Holds on to water and goodness."],
  ["Chalky", "Pale and stony, often with white lumps. Drains quickly."],
  ["Loam", "Dark and crumbly, and easy to dig. A gardener's favourite."],
  ["Not sure", "That's fine. Squeeze a handful of damp soil: a sticky lump is probably clay, gritty and loose is probably sandy, and soft crumbs are probably loam."],
];

const SWATCH: Record<string, string> = {
  orange: "#E8742A", red: "#C8361F", yellow: "#EFB927", "pale-yellow": "#F4E39A", pink: "#E59AB4", purple: "#6C3F9E",
  lilac: "#B49ACF", blue: "#4F79C7", white: "#FFFFFF", green: "#7BA84A", bronze: "#9A5B2A",
};

export function PlanScreen({ areaId }: { areaId: string }) {
  const { garden, update } = useStore();
  const area = garden.areas.find((a) => a.id === areaId);
  const [view, setView] = useState<"ask" | "result">("ask");
  const [goal, setGoal] = useState<Goal | undefined>();
  const [soil, setSoil] = useState<string | undefined>(area?.soil === "Loamy" ? "Loam" : area?.soil);
  const [prios, setPrios] = useState<Priority[]>([]);
  if (!area) return <NotFound what="area" />;

  const lessons = lessonsFor(garden, area.id);
  const growing = garden.plants.filter((p) => p.areaId === area.id && p.status !== "lost");
  const learned: string[] = [];
  if (lessons.wind) learned.push("wind has caused trouble here");
  if (lessons.wet) learned.push("it can get too wet");
  if (lessons.dry) learned.push("it can get too dry");
  if (lessons.frost) learned.push("frost has caught plants here");
  if (lessons.heat) learned.push("plants have scorched here");
  if (lessons.slugs) learned.push("slugs are a problem");
  const scheme = COLOUR_SCHEMES.find((c) => c.value === area.colours);
  const today = todayISO();
  const month = Number(today.slice(5, 7));

  if (view === "ask") {
    return (
      <>
        <BackBar to={href({ page: "area", id: area.id })} label={area.name} />
        <div className="stack-sm">
          <h1>Planting plan</h1>
          <p className="body">Mary Mary already knows a bit about {area.name}, so there are just a couple of questions.</p>
        </div>

        <div className="card stack" style={{ gap: 8 }}>
          <p className="label">What Mary Mary knows</p>
          <div className="knows">
            <span className="k">Faces</span>
            <span className="v">{area.aspect ? aspectText(area.aspect) : "Not set yet"}</span>
            <span className="k">Colours</span>
            <span className="v">{scheme ? scheme.label : "Not set yet"}</span>
            {learned.length > 0 && (
              <>
                <span className="k">Learned</span>
                <span className="v">{learned.join("; ").replace(/^./, (c) => c.toUpperCase())}</span>
              </>
            )}
            <span className="k">Growing</span>
            <span className="v">{growing.length ? growing.slice(0, 5).map((p) => p.name).join(", ") + (growing.length > 5 ? " and more" : "") : "Nothing recorded yet"}</span>
          </div>
          {(!area.aspect || !area.colours) && (
            <a href={href({ page: "editArea", id: area.id })} className="hint" style={{ color: "var(--green)", fontWeight: 600 }}>
              Add {!area.aspect ? "which way it faces" : ""}
              {!area.aspect && !area.colours ? " and " : ""}
              {!area.colours ? "a colour scheme" : ""} for better suggestions
            </a>
          )}
        </div>

        <div className="stack">
          <h2>What would you like?</h2>
          <button type="button" className="goal" aria-pressed={goal === "gaps"} onClick={() => setGoal("gaps")}>
            <span className="t">Fill the gaps</span>
            <span className="s">Keep everything as it is and add a few plants where it goes quiet.</span>
          </button>
          <button type="button" className="goal" aria-pressed={goal === "refresh"} onClick={() => setGoal("refresh")}>
            <span className="t">Give it a refresh</span>
            <span className="s">A bigger plan with some new ideas, planted a little at a time over the year. Nothing is removed without asking.</span>
          </button>
        </div>

        <div className="field">
          <span className="flabel">
            Do you know the soil? <span className="optional">(optional)</span>
          </span>
          <Chips label="Soil" options={SOILS.map(([s]) => ({ value: s, label: s }))} value={soil} onChange={setSoil} />
          <p className="hint">{SOILS.find(([s]) => s === soil)?.[1] ?? "Plenty of people don't know, and that's fine. Mary Mary will choose plants that cope with most soils."}</p>
        </div>

        <div className="field">
          <span className="flabel">
            What matters most this time? <span className="optional">(optional)</span>
          </span>
          <div className="chips" role="group" aria-label="What matters most">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                className="chip"
                aria-pressed={prios.includes(p.value)}
                onClick={() => setPrios(prios.includes(p.value) ? prios.filter((x) => x !== p.value) : [...prios, p.value])}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="btn full"
          disabled={!goal}
          onClick={() => {
            if (soil && soil !== "Not sure" && soil !== area.soil) update((g) => updateArea(g, area.id, { soil }));
            setView("result");
            window.scrollTo(0, 0);
          }}
        >
          {goal ? "Show me a plan" : "Choose an option above"}
        </button>
      </>
    );
  }

  const plan = makePlan(garden, area, { goal: goal!, soil, priorities: prios, month });
  const plannedIds = new Map(garden.planned.filter((p) => p.areaId === area.id && p.catalogueId).map((p) => [p.catalogueId!, p.id]));
  const total = plan.groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <BackBar to={href({ page: "area", id: area.id })} label={area.name} right={<button type="button" className="text-btn" onClick={() => setView("ask")}>Change my answers</button>} />
      <div className="stack-sm">
        <h1>{goal === "refresh" ? "A fresh look, a little at a time" : "A few plants to fill the gaps"}</h1>
        <p className="body">
          {goal === "refresh"
            ? "Planted in stages so you never have too much to do. Everything already here stays unless you say."
            : "Small additions to keep things going through the year."}{" "}
          {plan.soilNote}
        </p>
      </div>

      {lessons.wind > 0 && (
        <div className="panel-green">
          <p className="k">Learned from last time</p>
          <p className="v">Wind has caused trouble in {area.name}, so sturdy plants that don't need staking come first. Look for "Copes with wind".</p>
        </div>
      )}
      {plan.leftOut.length > 0 && <p className="hint">Left out: {plan.leftOut.join("; ")}.</p>}

      {total === 0 && (
        <p className="empty">
          Mary Mary hasn't got anything new to suggest for {area.name} right now. Try "Give it a refresh", or change the colour scheme on the area page.
        </p>
      )}

      {plan.groups.map((grp) => (
        <div key={grp.key} className="stack">
          <div className="stack-sm">
            <h2>{grp.title}</h2>
            <p className="sub">{grp.sub}</p>
          </div>
          {grp.items.map((s) => {
            const plannedId = plannedIds.get(s.plant.id);
            const dismissed = garden.notForMe.includes(`${area.id}:${s.plant.id}`);
            return (
              <div key={s.plant.id} className="sugg">
                <div className="name">
                  <span className="swatch" style={{ background: SWATCH[s.plant.colours[0]] ?? "#ccc" }} aria-hidden="true" />
                  <span>
                    {s.plant.name}
                    {s.plant.latin && !s.plant.name.includes(s.plant.latin) && <span className="latin"> {s.plant.latin}</span>}
                  </span>
                </div>
                {dismissed ? (
                  <p className="why">Noted. Mary Mary won't suggest {s.plant.name} for {area.name} again.</p>
                ) : (
                  <>
                    <p className="why">
                      {s.plant.why}
                      {s.plant.flowers ? ` Flowers ${s.plant.flowers}.` : ""}
                    </p>
                    {(s.tags.length > 0 || s.plant.plant.length) && (
                      <div className="tags">
                        <span className="tag amber">Plant {monthRanges(s.plant.plant)}</span>
                        {s.tags.map((t) => (
                          <span key={t} className="tag green">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div className="btn-row" style={{ marginTop: 2 }}>
                  {dismissed ? (
                    <button type="button" className="btn quiet" style={{ padding: 0 }} onClick={() => update((g) => notForMe(g, area.id, s.plant.id, true))}>
                      Undo
                    </button>
                  ) : plannedId ? (
                    <>
                      <span className="tag green" style={{ fontSize: 13, padding: "8px 12px" }}>
                        Planned
                      </span>
                      <button type="button" className="btn quiet" onClick={() => update((g) => removePlanned(g, plannedId))}>
                        Undo
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() =>
                          update(
                            (g) => addPlanned(g, { areaId: area.id, catalogueId: s.plant.id, name: s.plant.name, section: s.plant.section, plantMonth: s.month }, today),
                            `${s.plant.name} added to your plans`,
                          )
                        }
                      >
                        Add to planned
                      </button>
                      <button type="button" className="btn quiet" onClick={() => update((g) => notForMe(g, area.id, s.plant.id))}>
                        Not for me
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {total > 0 && (
        <button
          type="button"
          className="btn outline full"
          onClick={() =>
            update((g) => {
              let next = g;
              for (const grp of plan.groups)
                for (const s of grp.items)
                  if (!next.notForMe.includes(`${area.id}:${s.plant.id}`))
                    next = addPlanned(next, { areaId: area.id, catalogueId: s.plant.id, name: s.plant.name, section: s.plant.section, plantMonth: s.month }, today);
              return next;
            }, "All added to your plans")
          }
        >
          Add them all to planned
        </button>
      )}
      <a className="btn full" href={href({ page: "area", id: area.id })}>
        Back to {area.name}
      </a>
      <p className="hint">Suggestions come from Mary Mary's own list of reliable plants for UK gardens. Timings are general advice for most of England and Wales, so check the label too.</p>
    </>
  );
}

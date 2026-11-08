// The garden map (where everything is) and bed plans (what's planted where in each area).

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  addFeature,
  bedPlanFor,
  boxOf,
  clampBox,
  FEATURES,
  MAP_MAX,
  MAP_MIN,
  BED_MAX,
  BED_MIN,
  NORTH_DEGREES,
  nudge,
  placeAllAreas,
  placeArea,
  placeInBed,
  removeFromBed,
  removeFromMap,
  renameFeature,
  setBedSize,
  setBox,
  setMapSize,
  shortLabel,
  turn,
  turnNorth,
} from "../lib/layout";
import type { BedItem, MapRef } from "../lib/layout";
import type { AreaKind, Box, FeatureKind } from "../lib/types";
import { href } from "../router";
import { useStore } from "../store";
import { BackBar, NotFound } from "../ui";

const AREA_FILL: Record<AreaKind, string> = {
  border: "#d9eac4",
  bed: "#e8d9bf",
  pots: "#efdcc8",
  greenhouse: "#dcedf3",
  veg: "#dccaa6",
  water: "#c3def0",
  lawn: "#cfe6b2",
  other: "#e6e4dc",
};

const FEATURE_FILL: Record<FeatureKind, string> = {
  house: "#c9c4b8",
  shed: "#bba98f",
  patio: "#dcd8ce",
  path: "#ebe4d3",
  tree: "#a8cb85",
  compost: "#a28c6c",
  other: "#e6e4dc",
};

const refKey = (r: MapRef) => ("areaId" in r ? `a:${r.areaId}` : `f:${r.featureId}`);

function pct(b: Box, w: number, l: number) {
  return { left: `${(b.x / w) * 100}%`, top: `${(b.y / l) * 100}%`, width: `${(b.w / w) * 100}%`, height: `${(b.h / l) * 100}%` };
}

function NorthArrow({ north, onTurn }: { north: keyof typeof NORTH_DEGREES; onTurn?: () => void }) {
  const inner = (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" style={{ transform: `rotate(${NORTH_DEGREES[north]}deg)` }}>
      <circle cx="17" cy="17" r="16" fill="#fff" stroke="#b4b2a9" />
      <path d="M17 5l5 12h-10z" fill="#27500A" />
      <path d="M17 29l-5-12h10z" fill="#d3d1c7" />
    </svg>
  );
  const label = `North is ${north === "up" ? "at the top" : north === "down" ? "at the bottom" : `to the ${north}`}`;
  return onTurn ? (
    <button type="button" className="north" onClick={onTurn} aria-label={`${label}. Tap to turn`}>
      {inner}
      <span>N</span>
    </button>
  ) : (
    <span className="north" role="img" aria-label={label}>
      {inner}
      <span>N</span>
    </span>
  );
}

// ── The whole-garden map ─────────────────────────────────────────

export function MapScreen() {
  const { garden, update } = useStore();
  const m = garden.map;
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState<MapRef | null>(null);
  const [draft, setDraft] = useState<{ key: string; box: Box } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  const onMap = garden.areas.filter((a) => m.areas[a.id]);
  const offMap = garden.areas.filter((a) => !m.areas[a.id]);
  const nothingYet = onMap.length === 0 && m.features.length === 0;
  const selBox = sel ? boxOf(m, sel) : undefined;
  const selName = sel
    ? "areaId" in sel
      ? garden.areas.find((a) => a.id === sel.areaId)?.name
      : m.features.find((f) => f.id === sel.featureId)?.label
    : undefined;

  function drag(e: ReactPointerEvent<HTMLElement>, ref: MapRef, mode: "move" | "size") {
    const start = boxOf(m, ref);
    if (!start || !grid.current) return;
    e.preventDefault();
    e.stopPropagation();
    const cell = grid.current.getBoundingClientRect().width / m.width;
    const [sx, sy] = [e.clientX, e.clientY];
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    let box = start;
    const move = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - sx) / cell);
      const dy = Math.round((ev.clientY - sy) / cell);
      box = clampBox(
        mode === "move" ? { ...start, x: start.x + dx, y: start.y + dy } : { ...start, w: start.w + dx, h: start.h + dy },
        m.width,
        m.length,
      );
      setDraft({ key: refKey(ref), box });
    };
    const end = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      setDraft(null);
      if (box.x !== start.x || box.y !== start.y || box.w !== start.w || box.h !== start.h) update((g) => setBox(g, ref, box));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  const shapes = [
    ...m.features.map((f) => ({ ref: { featureId: f.id } as MapRef, box: f as Box, name: f.label, fill: FEATURE_FILL[f.kind], round: f.kind === "tree", area: undefined as string | undefined, flagged: false })),
    ...onMap.map((a) => ({
      ref: { areaId: a.id } as MapRef,
      box: m.areas[a.id],
      name: a.name,
      fill: AREA_FILL[a.kind],
      round: false,
      area: a.id,
      flagged: garden.plants.some((p) => p.areaId === a.id && p.status === "struggling"),
    })),
  ];

  return (
    <>
      <BackBar
        to="#/"
        label="Home"
        right={
          !nothingYet && (
            <button
              type="button"
              className={editing ? "btn small" : "btn outline small"}
              onClick={() => {
                setEditing(!editing);
                setSel(null);
              }}
            >
              {editing ? "Done" : "Move things"}
            </button>
          )
        }
      />
      <div className="stack-sm">
        <h1>Garden map</h1>
        <p className="sub">
          {editing ? "Tap something, then drag it, or use the buttons below." : `About ${m.width} m × ${m.length} m. Tap an area to open it.`}
        </p>
      </div>

      {nothingYet ? (
        <div className="card stack">
          <p className="body">
            Draw a rough map of your garden. Mary Mary will set out your areas in a grid, then you can move them to where they really are and add the
            house, paths and shed.
          </p>
          <button
            type="button"
            className="btn full"
            onClick={() => {
              update((g) => placeAllAreas(g), "Areas set out. Now move them into place.");
              setEditing(true);
            }}
          >
            Start my map
          </button>
        </div>
      ) : (
        <div className="map-wrap stack" style={{ gap: 4 }}>
          <div className="row">
            <p className="hint">{editing ? "Tap the compass to turn north round." : "Each square is about 1 metre."}</p>
            <NorthArrow north={m.north} onTurn={editing ? () => update((g) => turnNorth(g)) : undefined} />
          </div>
          <div
            ref={grid}
            className={`map${editing ? " editing" : ""}`}
            style={{ aspectRatio: `${m.width} / ${m.length}`, backgroundSize: `${100 / m.width}% ${100 / m.length}%` }}
            onClick={(e) => {
              if (editing && e.target === e.currentTarget) setSel(null);
            }}
          >
            {/* Bigger things first, so a small bed drawn over the lawn stays visible. */}
            {[...shapes].sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h).map((s) => {
              const key = refKey(s.ref);
              const box = draft?.key === key ? draft.box : s.box;
              const selected = sel !== null && refKey(sel) === key;
              const style = { ...pct(box, m.width, m.length), background: s.fill, borderRadius: s.round ? "50%" : 8 };
              const inner = (
                <>
                  <span className="map-name">{s.name}</span>
                  {s.flagged && <span className="dot" title="Something here is struggling" />}
                </>
              );
              if (!editing) {
                return s.area ? (
                  <a key={key} className="map-shape area" style={style} href={href({ page: "area", id: s.area })}>
                    {inner}
                  </a>
                ) : (
                  <div key={key} className="map-shape" style={style}>
                    {inner}
                  </div>
                );
              }
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`${s.name}${selected ? ", selected" : ""}`}
                  className={`map-shape${s.area ? " area" : ""}${selected ? " selected" : ""}`}
                  style={{ ...style, touchAction: selected ? "none" : undefined, zIndex: selected ? 3 : undefined }}
                  onPointerDown={selected ? (e) => drag(e, s.ref, "move") : undefined}
                  onClick={() => setSel(s.ref)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSel(s.ref);
                  }}
                >
                  {inner}
                  {selected && <span className="map-handle" aria-hidden="true" onPointerDown={(e) => drag(e, s.ref, "size")} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing && sel && selBox && (
        <div className="card stack" aria-live="polite">
          <div className="row">
            <p style={{ margin: 0, fontWeight: 700 }}>{selName}</p>
            <p className="hint">
              {selBox.w} m × {selBox.h} m
            </p>
          </div>
          {"featureId" in sel && renaming === sel.featureId ? (
            <form
              className="btn-row"
              onSubmit={(e) => {
                e.preventDefault();
                const v = (new FormData(e.currentTarget).get("label") as string) ?? "";
                update((g) => renameFeature(g, sel.featureId, v));
                setRenaming(null);
              }}
            >
              <input className="input" name="label" defaultValue={selName} aria-label="Name" autoFocus />
              <button className="btn small" type="submit">
                Save
              </button>
            </form>
          ) : null}
          <div className="pad" role="group" aria-label="Move">
            <span />
            <button type="button" className="btn outline small" aria-label="Move up" onClick={() => update((g) => nudge(g, sel, 0, -1))}>↑</button>
            <span />
            <button type="button" className="btn outline small" aria-label="Move left" onClick={() => update((g) => nudge(g, sel, -1, 0))}>←</button>
            <span className="pad-label">Move</span>
            <button type="button" className="btn outline small" aria-label="Move right" onClick={() => update((g) => nudge(g, sel, 1, 0))}>→</button>
            <span />
            <button type="button" className="btn outline small" aria-label="Move down" onClick={() => update((g) => nudge(g, sel, 0, 1))}>↓</button>
            <span />
          </div>
          <div className="size-grid">
            <span className="label">Width</span>
            <button type="button" className="btn outline small" onClick={() => update((g) => nudge(g, sel, 0, 0, -1, 0))}>Narrower</button>
            <button type="button" className="btn outline small" onClick={() => update((g) => nudge(g, sel, 0, 0, 1, 0))}>Wider</button>
            <span className="label">Length</span>
            <button type="button" className="btn outline small" onClick={() => update((g) => nudge(g, sel, 0, 0, 0, -1))}>Shorter</button>
            <button type="button" className="btn outline small" onClick={() => update((g) => nudge(g, sel, 0, 0, 0, 1))}>Longer</button>
          </div>
          <div className="chips">
            <button type="button" className="chip" onClick={() => update((g) => turn(g, sel))}>Turn round</button>
            {"featureId" in sel && (
              <button type="button" className="chip" onClick={() => setRenaming(sel.featureId)}>Rename</button>
            )}
            {"areaId" in sel && (
              <a className="chip" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }} href={href({ page: "bedPlan", areaId: sel.areaId })}>
                What's planted where
              </a>
            )}
            <button
              type="button"
              className="chip"
              onClick={() => {
                update((g) => removeFromMap(g, sel), `${selName} taken off the map`, true);
                setSel(null);
              }}
            >
              Take off the map
            </button>
          </div>
          <p className="hint">Tip: drag it with your finger, or drag the corner to resize. Each square is about 1 metre.</p>
        </div>
      )}

      {editing && (
        <>
          {offMap.length > 0 && (
            <div className="stack">
              <div className="row">
                <h2>Not on the map yet</h2>
                {offMap.length > 1 && (
                  <button type="button" className="text-btn" onClick={() => update((g) => placeAllAreas(g))}>
                    Add them all
                  </button>
                )}
              </div>
              <div className="chips">
                {offMap.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="chip"
                    onClick={() => {
                      update((g) => placeArea(g, a.id));
                      setSel({ areaId: a.id });
                    }}
                  >
                    + {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="stack">
            <h2>Add to the map</h2>
            <div className="chips">
              {FEATURES.map((f) => (
                <button
                  key={f.kind}
                  type="button"
                  className="chip"
                  onClick={() => {
                    let id = "";
                    update((g) => {
                      const [next, newId] = addFeature(g, f.kind);
                      id = newId;
                      return next;
                    });
                    setSel({ featureId: id });
                  }}
                >
                  + {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card stack">
            <p style={{ margin: 0, fontWeight: 700 }}>Size of the garden</p>
            <div className="btn-row">
              <label className="field" style={{ flex: 1 }}>
                <span className="flabel">Across (m)</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={MAP_MIN}
                  max={MAP_MAX}
                  defaultValue={m.width}
                  key={`w${m.width}`}
                  onBlur={(e) => update((g) => setMapSize(g, Number(e.target.value) || g.map.width, g.map.length))}
                />
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span className="flabel">Front to back (m)</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={MAP_MIN}
                  max={MAP_MAX}
                  defaultValue={m.length}
                  key={`l${m.length}`}
                  onBlur={(e) => update((g) => setMapSize(g, g.map.width, Number(e.target.value) || g.map.length))}
                />
              </label>
            </div>
            <p className="hint">A rough guess is fine.</p>
          </div>
        </>
      )}
    </>
  );
}

// ── Bed plan: what's planted where in one area ───────────────────

type Pick = { item: BedItem; spotId?: string } | null;

export function BedPlanScreen({ areaId, plantId }: { areaId: string; plantId?: string }) {
  const { garden, update } = useStore();
  // Opened from a plant page: start with that plant picked, ready to place or move.
  const fromPlant = plantId ? garden.plants.find((p) => p.id === plantId && p.areaId === areaId) : undefined;
  const [pick, setPick] = useState<Pick>(() => {
    if (!fromPlant) return null;
    const spot = bedPlanFor(garden, areaId).spots.find((s) => s.plantId === fromPlant.id);
    if (spot) return { item: { plantId: fromPlant.id }, spotId: spot.id };
    return fromPlant.status === "lost" ? null : { item: { plantId: fromPlant.id } };
  });
  const [sizing, setSizing] = useState(false);
  const area = garden.areas.find((a) => a.id === areaId);
  if (!area) return <NotFound what="area" />;

  const plan = bedPlanFor(garden, areaId);
  const plants = garden.plants.filter((p) => p.areaId === areaId);
  const planned = garden.planned.filter((p) => p.areaId === areaId);
  const placedPlants = new Set(plan.spots.map((s) => s.plantId).filter(Boolean));
  const placedPlanned = new Set(plan.spots.map((s) => s.plannedId).filter(Boolean));
  const waiting = [
    ...plants
      .filter((p) => p.status !== "lost" && !placedPlants.has(p.id))
      .map((p) => ({ item: { plantId: p.id } as BedItem, name: p.variety ? `${p.name} '${p.variety}'` : p.name, planned: false })),
    ...planned.filter((p) => !placedPlanned.has(p.id)).map((p) => ({ item: { plannedId: p.id } as BedItem, name: p.name, planned: true })),
  ];

  const describe = (s: { plantId?: string; plannedId?: string }) => {
    if (s.plantId) {
      const p = plants.find((x) => x.id === s.plantId);
      return { name: p ? (p.variety ? `${p.name} '${p.variety}'` : p.name) : "", status: p?.status ?? "growing", planned: false };
    }
    const p = planned.find((x) => x.id === s.plannedId);
    return { name: p?.name ?? "", status: "planned" as const, planned: true };
  };

  const pickedSpot = pick?.spotId ? plan.spots.find((s) => s.id === pick.spotId) : undefined;
  const pickedName = pick ? (pickedSpot ? describe(pickedSpot).name : waiting.find((w) => JSON.stringify(w.item) === JSON.stringify(pick.item))?.name) : undefined;
  const pickedInfo = pickedSpot ? describe(pickedSpot) : undefined;

  function tapCell(x: number, y: number) {
    const there = plan.spots.find((s) => s.x === x && s.y === y);
    if (pick) {
      if (there && there.id === pick.spotId) {
        setPick(null);
        return;
      }
      const item = pick.item;
      const name = fromPlant && "plantId" in item && item.plantId === fromPlant.id && !pick.spotId ? describe({ plantId: fromPlant.id }).name : undefined;
      update((g) => placeInBed(g, areaId, x, y, item), name ? `${name} has its square` : undefined);
      setPick(null);
      return;
    }
    if (there) setPick({ item: there.plantId ? { plantId: there.plantId } : { plannedId: there.plannedId! }, spotId: there.id });
  }

  const cells = [];
  for (let y = 0; y < plan.rows; y++) {
    for (let x = 0; x < plan.cols; x++) {
      const s = plan.spots.find((sp) => sp.x === x && sp.y === y);
      const info = s ? describe(s) : undefined;
      const selected = !!s && s.id === pick?.spotId;
      const focus = !pick && !!fromPlant && s?.plantId === fromPlant.id;
      cells.push(
        <button
          key={`${x}-${y}`}
          type="button"
          className={`bed-cell${pick && !selected ? " target" : ""}${selected ? " selected" : ""}${focus ? " focus" : ""}`}
          onClick={() => tapCell(x, y)}
          aria-label={info ? `${info.name}${info.status === "lost" ? ", was here" : info.planned ? ", planned" : ""}` : `Empty square ${x + 1} across, ${y + 1} down`}
        >
          {info && (
            <span className={`bed-plant ${info.status}`}>
              <span>{shortLabel(info.name)}</span>
            </span>
          )}
        </button>,
      );
    }
  }

  return (
    <>
      {fromPlant ? (
        <BackBar to={href({ page: "plant", id: fromPlant.id })} label={describe({ plantId: fromPlant.id }).name} />
      ) : (
        <BackBar to={href({ page: "area", id: areaId })} label={area.name} />
      )}
      <div className="stack-sm">
        <h1>What's where</h1>
        <p className="sub">{area.name}. Handy in winter, when things have died back.</p>
      </div>

      <div className="bed-wrap stack" style={{ gap: 4 }}>
        <div className="row">
          <p className="hint">North is the same way round as on the garden map.</p>
          <NorthArrow north={garden.map.north} />
        </div>
        <div className="bed" style={{ gridTemplateColumns: `repeat(${plan.cols}, 1fr)`, fontSize: plan.cols > 8 ? 9 : 11 }}>
          {cells}
        </div>
      </div>

      {pick ? (
        <div className="card stack" aria-live="polite">
          <p style={{ margin: 0, fontWeight: 700 }}>{pickedName}</p>
          <p className="hint">
            {pickedInfo?.status === "lost"
              ? "This didn't make it. Keep the square as a reminder, or clear it."
              : pickedSpot
                ? "Tap another square to move it there."
                : "Now tap a square to put it there."}
          </p>
          <div className="chips">
            {pickedSpot?.plantId && pickedSpot.plantId !== fromPlant?.id && (
              <a className="chip" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }} href={href({ page: "plant", id: pickedSpot.plantId })}>
                Open plant
              </a>
            )}
            {pickedSpot && (
              <button
                type="button"
                className="chip"
                onClick={() => {
                  update((g) => removeFromBed(g, areaId, pickedSpot.id), pickedInfo?.status === "lost" ? "Square cleared" : `${pickedName} taken off the plan`, true);
                  setPick(null);
                }}
              >
                {pickedInfo?.status === "lost" ? "Clear this square" : "Take off the plan"}
              </button>
            )}
            <button type="button" className="chip" onClick={() => setPick(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="stack">
        <h2>Not placed yet</h2>
        {waiting.length === 0 ? (
          <p className="empty">
            {plants.length + planned.length === 0 ? "Nothing planted here yet. Add plants to the area first." : "Everything here has a square. Lovely."}
          </p>
        ) : (
          <>
            <p className="hint">Tap a plant, then tap a square.</p>
            <div className="chips">
              {waiting.map((w) => {
                const on = !!pick && !pick.spotId && JSON.stringify(pick.item) === JSON.stringify(w.item);
                return (
                  <button key={JSON.stringify(w.item)} type="button" className="chip" aria-pressed={on} onClick={() => setPick(on ? null : { item: w.item })}>
                    {w.name}
                    {w.planned ? " (planned)" : ""}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="legend hint">
        <span><i className="bed-plant growing" /> Growing</span>
        <span><i className="bed-plant struggling" /> Struggling</span>
        <span><i className="bed-plant planned" /> Planned</span>
        <span><i className="bed-plant lost" /> Was here</span>
      </div>

      {sizing ? (
        <div className="card stack">
          <p style={{ margin: 0, fontWeight: 700 }}>Squares</p>
          {(
            [
              ["Across", plan.cols],
              ["Down", plan.rows],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="row">
              <span className="label" style={{ fontSize: 15 }}>
                {label}
              </span>
              <span className="btn-row">
                <button
                  type="button"
                  className="btn outline small"
                  aria-label={`Fewer squares ${label.toLowerCase()}`}
                  disabled={n <= BED_MIN}
                  onClick={() => update((g) => (label === "Across" ? setBedSize(g, areaId, n - 1, plan.rows) : setBedSize(g, areaId, plan.cols, n - 1)))}
                >
                  −
                </button>
                <span style={{ minWidth: 28, textAlign: "center", fontWeight: 700 }}>{n}</span>
                <button
                  type="button"
                  className="btn outline small"
                  aria-label={`More squares ${label.toLowerCase()}`}
                  disabled={n >= BED_MAX}
                  onClick={() => update((g) => (label === "Across" ? setBedSize(g, areaId, n + 1, plan.rows) : setBedSize(g, areaId, plan.cols, n + 1)))}
                >
                  +
                </button>
              </span>
            </div>
          ))}
          <p className="hint">Make the grid roughly the shape of the bed. Plants in squares you take away go back to "Not placed yet".</p>
          <button type="button" className="btn outline full" onClick={() => setSizing(false)}>
            Done
          </button>
        </div>
      ) : (
        <button type="button" className="btn quiet" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setSizing(true)}>
          Change the number of squares
        </button>
      )}

      <a className="btn outline full" href={href({ page: "map" })}>
        See the whole garden map
      </a>
    </>
  );
}

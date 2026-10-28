import { useState } from "react";
import { addArea, removeArea, updateArea } from "../lib/actions";
import { AREA_KINDS } from "../lib/data";
import type { Area, AreaKind, Aspect } from "../lib/types";
import { go, href } from "../router";
import { useStore } from "../store";
import { BackBar, Chips, NotFound } from "../ui";

const ASPECTS: Aspect[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const ASPECT_WORDS: Record<Aspect, string> = {
  N: "North",
  NE: "North-east",
  E: "East",
  SE: "South-east",
  S: "South",
  SW: "South-west",
  W: "West",
  NW: "North-west",
};
export const aspectText = (a?: Aspect) => (a ? ASPECT_WORDS[a] : "Not set");

const SOILS = ["Clay", "Loam", "Sandy", "Chalky", "Not sure"];

export function AreaForm({ id }: { id?: string }) {
  const { garden, update } = useStore();
  const existing = id ? garden.areas.find((a) => a.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<AreaKind | undefined>(existing?.kind ?? "border");
  const [aspect, setAspect] = useState<Aspect | undefined>(existing?.aspect);
  const [soil, setSoil] = useState<string | undefined>(existing?.soil);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [needName, setNeedName] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (id && !existing) return <NotFound what="area" />;

  const plantsHere = existing ? garden.plants.filter((p) => p.areaId === existing.id && p.status !== "lost").length : 0;

  const save = () => {
    const n = name.trim();
    if (!n) {
      setNeedName(true);
      return;
    }
    const fields: Omit<Area, "id" | "createdAt"> = {
      name: n,
      kind: kind ?? "other",
      aspect,
      soil,
      notes: notes.trim() || undefined,
    };
    if (existing) {
      update((g) => updateArea(g, existing.id, fields), "Saved");
      go({ page: "area", id: existing.id }, true);
    } else {
      let newId = "";
      update((g) => {
        const [next, nid] = addArea(g, fields);
        newId = nid;
        return next;
      }, `${n} added`);
      go({ page: "area", id: newId }, true);
    }
  };

  return (
    <>
      <BackBar to={existing ? href({ page: "area", id: existing.id }) : "#/"} label={existing ? existing.name : "Home"} />
      <h1>{existing ? "Edit area" : "New area"}</h1>

      <div className="field">
        <label htmlFor="area-name">Area name</label>
        <input
          id="area-name"
          className="input"
          value={name}
          placeholder="For example, the shady corner"
          onChange={(e) => {
            setName(e.target.value);
            setNeedName(false);
          }}
        />
        {needName && (
          <p className="hint" role="status">
            Give it a name first, like the Sunset Border or the pots by the door.
          </p>
        )}
      </div>

      <div className="field">
        <span className="flabel">What kind of space is it?</span>
        <Chips label="Kind of space" options={AREA_KINDS.map((k) => ({ value: k.kind, label: k.label }))} value={kind} onChange={setKind} />
      </div>

      <div className="field">
        <span className="flabel">
          Which way does it face? <span className="optional">(optional)</span>
        </span>
        <Chips label="Which way it faces" options={ASPECTS.map((a) => ({ value: a, label: a }))} value={aspect} onChange={setAspect} />
        <p className="hint">The direction you face when you look out from the house across this area. South-facing gets the most sun.</p>
      </div>

      <div className="field">
        <span className="flabel">
          Soil <span className="optional">(optional)</span>
        </span>
        <Chips label="Soil" options={SOILS.map((s) => ({ value: s, label: s }))} value={soil} onChange={setSoil} />
      </div>

      <div className="field">
        <label htmlFor="area-notes">
          Plans and notes <span className="optional">(optional)</span>
        </label>
        <textarea id="area-notes" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="For example, lift the dahlias over winter" />
      </div>

      <div className="btn-row">
        <button type="button" className="btn" onClick={save}>
          {existing ? "Save" : "Add area"}
        </button>
        <a className="btn quiet" href={existing ? href({ page: "area", id: existing.id }) : "#/"}>
          Cancel
        </a>
      </div>

      {existing && (
        <div className="stack" style={{ marginTop: 12 }}>
          {plantsHere > 0 ? (
            <p className="hint">
              To remove this area, first move its {plantsHere === 1 ? "plant" : `${plantsHere} plants`} somewhere else (open a plant, then Edit).
            </p>
          ) : !confirmRemove ? (
            <button type="button" className="btn danger" onClick={() => setConfirmRemove(true)}>
              Remove this area
            </button>
          ) : (
            <div className="card stack">
              <p className="body">Remove {existing.name}? You can undo straight afterwards.</p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => {
                    update((g) => removeArea(g, existing.id), `${existing.name} removed`, true);
                    go({ page: "home" }, true);
                  }}
                >
                  Remove
                </button>
                <button type="button" className="btn quiet" onClick={() => setConfirmRemove(false)}>
                  Keep it
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

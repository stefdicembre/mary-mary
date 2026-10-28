import { useState } from "react";
import { addPlant, pastSetbacksFor, updatePlant } from "../lib/actions";
import { SECTIONS } from "../lib/data";
import { shortDate } from "../lib/dates";
import { lessonFor, setbackSummary } from "../lib/reasons";
import type { PlantSource } from "../lib/types";
import { go, href } from "../router";
import { useStore } from "../store";
import { BackBar, Chips, NotFound } from "../ui";

const SOURCES: Array<{ value: PlantSource; label: string }> = [
  { value: "seed", label: "Seed" },
  { value: "plug", label: "Plug plant" },
  { value: "cutting", label: "Cutting" },
  { value: "shop", label: "Bought" },
  { value: "gift", label: "Gift" },
];

const OUTCOME_WORDS = { struggling: "struggled", died: "didn't make it", removed: "was pulled out" } as const;

export function PlantForm({ id, areaId }: { id?: string; areaId?: string }) {
  const { garden, update } = useStore();
  const existing = id ? garden.plants.find((p) => p.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [variety, setVariety] = useState(existing?.variety ?? "");
  const [latinName, setLatinName] = useState(existing?.latinName ?? "");
  const [section, setSection] = useState(existing?.section ?? "Perennials");
  const [where, setWhere] = useState(existing?.areaId ?? areaId ?? garden.areas[0]?.id ?? "");
  const [plantedOn, setPlantedOn] = useState(existing?.plantedOn ?? "");
  const [source, setSource] = useState<PlantSource | undefined>(existing?.source);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [needName, setNeedName] = useState(false);

  if (id && !existing) return <NotFound what="plant" />;
  if (!existing && !garden.areas.some((a) => a.id === where)) return <NotFound what="area" />;

  const areaName = (aid: string) => garden.areas.find((a) => a.id === aid)?.name ?? "the garden";
  // When adding the same plant again, remind gently what happened before.
  const past = !existing ? pastSetbacksFor(garden, name).slice(0, 2) : [];
  const backTo = existing ? href({ page: "plant", id: existing.id }) : href({ page: "area", id: where });

  const save = () => {
    const n = name.trim();
    if (!n) {
      setNeedName(true);
      return;
    }
    const fields = {
      name: n,
      variety: variety.trim() || undefined,
      latinName: latinName.trim() || undefined,
      section,
      areaId: where,
      plantedOn: plantedOn || undefined,
      source,
      notes: notes.trim() || undefined,
    };
    if (existing) {
      update((g) => updatePlant(g, existing.id, fields), "Saved");
      go({ page: "plant", id: existing.id }, true);
    } else {
      update((g) => addPlant(g, fields)[0], `${n} added to ${areaName(where)}`, true);
      go({ page: "area", id: where }, true);
    }
  };

  return (
    <>
      <BackBar to={backTo} label={existing ? existing.name : areaName(where)} />
      <h1>{existing ? "Edit plant" : "Add a plant"}</h1>

      <div className="field">
        <label htmlFor="p-name">What is it?</label>
        <input
          id="p-name"
          className="input"
          value={name}
          autoComplete="off"
          placeholder="For example, dahlia or Musa basjoo"
          onChange={(e) => {
            setName(e.target.value);
            setNeedName(false);
          }}
        />
        {needName && (
          <p className="hint" role="status">
            Add a name first. A rough one is fine, like "red rose".
          </p>
        )}
      </div>

      {past.length > 0 && (
        <div className="panel-amber" role="note">
          <p style={{ fontWeight: 700 }}>From last time</p>
          {past.map((s) => {
            const why = setbackSummary(s);
            const firstKey = s.reasons.find((r) => r !== "dontKnow");
            const tip = firstKey ? lessonFor(firstKey, s.details[firstKey]) : "";
            return (
              <p key={s.id}>
                On {shortDate(s.date)}, {name.trim()} in {areaName(s.areaId)} {OUTCOME_WORDS[s.outcome]}
                {why ? ` (${why})` : ""}.{tip ? ` ${tip}` : ""}
              </p>
            );
          })}
        </div>
      )}

      <div className="field">
        <label htmlFor="p-variety">
          Variety <span className="optional">(optional)</span>
        </label>
        <input id="p-variety" className="input" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="For example, Bishop of Llandaff" />
      </div>

      <div className="field">
        <label htmlFor="p-latin">
          Latin name <span className="optional">(optional)</span>
        </label>
        <input id="p-latin" className="input" value={latinName} onChange={(e) => setLatinName(e.target.value)} placeholder="For example, Alchemilla mollis" />
      </div>

      <div className="field">
        <label htmlFor="p-section">Section</label>
        <select id="p-section" className="select input" value={section} onChange={(e) => setSection(e.target.value)}>
          {SECTIONS.map((s) => (
            <option key={s}>{s}</option>
          ))}
          {!SECTIONS.includes(section) && <option>{section}</option>}
        </select>
      </div>

      <div className="field">
        <label htmlFor="p-where">Where it grows</label>
        <select id="p-where" className="select input" value={where} onChange={(e) => setWhere(e.target.value)}>
          {garden.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="p-date">
          Planted on <span className="optional">(optional)</span>
        </label>
        <input id="p-date" type="date" className="input" value={plantedOn} onChange={(e) => setPlantedOn(e.target.value)} />
      </div>

      <div className="field">
        <span className="flabel">
          Where it came from <span className="optional">(optional)</span>
        </span>
        <Chips label="Where it came from" options={SOURCES} value={source} onChange={setSource} />
      </div>

      <div className="field">
        <label htmlFor="p-notes">
          Notes <span className="optional">(optional)</span>
        </label>
        <textarea id="p-notes" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="For example, by the arch, needs staking" />
      </div>

      <div className="btn-row">
        <button type="button" className="btn" onClick={save}>
          {existing ? "Save" : "Add plant"}
        </button>
        <a className="btn quiet" href={backTo}>
          Cancel
        </a>
      </div>
    </>
  );
}

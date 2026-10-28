import { useEffect, useRef, useState } from "react";
import { addEntry, diaryEntries, removeEntry, updateEntry } from "../lib/actions";
import { shortDate, todayISO } from "../lib/dates";
import { photoUrl, savePhoto } from "../lib/photos";
import type { JournalEntry } from "../lib/types";
import { IconPlus } from "../icons";
import { go, href } from "../router";
import { useStore } from "../store";
import { BackBar, NotFound } from "../ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function Photo({ id, size, full }: { id: string; size?: number; full?: boolean }) {
  const [url, setUrl] = useState<string>();
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let live = true;
    photoUrl(id).then((u) => live && (u ? setUrl(u) : setGone(true)));
    return () => {
      live = false;
    };
  }, [id]);
  const style = full ? { width: "100%", borderRadius: 16, display: "block" } : { width: size ?? 72, height: size ?? 72, borderRadius: 12, objectFit: "cover" as const, display: "block" };
  if (gone) return <span className="photo-missing" style={full ? { height: 120 } : { width: size ?? 72, height: size ?? 72 }}>Photo not on this phone</span>;
  return url ? <img src={url} alt="" style={style} /> : <span className="photo-missing" style={full ? { height: 200 } : { width: size ?? 72, height: size ?? 72 }} />;
}

export function PhotoPicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="stack" style={{ gap: 8 }}>
      {ids.length > 0 && (
        <div className="thumbs">
          {ids.map((id) => (
            <div key={id} className="thumb">
              <Photo id={id} size={84} />
              <button type="button" className="thumb-x" aria-label="Remove photo" onClick={() => onChange(ids.filter((x) => x !== id))}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="btn outline" style={{ cursor: "pointer" }}>
        {busy ? "Saving photo…" : ids.length ? "+ Add another photo" : "+ Add a photo"}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            if (!files.length) return;
            setBusy(true);
            setErr("");
            const added: string[] = [];
            for (const f of files) {
              try {
                added.push(await savePhoto(f));
              } catch {
                setErr("One photo couldn't be read. Try a different one.");
              }
            }
            onChange([...ids, ...added]);
            setBusy(false);
            if (input.current) input.current.value = "";
          }}
        />
      </label>
      {err && (
        <p className="hint" role="status">
          {err}
        </p>
      )}
    </div>
  );
}

function EntryCard({ e }: { e: JournalEntry }) {
  const { garden } = useStore();
  const names = [
    ...e.areaIds.map((id) => garden.areas.find((a) => a.id === id)?.name),
    ...e.plantIds.map((id) => garden.plants.find((p) => p.id === id)?.name),
  ].filter(Boolean) as string[];
  return (
    <a className="entry" href={href({ page: "diaryEntry", id: e.id })}>
      <span className="when">
        {shortDate(e.date)}
        {e.setbackId ? " · Setback" : e.taskId ? " · Job done" : ""}
      </span>
      <span className="text">{e.text || "Photo"}</span>
      {names.length > 0 && <span className="meta">{Array.from(new Set(names)).join(" · ")}</span>}
      {e.photoIds && e.photoIds.length > 0 && (
        <span className="thumbs">
          {e.photoIds.slice(0, 3).map((id) => (
            <Photo key={id} id={id} size={64} />
          ))}
          {e.photoIds.length > 3 && <span className="more">+{e.photoIds.length - 3}</span>}
        </span>
      )}
    </a>
  );
}

export function DiaryScreen({ areaId, plantId }: { areaId?: string; plantId?: string }) {
  const { garden } = useStore();
  const [text, setText] = useState("");
  const area = areaId ? garden.areas.find((a) => a.id === areaId) : undefined;
  const plant = plantId ? garden.plants.find((p) => p.id === plantId) : undefined;
  const entries = diaryEntries(garden, { areaId, plantId, text });

  const groups: Array<{ label: string; items: JournalEntry[] }> = [];
  for (const e of entries) {
    const label = `${MONTHS[Number(e.date.slice(5, 7)) - 1]} ${e.date.slice(0, 4)}`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }

  const back = plant ? { to: href({ page: "plant", id: plant.id }), label: plant.name } : area ? { to: href({ page: "area", id: area.id }), label: area.name } : { to: href({ page: "menu" }), label: "Menu" };

  return (
    <>
      <BackBar to={back.to} label={back.label} />
      <div className="stack-sm">
        <h1>{plant ? `Diary: ${plant.name}` : area ? `Diary: ${area.name}` : "Garden diary"}</h1>
        <p className="body">{plant || area ? "Photos, notes and memories from here." : "Add photos and notes so you can keep a record of how your garden has grown."}</p>
      </div>

      {!plantId && (
        <div className="scroll-chips" role="group" aria-label="Show the diary for">
          <a className="chip" aria-pressed={!areaId} href={href({ page: "diary" })} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            Everywhere
          </a>
          {garden.areas.map((a) => (
            <a key={a.id} className="chip" aria-pressed={areaId === a.id} href={href({ page: "diary", areaId: a.id })} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap" }}>
              {a.name.replace(/^The /, "")}
            </a>
          ))}
        </div>
      )}

      <input className="input" type="search" placeholder="Search, e.g. dahlia or frost" aria-label="Search the diary" value={text} onChange={(e) => setText(e.target.value)} />

      <a className="btn" href={href({ page: "diaryNew", areaId, plantId })}>
        <IconPlus size={18} color="#fff" />
        Add something
      </a>

      {entries.length === 0 && (
        <p className="empty">
          {text ? "Nothing in the diary matches that." : "Nothing here yet. Add a note or a photo whenever something's worth remembering. Setbacks and finished jobs can go here too."}
        </p>
      )}

      {groups.map((g) => (
        <div key={g.label} className="stack">
          <p className="label">{g.label}</p>
          {g.items.map((e) => (
            <EntryCard key={e.id} e={e} />
          ))}
        </div>
      ))}
    </>
  );
}

export function DiaryEntryScreen({ id }: { id: string }) {
  const { garden, update } = useStore();
  const [confirm, setConfirm] = useState(false);
  const e = garden.journal.find((x) => x.id === id);
  if (!e) return <NotFound what="diary entry" />;
  const areas = e.areaIds.map((aid) => garden.areas.find((a) => a.id === aid)).filter(Boolean);
  const plants = e.plantIds.map((pid) => garden.plants.find((p) => p.id === pid)).filter(Boolean);
  return (
    <>
      <BackBar
        to={href({ page: "diary" })}
        label="Garden diary"
        right={
          <a className="text-btn" href={href({ page: "diaryEdit", id })} style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            Edit
          </a>
        }
      />
      <p className="sub">
        {shortDate(e.date)}
        {e.setbackId ? " · Setback" : e.taskId ? " · Job done" : ""}
      </p>
      {e.text && <p style={{ margin: 0, fontSize: 18, lineHeight: 1.5 }}>{e.text}</p>}
      {(e.photoIds ?? []).map((pid) => (
        <Photo key={pid} id={pid} full />
      ))}
      {(areas.length > 0 || plants.length > 0) && (
        <div className="chips">
          {areas.map((a) => (
            <a key={a!.id} className="chip" href={href({ page: "area", id: a!.id })} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              {a!.name}
            </a>
          ))}
          {plants.map((p) => (
            <a key={p!.id} className="chip" href={href({ page: "plant", id: p!.id })} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              {p!.name}
            </a>
          ))}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        {!confirm ? (
          <button type="button" className="btn quiet" style={{ padding: 0 }} onClick={() => setConfirm(true)}>
            Remove from the diary
          </button>
        ) : (
          <div className="card stack">
            <p className="body">Remove this from the diary?{e.setbackId ? " The setback itself stays on the plant." : ""}</p>
            <div className="btn-row">
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  update((g) => removeEntry(g, id), "Removed from the diary", true);
                  go({ page: "diary" }, true);
                }}
              >
                Remove
              </button>
              <button type="button" className="btn quiet" onClick={() => setConfirm(false)}>
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function DiaryForm({ id, areaId: startArea, plantId: startPlant, taskId }: { id?: string; areaId?: string; plantId?: string; taskId?: string }) {
  const { garden, update } = useStore();
  const today = todayISO();
  const existing = id ? garden.journal.find((j) => j.id === id) : undefined;
  const task = taskId ? garden.tasks.find((t) => t.id === taskId) : undefined;
  const startPlantObj = startPlant ? garden.plants.find((p) => p.id === startPlant) : undefined;
  const [text, setText] = useState(existing?.text ?? (task ? `${task.title}. ` : ""));
  const [date, setDate] = useState(existing?.date ?? task?.doneOn ?? today);
  const [areaId, setAreaId] = useState(existing?.areaIds[0] ?? startArea ?? task?.areaId ?? startPlantObj?.areaId ?? "");
  const [plantIds, setPlantIds] = useState<string[]>(existing?.plantIds ?? (startPlant ? [startPlant] : []));
  const [photoIds, setPhotoIds] = useState<string[]>(existing?.photoIds ?? []);
  const [need, setNeed] = useState(false);
  if (id && !existing) return <NotFound what="diary entry" />;

  const plantsHere = garden.plants.filter((p) => p.status !== "lost" && (!areaId || p.areaId === areaId) || plantIds.includes(p.id));
  const back = existing ? href({ page: "diaryEntry", id: existing.id }) : task ? href({ page: "jobs" }) : href({ page: "diary", areaId: startArea, plantId: startPlant });

  const save = () => {
    const t = text.trim();
    if (!t && !photoIds.length) return setNeed(true);
    const fields = { date, text: t, areaIds: areaId ? [areaId] : [], plantIds, photoIds };
    if (existing) {
      update((g) => updateEntry(g, existing.id, fields), "Saved");
      go({ page: "diaryEntry", id: existing.id }, true);
    } else {
      update((g) => addEntry(g, { ...fields, taskId: task?.id })[0], "Added to the diary", true);
      go(task ? { page: "jobs" } : { page: "diary", areaId: startArea, plantId: startPlant }, true);
    }
  };

  return (
    <>
      <BackBar to={back} label="Back" />
      <div className="stack-sm">
        <h1>{existing ? "Edit diary entry" : "Add to the diary"}</h1>
        {!existing && <p className="body">A thought, a memory or something you noticed. It doesn't have to be about a job.</p>}
      </div>
      <div className="field">
        <label htmlFor="e-text">Anything you'd like to remember?</label>
        <textarea id="e-text" className="textarea" value={text} onChange={(e) => (setText(e.target.value), setNeed(false))} placeholder="For example, the first sweet peas are out" />
        {need && <p className="hint" role="status">Add a few words or a photo first.</p>}
      </div>
      <PhotoPicker ids={photoIds} onChange={(ids) => (setPhotoIds(ids), setNeed(false))} />
      <div className="field">
        <label htmlFor="e-date">Date</label>
        <input id="e-date" type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
      </div>
      <div className="field">
        <label htmlFor="e-area">
          Where <span className="optional">(optional)</span>
        </label>
        <select id="e-area" className="select input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Anywhere in the garden</option>
          {garden.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      {plantsHere.length > 0 && (
        <div className="field">
          <span className="flabel">
            Which plants? <span className="optional">(optional)</span>
          </span>
          <div className="chips" role="group" aria-label="Which plants">
            {plantsHere.slice(0, 30).map((p) => (
              <button key={p.id} type="button" className="chip" aria-pressed={plantIds.includes(p.id)} onClick={() => setPlantIds(plantIds.includes(p.id) ? plantIds.filter((x) => x !== p.id) : [...plantIds, p.id])}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="btn-row">
        <button type="button" className="btn" onClick={save}>
          {existing ? "Save" : "Add to the diary"}
        </button>
        <a className="btn quiet" href={back}>
          Cancel
        </a>
      </div>
    </>
  );
}

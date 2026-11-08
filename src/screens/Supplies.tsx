// Supplies: what's in the shed, what's running low, and what this week's jobs need.

import { useState } from "react";
import { LEVELS, SUPPLY_SUGGESTIONS, addSupply, levelLabel, neededFor, removeSupply, renameSupply, setSupplyLevel, shoppingList } from "../lib/supplies";
import type { Supply, SupplyLevel } from "../lib/types";
import { shortDate } from "../lib/dates";
import { href } from "../router";
import { useStore } from "../store";
import { BackBar } from "../ui";
import { useJobs } from "./Jobs";

const CHIP: Record<SupplyLevel, string> = { plenty: "green", low: "amber", out: "grey" };

function LevelButtons({ value, onPick, levels = LEVELS, label }: { value: SupplyLevel; onPick: (l: SupplyLevel) => void; levels?: typeof LEVELS; label: string }) {
  return (
    <div className="level-row" role="group" aria-label={label}>
      {levels.map((l) => (
        <button key={l.value} type="button" className="chip" aria-pressed={value === l.value} onClick={() => onPick(l.value)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

function SupplyCard({ s, open, onToggle }: { s: Supply; open: boolean; onToggle: () => void }) {
  const { garden, update } = useStore();
  const { thisWeek } = useJobs();
  const [name, setName] = useState(s.name);
  const need = neededFor(garden, s, thisWeek);

  const pick = (level: SupplyLevel) => {
    if (level !== s.level || s.lowered) update((g) => setSupplyLevel(g, s.id, level), `${s.name} marked as ${levelLabel(level).toLowerCase()}`, true);
    onToggle();
  };

  return (
    <div className="card supply">
      <div className="row">
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{s.name}</h3>
        <span className={`tag ${CHIP[s.level]}`} style={{ flex: "none" }}>
          {levelLabel(s.level)}
        </span>
      </div>
      {need.length > 0 && (
        <p className="body">
          Needed for: {need.slice(0, 2).map((j) => j.title).join("; ")}
          {need.length > 2 ? ` and ${need.length - 2} more` : ""}
        </p>
      )}
      {s.lowered && (
        <p className="hint">
          Mary Mary {s.level === "out" ? "marked this as used up" : "lowered this"} after “{s.lowered.by}” ({shortDate(s.lowered.on)})
        </p>
      )}
      {open && (
        <div className="stack" style={{ gap: 8, marginTop: 4 }}>
          <span className="flabel">How much is left?</span>
          <LevelButtons value={s.level} onPick={pick} label={`How much ${s.name} is left?`} />
          <div className="field" style={{ marginTop: 4 }}>
            <label htmlFor={`name-${s.id}`}>Name</label>
            <input
              id={`name-${s.id}`}
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name.trim() !== s.name && update((g) => renameSupply(g, s.id, name))}
            />
          </div>
          <button
            type="button"
            className="btn quiet"
            style={{ alignSelf: "flex-start", padding: 0 }}
            onClick={() => update((g) => removeSupply(g, s.id), `${s.name} removed from Supplies`, true)}
          >
            Remove from Supplies
          </button>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "-6px -10px -8px 0" }}>
        <button type="button" className="btn quiet" style={{ fontSize: 13 }} aria-expanded={open} onClick={onToggle}>
          {open ? "Close" : "Change"}
        </button>
      </div>
    </div>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const { garden, update } = useStore();
  const [draft, setDraft] = useState("");
  const [level, setLevel] = useState<SupplyLevel>("plenty");
  const [needName, setNeedName] = useState(false);
  const have = new Set(garden.supplies.map((s) => s.name.toLowerCase()));
  const ideas = SUPPLY_SUGGESTIONS.filter((n) => !have.has(n.toLowerCase())).slice(0, 8);

  const save = () => {
    const n = draft.trim();
    if (!n) return setNeedName(true);
    if (have.has(n.toLowerCase())) {
      update((g) => g, `${n} is already on the list`);
      return onDone();
    }
    update((g) => addSupply(g, n, level)[0], `${n.charAt(0).toUpperCase() + n.slice(1)} added`, true);
    onDone();
  };

  return (
    <div className="card stack" style={{ gap: 14 }}>
      <div className="field">
        <label htmlFor="sup-name">What is it?</label>
        <input
          id="sup-name"
          className="input"
          value={draft}
          placeholder="For example, bone meal"
          autoFocus
          onChange={(e) => (setDraft(e.target.value), setNeedName(false))}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        {needName && (
          <p className="hint" role="status">
            Add a name first, like bone meal or netting.
          </p>
        )}
        {ideas.length > 0 && !draft && (
          <div className="chips" aria-label="Ideas">
            {ideas.map((n) => (
              <button key={n} type="button" className="chip" onClick={() => setDraft(n)}>
                {n}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="field">
        <span className="flabel">How much have you got?</span>
        <LevelButtons value={level} onPick={setLevel} levels={LEVELS.slice(0, 2)} label="How much have you got?" />
      </div>
      <div className="btn-row">
        <button type="button" className="btn" onClick={save}>
          Add
        </button>
        <button type="button" className="btn quiet" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

async function shareList(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) {
      await navigator.share({ title: "Garden shopping list", text });
      return "shared";
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return "shared";
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export function SuppliesScreen() {
  const { garden, update } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const toGet = garden.supplies.filter((s) => s.level !== "plenty");

  return (
    <>
      <BackBar to={href({ page: "menu" })} label="Menu" />
      <div className="stack-sm" style={{ gap: 6 }}>
        <h1>Supplies</h1>
        <p className="body">Mary Mary works out how much is left as you finish jobs that use it, and you can always correct her.</p>
      </div>

      {toGet.length > 0 && (
        <div className="panel-amber">
          <p style={{ fontWeight: 700 }}>Next time you're at the garden centre</p>
          <p>{toGet.map((s) => s.name).join(", ")}</p>
          <button
            type="button"
            className="btn outline small"
            style={{ alignSelf: "flex-start", marginTop: 6 }}
            onClick={async () => {
              const r = await shareList(shoppingList(garden));
              if (r === "copied") update((g) => g, "Shopping list copied");
              if (r === "failed") update((g) => g, "Couldn't share the list on this phone");
            }}
          >
            Share the list
          </button>
        </div>
      )}

      <div className="stack">
        <h2>What's in the shed?</h2>
        {garden.supplies.length === 0 && !adding && (
          <p className="empty">Nothing here yet. Add what you keep in the shed, and Mary Mary will keep an eye on it.</p>
        )}
        {garden.supplies.map((s) => (
          <SupplyCard key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} />
        ))}
        {adding ? (
          <AddForm onDone={() => setAdding(false)} />
        ) : (
          <button type="button" className="btn outline full" onClick={() => (setAdding(true), setOpenId(null))}>
            + Add something
          </button>
        )}
      </div>
      <p className="hint">Small jobs, like tying in a climber, use a bit: after three, Mary Mary drops it a level. Big jobs, like mulching, drop it straight away.</p>
    </>
  );
}

// Harvest log: what you've picked this year, and a quick form for "I picked something".

import { useState } from "react";
import {
  SIZES,
  addHarvest,
  amountText,
  cropName,
  cropTotals,
  harvestYears,
  harvestsIn,
  parseWeight,
  pickablePlants,
  plantLabel,
  recentOtherCrops,
  removeHarvest,
  totalText,
  updateHarvest,
} from "../lib/harvest";
import type { Harvest, HarvestSize } from "../lib/types";
import { shortDate, todayISO } from "../lib/dates";
import { addDays } from "../lib/jobs";
import { IconPlus } from "../icons";
import { go, href } from "../router";
import { useStore } from "../store";
import { BackBar, Chips, NotFound, Switch } from "../ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "12 Sep" without the year, for lists inside one year. */
const dayMonth = (iso: string) => shortDate(iso).replace(/ \d{4}$/, "");

function PickRow({ h }: { h: Harvest }) {
  const { garden } = useStore();
  const area = h.areaId ? garden.areas.find((a) => a.id === h.areaId)?.name : undefined;
  const amount = amountText(h);
  return (
    <a className="list-item" href={href({ page: "harvestEdit", id: h.id })}>
      <span className="grow">
        <span className="title">{cropName(garden, h)}</span>
        <span className="meta">
          {dayMonth(h.date)}
          {area ? ` · ${area}` : ""}
          {amount ? ` · ${amount}` : ""}
        </span>
        {h.note && <span className="meta" style={{ fontStyle: "italic" }}>“{h.note}”</span>}
      </span>
      <span className="text-btn" style={{ fontSize: 13, color: "var(--muted)" }}>
        Change
      </span>
    </a>
  );
}

export function HarvestScreen({ year: asked }: { year?: number }) {
  const { garden } = useStore();
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const year = asked ?? thisYear;
  const years = Array.from(new Set([thisYear, ...harvestYears(garden)])).sort((a, b) => b - a);
  const picks = harvestsIn(garden, year);
  const totals = cropTotals(garden, year, today);
  const isNow = year === thisYear;

  const groups: Array<{ label: string; items: Harvest[] }> = [];
  for (const h of picks) {
    const label = MONTHS[Number(h.date.slice(5, 7)) - 1];
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(h);
    else groups.push({ label, items: [h] });
  }

  return (
    <>
      <BackBar to={href({ page: "menu" })} label="Menu" />
      <div className="stack-sm" style={{ gap: 6 }}>
        <h1>Harvest log</h1>
        <p className="body">What you've picked from the garden: fruit, veg and herbs.</p>
      </div>

      <a className="btn" href={href({ page: "harvestNew" })}>
        <IconPlus size={18} color="#fff" />I picked something
      </a>

      {years.length > 1 && (
        <div className="scroll-chips" role="group" aria-label="Which year">
          {years.map((y) => (
            <a
              key={y}
              className="chip"
              aria-pressed={y === year}
              href={href({ page: "harvest", year: y === thisYear ? undefined : y })}
              style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
            >
              {y === thisYear ? "This year" : y}
            </a>
          ))}
        </div>
      )}

      {picks.length === 0 ? (
        <p className="empty">
          {isNow
            ? "Nothing picked yet this year. Next time you come in with a handful of beans or a bowl of tomatoes, tap “I picked something”."
            : `Nothing was logged in ${year}.`}
        </p>
      ) : (
        <>
          <div className="stack">
            <h2>{isNow ? "This year so far" : `${year} in all`}</h2>
            <div className="list">
              {totals.map((t) => (
                <div key={t.key} className="list-item">
                  <span className="grow">
                    <span className="title">{t.name}</span>
                    <span className="meta">{totalText(t)}</span>
                    {t.lastYear > 0 && (
                      <span className="meta">
                        {isNow ? `By now last year: ${t.lastYearByNow === 1 ? "once" : `${t.lastYearByNow} times`}` : `${year - 1}: ${t.lastYear === 1 ? "once" : `${t.lastYear} times`}`}
                      </span>
                    )}
                  </span>
                  <span className="meta" style={{ flex: "none" }}>
                    Last {dayMonth(t.last)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {groups.map((grp) => (
            <div key={grp.label} className="stack">
              <p className="label">{grp.label}</p>
              <div className="list">
                {grp.items.map((h) => (
                  <PickRow key={h.id} h={h} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      <p className="hint">You can save the harvest log as a spreadsheet in Settings and backup.</p>
    </>
  );
}

const OTHER = "__other";

export function HarvestForm({ id, plantId: fromPlant, taskId }: { id?: string; plantId?: string; taskId?: string }) {
  const { garden, update } = useStore();
  const today = todayISO();
  const existing = id ? garden.harvests.find((h) => h.id === id) : undefined;
  const task = taskId ? garden.tasks.find((t) => t.id === taskId) : undefined;
  const plants = pickablePlants(garden);
  const others = recentOtherCrops(garden);

  // Start from the picking being changed, the plant it came from, or the job just done.
  const startPlant = existing ? existing.plantId : (fromPlant ?? task?.plantId);
  const startDate = existing?.date ?? task?.doneOn ?? today;
  const [choice, setChoice] = useState<string | undefined>(startPlant ?? (existing ? OTHER : plants.length === 1 ? plants[0].id : undefined));
  const [otherName, setOtherName] = useState(existing && !existing.plantId ? existing.name : "");
  const [size, setSize] = useState<HarvestSize | undefined>(existing?.size);
  const [counting, setCounting] = useState(!!existing?.count);
  const [count, setCount] = useState(existing?.count ?? 1);
  const [weight, setWeight] = useState(existing?.grams ? String(existing.grams) : "");
  const [unit, setUnit] = useState<"g" | "kg">("g");
  const [note, setNote] = useState(existing?.note ?? "");
  const [when, setWhen] = useState<string | undefined>(startDate === today ? "today" : startDate === addDays(today, -1) ? "yesterday" : "date");
  const [date, setDate] = useState(startDate);
  const [diary, setDiary] = useState(!!existing?.journalEntryId);
  const [needWhat, setNeedWhat] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (id && !existing) return <NotFound what="picking" />;

  const plant = choice && choice !== OTHER ? garden.plants.find((p) => p.id === choice) : undefined;
  const back = existing
    ? href({ page: "harvest" })
    : fromPlant
      ? href({ page: "plant", id: fromPlant })
      : task
        ? href({ page: "jobs" })
        : href({ page: "harvest" });

  const save = () => {
    const name = plant ? plant.name : otherName.trim();
    if (!name) return setNeedWhat(true);
    const on = when === "yesterday" ? addDays(today, -1) : when === "date" ? date : today;
    const input = {
      date: on,
      plantId: plant?.id,
      name,
      size,
      count: counting ? count : undefined,
      grams: parseWeight(weight, unit),
      note,
      taskId: existing?.taskId ?? taskId,
      addToDiary: diary,
    };
    const what = plant ? plantLabel(plant) : name;
    if (existing) update((g) => updateHarvest(g, existing.id, input), "Picking updated", true);
    else update((g) => addHarvest(g, input)[0], `Lovely. ${what} added to the harvest log`, true);
    go(existing ? { page: "harvest" } : fromPlant ? { page: "plant", id: fromPlant } : task ? { page: "jobs" } : { page: "harvest" }, true);
  };

  const options = [
    ...plants.map((p) => ({ value: p.id, label: plantLabel(p) })),
    ...others.map((n) => ({ value: `name:${n}`, label: n })),
    { value: OTHER, label: "Something else" },
  ];
  const picked = choice?.startsWith("name:") ? OTHER : choice;

  return (
    <>
      <BackBar to={back} label={existing ? "Harvest log" : fromPlant ? (garden.plants.find((p) => p.id === fromPlant)?.name ?? "Back") : task ? "Jobs" : "Harvest log"} />
      <div className="stack-sm">
        <h1>{existing ? "Change this picking" : "I picked something"}</h1>
        {task && !existing && <p className="body">After “{task.title}”.</p>}
      </div>

      <div className="field">
        <span className="flabel">What did you pick?</span>
        <Chips
          label="What did you pick?"
          options={options}
          value={choice?.startsWith("name:") ? choice : picked}
          onChange={(v) => {
            setNeedWhat(false);
            if (v?.startsWith("name:")) {
              setChoice(v);
              setOtherName(v.slice(5));
            } else {
              setChoice(v);
              if (v !== OTHER) setOtherName("");
            }
          }}
        />
        {picked === OTHER && (
          <input
            className="input"
            aria-label="What did you pick?"
            value={otherName}
            placeholder="For example, blackberries from the hedge"
            autoFocus={!existing}
            onChange={(e) => (setOtherName(e.target.value), setNeedWhat(false))}
          />
        )}
        {plants.length === 0 && picked !== OTHER && (
          <p className="hint">Fruit, veg and herb plants you've added show here. You can also choose “Something else”.</p>
        )}
        {needWhat && (
          <p className="hint" role="status" style={{ color: "var(--struggle)" }}>
            Choose what you picked first.
          </p>
        )}
      </div>

      <div className="field">
        <span className="flabel">How much?</span>
        <Chips label="How much?" options={SIZES} value={size} onChange={setSize} />
        {!counting ? (
          <button type="button" className="btn quiet" style={{ alignSelf: "flex-start", padding: 0, minHeight: 40 }} onClick={() => setCounting(true)}>
            + Count them
          </button>
        ) : (
          <div className="stepper" role="group" aria-label="How many">
            <button type="button" className="chip" aria-label="One fewer" onClick={() => setCount(Math.max(1, count - 1))}>
              −
            </button>
            <input
              className="input"
              inputMode="numeric"
              aria-label="How many"
              value={count}
              onChange={(e) => setCount(Math.max(0, Math.min(999, Number(e.target.value.replace(/\D/g, "")) || 0)))}
            />
            <button type="button" className="chip" aria-label="One more" onClick={() => setCount(Math.min(999, count + 1))}>
              +
            </button>
            <button type="button" className="btn quiet" style={{ minHeight: 40 }} onClick={() => setCounting(false)}>
              Don't count
            </button>
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="h-weight">
          Weight <span className="optional">(if you weighed it)</span>
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input id="h-weight" className="input" inputMode="decimal" value={weight} placeholder="For example, 450" onChange={(e) => setWeight(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          <div className="chips" role="group" aria-label="Weight in" style={{ flexWrap: "nowrap" }}>
            {(["g", "kg"] as const).map((u) => (
              <button key={u} type="button" className="chip" aria-pressed={unit === u} onClick={() => setUnit(u)}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="field">
        <span className="flabel">When</span>
        <Chips
          label="When"
          options={[
            { value: "today", label: "Today" },
            { value: "yesterday", label: "Yesterday" },
            { value: "date", label: "Pick a date" },
          ]}
          value={when}
          onChange={(v) => setWhen(v ?? "today")}
        />
        {when === "date" && <input type="date" className="input" aria-label="Date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />}
      </div>

      <div className="field">
        <label htmlFor="h-note">
          Any notes? <span className="optional">(optional)</span>
        </label>
        <input id="h-note" className="input" value={note} placeholder="For example, the sweetest yet" onChange={(e) => setNote(e.target.value)} />
      </div>

      {!existing?.journalEntryId && (
        <div className="card" style={{ padding: "4px 16px" }}>
          <Switch id="h-diary" checked={diary} onChange={setDiary} label="Add to the garden diary" />
        </div>
      )}
      {existing?.journalEntryId && <p className="hint">This picking is also in the garden diary.</p>}

      <div className="btn-row">
        <button type="button" className="btn" onClick={save}>
          Save
        </button>
        <a className="btn quiet" href={back}>
          Cancel
        </a>
      </div>

      {existing && (
        <div className="stack" style={{ marginTop: 12 }}>
          {!confirm ? (
            <button type="button" className="btn quiet" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setConfirm(true)}>
              Remove from the harvest log
            </button>
          ) : (
            <div className="card stack">
              <p className="body">Remove this picking{existing.journalEntryId ? " and its diary entry" : ""}?</p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => {
                    update((g) => removeHarvest(g, existing.id), "Removed from the harvest log", true);
                    go({ page: "harvest" }, true);
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
      )}
    </>
  );
}

// First-time setup (v1.0), following the wireframe's "First-time setup" screen.
// Three ways in:
//  - a brand new phone (the garden has needsSetup), or "Start afresh" in Settings:
//    finishing replaces the garden with what was set up;
//  - "Try first-time setup" in Settings: a walk-through only, nothing is saved.
// Parts that need things Mary Mary doesn't have yet (photo recognition, everyday
// nudges) are shown greyed out as "Coming soon", as Stef asked. Joining a garden
// and invites work once sharing is switched on (v1.1, cloudConfig.ts).

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CATALOGUE } from "../lib/catalogue";
import { todayISO } from "../lib/dates";
import { AREA_KINDS } from "../lib/data";
import { cloudReady } from "../lib/cloudConfig";
import { loadExtra, saveExtra } from "../lib/db";
import {
  AREA_IDEAS,
  DAYS,
  GARDEN_NAME_IDEAS,
  LIKES,
  ROOMS,
  TIMES,
  blankAnswers,
  doneTitle,
  gardenFromSetup,
  namesList,
  starterIdeas,
} from "../lib/setup";
import type { Room, SetupAnswers } from "../lib/setup";
import { PRIORITIES } from "../lib/plan";
import type { Aspect, AreaKind, Gardener } from "../lib/types";
import { findPlace } from "../lib/weatherApi";
import { go, href } from "../router";
import { useStore } from "../store";
import { useSharing } from "../sharing";
import { IconBack, IconClose, IconLeaf, IconPlus } from "../icons";

type Starter = "" | "aspect" | "room" | "soil" | "matters" | "result";

interface Draft {
  step: number;
  areaIdx: number;
  ans: SetupAnswers;
}

const DRAFT_KEY = "setup-draft";
const LAST = 7;
const ASPECTS: Aspect[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const SOILS: Array<[string, string]> = [
  ["Sandy", "Gritty and light. Drains quickly, so it can dry out in summer."],
  ["Clay", "Sticky when wet and hard when dry. Holds on to water and goodness."],
  ["Chalky", "Pale and stony, often with white lumps. Drains quickly."],
  ["Loam", "Dark and crumbly, and easy to dig. A gardener's favourite."],
  ["Not sure", "That's fine. Squeeze a handful of damp soil. A sticky lump is probably clay, gritty and loose is probably sandy, and soft crumbs are probably loam."],
];
const PLAN_TAG: Record<string, string> = Object.fromEntries(PRIORITIES.map((p) => [p.label, p.tag]));

let keyCount = 0;
const newKey = () => `k${Date.now().toString(36)}${(keyCount++).toString(36)}`;

function Soon({ children }: { children: ReactNode }) {
  return (
    <div className="soon" aria-disabled="true">
      <span className="tag soon-tag">Coming soon</span>
      {children}
    </div>
  );
}

function Toggle<T extends string>({ value, on, label, full, onPick }: { value: T; on: boolean; label: string; full?: string; onPick: (v: T) => void }) {
  return (
    <button type="button" className="chip" aria-pressed={on} aria-label={full} onClick={() => onPick(value)}>
      {label}
    </button>
  );
}

export function SetupScreen({ trial }: { trial: boolean }) {
  const { garden, replaceAll } = useStore();
  const fresh = !!garden.settings.needsSetup;
  const shared = !!useSharing().link;
  const [step, setStep] = useState(0);
  const [areaIdx, setAreaIdx] = useState(0);
  const [ans, setAns] = useState<SetupAnswers>(blankAnswers);
  const [mode, setMode] = useState<"" | "name" | "unsure">("");
  const [draft, setDraft] = useState("");
  const [likeDraft, setLikeDraft] = useState("");
  const [st, setSt] = useState<Starter>("");
  const [room, setRoom] = useState<Room | undefined>();
  const [stNo, setStNo] = useState<string[]>([]);
  const [placeMsg, setPlaceMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(trial);
  const [finished, setFinished] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  // A new phone can open on any address: show #/setup, so finishing doesn't jump away.
  useEffect(() => {
    if (!trial && !/^#\/setup\b/.test(location.hash)) location.replace(href({ page: "setup" }));
  }, [trial]);

  // Pick up where we left off if the app was closed part way (not for a try-out).
  useEffect(() => {
    if (trial) return;
    loadExtra<Draft>(DRAFT_KEY)
      .then((d) => {
        if (d && d.ans) {
          setStep(Math.min(d.step, LAST - 1));
          setAreaIdx(d.areaIdx);
          setAns({ ...blankAnswers(), ...d.ans });
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [trial]);
  useEffect(() => {
    if (trial || !loaded || finished) return;
    saveExtra(DRAFT_KEY, { step, areaIdx, ans } satisfies Draft).catch(() => undefined);
  }, [trial, loaded, finished, step, areaIdx, ans]);

  // Each new screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step, areaIdx, st]);

  if (!loaded) return null;

  const set = (changes: Partial<SetupAnswers>) => setAns((a) => ({ ...a, ...changes }));
  const setPerson = (i: number, changes: Partial<Gardener>) =>
    setAns((a) => ({ ...a, people: a.people.map((p, j) => (j === i ? { ...p, ...changes } : p)) }));

  const named = ans.areas.filter((a) => a.name.trim());
  const ai = Math.min(areaIdx, Math.max(named.length - 1, 0));
  const cur = named[ai];
  const curName = cur?.name.trim() ?? "your garden";
  const curPlants = cur ? ans.plants.filter((p) => p.areaKey === cur.key) : [];
  const curPlanned = cur ? ans.planned.filter((p) => p.areaKey === cur.key) : [];
  const setCur = (changes: Partial<(typeof ans.areas)[number]>) =>
    cur && setAns((a) => ({ ...a, areas: a.areas.map((x) => (x.key === cur.key ? { ...x, ...changes } : x)) }));
  const ideas = cur ? starterIdeas(cur, { room, likes: ans.likes, month: new Date().getMonth() + 1, leaveOut: stNo }) : [];

  const finish = () => {
    if (!trial) {
      replaceAll(gardenFromSetup(ans, todayISO()));
      saveExtra(DRAFT_KEY, null).catch(() => undefined);
    }
    setFinished(true);
    setStep(LAST);
  };

  const next = async () => {
    if (st) {
      const order: Starter[] = ["aspect", "room", "soil", "matters", "result"];
      if (st === "result") {
        if (cur) set({ planned: [...ans.planned, ...ideas.map((p) => ({ areaKey: cur.key, catalogueId: p.id }))] });
        setSt("");
      } else setSt(order[order.indexOf(st) + 1]);
      return;
    }
    if (step === 3) {
      const pc = (ans.postcode ?? "").trim();
      if (pc && ans.location?.forPostcode !== pc && !placeMsg) {
        setBusy(true);
        try {
          const found = await findPlace(pc);
          set({ location: { ...found, forPostcode: pc } });
        } catch (e) {
          // Say what went wrong; tapping again carries on without it.
          setPlaceMsg(`${(e as Error).message} You can carry on and fix it in Settings later.`);
          setBusy(false);
          return;
        }
        setBusy(false);
      }
    }
    if (step === 4 && named.length === 0) {
      setStep(6);
      return;
    }
    if (step === 4) {
      setAreaIdx(0);
      setMode("");
      setStep(5);
      return;
    }
    if (step === 5 && ai < named.length - 1) {
      setAreaIdx(ai + 1);
      setMode("");
      setDraft("");
      return;
    }
    if (step === 6) {
      finish();
      return;
    }
    setMode("");
    setDraft("");
    setStep(step + 1);
  };

  const back = () => {
    if (st) {
      const prev: Record<Starter, Starter> = { "": "", aspect: "", room: "aspect", soil: "room", matters: "soil", result: "matters" };
      setSt(prev[st]);
      return;
    }
    if (step === 5 && ai > 0) {
      setAreaIdx(ai - 1);
      setMode("");
      return;
    }
    if (step === 6 && named.length === 0) {
      setStep(4);
      return;
    }
    if (step === 5) setAreaIdx(0);
    setMode("");
    setStep(Math.max(step - 1, 0));
  };

  const addDraft = () => {
    const t = draft.trim();
    if (!t || !cur) return;
    const item = mode === "unsure" ? { key: newKey(), areaKey: cur.key, name: "Not sure yet", describedAs: t } : { key: newKey(), areaKey: cur.key, name: t };
    set({ plants: [...ans.plants, item] });
    setDraft("");
    setMode("");
  };

  const addLike = () => {
    const t = likeDraft.trim();
    if (!t) return;
    if (!ans.likes.includes(t)) set({ likes: [...ans.likes, t] });
    setLikeDraft("");
  };
  const toggleLike = (l: string) => set({ likes: ans.likes.includes(l) ? ans.likes.filter((x) => x !== l) : [...ans.likes, l] });
  const customLikes = ans.likes.filter((l) => !LIKES.includes(l));

  const nextLabel =
    st === "result"
      ? ideas.length
        ? "Add these as planned"
        : "Carry on"
      : st === "matters"
        ? "Show me ideas"
        : st
          ? "Continue"
          : step === 0
            ? "Get started"
            : step === 3 && busy
              ? "Finding your place…"
              : step === 5 && ai < named.length - 1
                ? `Next: ${named[ai + 1].name.trim()}`
                : step === 6
                  ? "Finish"
                  : "Continue";

  const showTop = step > 0 && step < LAST;

  return (
    <div className="setup" ref={top}>
      {showTop && (
        <div className="topbar">
          <button type="button" className="icon-btn" onClick={back} aria-label="Back">
            <IconBack size={22} />
          </button>
          {!st && (
            <div className="setup-dots" aria-label={`Step ${step} of 6`} role="img">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <span key={n} className={n === step ? "on" : n < step ? "done" : ""} />
              ))}
            </div>
          )}
          {!st ? (
            <button type="button" className="text-btn" onClick={step === 6 ? finish : next}>
              Skip for now
            </button>
          ) : (
            <span style={{ width: 44 }} />
          )}
        </div>
      )}

      {trial && step < LAST && (
        <p className="setup-trial" role="note">
          Just trying it out. Nothing here will be saved.
        </p>
      )}

      <div className="setup-body">
        {/* 0. Welcome */}
        {step === 0 && (
          <div className="setup-welcome">
            <span className="setup-badge" aria-hidden="true">
              <IconLeaf size={52} color="#3B6D11" />
            </span>
            <div className="stack-sm" style={{ alignItems: "center" }}>
              <h1 style={{ fontSize: 34 }}>Mary Mary</h1>
              <p className="sub" style={{ fontSize: 16 }}>
                How does your garden grow?
              </p>
            </div>
            <p className="body" style={{ fontSize: 17, textAlign: "center" }}>
              Let's get to know your outside place.
            </p>
            {!trial && !fresh && (
              <div className="panel-amber" role="note">
                <p>
                  <strong>Starting afresh.</strong> When you finish, what you set up here replaces everything on this phone. Save a backup in Settings first if you might want it back.
                  {shared && " This garden is shared, so it will start afresh for everyone in it too."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 1. Garden name */}
        {step === 1 && (
          <div className="stack" style={{ gap: 18 }}>
            <div className="stack-sm" style={{ gap: 8 }}>
              <h1>What's your garden called?</h1>
              <p className="body">Anyone you invite to help will see this name, so they know they're joining the right garden.</p>
            </div>
            <div className="field">
              <label htmlFor="su-name">Garden name</label>
              <input id="su-name" className="input" value={ans.gardenName} onChange={(e) => set({ gardenName: e.target.value })} />
            </div>
            <div className="chips" role="group" aria-label="Name ideas">
              {GARDEN_NAME_IDEAS.map((n) => (
                <button key={n} type="button" className="chip" aria-pressed={ans.gardenName === n} onClick={() => set({ gardenName: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. Who's gardening */}
        {step === 2 && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="stack-sm" style={{ gap: 8 }}>
              <h1>Who's gardening?</h1>
              <p className="body">Add everyone who helps out and roughly how much time they have to garden.</p>
            </div>
            {ans.people.map((p, i) => (
              <div key={i} className="card stack" style={{ gap: 12 }}>
                <p className="label">{i === 0 ? "You" : "Another gardener"}</p>
                <div className="btn-row">
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={p.name}
                    placeholder="Name"
                    aria-label={`Name of person ${i + 1}`}
                    onChange={(e) => setPerson(i, { name: e.target.value })}
                  />
                  {ans.people.length > 1 && (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Remove person"
                      onClick={() => set({ people: ans.people.filter((_, j) => j !== i) })}
                    >
                      <IconClose />
                    </button>
                  )}
                </div>
                <div className="stack-sm" style={{ gap: 8 }}>
                  <p className="label">Time available in a typical week</p>
                  <div className="chips" role="group" aria-label="Time available in a typical week">
                    {TIMES.map((t) => (
                      <Toggle key={t.value} value={t.value} on={p.time === t.value} label={t.label} onPick={(v) => setPerson(i, { time: p.time === v ? undefined : v })} />
                    ))}
                  </div>
                </div>
                <div className="stack-sm" style={{ gap: 8 }}>
                  <p className="label">Which days usually suit? (optional)</p>
                  <div className="days" role="group" aria-label="Which days usually suit">
                    {DAYS.map(([short, day]) => (
                      <Toggle
                        key={day}
                        value={day}
                        on={p.days.includes(day)}
                        label={short}
                        full={day}
                        onPick={(d) => setPerson(i, { days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d] })}
                      />
                    ))}
                  </div>
                </div>
                {i > 0 && cloudReady() && (
                  <p className="hint">
                    {p.name.trim() || "They"} can have Mary Mary on their own phone too. When you've finished, you'll be able to send {p.name.trim() ? "them" : "an"} invite.
                  </p>
                )}
                {i > 0 && !cloudReady() && (
                  <Soon>
                    <p className="label">Invite them to join on their own phone</p>
                    <input className="input" disabled aria-label="Their mobile number or email" placeholder="Their mobile number or email" />
                    <button type="button" className="btn outline small" disabled>
                      Send invite
                    </button>
                    <p className="hint">Comes with sharing the garden between phones.</p>
                  </Soon>
                )}
              </div>
            ))}
            <button type="button" className="btn outline" onClick={() => set({ people: [...ans.people, { name: "", days: [] }] })}>
              <IconPlus size={20} />
              Add another person
            </button>
          </div>
        )}

        {/* 3. Where */}
        {step === 3 && (
          <div className="stack" style={{ gap: 18 }}>
            <div className="stack-sm" style={{ gap: 8 }}>
              <h1>Where's your garden?</h1>
              <p className="body">Mary Mary uses this for your local weather, frost warnings and the right timings for your area.</p>
            </div>
            <div className="field">
              <label htmlFor="su-place">Town or postcode</label>
              <input
                id="su-place"
                className="input"
                value={ans.postcode ?? ""}
                placeholder="Maidstone or ME14"
                autoCapitalize="characters"
                onChange={(e) => {
                  setPlaceMsg("");
                  set({ postcode: e.target.value });
                }}
              />
              <p className="hint">Only used for weather and never shared.</p>
            </div>
            {ans.location && ans.location.forPostcode === (ans.postcode ?? "").trim() && <p className="hint">Found it: {ans.location.place}.</p>}
            {placeMsg && (
              <p className="hint" role="status" style={{ color: "var(--struggle)" }}>
                {placeMsg}
              </p>
            )}
          </div>
        )}

        {/* 4. Areas */}
        {step === 4 && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="stack-sm" style={{ gap: 8 }}>
              <h1>Show your garden</h1>
              <p className="body">What are the different parts of your garden? Add each bed, border or group of pots. You can rename, remove or add more later.</p>
            </div>
            <Soon>
              <button type="button" className="btn outline full" disabled>
                Add photos
              </button>
              <p className="hint">Take a few photos as you walk round, and Mary Mary will suggest areas and names as you go.</p>
            </Soon>
            <div className="stack-sm" style={{ gap: 8 }}>
              <p className="label">Ideas to start from</p>
              <div className="chips" role="group" aria-label="Area ideas">
                {AREA_IDEAS.filter((x) => !ans.areas.some((a) => a.name === x.name)).map((x) => (
                  <button key={x.name} type="button" className="chip" onClick={() => set({ areas: [...ans.areas, { key: newKey(), name: x.name, kind: x.kind }] })}>
                    + {x.name}
                  </button>
                ))}
              </div>
            </div>
            {ans.areas.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <p className="label">Your areas</p>
                {ans.areas.map((a) => (
                  <div key={a.key} className="card stack" style={{ gap: 8, padding: "10px 12px" }}>
                    <div className="btn-row">
                      <input
                        className="input"
                        style={{ flex: 1 }}
                        value={a.name}
                        aria-label="Area name"
                        placeholder="Name this area"
                        onChange={(e) => set({ areas: ans.areas.map((x) => (x.key === a.key ? { ...x, name: e.target.value } : x)) })}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${a.name || "area"}`}
                        onClick={() => set({ areas: ans.areas.filter((x) => x.key !== a.key), plants: ans.plants.filter((p) => p.areaKey !== a.key), planned: ans.planned.filter((p) => p.areaKey !== a.key) })}
                      >
                        <IconClose />
                      </button>
                    </div>
                    <select
                      className="input select"
                      aria-label={`What kind of area ${a.name}`}
                      value={a.kind}
                      onChange={(e) => set({ areas: ans.areas.map((x) => (x.key === a.key ? { ...x, kind: e.target.value as AreaKind } : x)) })}
                    >
                      {AREA_KINDS.map((k) => (
                        <option key={k.kind} value={k.kind}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn outline" onClick={() => set({ areas: [...ans.areas, { key: newKey(), name: "", kind: "border" }] })}>
              <IconPlus size={20} />
              Add an area yourself
            </button>
          </div>
        )}

        {/* 5. What's growing, one area at a time */}
        {step === 5 && !st && cur && (
          <div className="stack" style={{ gap: 16 }}>
            {named.length > 1 && (
              <div className="setup-tabs" aria-label="Your areas">
                {named.map((a, i) => (
                  <span key={a.key} className={i === ai ? "on" : i < ai ? "done" : ""}>
                    {a.name.trim()}
                  </span>
                ))}
              </div>
            )}
            <div className="stack-sm" style={{ gap: 8 }}>
              <h1>What's growing in {curName}?</h1>
              <p className="body">Add as many or as few as you like. Mary Mary can help fill any gaps later.</p>
            </div>
            <Soon>
              <button type="button" className="goal" disabled>
                <span className="t">Take a photo</span>
                <span className="s">Mary Mary can identify it for you</span>
              </button>
            </Soon>
            <button type="button" className="goal" aria-pressed={mode === "name"} onClick={() => { setMode(mode === "name" ? "" : "name"); setDraft(""); }}>
              <span className="t">Use the name</span>
              <span className="s">Enter the name if you already know it</span>
            </button>
            <button type="button" className="goal" aria-pressed={mode === "unsure"} onClick={() => { setMode(mode === "unsure" ? "" : "unsure"); setDraft(""); }}>
              <span className="t">I'm not sure</span>
              <span className="s">Describe it, and it goes on your list to identify later</span>
            </button>
            {mode && (
              <form
                className="btn-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  addDraft();
                }}
              >
                <input
                  className="input"
                  style={{ flex: 1 }}
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label={mode === "unsure" ? "Describe the plant" : "Plant name"}
                  placeholder={mode === "unsure" ? "Tall, purple, spiky flowers" : "e.g. Rosa 'Roald Dahl'"}
                />
                <button type="submit" className="btn" style={{ flex: "none" }} disabled={!draft.trim()}>
                  Add
                </button>
              </form>
            )}
            {curPlants.length + curPlanned.length < 3 && (
              <button
                type="button"
                className="goal starter"
                onClick={() => {
                  setSt("aspect");
                  setRoom(undefined);
                  setStNo([]);
                }}
              >
                <span className="t">Not much planted yet?</span>
                <span className="s">Mary Mary can suggest a few easy plants to get you going</span>
              </button>
            )}
            {(curPlants.length > 0 || curPlanned.length > 0) && (
              <div className="stack-sm" style={{ gap: 8 }}>
                <p className="label">In {curName}</p>
                <div className="list">
                  {curPlants.map((p) => (
                    <div key={p.key} className="list-item">
                      <div className="grow">
                        <span className="title">{p.name}</span>
                        <span className="meta">{p.describedAs !== undefined ? `${p.describedAs}. On your list to identify.` : "Added by name"}</span>
                      </div>
                      <button type="button" className="icon-btn" aria-label={`Remove ${p.name}`} onClick={() => set({ plants: ans.plants.filter((x) => x.key !== p.key) })}>
                        <IconClose />
                      </button>
                    </div>
                  ))}
                  {curPlanned.map((p) => (
                    <div key={p.catalogueId} className="list-item">
                      <div className="grow">
                        <span className="title">{starterName(p.catalogueId)}</span>
                        <span className="meta">Planned. Mary Mary will help you plant it.</span>
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${starterName(p.catalogueId)}`}
                        onClick={() => set({ planned: ans.planned.filter((x) => !(x.areaKey === p.areaKey && x.catalogueId === p.catalogueId)) })}
                      >
                        <IconClose />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* "Not much planted yet?": a few questions, then a short list */}
        {st === "aspect" && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="stack-sm" style={{ gap: 8 }}>
              <h1>Which way does {curName} face?</h1>
              <p className="body">Think about where the sun is in the late afternoon. If the sun is on it then, it probably faces west or south-west.</p>
            </div>
            <div className="aspects" role="group" aria-label="Direction the area faces">
              {ASPECTS.map((a) => (
                <Toggle key={a} value={a} on={cur?.aspect === a} label={a} onPick={(v) => setCur({ aspect: cur?.aspect === v ? undefined : v })} />
              ))}
            </div>
            <Soon>
              <p className="hint">Work it out with your phone's compass when you're standing there.</p>
            </Soon>
            <p className="hint">
              {!cur?.aspect
                ? "Not sure? That's fine. Just tap Continue and Mary Mary will pick plants that cope with most spots."
                : ["S", "SE", "SW", "W"].includes(cur.aspect)
                  ? "A sunny spot for much of the day. Lots of plants will be happy here."
                  : ["N", "NE"].includes(cur.aspect)
                    ? "A cooler, shadier spot, so Mary Mary will pick plants that like it that way."
                    : "Sun for part of the day suits many plants."}
            </p>
          </div>
        )}

        {st === "room" && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="stack-sm" style={{ gap: 8 }}>
              <h1>How much room is there?</h1>
              <p className="body">A rough idea is plenty. Mary Mary will suggest a few plants first, so it never feels like too much.</p>
            </div>
            {ROOMS.map((r) => (
              <button key={r.value} type="button" className="goal" aria-pressed={room === r.value} onClick={() => setRoom(room === r.value ? undefined : r.value)}>
                <span className="t">{r.title}</span>
                <span className="s">{r.sub}</span>
              </button>
            ))}
          </div>
        )}

        {st === "soil" && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="stack-sm" style={{ gap: 8 }}>
              <h1>What's the soil like? (optional)</h1>
              <p className="body">Not everyone knows, and you can skip this. Just tap Continue.</p>
            </div>
            <div className="chips" role="group" aria-label="Soil type">
              {SOILS.map(([s]) => (
                <Toggle key={s} value={s} on={cur?.soil === s} label={s} onPick={(v) => setCur({ soil: cur?.soil === v ? undefined : v })} />
              ))}
            </div>
            <p className="hint">{SOILS.find(([s]) => s === cur?.soil)?.[1] ?? "Lots of people don't know, and that's fine. Mary Mary will choose plants that cope with most soils."}</p>
          </div>
        )}

        {st === "matters" && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="stack-sm" style={{ gap: 8 }}>
              <h1>What matters most to you?</h1>
              <p className="body">Pick any that fit. Mary Mary uses these to choose plants you'll enjoy.</p>
            </div>
            <div className="chips" role="group" aria-label="What matters most">
              {LIKES.map((l) => (
                <Toggle key={l} value={l} on={ans.likes.includes(l)} label={l} onPick={toggleLike} />
              ))}
            </div>
          </div>
        )}

        {st === "result" && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="stack-sm" style={{ gap: 8 }}>
              <h1>Where to start in {curName}</h1>
              <p className="body">A few easy, forgiving plants to get you going. You can change any of this later.</p>
              <p className="hint">{cur?.soil && cur.soil !== "Not sure" ? `Chosen with ${cur.soil.toLowerCase()} soil in mind.` : "Chosen to cope with most soils."} This is general UK advice: always check the label.</p>
            </div>
            {ideas.length === 0 && (
              <p className="empty">You've taken everything off the list. Tap the back arrow to change your answers, or carry on and add plants yourself.</p>
            )}
            {ideas.map((p) => {
              const tags = [
                ...(ans.likes.includes("Growing food") && ["Herbs", "Fruit", "Vegetables"].includes(p.section) ? ["Good to eat"] : []),
                ...ans.likes
                  .filter((l) => PLAN_TAG[l])
                  .filter((l) => (l === "Flowers and colour" && p.colours.some((c) => c !== "green")) || (l === "Wildlife" && p.wildlife) || (l === "Low maintenance" && p.easy) || (l === "Trying new things" && p.unusual))
                  .map((l) => PLAN_TAG[l]),
              ];
              return (
                <div key={p.id} className="sugg">
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div className="stack-sm">
                      <span className="name">{p.name}</span>
                      {p.latin && <span className="latin">{p.latin}</span>}
                    </div>
                    <button type="button" className="btn quiet small" onClick={() => setStNo([...stNo, p.id])}>
                      Not for me
                    </button>
                  </div>
                  <p className="why">{p.why}</p>
                  {tags.length > 0 && (
                    <div className="tags">
                      {tags.map((t) => (
                        <span key={t} className="tag green">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 6. How should Mary Mary help */}
        {step === 6 && (
          <div className="stack" style={{ gap: 18 }}>
            <div className="stack-sm" style={{ gap: 8 }}>
              <h1>How should Mary Mary help?</h1>
              <p className="body">You can change any of this later.</p>
            </div>
            <Soon>
              <p className="label">How often should Mary Mary nudge you?</p>
              <div className="chips">
                {["Daily", "A few times a week", "Weekly", "Never"].map((f) => (
                  <button key={f} type="button" className="chip" disabled>
                    {f}
                  </button>
                ))}
              </div>
              <p className="label" style={{ marginTop: 6 }}>
                Quiet time
              </p>
              <p className="hint">No nudges between 8pm and 8am.</p>
              <p className="hint">
                Everyday nudges aren't here yet. Urgent alerts for frost, storms and heatwaves can be turned on in{" "}
                {trial ? "Settings" : "Settings once you've finished"}.
              </p>
            </Soon>
            <div className="stack-sm" style={{ gap: 8 }}>
              <p className="label">What matters most to you?</p>
              <p className="hint">Tell Mary Mary all the things you want to focus on. For example, growing veg, planting plans, lawn care.</p>
            </div>
            <div className="chips" role="group" aria-label="What matters most">
              {LIKES.map((l) => (
                <Toggle key={l} value={l} on={ans.likes.includes(l)} label={l} onPick={toggleLike} />
              ))}
            </div>
            <form
              className="btn-row"
              onSubmit={(e) => {
                e.preventDefault();
                addLike();
              }}
            >
              <input className="input" style={{ flex: 1 }} value={likeDraft} onChange={(e) => setLikeDraft(e.target.value)} aria-label="Add something else that matters to you" placeholder="Something else" />
              <button type="submit" className="btn" style={{ flex: "none" }} disabled={!likeDraft.trim()}>
                Add
              </button>
            </form>
            {customLikes.length > 0 && (
              <div className="stack-sm" style={{ gap: 8 }}>
                <p className="label">I want Mary Mary to work with me on</p>
                <div className="list">
                  {customLikes.map((l) => (
                    <div key={l} className="list-item">
                      <span className="grow title">{l}</span>
                      <button type="button" className="icon-btn" aria-label={`Remove ${l}`} onClick={() => set({ likes: ans.likes.filter((x) => x !== l) })}>
                        <IconClose />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7. Done */}
        {step === LAST && (
          <div className="setup-welcome">
            <span className="setup-badge" aria-hidden="true">
              <IconLeaf size={52} color="#3B6D11" />
            </span>
            <div className="stack-sm" style={{ alignItems: "center", gap: 10 }}>
              <h1 style={{ textAlign: "center" }}>{doneTitle(ans.people)}</h1>
              <p className="sub" style={{ fontSize: 16 }}>
                Time to get gardening
              </p>
            </div>
            <p className="body" style={{ textAlign: "center", fontSize: 15 }}>
              Let's start small, with one or two easy jobs. Keep going and Mary Mary will learn more about your garden, helping you create your perfect outside place.
            </p>
            {trial && (
              <div className="panel-green">
                <p className="v">That was a try-out, so nothing was saved. Your garden is just as it was.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="setup-foot">
        {step < LAST && (
          <button type="button" className="btn full" onClick={next} disabled={busy || (step === 5 && !cur)}>
            {nextLabel}
          </button>
        )}
        {step === 0 && (
          <>
            {cloudReady() && !trial ? (
              <a className="btn outline full" href={href({ page: "join" })}>
                Been invited? Join a garden
              </a>
            ) : (
              <Soon>
                <button type="button" className="btn quiet full" disabled>
                  Been invited? Join a garden
                </button>
              </Soon>
            )}
            {fresh && !trial && (
              <a className="btn quiet full" href={href({ page: "settings" })}>
                Moving from another phone? Restore a backup
              </a>
            )}
            {(trial || !fresh) && (
              <a className="btn quiet full" href={href({ page: "settings" })}>
                Back to Settings
              </a>
            )}
          </>
        )}
        {step === LAST && !trial && (
          <button type="button" className="btn full" onClick={() => go({ page: "home" })}>
            Go to your garden
          </button>
        )}
        {step === LAST && !trial && cloudReady() && ans.people.slice(1).some((p) => p.name.trim()) && (
          <a className="btn outline full" href={href({ page: "sharing" })}>
            Invite {namesList(ans.people.slice(1).map((p) => p.name.trim()).filter(Boolean))} to join
          </a>
        )}
        {step === LAST && trial && (
          <>
            <a className="btn full" href={href({ page: "settings" })}>
              Back to Settings
            </a>
            <button
              type="button"
              className="btn quiet full"
              onClick={() => {
                setAns(blankAnswers());
                setStep(0);
                setAreaIdx(0);
                setFinished(false);
              }}
            >
              Start again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function starterName(id: string): string {
  return CATALOGUE.find((c) => c.id === id)?.name ?? id;
}

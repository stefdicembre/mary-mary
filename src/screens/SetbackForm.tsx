import { useState } from "react";
import { logSetback } from "../lib/actions";
import { todayISO } from "../lib/dates";
import { REASONS, guessReasons, lessonFor, reasonLabel } from "../lib/reasons";
import type { ReasonKey, SetbackOutcome } from "../lib/types";
import { go, href } from "../router";
import { useStore } from "../store";
import { BackBar, Chips, NotFound, Switch } from "../ui";

const OUTCOMES: Array<{ value: SetbackOutcome; label: string }> = [
  { value: "struggling", label: "Struggling" },
  { value: "died", label: "Died" },
  { value: "removed", label: "Pulled it out" },
];

export function SetbackForm({ id, outcome: initial }: { id: string; outcome: SetbackOutcome }) {
  const { garden, update } = useStore();
  const plant = garden.plants.find((p) => p.id === id);
  const [outcome, setOutcome] = useState<SetbackOutcome | undefined>(initial);
  const [reasons, setReasons] = useState<ReasonKey[]>([]);
  const [details, setDetails] = useState<Partial<Record<ReasonKey, string>>>({});
  const [words, setWords] = useState("");
  const [date, setDate] = useState(todayISO());
  const [diary, setDiary] = useState(true);
  if (!plant) return <NotFound what="plant" />;
  const area = garden.areas.find((a) => a.id === plant.areaId);

  const toggleReason = (k: ReasonKey) => {
    if (reasons.includes(k)) {
      setReasons(reasons.filter((r) => r !== k));
      const d = { ...details };
      delete d[k];
      setDetails(d);
    } else {
      // "Don't know" on its own; picking a real reason clears it.
      setReasons(k === "dontKnow" ? ["dontKnow"] : [...reasons.filter((r) => r !== "dontKnow"), k]);
      if (k === "dontKnow") setDetails({});
    }
  };

  // Offer reasons spotted in the gardener's words that aren't picked yet.
  const suggestions = guessReasons(words).filter((gs) => !(reasons.includes(gs.key) && (!gs.detail || details[gs.key] === gs.detail)));

  const save = () => {
    const chosen = outcome ?? "struggling";
    update(
      (g) =>
        logSetback(g, {
          plantId: id,
          date,
          outcome: chosen,
          reasons,
          details,
          inOwnWords: words,
          addToDiary: diary,
        }),
      chosen === "struggling" ? `Noted. ${plant.name} is flagged as struggling` : `Noted. ${plant.name} has moved to Didn't make it`,
      true,
    );
    go({ page: "plant", id }, true);
  };

  const firstReal = reasons.find((r) => r !== "dontKnow");
  const lesson = firstReal ? lessonFor(firstReal, details[firstReal]) : "";

  return (
    <>
      <BackBar to={href({ page: "plant", id })} label={plant.name} />
      <div className="stack-sm">
        <h1>Not doing well</h1>
        <p className="sub">
          {plant.name} in {area?.name}
        </p>
      </div>

      <div className="field">
        <span className="flabel">What's happened?</span>
        <Chips label="What's happened" options={OUTCOMES} value={outcome} onChange={setOutcome} />
      </div>

      <div className="field">
        <span className="flabel">
          What went wrong? <span className="optional">Only if you know</span>
        </span>
        <div className="chips" role="group" aria-label="What went wrong">
          {REASONS.map((r) => (
            <button key={r.key} type="button" className="chip" aria-pressed={reasons.includes(r.key)} onClick={() => toggleReason(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {REASONS.filter((r) => r.options && reasons.includes(r.key)).map((r) => (
        <div key={r.key} className="field">
          <span className="flabel">
            {r.question} <span className="optional">(optional)</span>
          </span>
          <Chips
            label={r.question ?? r.label}
            options={r.options!.map((o) => ({ value: o, label: o }))}
            value={details[r.key]}
            onChange={(v) => setDetails({ ...details, [r.key]: v })}
          />
        </div>
      ))}

      <div className="field">
        <label htmlFor="sb-words">
          In your own words <span className="optional">(optional)</span>
        </label>
        <textarea
          id="sb-words"
          className="textarea"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          placeholder="For example, the caterpillars ate all the leaves"
        />
        {suggestions.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <p className="hint">Sounds like:</p>
            <div className="chips">
              {suggestions.map((gs) => (
                <button
                  key={gs.key + (gs.detail ?? "")}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setReasons([...reasons.filter((r) => r !== "dontKnow" && r !== gs.key), gs.key]);
                    if (gs.detail) setDetails({ ...details, [gs.key]: gs.detail });
                  }}
                >
                  + {reasonLabel(gs.key, gs.detail)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="sb-date">When</label>
        <input id="sb-date" type="date" className="input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
      </div>

      <div className="card" style={{ padding: "4px 16px" }}>
        <Switch id="sb-diary" checked={diary} onChange={setDiary} label="Add to the garden diary" />
      </div>

      {lesson && (
        <div className="panel-green">
          <p className="k">Next time</p>
          <p className="v">{lesson}</p>
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn" onClick={save}>
          Save
        </button>
        <a className="btn quiet" href={href({ page: "plant", id })}>
          Cancel
        </a>
      </div>
    </>
  );
}

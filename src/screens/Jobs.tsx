import { useState } from "react";
import { addEntry } from "../lib/actions";
import { shortDate, todayISO } from "../lib/dates";
import { addDays, addTask, completeJob, deleteTask, jobLists, nextMonthJobs, snoozeJob, undoDone } from "../lib/jobs";
import type { JobItem } from "../lib/jobs";
import { adviceFor } from "../lib/weather";
import { go, href } from "../router";
import { useStore } from "../store";
import { BackBar, Chips, Switch } from "../ui";
import { useWeather } from "../weatherStore";
import { PhotoPicker } from "./Diary";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dueWords = (due: string, today: string) => {
  if (due < today) return `Overdue since ${shortDate(due)}`;
  if (due === today) return "Due today";
  if (due === addDays(today, 1)) return "Due tomorrow";
  if (due <= addDays(today, 6)) return `Due ${WEEKDAY[new Date(due + "T12:00:00Z").getUTCDay()]}`;
  return `Due ${shortDate(due)}`;
};

/** Shared by Home and the Jobs screen. */
export function useJobs() {
  const { garden } = useStore();
  const { forecast } = useWeather();
  const today = todayISO();
  const advice = forecast ? adviceFor(forecast, garden, today) : [];
  return { today, ...jobLists(garden, today, advice) };
}

export function JobRow({ job, compact }: { job: JobItem; compact?: boolean }) {
  const { update } = useStore();
  const today = todayISO();
  const tag = job.kind === "weather" ? { t: "Frost tonight", c: "blue" } : job.overdue ? { t: "Overdue", c: "amber" } : job.dueOn ? { t: dueWords(job.dueOn, today), c: "green" } : job.lastChance ? { t: "Last chance this month", c: "amber" } : undefined;
  return (
    <div className="job">
      <button
        type="button"
        className="job-tick"
        aria-label={`Done: ${job.title}`}
        onClick={() => update((g) => completeJob(g, job, today)[0], "Done. Lovely work.", true)}
      >
        <span className="tick" aria-hidden="true" />
      </button>
      <div className="job-main">
        {job.kind === "weather" ? (
          <a href={href({ page: "weather" })} className="job-title" style={{ color: "var(--ink)", textDecoration: "none" }}>
            {job.title}
          </a>
        ) : (
          <span className="job-title">{job.title}</span>
        )}
        <span className="job-meta">
          {job.where}
          {job.minutes ? ` · ${job.minutes} min` : ""}
        </span>
        {!compact && job.why && <span className="job-why">{job.why}</span>}
        {tag && <span className={`tag ${tag.c}`} style={{ alignSelf: "flex-start", marginTop: 2 }}>{tag.t}</span>}
      </div>
      {!compact && (
        <div className="job-side">
          <button type="button" className="btn quiet" style={{ minHeight: 40, padding: "0 4px", fontSize: 13 }} onClick={() => update((g) => snoozeJob(g, job.key, today), "Put off for a week", true)}>
            Not now
          </button>
          {job.kind === "mine" && job.taskId && (
            <button type="button" className="btn quiet" style={{ minHeight: 40, padding: "0 4px", fontSize: 13 }} onClick={() => update((g) => deleteTask(g, job.taskId!), "Job removed", true)}>
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const TIME_FILTERS = [
  { value: "10", label: "10 minutes" },
  { value: "30", label: "Half an hour" },
  { value: "60", label: "An hour" },
];

export function JobsScreen() {
  const { garden, update } = useStore();
  const { today, thisWeek, later, done } = useJobs();
  const [time, setTime] = useState<string | undefined>();
  const fitsTime = (j: JobItem) => !time || (j.minutes ?? 15) <= Number(time);
  const shown = thisWeek.filter(fitsTime);
  const ahead = nextMonthJobs(garden, today);
  const hasEntry = (taskId: string) => garden.journal.some((j) => j.taskId === taskId);

  return (
    <>
      <BackBar to="#/" label="Home" />
      <div className="stack-sm">
        <h1>Jobs</h1>
        <p className="body">Mary Mary suggests jobs that suit your garden and the time of year. Add your own too.</p>
      </div>
      <div className="btn-row">
        <a className="btn outline small" href={href({ page: "newJob" })}>
          + Add a job
        </a>
        <a className="btn outline small" href={href({ page: "didJob" })} style={{ flex: "none" }}>
          Add something I did
        </a>
      </div>

      <div className="field">
        <span className="flabel">How much time have you got?</span>
        <Chips label="How much time have you got?" options={TIME_FILTERS} value={time} onChange={setTime} />
      </div>

      <div className="stack">
        <h2>This week</h2>
        {shown.length === 0 ? (
          <p className="empty">{thisWeek.length ? "Nothing that short this week. Try a longer time." : "All done. Lovely work."}</p>
        ) : (
          <div className="list">
            {shown.map((j) => (
              <JobRow key={j.key} job={j} />
            ))}
          </div>
        )}
      </div>

      {later.length > 0 && (
        <div className="stack">
          <h2>Later</h2>
          <div className="list">
            {later.map((j) => (
              <div key={j.key} className="list-item">
                <span className="grow">
                  <span className="title" style={{ fontWeight: 500 }}>{j.title}</span>
                  <span className="meta">
                    {j.dueOn ? dueWords(j.dueOn, today) : garden.snoozed[j.key] ? (j.lastChance ? "Put off. Its season ends this month" : `Back on the list ${shortDate(garden.snoozed[j.key])}`) : ""}
                    {j.where ? ` · ${j.where}` : ""}
                  </span>
                </span>
                {garden.snoozed[j.key] && (
                  <button
                    type="button"
                    className="btn quiet"
                    style={{ minHeight: 40, fontSize: 13 }}
                    onClick={() =>
                      update((g) => {
                        const s = { ...g.snoozed };
                        delete s[j.key];
                        return { ...g, snoozed: s };
                      })
                    }
                  >
                    Do this week
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {ahead.length > 0 && (
        <div className="stack">
          <h2>Coming up next month</h2>
          <div className="card stack" style={{ gap: 6 }}>
            {ahead.map((j) => (
              <p key={j.id} className="body">
                {j.title}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="stack">
        <h2>Done recently</h2>
        {done.length === 0 ? (
          <p className="empty">Nothing ticked off in the last two weeks yet.</p>
        ) : (
          <div className="list">
            {done.map((t) => (
              <div key={t.id} className="list-item" style={{ flexWrap: "wrap" }}>
                <span className="grow">
                  <span className="title" style={{ fontWeight: 500 }}>{t.title}</span>
                  <span className="meta">
                    {t.doneOn === today ? "Done today" : `Done ${shortDate(t.doneOn)}`}
                    {t.areaId ? ` · ${garden.areas.find((a) => a.id === t.areaId)?.name ?? ""}` : ""}
                  </span>
                </span>
                {hasEntry(t.id) ? (
                  <span className="tag green">In the diary</span>
                ) : (
                  <a className="btn quiet" style={{ minHeight: 40, fontSize: 13 }} href={href({ page: "diaryNew", taskId: t.id })}>
                    + Diary
                  </a>
                )}
                <button type="button" className="btn quiet" style={{ minHeight: 40, fontSize: 13 }} onClick={() => update((g) => undoDone(g, t.id), "Back on the list", true)}>
                  Undo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="hint">Seasonal jobs are general advice for most of England and Wales. Further north, things often happen a couple of weeks later.</p>
    </>
  );
}

const WHEN = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "next", label: "Next week" },
  { value: "date", label: "Pick a date" },
];
const HOW_LONG = [
  { value: "5", label: "5 min" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "An hour" },
  { value: "120", label: "Longer" },
];

export function JobForm() {
  const { garden, update } = useStore();
  const today = todayISO();
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState("");
  const [when, setWhen] = useState<string | undefined>("week");
  const [date, setDate] = useState(addDays(today, 3));
  const [mins, setMins] = useState<string | undefined>("15");
  const [notes, setNotes] = useState("");
  const [needTitle, setNeedTitle] = useState(false);

  const save = () => {
    const t = title.trim();
    if (!t) return setNeedTitle(true);
    const dueOn = when === "today" ? today : when === "week" ? addDays(today, 6) : when === "next" ? addDays(today, 13) : when === "date" ? date : undefined;
    update((g) => addTask(g, { title: t, areaId: areaId || undefined, dueOn, minutes: mins ? Number(mins) : undefined, notes: notes.trim() || undefined })[0], "Job added", true);
    go({ page: "jobs" }, true);
  };

  return (
    <>
      <BackBar to={href({ page: "jobs" })} label="Jobs" />
      <div className="stack-sm">
        <h1>Add a job</h1>
        <p className="body">Anything else you'd like to get done. It sits alongside Mary Mary's suggestions.</p>
      </div>
      <div className="field">
        <label htmlFor="j-title">What needs doing?</label>
        <input id="j-title" className="input" value={title} placeholder="For example, fix the shed door" onChange={(e) => (setTitle(e.target.value), setNeedTitle(false))} />
        {needTitle && <p className="hint" role="status">Add a few words about the job first.</p>}
      </div>
      <div className="field">
        <label htmlFor="j-where">Where</label>
        <select id="j-where" className="select input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Anywhere in the garden</option>
          {garden.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span className="flabel">When</span>
        <Chips label="When" options={WHEN} value={when} onChange={setWhen} />
        {when === "date" && <input type="date" className="input" aria-label="Date" value={date} min={today} onChange={(e) => setDate(e.target.value || today)} />}
      </div>
      <div className="field">
        <span className="flabel">How long, roughly?</span>
        <Chips label="How long" options={HOW_LONG} value={mins} onChange={setMins} />
      </div>
      <div className="field">
        <label htmlFor="j-notes">
          Anything you'll need? <span className="optional">(optional)</span>
        </label>
        <input id="j-notes" className="input" value={notes} placeholder="For example, twine and secateurs" onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="btn-row">
        <button type="button" className="btn" onClick={save}>
          Add job
        </button>
        <a className="btn quiet" href={href({ page: "jobs" })}>
          Cancel
        </a>
      </div>
    </>
  );
}

export function DidSomethingForm() {
  const { garden, update } = useStore();
  const today = todayISO();
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState("");
  const [when, setWhen] = useState<string | undefined>("today");
  const [date, setDate] = useState(today);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [diary, setDiary] = useState(true);
  const [needTitle, setNeedTitle] = useState(false);

  const save = () => {
    const t = title.trim();
    if (!t) return setNeedTitle(true);
    const doneOn = when === "yesterday" ? addDays(today, -1) : when === "date" ? date : today;
    update((g) => {
      const [g1, taskId] = addTask(g, { title: t, areaId: areaId || undefined, doneOn, extra: true });
      if (!diary) return g1;
      return addEntry(g1, { date: doneOn, text: t, plantIds: [], areaIds: areaId ? [areaId] : [], taskId, photoIds })[0];
    }, "Noted. Lovely work.", true);
    go({ page: "jobs" }, true);
  };

  return (
    <>
      <BackBar to={href({ page: "jobs" })} label="Jobs" />
      <div className="stack-sm">
        <h1>Add something I did</h1>
        <p className="body">Anything you did that wasn't on the list. It goes under Done recently.</p>
      </div>
      <div className="field">
        <label htmlFor="d-title">What did you do?</label>
        <input id="d-title" className="input" value={title} placeholder="For example, cleared the gutter on the greenhouse" onChange={(e) => (setTitle(e.target.value), setNeedTitle(false))} />
        {needTitle && <p className="hint" role="status">Add a few words first.</p>}
      </div>
      <div className="field">
        <label htmlFor="d-where">Where</label>
        <select id="d-where" className="select input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Anywhere in the garden</option>
          {garden.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
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
          onChange={setWhen}
        />
        {when === "date" && <input type="date" className="input" aria-label="Date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />}
      </div>
      <div className="card" style={{ padding: "4px 16px" }}>
        <Switch id="d-diary" checked={diary} onChange={setDiary} label="Add to the garden diary" />
      </div>
      {diary && <PhotoPicker ids={photoIds} onChange={setPhotoIds} />}
      <div className="btn-row">
        <button type="button" className="btn" onClick={save}>
          Save
        </button>
        <a className="btn quiet" href={href({ page: "jobs" })}>
          Cancel
        </a>
      </div>
    </>
  );
}

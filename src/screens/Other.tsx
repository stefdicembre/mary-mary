import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { updateSettings } from "../lib/actions";
import { isGardenData, plantsToCSV } from "../lib/data";
import { harvestsIn, harvestsToCSV } from "../lib/harvest";
import { shortDate, todayISO } from "../lib/dates";
import { setbackSummary } from "../lib/reasons";
import { IconBag, IconBasket, IconBook, IconCheck, IconClose, IconCog, IconDownload, IconLeaf, IconMap, IconNext, IconPeople, SkyIcon } from "../icons";
import { exportPhotos, importPhotos } from "../lib/photos";
import { photosInUse } from "../lib/actions";
import { findPlace } from "../lib/weatherApi";
import { dateWords, fetchFrostDates, frostFor, frostSourceWords } from "../lib/sowing";
import { href } from "../router";
import { useStore } from "../store";
import { BackBar } from "../ui";
import { NotifySettings } from "./Notify";
import { SyncLine } from "./Sharing";
import { useSharing } from "../sharing";

export function Menu() {
  const { garden } = useStore();
  const lostCount = garden.plants.filter((p) => p.status === "lost").length;
  const lowCount = garden.supplies.filter((s) => s.level !== "plenty").length;
  const pickedThisYear = harvestsIn(garden, Number(todayISO().slice(0, 4))).length;
  const item = (to: string, icon: ReactNode, title: string, sub: string) => (
    <a className="list-item" href={to} style={{ minHeight: 68 }}>
      <span style={{ flex: "none", width: 40, height: 40, borderRadius: "50%", background: "var(--green-pale)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </span>
      <span className="grow">
        <span className="title">{title}</span>
        <span className="meta">{sub}</span>
      </span>
      <IconNext />
    </a>
  );
  return (
    <>
      <div className="topbar">
        <a className="icon-btn" href="#/" aria-label="Close menu">
          <IconClose />
        </a>
      </div>
      <h1>Menu</h1>
      <div className="list">
        {item(href({ page: "jobs" }), <IconCheck />, "Jobs", "This week's jobs, and what you've done")}
        {item(href({ page: "diary" }), <IconBook />, "Garden diary", "See how your garden has grown")}
        {item(href({ page: "harvest" }), <IconBasket />, "Harvest log", pickedThisYear ? `${pickedThisYear} ${pickedThisYear === 1 ? "picking" : "pickings"} this year` : "What you've picked, and how much")}
        {item(href({ page: "supplies" }), <IconBag />, "Supplies", lowCount ? `${lowCount} running low or used up` : "What's in the shed, and what your jobs need")}
        {item(href({ page: "map" }), <IconMap />, "Garden map", "Where everything is, and what's planted where")}
        {item(href({ page: "weather" }), <SkyIcon sky="partly" size={24} />, "Weather", "The week ahead, and what it means for the garden")}
        {item(href({ page: "lost" }), <IconLeaf size={22} />, "Didn't make it", lostCount ? `${lostCount} ${lostCount === 1 ? "plant" : "plants"} to learn from` : "Nothing lost so far")}
        {item(href({ page: "sharing" }), <IconPeople />, "Sharing", "Invite someone to garden with you")}
        {item(href({ page: "settings" }), <IconCog size={22} color="#3B6D11" />, "Settings and backup", "Your garden's name, and saving a copy")}
      </div>
    </>
  );
}

export function Lost() {
  const { garden } = useStore();
  const lost = garden.plants.filter((p) => p.status === "lost").sort((a, b) => (b.lostOn ?? "").localeCompare(a.lostOn ?? ""));
  const areaName = (id: string) => garden.areas.find((a) => a.id === id)?.name ?? "";
  const latest = (plantId: string) => garden.setbacks.filter((s) => s.plantId === plantId).sort((a, b) => b.date.localeCompare(a.date))[0];
  return (
    <>
      <BackBar to={href({ page: "menu" })} label="Menu" />
      <div className="stack-sm">
        <h1>Didn't make it</h1>
        <p className="body">Every gardener loses plants. Keeping a note of why helps Mary Mary suggest better next time.</p>
      </div>
      {lost.length === 0 ? (
        <p className="empty">Nothing here. Long may it last.</p>
      ) : (
        <div className="list">
          {lost.map((p) => {
            const s = latest(p.id);
            const why = s ? setbackSummary(s) : "";
            return (
              <a key={p.id} className="list-item" href={href({ page: "plant", id: p.id })}>
                <span className="grow">
                  <span className="title">{p.name}</span>
                  <span className="meta">
                    {areaName(p.areaId)}
                    {p.lostOn ? ` · ${shortDate(p.lostOn)}` : ""}
                  </span>
                  {why && <span className="mark-struggle">{why}</span>}
                </span>
                <IconNext />
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Hands a file to the phone's share sheet (so it can go to Files or email), or downloads it. */
async function saveFile(name: string, type: string, text: string): Promise<void> {
  const file = new File([text], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function Settings() {
  const { garden, update, replaceAll } = useStore();
  const sharing = useSharing();
  const [gardenName, setGardenName] = useState(garden.settings.gardenName);
  const [yourName, setYourName] = useState(garden.settings.yourName);
  const [postcode, setPostcode] = useState(garden.settings.postcode ?? "");
  const [restoreMsg, setRestoreMsg] = useState("");
  const [placeMsg, setPlaceMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stamp = todayISO();

  const counts = `${garden.areas.length} areas, ${garden.plants.length} plants, ${garden.journal.length} diary entries${garden.harvests.length ? `, ${garden.harvests.length} pickings` : ""}`;

  return (
    <>
      <BackBar to="#/" label="Home" />
      <h1>Settings</h1>

      <div className="stack">
        <h2>Your garden</h2>
        <div className="field">
          <label htmlFor="s-garden">Garden name</label>
          <input id="s-garden" className="input" value={gardenName} onChange={(e) => setGardenName(e.target.value)} />
          <p className="hint">Shown under the Mary Mary title.</p>
        </div>
        <div className="field">
          <label htmlFor="s-you">Your name</label>
          <input id="s-you" className="input" value={yourName} onChange={(e) => setYourName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="s-post">
            Town or postcode <span className="optional">(for the weather)</span>
          </label>
          <input id="s-post" className="input" value={postcode} autoCapitalize="characters" onChange={(e) => setPostcode(e.target.value)} />
          <p className="hint">Only used for your local weather and frost warnings. Never shared.</p>
        </div>
        {garden.settings.location && garden.settings.location.forPostcode === (garden.settings.postcode ?? "") && (
          <p className="hint">Weather is for {garden.settings.location.place}.</p>
        )}
        {placeMsg && (
          <p className="hint" role="status" style={{ color: "var(--struggle)" }}>
            {placeMsg}
          </p>
        )}
        <button
          type="button"
          className="btn"
          disabled={saving}
          onClick={async () => {
            setPlaceMsg("");
            const pc = postcode.trim();
            let location = garden.settings.location;
            if (!pc) location = undefined;
            else if (!location || location.forPostcode !== pc) {
              setSaving(true);
              try {
                const found = await findPlace(pc);
                location = { ...found, forPostcode: pc };
              } catch (e) {
                setPlaceMsg((e as Error).message);
                setSaving(false);
                return;
              }
              setSaving(false);
            }
            const newName = yourName.trim() || garden.settings.yourName;
            if (sharing.link && newName !== garden.settings.yourName) sharing.rename(newName).catch(() => undefined);
            update(
              (g) =>
                updateSettings(g, {
                  gardenName: gardenName.trim() || g.settings.gardenName,
                  yourName: yourName.trim() || g.settings.yourName,
                  postcode: pc || undefined,
                  location,
                }),
              location && location.forPostcode === pc && pc ? `Saved. Weather is for ${location.place}` : "Saved",
            );
          }}
        >
          {saving ? "Finding your place…" : "Save"}
        </button>
      </div>

      <SharingSettings />

      <FrostSettings />

      <NotifySettings />

      <div className="stack" style={{ marginTop: 10 }}>
        <h2>Backup</h2>
        <p className="body">
          {sharing.link ? `Everything is kept on this phone, and shared online (${counts}).` : `Everything is kept on this phone (${counts}).`} Save a backup now and then, to Files or iCloud Drive, in case the phone is lost or the app is removed.
        </p>
        <button
          type="button"
          className="btn outline"
          onClick={async () => {
            const photos = await exportPhotos(Array.from(photosInUse(garden))).catch(() => ({}));
            await saveFile(`mary-mary-backup-${stamp}.json`, "application/json", JSON.stringify({ ...garden, photos }));
          }}
        >
          <IconDownload size={20} />
          Save a backup{photosInUse(garden).size ? " (with photos)" : ""}
        </button>
        <button type="button" className="btn outline" onClick={() => saveFile(`mary-mary-plants-${stamp}.csv`, "text/csv", plantsToCSV(garden))}>
          <IconDownload size={20} />
          Plants as a spreadsheet (CSV)
        </button>
        {garden.harvests.length > 0 && (
          <button type="button" className="btn outline" onClick={() => saveFile(`mary-mary-harvests-${stamp}.csv`, "text/csv", harvestsToCSV(garden))}>
            <IconDownload size={20} />
            Harvest log as a spreadsheet (CSV)
          </button>
        )}

        <div className="field" style={{ marginTop: 6 }}>
          <span className="flabel">Restore from a backup</span>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            aria-label="Choose a backup file"
            style={{ fontSize: 14 }}
            onChange={async (e) => {
              setRestoreMsg("");
              setPending(null);
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const data = JSON.parse(await f.text());
                if (!isGardenData(data)) throw new Error("not a backup");
                setPending(data);
              } catch {
                setRestoreMsg("That file doesn't look like a Mary Mary backup.");
              }
            }}
          />
          {restoreMsg && (
            <p className="hint" role="status">
              {restoreMsg}
            </p>
          )}
          {pending !== null && isGardenData(pending) && (
            <div className="card stack">
              <p className="body">
                Replace everything on this phone with this backup ({pending.areas.length} areas, {pending.plants.length} plants)?
              </p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    const photos = (pending as { photos?: Record<string, string> }).photos;
                    if (photos) await importPhotos(photos).catch(() => undefined);
                    const { photos: _drop, ...rest } = pending as typeof pending & { photos?: unknown };
                    replaceAll(rest);
                    setGardenName(pending.settings.gardenName);
                    setYourName(pending.settings.yourName);
                    setPostcode(pending.settings.postcode ?? "");
                    setPending(null);
                    setRestoreMsg("Backup restored.");
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  Restore
                </button>
                <button type="button" className="btn quiet" onClick={() => setPending(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <SetupSettings
        onBackup={async () => {
          const photos = await exportPhotos(Array.from(photosInUse(garden))).catch(() => ({}));
          await saveFile(`mary-mary-backup-${stamp}.json`, "application/json", JSON.stringify({ ...garden, photos }));
        }}
      />

      <p className="hint" style={{ marginTop: 16 }}>
        Mary Mary, version {__APP_VERSION__}
      </p>
    </>
  );
}

declare const __APP_VERSION__: string;

/** Settings → Sharing: a short summary, and the way in to invites (v1.1). */
function SharingSettings() {
  const { link, ready } = useSharing();
  return (
    <div className="stack" style={{ marginTop: 10 }}>
      <h2>Sharing</h2>
      {link ? (
        <>
          <SyncLine />
          <p className="body">This garden is shared. Invite someone else, see who's in, or leave.</p>
        </>
      ) : (
        <p className="body">Garden with someone? Share this garden so you can both use Mary Mary on your own phones{ready ? "" : " (not switched on yet)"}.</p>
      )}
      <a className="btn outline" href={href({ page: "sharing" })}>
        {link ? "Sharing and invites" : "Share this garden or join one"}
      </a>
    </div>
  );
}

/** Settings → First-time setup: try it out, or start the garden afresh (v1.0). */
function SetupSettings({ onBackup }: { onBackup: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  return (
    <div className="stack" style={{ marginTop: 10 }}>
      <h2>First-time setup</h2>
      <p className="body">See the questions a new gardener is asked when they first open Mary Mary. Trying it out doesn't change anything.</p>
      <a className="btn outline" href={href({ page: "setup", trial: true })}>
        Try first-time setup
      </a>
      {!asking ? (
        <button type="button" className="btn quiet" onClick={() => setAsking(true)}>
          Start afresh…
        </button>
      ) : (
        <div className="card stack">
          <p className="body">
            <strong>Start afresh?</strong> You'll go through first-time setup, and when you finish it replaces everything on this phone: areas, plants, jobs, diary and harvests.
          </p>
          <button
            type="button"
            className="btn outline"
            onClick={async () => {
              await onBackup();
              setBackedUp(true);
            }}
          >
            <IconDownload size={20} />
            {backedUp ? "Backup saved. Save another" : "Save a backup first"}
          </button>
          <div className="btn-row">
            <a className="btn danger" href={href({ page: "setup" })}>
              Start afresh
            </a>
            <button type="button" className="btn quiet" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
          <p className="hint">Nothing changes until you tap Finish at the end. You can leave part way and your garden stays as it is.</p>
        </div>
      )}
    </div>
  );
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PARTS: Array<[string, string]> = [["05", "Early"], ["15", "Mid"], ["25", "Late"]];
const partOf = (mmdd: string) => (+mmdd.slice(3, 5) <= 10 ? "05" : +mmdd.slice(3, 5) <= 20 ? "15" : "25");

/** Pick a date as "Mid" + "May": all the precision frost dates deserve. */
function RoughDate({ id, label, value, onChange, months }: { id: string; label: string; value: string; onChange: (v: string) => void; months: number[] }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="btn-row">
        <select id={id} className="input" aria-label={`${label}: early, mid or late`} value={partOf(value)} onChange={(e) => onChange(`${value.slice(0, 2)}-${e.target.value}`)}>
          {PARTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="input" aria-label={`${label}: month`} value={value.slice(0, 2)} onChange={(e) => onChange(`${e.target.value}-${partOf(value)}`)}>
          {months.map((m) => (
            <option key={m} value={String(m).padStart(2, "0")}>
              {MONTH_NAMES[m - 1]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Settings: the frost dates sowing and jobs follow (v0.8). */
function FrostSettings() {
  const { garden, update } = useStore();
  const f = frostFor(garden.settings);
  const [editing, setEditing] = useState(false);
  const [last, setLast] = useState(f.lastSpring);
  const [first, setFirst] = useState(f.firstAutumn);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const loc = garden.settings.location;

  return (
    <div className="stack" style={{ marginTop: 10 }}>
      <h2>Frost dates</h2>
      <p className="body">
        Frost is usually over by <strong>{dateWords(f.lastSpring)}</strong> and holds off until <strong>{dateWords(f.firstAutumn)}</strong>. {frostSourceWords(f)}
      </p>
      <p className="hint">Sowing times, planting out and frost jobs all follow these. If your garden is a frost pocket, or you know better, change them.</p>
      {msg && (
        <p className="hint" role="status">
          {msg}
        </p>
      )}
      {editing ? (
        <div className="card stack">
          <RoughDate id="s-last" label="Last spring frost is usually over by" value={last} onChange={setLast} months={[2, 3, 4, 5, 6]} />
          <RoughDate id="s-first" label="First autumn frost usually comes from" value={first} onChange={setFirst} months={[9, 10, 11, 12]} />
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                update((g) => updateSettings(g, { frost: { lastSpring: last, firstAutumn: first, source: "you" } }), "Frost dates saved", true);
                setEditing(false);
                setMsg("");
              }}
            >
              Use these dates
            </button>
            <button type="button" className="btn quiet" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="btn-row">
          <button
            type="button"
            className="btn outline small"
            onClick={() => {
              setLast(f.lastSpring);
              setFirst(f.firstAutumn);
              setEditing(true);
            }}
          >
            Change them
          </button>
          {loc && f.source !== "history" && (
            <button
              type="button"
              className="btn outline small"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMsg("");
                try {
                  const frost = await fetchFrostDates(loc, todayISO());
                  update((g) => updateSettings(g, { frost }), `Frost dates worked out for ${loc.place}`, true);
                } catch (e) {
                  setMsg((e as Error).message);
                }
                setBusy(false);
              }}
            >
              {busy ? "Working them out…" : "Work them out from the weather"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

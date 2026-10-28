import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { updateSettings } from "../lib/actions";
import { isGardenData, plantsToCSV } from "../lib/data";
import { shortDate, todayISO } from "../lib/dates";
import { setbackSummary } from "../lib/reasons";
import { IconBook, IconClose, IconCog, IconDownload, IconNext } from "../icons";
import { href } from "../router";
import { useStore } from "../store";
import { BackBar } from "../ui";

export function Menu() {
  const { garden } = useStore();
  const lostCount = garden.plants.filter((p) => p.status === "lost").length;
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
        {item(href({ page: "lost" }), <IconBook />, "Didn't make it", lostCount ? `${lostCount} ${lostCount === 1 ? "plant" : "plants"} to learn from` : "Nothing lost so far")}
        {item(href({ page: "settings" }), <IconCog size={22} color="#3B6D11" />, "Settings and backup", "Your garden's name, and saving a copy")}
      </div>
      <p className="hint">Coming next: weather and frost warnings, this week's jobs, the garden diary and supplies.</p>
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
  const [gardenName, setGardenName] = useState(garden.settings.gardenName);
  const [yourName, setYourName] = useState(garden.settings.yourName);
  const [postcode, setPostcode] = useState(garden.settings.postcode ?? "");
  const [restoreMsg, setRestoreMsg] = useState("");
  const [pending, setPending] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stamp = todayISO();

  const counts = `${garden.areas.length} areas, ${garden.plants.length} plants, ${garden.journal.length} diary entries`;

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
            Town or postcode <span className="optional">(for weather, coming soon)</span>
          </label>
          <input id="s-post" className="input" value={postcode} autoCapitalize="characters" onChange={(e) => setPostcode(e.target.value)} />
          <p className="hint">Only used for your local weather and frost warnings. Never shared.</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() =>
            update(
              (g) => updateSettings(g, { gardenName: gardenName.trim() || g.settings.gardenName, yourName: yourName.trim() || g.settings.yourName, postcode: postcode.trim() || undefined }),
              "Saved",
            )
          }
        >
          Save
        </button>
      </div>

      <div className="stack" style={{ marginTop: 10 }}>
        <h2>Backup</h2>
        <p className="body">
          Everything is kept on this phone ({counts}). Save a backup now and then, to Files or iCloud Drive, in case the phone is lost or the app is removed.
        </p>
        <button type="button" className="btn outline" onClick={() => saveFile(`mary-mary-backup-${stamp}.json`, "application/json", JSON.stringify(garden, null, 2))}>
          <IconDownload size={20} />
          Save a backup
        </button>
        <button type="button" className="btn outline" onClick={() => saveFile(`mary-mary-plants-${stamp}.csv`, "text/csv", plantsToCSV(garden))}>
          <IconDownload size={20} />
          Plants as a spreadsheet (CSV)
        </button>

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
                  onClick={() => {
                    replaceAll(pending);
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

      <p className="hint" style={{ marginTop: 16 }}>
        Mary Mary, version {__APP_VERSION__}
      </p>
    </>
  );
}

declare const __APP_VERSION__: string;

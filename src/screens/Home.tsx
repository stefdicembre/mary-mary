import { greeting, longDate } from "../lib/dates";
import { setbackSummary } from "../lib/reasons";
import { AreaIcon, IconCog, IconMenu, IconNext, IconPlus } from "../icons";
import { href } from "../router";
import { useStore } from "../store";

/** "The allotment" → "Allotment", to fit under the circle. */
const shortName = (n: string) => {
  const s = n.replace(/^The /i, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function Home() {
  const { garden, saveError } = useStore();
  const now = new Date();
  const struggling = garden.plants.filter((p) => p.status === "struggling");
  const areaName = (id: string) => garden.areas.find((a) => a.id === id)?.name ?? "";
  const latestSetback = (plantId: string) =>
    garden.setbacks.filter((s) => s.plantId === plantId).sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <>
      <div className="topbar">
        <a className="icon-btn" href={href({ page: "menu" })} aria-label="Menu">
          <IconMenu />
        </a>
        <a className="icon-btn" href={href({ page: "settings" })} aria-label="Settings">
          <IconCog />
        </a>
      </div>

      <div className="stack-sm">
        <h1>Mary Mary</h1>
        <p className="sub">{garden.settings.gardenName}</p>
      </div>

      <div className="stack-sm">
        <h2 style={{ fontSize: 20 }}>{greeting(now)}</h2>
        <p className="sub">{longDate(now)}</p>
      </div>

      {saveError && (
        <div className="panel-amber" role="alert">
          <p>Mary Mary couldn't save your last change on this phone. Try again, and save a backup from Settings.</p>
        </div>
      )}

      {struggling.length > 0 && (
        <div className="stack">
          <p className="label">Needs a look</p>
          <div className="list">
            {struggling.map((p) => {
              const s = latestSetback(p.id);
              const why = s ? setbackSummary(s) : "";
              return (
                <a key={p.id} className="list-item" href={href({ page: "plant", id: p.id })}>
                  <span className="grow">
                    <span className="title">{p.name}</span>
                    <span className="meta">{areaName(p.areaId)}</span>
                    <span className="mark-struggle">Struggling{why ? ` · ${why}` : ""}</span>
                  </span>
                  <IconNext />
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="stack">
        <p className="label">Our garden</p>
        <div className="areas">
          {garden.areas.map((a) => {
            const flagged = garden.plants.some((p) => p.areaId === a.id && p.status === "struggling");
            return (
              <a key={a.id} className="area-tile" href={href({ page: "area", id: a.id })}>
                <span className="circle">
                  <AreaIcon kind={a.kind} />
                  {flagged && <span className="dot" title="Something here is struggling" />}
                </span>
                <span className="name">{shortName(a.name)}</span>
              </a>
            );
          })}
          <a className="area-tile" href={href({ page: "newArea" })}>
            <span className="circle add">
              <IconPlus size={22} />
            </span>
            <span className="name">Add area</span>
          </a>
        </div>
        {garden.areas.length === 0 && (
          <p className="empty">Start by adding the parts of your garden: a border, the pots, the greenhouse.</p>
        )}
      </div>
    </>
  );
}

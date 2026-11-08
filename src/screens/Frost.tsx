// "Your frost dates": shown on the Weather screen and the planting plan (v0.8).

import { compareWithTypical, dateWords, frostFor, frostSourceWords } from "../lib/sowing";
import { href } from "../router";
import { useStore } from "../store";

export function FrostCard({ compact }: { compact?: boolean }) {
  const { garden } = useStore();
  const f = frostFor(garden.settings);
  const compare = compareWithTypical(f);
  if (compact) {
    return (
      <p className="hint">
        Timings follow your frost dates: frost is usually over by {dateWords(f.lastSpring)}
        {f.source === "typical" ? " (general UK dates)" : ""}. <a href={href({ page: "settings" })}>Change</a>
      </p>
    );
  }
  return (
    <div className="stack">
      <h2>Your frost dates</h2>
      <div className="card stack" style={{ gap: 10 }}>
        <div className="knows">
          <span className="k">Last spring frost</span>
          <span className="v">Usually over by {dateWords(f.lastSpring)}</span>
          <span className="k">First autumn frost</span>
          <span className="v">Usually not before {dateWords(f.firstAutumn)}</span>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          {frostSourceWords(f)} {compare} Sowing, planting out and frost jobs follow these dates.
          {f.source === "history" ? " They're right in about 8 years out of 10, so still check the forecast." : ""}
        </p>
        <a className="btn outline small" style={{ alignSelf: "flex-start" }} href={href({ page: "settings" })}>
          {f.source === "typical" ? "Add your postcode" : "Change"}
        </a>
      </div>
    </div>
  );
}

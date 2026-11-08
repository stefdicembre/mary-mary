// Settings → Notifications: urgent alerts on the lock screen (v0.9).
// Turning them on makes a "push code" that Stef pastes into GitHub once.

import { useEffect, useState } from "react";
import { codeIsOutOfDate } from "../lib/alerts";
import { shortDate } from "../lib/dates";
import { permission, pushSupport, refreshCode, repoUrl, savePush, savedPush, turnOff, turnOn } from "../lib/push";
import type { SavedPush } from "../lib/push";
import { tenderPlants } from "../lib/weather";
import { useStore } from "../store";

export function NotifySettings() {
  const { garden } = useStore();
  const [saved, setSaved] = useState<SavedPush | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState<"" | "yes" | "failed">("");
  const [showSteps, setShowSteps] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    savedPush().then((p) => {
      setSaved(p);
      setLoaded(true);
    });
  }, []);

  const support = pushSupport();
  const loc = garden.settings.location;
  const protect = tenderPlants(garden);
  const repo = repoUrl();
  const outOfDate = !!saved && codeIsOutOfDate(saved.code, loc?.place, protect);
  const blocked = denied || (!saved && permission() === "denied");

  const intro = (
    <p className="body">
      Mary Mary can warn you on the lock screen about <strong>frost tonight, storms and heatwaves</strong>. Only those, so you'll only hear from it when the garden needs you.
    </p>
  );

  if (!loaded) return null;

  let content;
  if (support !== "ok") {
    content = (
      <p className="hint">
        {support === "not-installed"
          ? "To turn these on, open Mary Mary from its icon on your Home Screen (it needs an iPhone on iOS 16.4 or later)."
          : "This browser can't show alerts. Open Mary Mary from its icon on your iPhone's Home Screen."}
      </p>
    );
  } else if (!loc) {
    content = <p className="hint">Add your town or postcode above first, so the alerts are for your garden's weather.</p>;
  } else if (blocked) {
    content = (
      <div className="card stack" style={{ background: "var(--amber-pale)" }}>
        <p className="body" style={{ color: "var(--amber-ink)" }}>
          Notifications are turned off for Mary Mary on this phone. To allow them, open the iPhone <strong>Settings</strong> app → <strong>Notifications</strong> → <strong>Mary Mary</strong> → Allow Notifications. Then come back here.
        </p>
        <button type="button" className="btn outline small" style={{ alignSelf: "flex-start" }} onClick={() => setDenied(false)}>
          I've allowed them
        </button>
      </div>
    );
  } else if (!saved) {
    content = (
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg("");
          try {
            setSaved(await turnOn(loc, protect));
            setShowSteps(true);
          } catch (e) {
            if ((e as Error).message === "denied" || permission() === "denied") setDenied(true);
            else setMsg("Couldn't turn alerts on just now. Check you have signal and try again.");
          }
          setBusy(false);
        }}
      >
        {busy ? "Asking your phone…" : "Turn on urgent alerts"}
      </button>
    );
  } else {
    const code = JSON.stringify(saved.code);
    const steps = !saved.inGitHub || showSteps;
    content = (
      <>
        {saved.inGitHub && !outOfDate && (
          <p className="body">
            <strong>On.</strong> GitHub checks the forecast at about 6am and 3pm (an hour later in summer) and alerts you if there's frost tonight, gusts of 55mph or more, or 30°C or more. Set up on {shortDate(saved.code.madeOn)}.
          </p>
        )}
        {outOfDate && (
          <div className="card stack" style={{ background: "var(--amber-pale)" }}>
            <p className="body" style={{ color: "var(--amber-ink)" }}>
              {loc.place !== saved.code.place
                ? `Your garden's place has changed since the code was made, so alerts are still for ${saved.code.place}.`
                : "Your tender plants have changed since the code was made, so frost alerts may name the wrong ones."}{" "}
              Make a new code and update it in GitHub.
            </p>
            <button
              type="button"
              className="btn outline small"
              style={{ alignSelf: "flex-start" }}
              onClick={async () => {
                setSaved(await refreshCode(saved, loc, protect));
                setCopied("");
                setShowSteps(true);
              }}
            >
              Make a new code
            </button>
          </div>
        )}
        {steps && !outOfDate && (
          <div className="card stack">
            <h3 style={{ margin: 0, fontSize: 15 }}>{saved.inGitHub ? "Setting up GitHub" : "One last step: give GitHub the code"}</h3>
            <p className="hint">GitHub does the checking, so it needs this code once. It's private: only you can see secrets in GitHub.</p>
            <ol className="steps">
              <li>
                <button
                  type="button"
                  className="btn small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(code);
                      setCopied("yes");
                    } catch {
                      setCopied("failed");
                    }
                  }}
                >
                  {copied === "yes" ? "Copied" : "Copy the code"}
                </button>
                {copied === "failed" && (
                  <textarea
                    className="input"
                    readOnly
                    aria-label="Your push code"
                    value={code}
                    rows={4}
                    style={{ marginTop: 8, fontSize: 12, fontFamily: "monospace" }}
                    onFocus={(e) => e.target.select()}
                  />
                )}
              </li>
              <li>
                Open{" "}
                <a href={`${repo}/settings/secrets/actions`} target="_blank" rel="noopener">
                  your GitHub secrets
                </a>{" "}
                and tap <strong>New repository secret</strong>. Name it <code>MARY_MARY_PUSH</code> and paste the code as the secret. (Already there? Tap the pencil next to it and paste over it.)
              </li>
              <li>
                Open{" "}
                <a href={`${repo}/actions/workflows/notify.yml`} target="_blank" rel="noopener">
                  Garden alerts in GitHub
                </a>
                , tap <strong>Run workflow</strong>, then the green <strong>Run workflow</strong>. A test alert should arrive in a minute or two.
              </li>
            </ol>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                const next = { ...saved, inGitHub: true };
                await savePush(next);
                setSaved(next);
                setShowSteps(false);
                setMsg("");
              }}
            >
              Done, the test alert came
            </button>
            <p className="hint">Nothing after five minutes? Open the run in GitHub: it says in red what went wrong.</p>
          </div>
        )}
        <div className="btn-row">
          {saved.inGitHub && !steps && !outOfDate && (
            <a className="btn outline small" href={`${repo}/actions/workflows/notify.yml`} target="_blank" rel="noopener">
              Send a test alert
            </a>
          )}
          {saved.inGitHub && !steps && !outOfDate && (
            <button type="button" className="btn outline small" onClick={() => setShowSteps(true)}>
              Set-up steps
            </button>
          )}
          <button
            type="button"
            className="btn quiet"
            onClick={async () => {
              await turnOff();
              setSaved(undefined);
              setCopied("");
              setMsg("Alerts are off. In GitHub you can also delete the MARY_MARY_PUSH secret, so it stops checking.");
            }}
          >
            Turn off
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="stack" style={{ marginTop: 10 }}>
      <h2>Notifications</h2>
      {intro}
      {content}
      {msg && (
        <p className="hint" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

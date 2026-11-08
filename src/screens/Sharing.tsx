// Settings → Sharing (#/sharing) and Join a garden (#/join), v1.1.
// Put the garden online, invite people with a code, see who's in, and leave.

import { useEffect, useState } from "react";
import type { Invite, Member } from "../lib/cloud";
import { updateSettings } from "../lib/actions";
import { inviteMessage } from "../lib/share";
import { namesList } from "../lib/setup";
import { go, href } from "../router";
import { hasOwnGarden, useSharing } from "../sharing";
import { useStore } from "../store";
import { BackBar } from "../ui";
import { IconPlus } from "../icons";

const APP_URL = "https://stefdicembre.github.io/mary-mary/";

/** "Sunday 15 November" */
function dayWords(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}

/** "just now", "5 minutes ago", "at 14:05" */
export function agoWords(iso: string, now = Date.now()): string {
  const mins = Math.round((now - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  return `at ${new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))}`;
}

/** One line saying whether the garden is up to date. */
export function SyncLine() {
  const { status, link } = useSharing();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);
  let text = "";
  let tone = "green";
  switch (status.state) {
    case "syncing":
      text = "Catching up…";
      break;
    case "ok":
      text = `Up to date · checked ${agoWords(status.at)}`;
      break;
    case "offline":
      text = "No signal just now. Changes will go across when you're back online.";
      tone = "amber";
      break;
    case "error":
      text = `Couldn't catch up: ${status.message}`;
      tone = "amber";
      break;
    default:
      text = link?.lastSynced ? `Last caught up ${agoWords(link.lastSynced)}` : "Getting ready…";
  }
  return (
    <p className={`tag ${tone}`} role="status" style={{ alignSelf: "flex-start", fontSize: 13, padding: "5px 10px", lineHeight: 1.4 }}>
      {text}
    </p>
  );
}

export function SharingScreen() {
  const { garden, update } = useStore();
  const sh = useSharing();
  const [name, setName] = useState(garden.settings.yourName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [forName, setForName] = useState("");
  const [made, setMade] = useState<Invite | null>(null);
  const [copied, setCopied] = useState("");
  const [removing, setRemoving] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [noList, setNoList] = useState(false);
  const linked = !!sh.link;

  const refresh = () => {
    if (!sh.link) return;
    sh.members()
      .then((m) => {
        setMembers(m);
        setNoList(false);
      })
      .catch(() => setNoList(true));
    sh.invites().then(setInvites).catch(() => undefined);
  };
  useEffect(refresh, [sh.link?.gardenId]);

  const others = (members ?? []).filter((m) => m.user_id !== sh.me);
  const owner = (members ?? []).find((m) => m.role === "owner") ?? (members ?? [])[0];
  const iAmOwner = !!owner && owner.user_id === sh.me;
  const alone = members !== null && others.length === 0;

  const fail = (e: unknown) => {
    const m = (e as Error).message;
    setMsg(/internet/.test(m) ? "You need signal for this. Try again when you're online." : m);
  };

  const send = async (inv: Invite) => {
    const text = inviteMessage({ code: inv.code, gardenName: garden.settings.gardenName, from: garden.settings.yourName, forName: inv.for_name ?? undefined, appUrl: APP_URL, expires: dayWords(inv.expires_at) });
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(inv.code);
    } catch {
      setCopied("");
    }
  };

  if (!sh.ready) {
    return (
      <>
        <BackBar to={href({ page: "settings" })} label="Settings" />
        <h1>Sharing</h1>
        <div className="card stack">
          <p className="body">
            Sharing isn't switched on yet. It needs the garden's free online home set up once, by following "Sharing a garden" in the README on GitHub. After that, this is where you'll invite people.
          </p>
        </div>
      </>
    );
  }
  if (!sh.loaded) return null;

  return (
    <>
      <BackBar to={href({ page: "settings" })} label="Settings" />
      <h1>Sharing</h1>

      {sh.goneFrom && !linked && (
        <div className="panel-amber" role="note" style={{ marginBottom: 12 }}>
          <p>
            <strong>This phone isn't in "{sh.goneFrom}" any more.</strong> Someone took it out of the garden, or the garden was taken offline. Everything is still here on this phone, but changes won't go across. Ask for a new invite code to join again.
          </p>
          <button type="button" className="btn small outline" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={sh.forgetGone}>
            OK
          </button>
        </div>
      )}

      {msg && (
        <p className="hint" role="alert" style={{ color: "var(--struggle)", marginBottom: 10 }}>
          {msg}
        </p>
      )}

      {!linked ? (
        <div className="stack">
          <p className="body">
            Garden with someone else? Share this garden and invite them, and you'll both see the same plants, jobs, diary and photos on your own phones. It still works without signal, and catches up when you're back online.
          </p>
          <div className="field">
            <label htmlFor="sh-name">Your name</label>
            <input id="sh-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            <p className="hint">So the people you invite can see who made each change.</p>
          </div>
          <button
            type="button"
            className="btn"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              setMsg("");
              try {
                if (name.trim() !== garden.settings.yourName) update((g) => updateSettings(g, { yourName: name.trim() }));
                await sh.shareThis(name.trim());
              } catch (e) {
                fail(e);
              }
              setBusy(false);
            }}
          >
            {busy ? "Putting it online…" : "Share this garden"}
          </button>
          <p className="hint">Your garden is kept in your own free Supabase project. Only phones you invite can see it.</p>
          <div className="card stack" style={{ marginTop: 6 }}>
            <p className="label">Been invited to someone else's garden?</p>
            <a className="btn outline" href={href({ page: "join" })}>
              Join a garden
            </a>
          </div>
        </div>
      ) : (
        <div className="stack">
          <SyncLine />
          <p className="body">
            "{garden.settings.gardenName}" is shared. Changes made here go across to everyone in it, usually within a minute.
          </p>
          <button type="button" className="btn outline small" style={{ alignSelf: "flex-start" }} onClick={() => { sh.syncNow(); refresh(); }}>
            Check now
          </button>

          <h2>Who's gardening here</h2>
          <div className="list">
            {members === null && (
              <p className="hint" style={{ padding: 12 }}>
                {noList ? "Mary Mary needs signal to see who's in. Try Check now when you're online." : "Looking…"}
              </p>
            )}
            {(members ?? []).map((m) => (
              <div key={m.user_id} className="list-item" style={{ flexWrap: "wrap" }}>
                <span className="grow">
                  <span className="title">
                    {m.name}
                    {m.user_id === sh.me ? " (you)" : ""}
                  </span>
                  <span className="meta">{m === owner ? "Started this garden" : `Joined ${dayWords(m.joined_at)}`}</span>
                </span>
                {iAmOwner && m.user_id !== sh.me && removing !== m.user_id && (
                  <button type="button" className="btn small quiet" onClick={() => setRemoving(m.user_id)}>
                    Remove
                  </button>
                )}
                {removing === m.user_id && (
                  <div className="stack-sm" style={{ width: "100%" }}>
                    <p className="hint">Take {m.name} out of this garden? Their phone keeps a copy, but won't get changes any more.</p>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn danger small"
                        onClick={async () => {
                          setMsg("");
                          try {
                            await sh.remove(m.user_id);
                          } catch (e) {
                            fail(e);
                          }
                          setRemoving("");
                          refresh();
                        }}
                      >
                        Remove {m.name}
                      </button>
                      <button type="button" className="btn small quiet" onClick={() => setRemoving("")}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <h2>Invite someone</h2>
          {!made ? (
            <div className="card stack">
              <p className="body">Mary Mary makes a code to send them. It works once, for a week.</p>
              <div className="field">
                <label htmlFor="sh-for">
                  Who's it for? <span className="optional">(optional)</span>
                </label>
                <input id="sh-for" className="input" value={forName} placeholder="Their name" onChange={(e) => setForName(e.target.value)} />
              </div>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setMsg("");
                  setCopied("");
                  try {
                    const inv = await sh.makeInvite(forName.trim());
                    setMade({ ...inv, for_name: forName.trim() || null });
                    setForName("");
                    refresh();
                  } catch (e) {
                    fail(e);
                  }
                  setBusy(false);
                }}
              >
                <IconPlus size={20} color="#fff" />
                {busy ? "Making a code…" : "Make an invite code"}
              </button>
            </div>
          ) : (
            <div className="card stack" style={{ alignItems: "stretch" }}>
              <p className="label">{made.for_name ? `Invite code for ${made.for_name}` : "Invite code"}</p>
              <p className="invite-code" aria-label={`Invite code ${made.code.split("").join(" ")}`}>
                {made.code}
              </p>
              <p className="hint">
                Works once, until {dayWords(made.expires_at)}. They'll need Mary Mary on their Home Screen, then "Been invited? Join a garden". The message explains how.
              </p>
              <button type="button" className="btn" onClick={() => send(made)}>
                Send the invite
              </button>
              {copied === made.code && (
                <p className="hint" role="status">
                  Copied. Paste it into a message to {made.for_name || "them"}.
                </p>
              )}
              <button type="button" className="btn quiet" onClick={() => setMade(null)}>
                Done
              </button>
            </div>
          )}

          {invites.filter((i) => i.code !== made?.code).length > 0 && (
            <>
              <h2>Waiting to join</h2>
              <div className="list">
                {invites
                  .filter((i) => i.code !== made?.code)
                  .map((i) => (
                    <div key={i.code} className="list-item">
                      <span className="grow">
                        <span className="title">{i.for_name || "Someone"}</span>
                        <span className="meta">
                          {i.code} · until {dayWords(i.expires_at)}
                        </span>
                      </span>
                      <button type="button" className="btn small quiet" onClick={() => send(i)}>
                        Send again
                      </button>
                      <button
                        type="button"
                        className="btn small quiet"
                        onClick={async () => {
                          try {
                            await sh.cancelInvite(i.code);
                          } catch (e) {
                            fail(e);
                          }
                          refresh();
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
              </div>
            </>
          )}

          <h2>{alone ? "Stop sharing" : "Leave this garden"}</h2>
          {!leaving ? (
            <button type="button" className="btn danger" onClick={() => setLeaving(true)}>
              {alone ? "Stop sharing" : "Leave this garden"}
            </button>
          ) : (
            <div className="card stack">
              <p className="body">
                {alone
                  ? "This takes the garden offline. Everything stays on this phone, just as it is now."
                  : "This phone stops getting changes from the others, and they stop getting yours. Everything stays on this phone as it is now."}
              </p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setMsg("");
                    try {
                      await sh.leave();
                      setMembers(null);
                      setLeaving(false);
                    } catch (e) {
                      fail(e);
                    }
                    setBusy(false);
                  }}
                >
                  {alone ? "Stop sharing" : "Leave"}
                </button>
                <button type="button" className="btn quiet" onClick={() => setLeaving(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function JoinScreen() {
  const { garden } = useStore();
  const sh = useSharing();
  const [code, setCode] = useState("");
  const [name, setName] = useState(garden.settings.yourName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fresh = !!garden.settings.needsSetup;
  const back = fresh ? { to: href({ page: "setup" }), label: "Back" } : { to: href({ page: "sharing" }), label: "Sharing" };

  return (
    <>
      <BackBar to={back.to} label={back.label} />
      <div className="stack" style={{ gap: 16 }}>
        <div className="stack-sm" style={{ gap: 8 }}>
          <h1>Join a garden</h1>
          <p className="body">Type the invite code you were sent. It's a word and six numbers, like ROSE-482193.</p>
        </div>
        {!sh.ready ? (
          <div className="card">
            <p className="body">Sharing isn't switched on in this copy of Mary Mary yet.</p>
          </div>
        ) : sh.link ? (
          <div className="panel-amber" role="note">
            <p>
              This phone is already sharing "{garden.settings.gardenName}". To join a different garden, leave it first in{" "}
              <a href={href({ page: "sharing" })}>Settings → Sharing</a>.
            </p>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="j-code">Invite code</label>
              <input
                id="j-code"
                className="input invite-input"
                value={code}
                placeholder="ROSE-482193"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => {
                  setMsg("");
                  setCode(e.target.value);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="j-name">Your name</label>
              <input id="j-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
              <p className="hint">So the others can see who made each change.</p>
            </div>
            {hasOwnGarden(garden) && (
              <div className="panel-amber" role="note">
                <p>
                  <strong>Joining replaces what's on this phone</strong> ({garden.areas.length} areas, {garden.plants.length} plants) with the shared garden. Save a backup in{" "}
                  <a href={href({ page: "settings" })}>Settings</a> first if you might want it back.
                </p>
              </div>
            )}
            {msg && (
              <p className="hint" role="alert" style={{ color: "var(--struggle)" }}>
                {msg}
              </p>
            )}
            <button
              type="button"
              className="btn full"
              disabled={busy || !code.trim() || !name.trim()}
              onClick={async () => {
                setBusy(true);
                setMsg("");
                const r = await sh.join(code, name);
                setBusy(false);
                if (!r.ok) {
                  setMsg(r.message);
                  return;
                }
                go({ page: "joined" }, true);
              }}
            >
              {busy ? "Joining…" : "Join the garden"}
            </button>
          </>
        )}
      </div>
    </>
  );
}

/** After joining: a friendly hello, then into the garden. */
export function JoinedScreen() {
  const { garden } = useStore();
  const names = (garden.settings.gardeners ?? []).map((g) => g.name).filter((n) => n && n !== garden.settings.yourName);
  return (
    <div className="setup-welcome" style={{ minHeight: "70vh" }}>
      <div className="stack-sm" style={{ alignItems: "center", gap: 10 }}>
        <h1 style={{ textAlign: "center" }}>Welcome to {garden.settings.gardenName}</h1>
        <p className="sub" style={{ fontSize: 16, textAlign: "center" }}>
          {names.length ? `You're gardening with ${namesList(names)}` : "You're in"}
        </p>
      </div>
      <p className="body" style={{ textAlign: "center", fontSize: 15 }}>
        Everything in the garden is on your phone now: areas, plants, jobs and the diary. When anyone changes something, the others see it too.
      </p>
      <a className="btn full" href={href({ page: "home" })}>
        Go to the garden
      </a>
    </div>
  );
}

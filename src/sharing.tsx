// Sharing a garden between phones (v1.1): connects the garden on this phone
// to its shared copy online, and keeps the two in step.
//
// It checks for changes when the app opens, when it comes back to the front,
// every 30 seconds while it's open, and shortly after every change made here.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Cloud } from "./lib/cloud";
import type { Invite, Member, Session } from "./lib/cloud";
import { SUPABASE_KEY, SUPABASE_URL, cloudReady } from "./lib/cloudConfig";
import { loadExtra, saveExtra } from "./lib/db";
import { photosInUse } from "./lib/actions";
import { allPhotoIds, exportPhotos, importPhotos } from "./lib/photos";
import { shareable, tidyCode, withLocal } from "./lib/share";
import { Syncer } from "./lib/sync";
import type { CloudLink, SyncStatus } from "./lib/sync";
import type { GardenData } from "./lib/types";
import { useStore } from "./store";

const KEY = "cloud";

/** What's kept on the phone about sharing (never in backups). */
interface Saved {
  session?: Session;
  link?: CloudLink;
  /** Set when this phone was taken out of a garden, or the garden went offline. */
  goneFrom?: string;
}

export type JoinOutcome = { ok: true; gardenName: string } | { ok: false; message: string };

interface Sharing {
  /** Whether Mary Mary has an online home set up at all (cloudConfig.ts). */
  ready: boolean;
  loaded: boolean;
  link?: CloudLink;
  status: SyncStatus;
  me?: string;
  goneFrom?: string;
  shareThis: (yourName: string) => Promise<void>;
  join: (code: string, name: string) => Promise<JoinOutcome>;
  members: () => Promise<Member[]>;
  invites: () => Promise<Invite[]>;
  makeInvite: (forName: string) => Promise<Invite>;
  cancelInvite: (code: string) => Promise<void>;
  remove: (userId: string) => Promise<void>;
  leave: () => Promise<void>;
  rename: (name: string) => Promise<void>;
  syncNow: () => void;
  forgetGone: () => void;
}

const Ctx = createContext<Sharing | null>(null);

export function useSharing(): Sharing {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSharing outside SharingProvider");
  return s;
}

const photoBridge = {
  localIds: allPhotoIds,
  exportData: exportPhotos,
  importData: importPhotos,
  inUse: photosInUse,
};

/** The phone has a garden of its own worth keeping (not a fresh install). */
export function hasOwnGarden(g: GardenData): boolean {
  return !g.settings.needsSetup && (g.areas.length > 0 || g.plants.length > 0 || g.journal.length > 0);
}

export function SharingProvider({ children }: { children: ReactNode }) {
  const { garden, replaceAll, fromCloud } = useStore();
  const ready = cloudReady();
  const [saved, setSaved] = useState<Saved>({});
  const [loaded, setLoaded] = useState(!ready);
  const [status, setStatus] = useState<SyncStatus>({ state: "idle" });
  const savedRef = useRef<Saved>({});
  const cloud = useRef<Cloud | null>(null);
  const syncer = useRef<Syncer | null>(null);
  const gardenRef = useRef(garden);
  gardenRef.current = garden;
  /** The garden object last set from online, so it isn't sent straight back. */
  const fromOnline = useRef<GardenData | null>(null);

  const keep = useCallback(async (s: Saved) => {
    savedRef.current = s;
    setSaved({ ...s });
    await saveExtra(KEY, s).catch(() => undefined);
  }, []);

  const getCloud = useCallback(() => {
    if (!cloud.current)
      cloud.current = new Cloud(SUPABASE_URL, SUPABASE_KEY, (u, i) => fetch(u, i), savedRef.current.link?.session ?? savedRef.current.session, (session) => {
        savedRef.current.session = session;
        if (savedRef.current.link) savedRef.current.link.session = session;
        saveExtra(KEY, savedRef.current).catch(() => undefined);
      });
    return cloud.current;
  }, []);

  const start = useCallback(
    (link: CloudLink) => {
      if (syncer.current) syncer.current.stopped = true;
      syncer.current = new Syncer({
        cloud: getCloud(),
        link,
        saveLink: async (l) => {
          if (savedRef.current.link?.gardenId !== l.gardenId) return;
          await keep({ ...savedRef.current, link: l, session: l.session ?? savedRef.current.session });
        },
        photos: photoBridge,
        onRemote: async (shared, from, by) => {
          fromOnline.current = await fromCloud(shared, from, by);
        },
        onStatus: setStatus,
        onGone: () => {
          syncer.current = null;
          keep({ session: savedRef.current.session, goneFrom: savedRef.current.link?.base.settings.gardenName ?? "the shared garden" });
        },
        myName: () => gardenRef.current.settings.yourName,
      });
    },
    [fromCloud, getCloud, keep],
  );

  const syncNow = useCallback(() => {
    if (syncer.current && !syncer.current.stopped) syncer.current.sync(gardenRef.current).catch(() => undefined);
  }, []);

  // Pick up the link saved on this phone.
  useEffect(() => {
    if (!ready) return;
    loadExtra<Saved>(KEY)
      .then((s) => {
        savedRef.current = s ?? {};
        setSaved({ ...savedRef.current });
        if (savedRef.current.link) start(savedRef.current.link);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [ready, start]);

  const linked = !!saved.link;

  // Send changes made here, shortly after they're made.
  useEffect(() => {
    if (!linked) return;
    if (garden === fromOnline.current) return;
    const t = window.setTimeout(syncNow, 1200);
    return () => window.clearTimeout(t);
  }, [garden, linked, syncNow]);

  // Check for other people's changes: on opening, coming back to the app, getting signal, and every 30 seconds.
  useEffect(() => {
    if (!linked) return;
    syncNow();
    const onShow = () => document.visibilityState === "visible" && syncNow();
    const timer = window.setInterval(onShow, 30_000);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("online", syncNow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("online", syncNow);
    };
  }, [linked, syncNow]);

  const gardenId = () => {
    const id = savedRef.current.link?.gardenId;
    if (!id) throw new Error("This garden isn't shared yet.");
    return id;
  };

  const value: Sharing = {
    ready,
    loaded,
    link: saved.link,
    status,
    me: saved.link?.session?.userId ?? saved.session?.userId,
    goneFrom: saved.goneFrom,
    syncNow,
    forgetGone: () => keep({ session: savedRef.current.session, link: savedRef.current.link }),

    shareThis: async (yourName) => {
      const c = getCloud();
      const g = gardenRef.current;
      const data = shareable(g);
      const id = await c.createGarden(data.settings.gardenName, data, yourName);
      const link: CloudLink = { gardenId: id, baseVersion: 1, base: data, role: "owner", photosUp: [], session: c.session, lastSynced: new Date().toISOString() };
      await keep({ session: c.session, link });
      start(link);
      setStatus({ state: "ok", at: link.lastSynced! });
    },

    join: async (typed, name) => {
      const code = tidyCode(typed);
      if (!code) return { ok: false, message: "That doesn't look like an invite code. It's a word and six numbers, like ROSE-482193." };
      if (savedRef.current.link) return { ok: false, message: "This phone is already sharing a garden. Leave it first in Settings → Sharing." };
      const c = getCloud();
      try {
        const r = await c.join(code, name.trim());
        if (!r.ok)
          return {
            ok: false,
            message: r.reason === "too-many" ? "Too many tries for now. Wait an hour, then try again." : "That code didn't work. It may have been used already, or run out. Ask for a new one.",
          };
        const remote = await c.getGarden(r.garden_id);
        if (!remote) return { ok: false, message: "Couldn't open that garden. Ask for a new invite code." };
        // Add the new gardener to the garden's list of people, if they're not on it.
        const people = remote.data.settings.gardeners ?? [];
        const isOn = people.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
        const shared: GardenData = isOn ? remote.data : { ...remote.data, settings: { ...remote.data.settings, gardeners: [...people, { name: name.trim(), days: [] }] } };
        const link: CloudLink = { gardenId: r.garden_id, baseVersion: remote.version, base: remote.data, role: "gardener", photosUp: [], session: c.session };
        await keep({ session: c.session, link });
        await saveExtra("setup-draft", null).catch(() => undefined);
        replaceAll(withLocal(shared, { settings: { yourName: name.trim() } }));
        start(link);
        return { ok: true, gardenName: r.name || remote.data.settings.gardenName };
      } catch (e) {
        const msg = (e as Error).message;
        return { ok: false, message: /internet/.test(msg) ? "You need signal to join a garden. Try again when you're online." : msg };
      }
    },

    members: () => getCloud().members(gardenId()),
    invites: () => getCloud().invites(gardenId()),
    makeInvite: (forName) => getCloud().makeInvite(gardenId(), forName),
    cancelInvite: (code) => getCloud().cancelInvite(code),
    remove: (userId) => getCloud().removeMember(gardenId(), userId),
    rename: (name) => getCloud().rename(gardenId(), name),

    leave: async () => {
      const id = gardenId();
      await getCloud().leave(id);
      if (syncer.current) syncer.current.stopped = true;
      syncer.current = null;
      setStatus({ state: "idle" });
      await keep({ session: savedRef.current.session });
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

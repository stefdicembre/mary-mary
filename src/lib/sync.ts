// Keeping a shared garden in step between phones (v1.1).
//
// Each phone keeps:
//  - its own garden, as always (so it works with no signal),
//  - `base`: the garden as it was when this phone and the online copy last agreed,
//    and that copy's version number.
// A sync round then works out what to do:
//  - nothing changed here, and the online version is the same: nothing to do;
//  - nothing changed here, but the online copy is newer: take it;
//  - something changed here: send it, saying which version it was based on.
//    If someone else got there first, merge (keeping both sets of changes) and send again.
// Photos follow afterwards: new ones go up, missing ones come down.

import type { Cloud, RemoteGarden, Session } from "./cloud";
import { CloudError } from "./cloud";
import { merge3, same, shareable, withLocal } from "./share";
import type { GardenData } from "./types";

/** What this phone remembers about the shared garden. Kept on the phone, never in backups. */
export interface CloudLink {
  gardenId: string;
  baseVersion: number;
  base: GardenData;
  session?: Session;
  /** Whether this phone put the garden online (the owner) or joined it. */
  role: "owner" | "gardener";
  /** Photos known to be online already. */
  photosUp: string[];
  lastSynced?: string; // ISO date-time
}

export type SyncStatus =
  | { state: "idle" }
  | { state: "syncing" }
  | { state: "ok"; at: string }
  | { state: "offline" }
  | { state: "error"; message: string }
  | { state: "gone" };

export interface PhotoBridge {
  localIds(): Promise<string[]>;
  exportData(ids: string[]): Promise<Record<string, string>>;
  importData(photos: Record<string, string>): Promise<void>;
  inUse(g: GardenData): Set<string>;
}

export interface SyncerOptions {
  cloud: Cloud;
  link: CloudLink;
  /** Remember the link (or forget it, with undefined). */
  saveLink: (l: CloudLink) => Promise<void>;
  photos?: PhotoBridge;
  /**
   * Changes came from online. `shared` is the new shared garden; `from` is what this
   * phone's garden was (shared part) when the round started, so the screen can keep
   * anything changed since. `by` is who made the change, if it was someone else.
   */
  onRemote: (shared: GardenData, from: GardenData, by?: string) => void | Promise<void>;
  onStatus: (s: SyncStatus) => void;
  /** This phone isn't in the garden any more (removed, or the garden was taken offline). */
  onGone: () => void;
  myName: () => string;
  now?: () => string;
}

export class Syncer {
  private running: Promise<void> | null = null;
  private again = false;
  private latest: GardenData | null = null;
  stopped = false;

  constructor(private o: SyncerOptions) {}

  get link(): CloudLink {
    return this.o.link;
  }

  private stamp(): string {
    return (this.o.now ?? (() => new Date().toISOString()))();
  }

  /** Ask for a sync round with the phone's latest garden. Rounds never overlap. */
  sync(local: GardenData): Promise<void> {
    this.latest = local;
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.round(this.latest!);
        } while (this.again && !this.stopped);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private async save(): Promise<void> {
    this.o.link.session = this.o.cloud.session;
    await this.o.saveLink(this.o.link);
  }

  private async round(local: GardenData): Promise<void> {
    if (this.stopped) return;
    const { cloud, link } = this.o;
    this.o.onStatus({ state: "syncing" });
    try {
      const mine = shareable(local);
      if (same(mine, link.base)) {
        // Nothing new here: just see whether anyone else changed anything.
        const v = await cloud.getVersion(link.gardenId);
        if (v === null) return this.gone();
        if (v !== link.baseVersion) {
          const remote = await cloud.getGarden(link.gardenId);
          if (!remote) return this.gone();
          await this.take(remote, mine);
        }
      } else {
        await this.send(mine);
      }
      if (this.o.photos) await this.photos(local);
      link.lastSynced = this.stamp();
      await this.save();
      this.o.onStatus({ state: "ok", at: link.lastSynced });
    } catch (e) {
      if (e instanceof CloudError && e.kind === "offline") this.o.onStatus({ state: "offline" });
      else this.o.onStatus({ state: "error", message: (e as Error).message });
    }
  }

  private async take(remote: RemoteGarden, from: GardenData): Promise<void> {
    const { link } = this.o;
    link.base = remote.data;
    link.baseVersion = remote.version;
    const by = remote.updated_by && remote.updated_by !== this.o.cloud.userId ? remote.updated_name ?? undefined : undefined;
    await this.o.onRemote(remote.data, from, by);
  }

  private async send(mine: GardenData): Promise<void> {
    const { cloud, link } = this.o;
    let data = mine;
    let baseData = link.base;
    let base = link.baseVersion;
    let merged = false;
    let by: string | undefined;
    for (let tries = 0; tries < 4; tries++) {
      const v = await cloud.pushGarden(link.gardenId, base, data, data.settings.gardenName, this.o.myName());
      if (v !== null) {
        link.base = data;
        link.baseVersion = v;
        // If we merged in someone else's changes, the screen needs them too.
        if (merged) await this.o.onRemote(data, mine, by);
        return;
      }
      // Someone else got there first: merge their changes with ours and try again.
      // (The link only moves on once a send works, so a failed round loses nothing.)
      const remote = await cloud.getGarden(link.gardenId);
      if (!remote) return this.gone();
      data = merge3(baseData, data, remote.data);
      baseData = remote.data;
      base = remote.version;
      merged = true;
      if (remote.updated_by && remote.updated_by !== cloud.userId) by = remote.updated_name ?? undefined;
    }
    throw new CloudError("The garden kept changing while sending. It'll try again shortly.", "server");
  }

  private async photos(local: GardenData): Promise<void> {
    const p = this.o.photos!;
    const { cloud, link } = this.o;
    // Photos this phone's garden uses, plus any in what just came in from online.
    const inUse = new Set([...p.inUse(local), ...p.inUse(link.base)]);
    if (!inUse.size) return;
    const here = new Set(await p.localIds());
    const up = new Set(link.photosUp);
    // Going up: photos on this phone that the garden uses and aren't online yet.
    const toSend = [...inUse].filter((id) => here.has(id) && !up.has(id));
    if (toSend.length) {
      const known = new Set(await cloud.photoIds(link.gardenId));
      for (const id of toSend) {
        if (!known.has(id)) {
          const data = (await p.exportData([id]))[id];
          if (!data) continue;
          await cloud.putPhoto(link.gardenId, id, data);
        }
        up.add(id);
      }
    }
    // Coming down: photos the garden uses that this phone hasn't got.
    const missing = [...inUse].filter((id) => !here.has(id));
    if (missing.length) {
      const got = await cloud.getPhotos(link.gardenId, missing);
      if (Object.keys(got).length) {
        await p.importData(got);
        Object.keys(got).forEach((id) => up.add(id));
      }
    }
    link.photosUp = [...up].filter((id) => inUse.has(id));
  }

  private gone(): void {
    this.stopped = true;
    this.o.onStatus({ state: "gone" });
    this.o.onGone();
  }
}

/**
 * Brings changes from online into the phone's garden, keeping anything changed on
 * the phone since `from` (both `shared` and `from` are the shared part only).
 */
export function bringIn(current: GardenData, shared: GardenData, from: GardenData): GardenData {
  const now = shareable(current);
  return withLocal(same(now, from) ? shared : merge3(from, now, shared), current);
}

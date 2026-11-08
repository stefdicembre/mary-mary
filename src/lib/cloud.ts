// Talking to the online database (Supabase) for sharing a garden (v1.1).
// Uses Supabase's plain web addresses with fetch, so no extra packages are needed.
//
// Each phone signs in quietly as an "anonymous" user: no email or password.
// The invite code is what lets a phone into a garden, and the database's
// rules (supabase/setup.sql) only ever show a phone the gardens it has joined.

import type { GardenData } from "./types";

export interface Session {
  access: string;
  refresh: string;
  /** When the access pass runs out (milliseconds since 1970). */
  expiresAt: number;
  userId: string;
}

export type CloudErrorKind = "offline" | "server" | "signin";

export class CloudError extends Error {
  constructor(
    message: string,
    public kind: CloudErrorKind,
    public status = 0,
  ) {
    super(message);
  }
}

export interface Member {
  user_id: string;
  name: string;
  role: "owner" | "gardener";
  joined_at: string;
}

export interface Invite {
  code: string;
  for_name?: string | null;
  expires_at: string;
}

export interface RemoteGarden {
  data: GardenData;
  version: number;
  updated_by?: string | null;
  updated_name?: string | null;
}

export type JoinResult = { ok: true; garden_id: string; name: string } | { ok: false; reason: "not-found" | "too-many" };

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export class Cloud {
  constructor(
    private url: string,
    private key: string,
    private fetcher: Fetch,
    public session?: Session,
    private onSession?: (s: Session) => void,
    private now: () => number = () => Date.now(),
  ) {
    this.url = url.replace(/\/+$/, "");
  }

  get userId(): string | undefined {
    return this.session?.userId;
  }

  private async send(path: string, init: RequestInit & { auth?: boolean }): Promise<unknown> {
    const headers: Record<string, string> = { apikey: this.key, "Content-Type": "application/json", ...(init.headers as Record<string, string>) };
    if (init.auth !== false) headers.Authorization = `Bearer ${(await this.signIn()).access}`;
    let res: Response;
    try {
      res = await this.fetcher(this.url + path, { ...init, headers });
    } catch {
      throw new CloudError("No internet connection just now.", "offline");
    }
    const text = await res.text();
    let body: unknown = undefined;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const msg = (body && typeof body === "object" && ((body as Record<string, string>).message || (body as Record<string, string>).msg || (body as Record<string, string>).error_description)) || `The garden database said no (${res.status}).`;
      throw new CloudError(String(msg), init.auth === false ? "signin" : "server", res.status);
    }
    return body;
  }

  private keep(raw: unknown): Session {
    const r = raw as { access_token: string; refresh_token: string; expires_in: number; user: { id: string } };
    if (!r?.access_token || !r.user?.id) throw new CloudError("Couldn't sign in to the garden database.", "signin");
    const s: Session = { access: r.access_token, refresh: r.refresh_token, expiresAt: this.now() + (r.expires_in ?? 3600) * 1000, userId: r.user.id };
    this.session = s;
    this.onSession?.(s);
    return s;
  }

  /** Makes sure this phone is signed in, quietly, and the pass is fresh. */
  async signIn(): Promise<Session> {
    const s = this.session;
    if (s && s.expiresAt - this.now() > 60_000) return s;
    if (s) {
      try {
        return this.keep(await this.send("/auth/v1/token?grant_type=refresh_token", { method: "POST", auth: false, body: JSON.stringify({ refresh_token: s.refresh }) }));
      } catch (e) {
        // Offline: carry on with the old pass and let the request fail as offline.
        if (e instanceof CloudError && e.kind === "offline") throw e;
        throw new CloudError("This phone's sign-in has run out. Ask for a new invite code to join again.", "signin", (e as CloudError).status);
      }
    }
    return this.keep(await this.send("/auth/v1/signup", { method: "POST", auth: false, body: JSON.stringify({ data: {} }) }));
  }

  private rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    return this.send(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(args) }) as Promise<T>;
  }

  createGarden(name: string, data: GardenData, yourName: string): Promise<string> {
    return this.rpc<string>("create_garden", { p_name: name, p_data: data, p_your_name: yourName });
  }

  /** The garden, or null if this phone isn't in it any more (or it was removed). */
  async getGarden(id: string): Promise<RemoteGarden | null> {
    const rows = (await this.send(`/rest/v1/gardens?id=eq.${id}&select=data,version,updated_by,updated_name`, { method: "GET" })) as RemoteGarden[];
    return rows[0] ?? null;
  }

  /** Just the version number, to see cheaply whether anything changed. */
  async getVersion(id: string): Promise<number | null> {
    const rows = (await this.send(`/rest/v1/gardens?id=eq.${id}&select=version`, { method: "GET" })) as Array<{ version: number }>;
    return rows[0]?.version ?? null;
  }

  /**
   * Sends the garden, but only if the online copy is still at `base`.
   * Returns the new version, or null if someone else changed it first.
   */
  async pushGarden(id: string, base: number, data: GardenData, name: string, byName: string): Promise<number | null> {
    const rows = (await this.send(`/rest/v1/gardens?id=eq.${id}&version=eq.${base}&select=version`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ data, name, updated_name: byName }),
    })) as Array<{ version: number }>;
    return rows[0]?.version ?? null;
  }

  members(id: string): Promise<Member[]> {
    return this.send(`/rest/v1/members?garden_id=eq.${id}&select=user_id,name,role,joined_at&order=joined_at`, { method: "GET" }) as Promise<Member[]>;
  }

  async rename(id: string, name: string): Promise<void> {
    const uid = (await this.signIn()).userId;
    await this.send(`/rest/v1/members?garden_id=eq.${id}&user_id=eq.${uid}`, { method: "PATCH", body: JSON.stringify({ name }) });
  }

  invites(id: string): Promise<Invite[]> {
    return this.send(`/rest/v1/invites?garden_id=eq.${id}&expires_at=gt.${new Date(this.now()).toISOString()}&select=code,for_name,expires_at&order=made_at`, {
      method: "GET",
    }) as Promise<Invite[]>;
  }

  makeInvite(id: string, forName: string): Promise<Invite> {
    return this.rpc<Invite>("make_invite", { p_garden: id, p_for: forName });
  }

  async cancelInvite(code: string): Promise<void> {
    await this.send(`/rest/v1/invites?code=eq.${encodeURIComponent(code)}`, { method: "DELETE" });
  }

  join(code: string, name: string): Promise<JoinResult> {
    return this.rpc<JoinResult>("join_garden", { p_code: code, p_name: name });
  }

  async leave(id: string): Promise<void> {
    await this.rpc("leave_garden", { p_garden: id });
  }

  async removeMember(id: string, userId: string): Promise<void> {
    await this.rpc("remove_member", { p_garden: id, p_user: userId });
  }

  async photoIds(id: string): Promise<string[]> {
    const rows = (await this.send(`/rest/v1/photos?garden_id=eq.${id}&select=id`, { method: "GET" })) as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }

  async getPhotos(id: string, ids: string[]): Promise<Record<string, string>> {
    if (!ids.length) return {};
    const list = ids.map((x) => `"${x.replace(/"/g, "")}"`).join(",");
    const rows = (await this.send(`/rest/v1/photos?garden_id=eq.${id}&id=in.(${encodeURIComponent(list)})&select=id,data`, { method: "GET" })) as Array<{ id: string; data: string }>;
    return Object.fromEntries(rows.map((r) => [r.id, r.data]));
  }

  async putPhoto(id: string, photoId: string, data: string): Promise<void> {
    await this.send(`/rest/v1/photos?on_conflict=garden_id,id`, {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify([{ garden_id: id, id: photoId, data }]),
    });
  }
}

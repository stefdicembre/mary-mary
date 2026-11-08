// A pretend Supabase, kept in memory, for the tests and the click-through.
// It follows the same rules as supabase/setup.sql (which is checked on a real
// Postgres separately), so the app can be tried end to end without the internet.

interface FakeGarden {
  id: string;
  name: string;
  data: unknown;
  version: number;
  updated_by?: string;
  updated_name?: string;
}

export class FakeSupabase {
  users = new Map<string, string>(); // access token → user id
  refresh = new Map<string, string>(); // refresh token → user id
  gardens = new Map<string, FakeGarden>();
  members: Array<{ garden_id: string; user_id: string; name: string; role: "owner" | "gardener"; joined_at: string }> = [];
  invites: Array<{ code: string; garden_id: string; for_name?: string; made_at: string; expires_at: string }> = [];
  photos = new Map<string, string>(); // garden_id/id → data
  offline = false;
  calls: string[] = [];
  private n = 0;
  now = () => Date.now();
  /** Make the next codes predictable in tests. */
  nextCodes: string[] = [];

  private id(prefix: string) {
    this.n++;
    return `${prefix}-${this.n.toString().padStart(4, "0")}`;
  }

  private isMember(g: string, uid: string) {
    return this.members.some((m) => m.garden_id === g && m.user_id === uid);
  }

  /** Lets a test pretend a phone's pass has run out. */
  expire(access: string) {
    this.users.delete(access);
  }

  fetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
    if (this.offline) throw new TypeError("Failed to fetch");
    const u = new URL(url);
    const method = (init.method ?? "GET").toUpperCase();
    // Header names are case-insensitive, as on the real server.
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const q = u.searchParams;
    const eq = (k: string) => q.get(k)?.replace(/^eq\./, "");
    this.calls.push(`${method} ${u.pathname}`);
    const json = (status: number, v?: unknown) => new Response(v === undefined ? null : JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });

    if (!headers.apikey) return json(401, { message: "No API key found in request" });

    if (u.pathname === "/auth/v1/signup") {
      const uid = `user-${this.id("u")}`;
      return json(200, this.issue(uid));
    }
    if (u.pathname === "/auth/v1/token") {
      const uid = this.refresh.get(body?.refresh_token);
      if (!uid) return json(400, { error_description: "Invalid Refresh Token" });
      this.refresh.delete(body.refresh_token);
      return json(200, this.issue(uid));
    }

    const token = (headers.authorization ?? "").replace(/^Bearer /, "");
    const uid = this.users.get(token);
    if (!uid) return json(401, { message: "JWT expired" });

    const path = u.pathname.replace(/^\/rest\/v1\//, "");
    if (path.startsWith("rpc/")) return this.rpc(path.slice(4), body, uid, json);

    if (path === "gardens") {
      const g = this.gardens.get(eq("id") ?? "");
      const visible = g && this.isMember(g.id, uid) ? [g] : [];
      if (method === "GET") {
        const cols = (q.get("select") ?? "*").split(",");
        return json(200, visible.map((x) => Object.fromEntries(cols.map((c) => [c, structuredClone((x as unknown as Record<string, unknown>)[c])]))));
      }
      if (method === "PATCH") {
        const want = Number(q.get("version")?.replace(/^eq\./, ""));
        const hit = visible.filter((x) => x.version === want);
        for (const x of hit) {
          // Like Postgres jsonb: the keys come back in a different order.
          x.data = reorder(structuredClone(body.data));
          x.name = body.name ?? x.name;
          x.updated_name = body.updated_name;
          x.updated_by = uid;
          x.version++;
        }
        return json(200, hit.map((x) => ({ version: x.version })));
      }
    }
    if (path === "members") {
      const g = eq("garden_id") ?? "";
      if (!this.isMember(g, uid)) return json(200, []);
      if (method === "GET") return json(200, this.members.filter((m) => m.garden_id === g).map((m) => ({ ...m })));
      if (method === "PATCH") {
        this.members.filter((m) => m.garden_id === g && m.user_id === uid && m.user_id === eq("user_id")).forEach((m) => (m.name = body.name));
        return json(204);
      }
    }
    if (path === "invites") {
      if (method === "GET") {
        const g = eq("garden_id") ?? "";
        if (!this.isMember(g, uid)) return json(200, []);
        return json(200, this.invites.filter((i) => i.garden_id === g && Date.parse(i.expires_at) > this.now()));
      }
      if (method === "DELETE") {
        const code = decodeURIComponent(eq("code") ?? "");
        this.invites = this.invites.filter((i) => !(i.code === code && this.isMember(i.garden_id, uid)));
        return json(204);
      }
    }
    if (path === "photos") {
      if (method === "GET") {
        const g = eq("garden_id") ?? "";
        if (!this.isMember(g, uid)) return json(200, []);
        const inList = q.get("id")?.match(/^in\.\((.*)\)$/)?.[1];
        const ids = inList ? inList.split(",").map((s) => s.replace(/^"|"$/g, "")) : undefined;
        const rows = [...this.photos.entries()]
          .filter(([k]) => k.startsWith(`${g}/`))
          .map(([k, data]) => ({ id: k.slice(g.length + 1), data }))
          .filter((r) => !ids || ids.includes(r.id));
        return json(200, (q.get("select") ?? "") === "id" ? rows.map((r) => ({ id: r.id })) : rows);
      }
      if (method === "POST") {
        for (const r of body as Array<{ garden_id: string; id: string; data: string }>) {
          if (!this.isMember(r.garden_id, uid)) return json(403, { message: "new row violates row-level security policy" });
          const k = `${r.garden_id}/${r.id}`;
          if (!this.photos.has(k)) this.photos.set(k, r.data);
        }
        return json(201);
      }
    }
    return json(404, { message: `Fake Supabase doesn't know ${method} ${u.pathname}` });
  };

  private issue(uid: string) {
    const access = this.id("access");
    const refresh = this.id("refresh");
    this.users.set(access, uid);
    this.refresh.set(refresh, uid);
    return { access_token: access, refresh_token: refresh, expires_in: 3600, user: { id: uid } };
  }

  private rpc(name: string, a: Record<string, unknown>, uid: string, json: (s: number, v?: unknown) => Response): Response {
    const stamp = () => new Date(this.now() + this.n++).toISOString();
    switch (name) {
      case "create_garden": {
        const id = `garden-${this.id("g")}`;
        this.gardens.set(id, { id, name: String(a.p_name || "My garden"), data: reorder(structuredClone(a.p_data)), version: 1, updated_by: uid, updated_name: String(a.p_your_name) });
        this.members.push({ garden_id: id, user_id: uid, name: String(a.p_your_name || "Me"), role: "owner", joined_at: stamp() });
        return json(200, id);
      }
      case "make_invite": {
        const g = String(a.p_garden);
        if (!this.isMember(g, uid)) return json(400, { message: "not in this garden" });
        const code = this.nextCodes.shift() ?? `ROSE-${String(100000 + this.n++).slice(-6)}`;
        const inv = { code, garden_id: g, for_name: (a.p_for as string) || undefined, made_at: stamp(), expires_at: new Date(this.now() + 7 * 86400_000).toISOString() };
        this.invites.push(inv);
        return json(200, { code, expires_at: inv.expires_at });
      }
      case "join_garden": {
        const code = String(a.p_code).trim().toUpperCase();
        const inv = this.invites.find((i) => i.code === code && Date.parse(i.expires_at) > this.now());
        if (!inv) return json(200, { ok: false, reason: "not-found" });
        const had = this.members.find((m) => m.garden_id === inv.garden_id && m.user_id === uid);
        if (had) had.name = String(a.p_name);
        else this.members.push({ garden_id: inv.garden_id, user_id: uid, name: String(a.p_name || "A gardener"), role: "gardener", joined_at: stamp() });
        this.invites = this.invites.filter((i) => i !== inv);
        return json(200, { ok: true, garden_id: inv.garden_id, name: this.gardens.get(inv.garden_id)?.name });
      }
      case "leave_garden": {
        const g = String(a.p_garden);
        this.members = this.members.filter((m) => !(m.garden_id === g && m.user_id === uid));
        if (!this.members.some((m) => m.garden_id === g)) this.gardens.delete(g);
        return json(204);
      }
      case "remove_member": {
        const g = String(a.p_garden);
        const me = this.members.find((m) => m.garden_id === g && m.user_id === uid);
        if (me?.role !== "owner") return json(400, { message: "only the owner can do that" });
        this.members = this.members.filter((m) => !(m.garden_id === g && m.user_id === a.p_user && m.user_id !== uid));
        return json(204);
      }
    }
    return json(404, { message: `no function ${name}` });
  }
}

/** Shuffles object keys (reversed), the way the database may hand them back. */
function reorder(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(reorder);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).reverse().map(([k, v]) => [k, reorder(v)]));
  return x;
}

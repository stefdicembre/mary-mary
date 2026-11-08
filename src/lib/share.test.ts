import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyGarden } from "./data";
import { addEntry, addPlant, deletePlant, notForMe, updatePlant, updateSettings } from "./actions";
import { inviteMessage, merge3, same, shareable, tidyCode, withLocal } from "./share";
import { Cloud } from "./cloud";
import { FakeSupabase } from "./cloud.fake";
import { Syncer, bringIn } from "./sync";
import type { CloudLink, PhotoBridge, SyncStatus } from "./sync";
import { photosInUse } from "./actions";
import type { GardenData } from "./types";

const garden = () => {
  const g = updateSettings(emptyGarden(true), { yourName: "Stef", gardenName: "Stef and Cath's garden" });
  const [g2] = addPlant(g, { name: "Dahlia", areaId: g.areas[0].id, section: "Dahlias" });
  return g2;
};

// ── What's shared ────────────────────────────────────────────────

test("share: your own name stays on your phone", () => {
  const g = updateSettings(garden(), { needsSetup: true });
  const s = shareable(g);
  assert.equal(s.settings.yourName, undefined);
  assert.equal(s.settings.needsSetup, undefined);
  assert.equal(s.settings.gardenName, "Stef and Cath's garden");
  const back = withLocal(s, { settings: { yourName: "Cath" } });
  assert.equal(back.settings.yourName, "Cath");
  assert.equal(back.settings.needsSetup, undefined);
  assert.equal(g.settings.yourName, "Stef", "the phone's garden isn't changed");
});

test("share: key order and missing keys don't count as changes", () => {
  assert.ok(same({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 }));
  assert.ok(same({ a: 1, b: undefined }, { a: 1 }));
  assert.ok(!same({ a: [1, 2] }, { a: [2, 1] }));
  assert.ok(!same({ a: 1 }, { a: "1" }));
});

// ── Merging ──────────────────────────────────────────────────────

test("merge: both phones add plants and both are kept", () => {
  const base = garden();
  const area = base.areas[0].id;
  const [stef] = addPlant(base, { name: "Lavender", areaId: area, section: "Perennials" });
  const [cath] = addPlant(base, { name: "Rosemary", areaId: area, section: "Herbs" });
  const m = merge3(base, stef, cath);
  assert.deepEqual(m.plants.map((p) => p.name).sort(), ["Dahlia", "Lavender", "Rosemary"]);
});

test("merge: different changes to the same plant are both kept", () => {
  const base = garden();
  const id = base.plants[0].id;
  const stef = updatePlant(base, id, { notes: "Staked it" });
  const cath = updatePlant(base, id, { variety: "Bishop of Llandaff" });
  const p = merge3(base, stef, cath).plants[0];
  assert.equal(p.notes, "Staked it");
  assert.equal(p.variety, "Bishop of Llandaff");
});

test("merge: the same field changed on both, the phone sending now wins", () => {
  const base = garden();
  const id = base.plants[0].id;
  const m = merge3(base, updatePlant(base, id, { notes: "Mine" }), updatePlant(base, id, { notes: "Theirs" }));
  assert.equal(m.plants[0].notes, "Mine");
});

test("merge: removed on one phone, untouched on the other: it goes", () => {
  const base = garden();
  const id = base.plants[0].id;
  assert.equal(merge3(base, deletePlant(base, id), base).plants.length, 0);
  assert.equal(merge3(base, base, deletePlant(base, id)).plants.length, 0);
});

test("merge: removed on one phone but changed on the other: it's kept", () => {
  const base = garden();
  const id = base.plants[0].id;
  const cath = updatePlant(base, id, { notes: "Flowering!" });
  assert.equal(merge3(base, deletePlant(base, id), cath).plants[0]?.notes, "Flowering!");
});

test("merge: lists of words keep additions and removals from both", () => {
  let base = notForMe(garden(), "a1", "lavender");
  base = notForMe(base, "a1", "rosemary");
  const stef = notForMe(notForMe(base, "a1", "fern"), "a1", "lavender", true);
  const cath = notForMe(base, "a1", "sage");
  assert.deepEqual([...merge3(base, stef, cath).notForMe].sort(), ["a1:fern", "a1:rosemary", "a1:sage"]);
});

test("merge: settings and the map merge field by field", () => {
  const base = garden();
  const stef = updateSettings(base, { postcode: "ME14 1AA" });
  const cath = { ...base, map: { ...base.map, width: 30 } };
  const m = merge3(base, stef, cath);
  assert.equal(m.settings.postcode, "ME14 1AA");
  assert.equal(m.map.width, 30);
});

test("merge: changes made while a sync was going are kept (bringIn)", () => {
  const stef = garden();
  const from = shareable(stef);
  const [cathAdded] = addPlant(from, { name: "Sweet peas", areaId: from.areas[0].id, section: "Annuals and bedding" });
  // Meanwhile Stef wrote a diary note.
  const [now] = addEntry(stef, { date: "2026-11-08", text: "Raked leaves", plantIds: [], areaIds: [] });
  const after = bringIn(now, cathAdded, from);
  assert.ok(after.plants.some((p) => p.name === "Sweet peas"));
  assert.equal(after.journal[0]?.text, "Raked leaves");
  assert.equal(after.settings.yourName, "Stef");
  // Nothing changed meanwhile: the online garden is taken as it is (with Stef's own name).
  assert.ok(same(bringIn(stef, cathAdded, from), withLocal(cathAdded, stef)));
});

// ── Invite codes ─────────────────────────────────────────────────

test("invites: codes are tidied however they're typed", () => {
  assert.equal(tidyCode("rose 482 193"), "ROSE-482193");
  assert.equal(tidyCode(" Rose-482193 "), "ROSE-482193");
  assert.equal(tidyCode("THYME482193"), "THYME-482193");
  assert.equal(tidyCode("ROSE-4821"), undefined);
  assert.equal(tidyCode("WEED-482193"), undefined);
  assert.equal(tidyCode(""), undefined);
});

test("invites: the message says how to get the app and join", () => {
  const m = inviteMessage({ code: "ROSE-482193", gardenName: "Stef and Cath's garden", from: "Stef", forName: "Cath", appUrl: "https://example.org/mm/", expires: "Sunday 15 November" });
  assert.match(m, /^Hi Cath! Stef would like you/);
  assert.match(m, /Add to Home Screen/);
  assert.match(m, /Been invited\? Join a garden/);
  assert.match(m, /ROSE-482193/);
  assert.match(m, /until Sunday 15 November/);
});

// ── Two phones, talking to a pretend Supabase ───────────────────

interface Phone {
  garden: GardenData;
  link?: CloudLink;
  cloud: Cloud;
  syncer?: Syncer;
  status: SyncStatus;
  heardFrom: string[];
  gone: boolean;
  photos: Map<string, string>;
}

function phone(server: FakeSupabase, g: GardenData): Phone {
  const p: Phone = { garden: g, cloud: new Cloud("https://fake.supabase.co", "sb_publishable_test_key_1234567890", server.fetch), status: { state: "idle" }, heardFrom: [], gone: false, photos: new Map() };
  return p;
}

function bridge(p: Phone): PhotoBridge {
  return {
    localIds: async () => [...p.photos.keys()],
    exportData: async (ids) => Object.fromEntries(ids.filter((i) => p.photos.has(i)).map((i) => [i, p.photos.get(i)!])),
    importData: async (ph) => Object.entries(ph).forEach(([k, v]) => p.photos.set(k, v)),
    inUse: photosInUse,
  };
}

function connect(p: Phone, link: CloudLink) {
  p.link = link;
  p.syncer = new Syncer({
    cloud: p.cloud,
    link,
    saveLink: async () => undefined,
    photos: bridge(p),
    onRemote: (shared, from, by) => {
      p.garden = bringIn(p.garden, shared, from);
      if (by) p.heardFrom.push(by);
    },
    onStatus: (s) => (p.status = s),
    onGone: () => (p.gone = true),
    myName: () => p.garden.settings.yourName,
  });
}

async function shareFrom(p: Phone): Promise<string> {
  const data = shareable(p.garden);
  const id = await p.cloud.createGarden(data.settings.gardenName, data, p.garden.settings.yourName);
  connect(p, { gardenId: id, baseVersion: 1, base: data, role: "owner", photosUp: [] });
  return id;
}

async function joinWith(p: Phone, code: string, name: string): Promise<void> {
  const r = await p.cloud.join(code, name);
  assert.ok(r.ok, "joined");
  if (!r.ok) return;
  const remote = (await p.cloud.getGarden(r.garden_id))!;
  p.garden = withLocal(remote.data, { settings: { yourName: name } });
  connect(p, { gardenId: r.garden_id, baseVersion: remote.version, base: remote.data, role: "gardener", photosUp: [] });
}

test("sync: Stef shares, invites Cath, and Cath joins with the code", async () => {
  const server = new FakeSupabase();
  const stef = phone(server, garden());
  const id = await shareFrom(stef);
  const inv = await stef.cloud.makeInvite(id, "Cath");
  assert.match(inv.code, /^ROSE-\d{6}$/);
  assert.equal((await stef.cloud.invites(id)).length, 1);

  const cath = phone(server, emptyGarden(false));
  await joinWith(cath, inv.code.toLowerCase(), "Cath");
  assert.equal(cath.garden.settings.yourName, "Cath");
  assert.equal(cath.garden.settings.gardenName, "Stef and Cath's garden");
  assert.equal(cath.garden.plants[0].name, "Dahlia");
  assert.deepEqual((await stef.cloud.members(id)).map((m) => [m.name, m.role]), [["Stef", "owner"], ["Cath", "gardener"]]);
  assert.equal((await stef.cloud.invites(id)).length, 0, "the code is used up");

  // A used code doesn't work again.
  const eve = phone(server, emptyGarden(false));
  assert.deepEqual(await eve.cloud.join(inv.code, "Eve"), { ok: false, reason: "not-found" });
  assert.equal(await eve.cloud.getGarden(id), null, "strangers see nothing");
});

test("sync: changes on one phone show up on the other, with who made them", async () => {
  const server = new FakeSupabase();
  const stef = phone(server, garden());
  const id = await shareFrom(stef);
  const cath = phone(server, emptyGarden(false));
  await joinWith(cath, (await stef.cloud.makeInvite(id, "")).code, "Cath");

  cath.garden = updatePlant(cath.garden, cath.garden.plants[0].id, { notes: "Lifted for winter" });
  await cath.syncer!.sync(cath.garden);
  assert.equal(cath.status.state, "ok");

  await stef.syncer!.sync(stef.garden);
  assert.equal(stef.garden.plants[0].notes, "Lifted for winter");
  assert.deepEqual(stef.heardFrom, ["Cath"]);
  assert.equal(stef.garden.settings.yourName, "Stef", "Stef is still Stef");

  // Nothing new: a sync round is a single cheap check.
  server.calls = [];
  await stef.syncer!.sync(stef.garden);
  assert.deepEqual(server.calls, ["GET /rest/v1/gardens"]);
});

test("sync: both phones change things offline, and both sets of changes survive", async () => {
  const server = new FakeSupabase();
  const stef = phone(server, garden());
  const id = await shareFrom(stef);
  const cath = phone(server, emptyGarden(false));
  await joinWith(cath, (await stef.cloud.makeInvite(id, "")).code, "Cath");

  server.offline = true;
  const area = stef.garden.areas[0].id;
  [stef.garden] = addPlant(stef.garden, { name: "Lavender", areaId: area, section: "Perennials" });
  [cath.garden] = addEntry(cath.garden, { date: "2026-11-08", text: "Planted garlic", plantIds: [], areaIds: [area] });
  await stef.syncer!.sync(stef.garden);
  assert.equal(stef.status.state, "offline");

  server.offline = false;
  await cath.syncer!.sync(cath.garden);
  await stef.syncer!.sync(stef.garden); // conflict → merge → send
  await cath.syncer!.sync(cath.garden);
  for (const p of [stef, cath]) {
    assert.ok(p.garden.plants.some((x) => x.name === "Lavender"), "lavender kept");
    assert.equal(p.garden.journal[0]?.text, "Planted garlic", "diary note kept");
  }
  assert.ok(same(shareable(stef.garden), shareable(cath.garden)), "both phones agree");
  assert.equal(stef.garden.settings.yourName, "Stef");
  assert.equal(cath.garden.settings.yourName, "Cath");
});

test("sync: a run-out pass is renewed quietly", async () => {
  const server = new FakeSupabase();
  let clock = Date.parse("2026-11-08T10:00:00Z");
  const stef = phone(server, garden());
  stef.cloud = new Cloud("https://fake.supabase.co", "sb_publishable_test_key_1234567890", server.fetch, undefined, undefined, () => clock);
  await shareFrom(stef);
  const first = stef.cloud.session!.access;
  clock += 2 * 3600_000;
  server.expire(first);
  stef.garden = updateSettings(stef.garden, { postcode: "ME14" });
  await stef.syncer!.sync(stef.garden);
  assert.equal(stef.status.state, "ok");
  assert.notEqual(stef.cloud.session!.access, first);
});

test("sync: someone removed from the garden is told, and keeps their copy", async () => {
  const server = new FakeSupabase();
  const stef = phone(server, garden());
  const id = await shareFrom(stef);
  const cath = phone(server, emptyGarden(false));
  await joinWith(cath, (await stef.cloud.makeInvite(id, "")).code, "Cath");
  const cathId = cath.cloud.userId!;
  await stef.cloud.removeMember(id, cathId);
  await cath.syncer!.sync(cath.garden);
  assert.equal(cath.gone, true);
  assert.equal(cath.status.state, "gone");
  assert.equal(cath.garden.plants.length, 1, "her copy stays on the phone");
  // Cath can't remove Stef (only the owner can remove people).
  await assert.rejects(cath.cloud.removeMember(id, stef.cloud.userId!));
});

test("sync: diary photos go up from one phone and come down on the other", async () => {
  const server = new FakeSupabase();
  const stef = phone(server, garden());
  const id = await shareFrom(stef);
  const cath = phone(server, emptyGarden(false));
  await joinWith(cath, (await stef.cloud.makeInvite(id, "")).code, "Cath");

  stef.photos.set("photo_a", "data:image/jpeg;base64,AAAA");
  [stef.garden] = addEntry(stef.garden, { date: "2026-11-08", text: "First frost", plantIds: [], areaIds: [], photoIds: ["photo_a"] });
  await stef.syncer!.sync(stef.garden);
  assert.deepEqual(stef.status.state, "ok", JSON.stringify(stef.status));
  assert.equal(server.photos.get(`${id}/photo_a`), "data:image/jpeg;base64,AAAA");
  assert.deepEqual(stef.link!.photosUp, ["photo_a"]);

  await cath.syncer!.sync(cath.garden);
  assert.equal(cath.photos.get("photo_a"), "data:image/jpeg;base64,AAAA");

  // Already sent: not sent again.
  server.calls = [];
  await stef.syncer!.sync(stef.garden);
  assert.ok(!server.calls.includes("POST /rest/v1/photos"));
});

test("sync: when the last person leaves, the online copy goes", async () => {
  const server = new FakeSupabase();
  const stef = phone(server, garden());
  const id = await shareFrom(stef);
  await stef.cloud.leave(id);
  assert.equal(server.gardens.size, 0);
});

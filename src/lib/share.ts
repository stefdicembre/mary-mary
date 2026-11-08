// Sharing a garden between phones (v1.1): the plain logic, so it can be tested
// without a phone or the internet.
//
//  - Which parts of the garden are shared, and which belong to one phone.
//  - Merging: if Stef and Cath both change things before their phones catch up,
//    both sets of changes are kept. Only when they change the very same thing
//    (the same plant's notes, say) does the later one win.
//  - Invite codes, like ROSE-482193.

import type { GardenData, GardenSettings } from "./types";

/** Settings that belong to this phone, not the shared garden. */
const LOCAL_SETTINGS: Array<keyof GardenSettings> = ["yourName", "needsSetup"];

/** The garden as it goes online: without this phone's own settings. */
export function shareable(g: GardenData): GardenData {
  const settings = { ...g.settings };
  for (const k of LOCAL_SETTINGS) delete settings[k];
  return { ...g, settings };
}

/** A garden from online, with this phone's own settings put back. */
export function withLocal(shared: GardenData, local: Pick<GardenData, "settings"> | { settings: Partial<GardenSettings> }): GardenData {
  const settings = { ...shared.settings };
  for (const k of LOCAL_SETTINGS) {
    const v = (local.settings as Partial<GardenSettings>)[k];
    if (v === undefined) delete settings[k];
    else (settings as Record<string, unknown>)[k] = v;
  }
  return { ...shared, settings: settings as GardenSettings };
}

// ── Comparing ────────────────────────────────────────────────────

type Json = unknown;

function isObj(x: Json): x is Record<string, Json> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/**
 * True if two values hold the same data. The online database stores keys in its
 * own order, and a missing key is the same as one set to undefined.
 */
export function same(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => same(x, b[i]));
  }
  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if (!same(a[k], b[k])) return false;
    return true;
  }
  return false;
}

// ── Merging ──────────────────────────────────────────────────────

function hasIds(xs: Json[]): xs is Array<Record<string, Json> & { id: string }> {
  return xs.every((x) => isObj(x) && typeof x.id === "string");
}

function isPrimitive(x: Json): boolean {
  return x === null || ["string", "number", "boolean"].includes(typeof x);
}

/** Lists of things with ids (plants, jobs, diary entries…): merged one thing at a time. */
function mergeById(base: Json[], mine: Json[], theirs: Json[]): Json[] {
  const b = new Map((base as Array<{ id: string }>).map((x) => [x.id, x]));
  const m = new Map((mine as Array<{ id: string }>).map((x) => [x.id, x]));
  const out: Json[] = [];
  const seen = new Set<string>();
  // Their order first, then anything new of mine, in my order.
  for (const t of theirs as Array<{ id: string }>) {
    seen.add(t.id);
    const was = b.get(t.id);
    const now = m.get(t.id);
    if (now === undefined) {
      // I removed it. Keep it only if they changed it meanwhile (or added it).
      if (was === undefined || !same(was, t)) out.push(t);
      continue;
    }
    out.push(was === undefined ? merge3(undefined, now, t) : merge3(was, now, t));
  }
  for (const x of mine as Array<{ id: string }>) {
    if (seen.has(x.id)) continue;
    const was = b.get(x.id);
    // They removed it. Keep it only if I changed it meanwhile (or it's new).
    if (was === undefined || !same(was, x)) out.push(x);
  }
  return out;
}

/** Lists of plain words or numbers (like "Not for me"): additions and removals from both. */
function mergeSet(base: Json[], mine: Json[], theirs: Json[]): Json[] {
  const has = (xs: Json[], v: Json) => xs.some((x) => x === v);
  const out = theirs.filter((v) => !(has(base, v) && !has(mine, v)));
  for (const v of mine) if (!has(base, v) && !has(out, v)) out.push(v);
  return out;
}

/**
 * Three-way merge: `base` is what both phones last agreed on, `mine` is this
 * phone's version, `theirs` is what's online now. Whatever only one side changed
 * is taken from that side. If both changed the same thing, mine wins (it's the
 * newer change, about to be sent).
 */
export function merge3<T>(base: T | undefined, mine: T, theirs: T): T {
  if (same(mine, theirs)) return mine;
  if (base !== undefined && same(mine, base)) return theirs;
  if (base !== undefined && same(theirs, base)) return mine;
  const b = base as Json;
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    const bs = Array.isArray(b) ? b : [];
    if (hasIds(mine) && hasIds(theirs) && hasIds(bs)) return mergeById(bs, mine, theirs) as T;
    if ([...mine, ...theirs, ...bs].every(isPrimitive)) return mergeSet(bs, mine, theirs) as T;
    return mine;
  }
  if (isObj(mine) && isObj(theirs)) {
    const bo = isObj(b) ? b : {};
    const out: Record<string, Json> = {};
    const keys = new Set([...Object.keys(theirs), ...Object.keys(mine)]);
    for (const k of keys) {
      const v = k in bo ? merge3(bo[k], mine[k], theirs[k]) : mine[k] === undefined ? theirs[k] : theirs[k] === undefined ? mine[k] : merge3(undefined, mine[k], theirs[k]);
      if (v !== undefined) out[k] = v;
    }
    return out as T;
  }
  return mine;
}

// ── Invite codes ─────────────────────────────────────────────────

/** The words invite codes start with (the online database picks one). Kept in step with supabase/setup.sql. */
export const CODE_WORDS = ["ROSE", "TULIP", "FERN", "IVY", "OAK", "MINT", "SAGE", "PEA", "BEAN", "LILY", "IRIS", "DAISY", "POPPY", "HOLLY", "THYME", "BASIL", "PLUM", "PEAR", "KALE", "LEEK"];

/**
 * Tidies a typed code: "rose 482 193", "Rose-482193" and "ROSE482193" all become "ROSE-482193".
 * Returns undefined if it doesn't look like a code yet.
 */
export function tidyCode(typed: string): string | undefined {
  const s = typed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^([A-Z]+)(\d{6})$/.exec(s);
  if (!m || !CODE_WORDS.includes(m[1])) return undefined;
  return `${m[1]}-${m[2]}`;
}

/** The message sent with an invite. */
export function inviteMessage(opts: { code: string; gardenName: string; from: string; forName?: string; appUrl: string; expires: string }): string {
  const hi = opts.forName?.trim() ? `Hi ${opts.forName.trim()}! ` : "";
  return [
    `${hi}${opts.from || "I"} would like you to help with "${opts.gardenName}" on Mary Mary, our garden app.`,
    "",
    `1. On your iPhone, open ${opts.appUrl} in Safari, tap the Share button, then "Add to Home Screen".`,
    `2. Open Mary Mary from your Home Screen and tap "Been invited? Join a garden".`,
    `3. Type this code: ${opts.code}`,
    "",
    `The code works once, until ${opts.expires}.`,
  ].join("\n");
}

// Date helpers. Mary Mary always thinks in UK time (Europe/London),
// so "today" is right even around midnight and the clocks changing.

const TZ = "Europe/London";

function londonParts(d: Date): { y: string; m: string; day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { y: get("year"), m: get("month"), day: get("day"), hour: Number(get("hour")) };
}

/** Today's date in the UK, as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  const p = londonParts(now);
  return `${p.y}-${p.m}-${p.day}`;
}

/** "Good morning", "Good afternoon" or "Good evening", by UK time. */
export function greeting(now: Date = new Date()): string {
  const h = londonParts(now).hour;
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** "Wednesday 28 October" */
export function longDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

/** "28 Oct 2026" from YYYY-MM-DD. Returns "" for a missing date. */
export function shortDate(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

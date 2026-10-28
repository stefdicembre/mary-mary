// "What went wrong?" — the reason chips from the wireframes, plus a gentle
// guess from the gardener's own words (e.g. "caterpillars ate it" → Pests).

import type { ReasonKey, Setback } from "./types";

export interface ReasonDef {
  key: ReasonKey;
  label: string;
  question?: string;
  options?: string[];
}

export const REASONS: ReasonDef[] = [
  { key: "weather", label: "Weather", question: "What kind of weather?", options: ["Frost", "Heat", "Wind"] },
  { key: "water", label: "Water", question: "Too much or too little?", options: ["Too wet", "Too dry"] },
  {
    key: "pests",
    label: "Pests",
    question: "Which pest?",
    options: ["Slugs and snails", "Caterpillars", "Aphids", "Vine weevil", "Something else"],
  },
  { key: "disease", label: "Disease", question: "Which disease?", options: ["Blight", "Mildew", "Rust", "Rot", "Not sure"] },
  { key: "neglect", label: "Forgot about it" },
  { key: "dontKnow", label: "Don't know" },
];

export interface Guess {
  key: ReasonKey;
  detail?: string;
}

// Word starts to look for (small regular expressions). Order matters only for readability.
const GUESSES: Array<[ReasonKey, string | undefined, string[]]> = [
  ["weather", "Frost", ["frost", "froze", "freez", "cold snap"]],
  ["weather", "Heat", ["heatwave", "heat", "too hot", "scorch", "sunburn", "burnt", "frazzled"]],
  ["weather", "Wind", ["wind(y|s)?\\b", "gale", "storm", "blown", "shredded"]],
  ["water", "Too wet", ["too wet", "waterlog", "soggy", "sodden", "drown", "puddle", "rain"]],
  ["water", "Too dry", ["too dry", "dried out", "drought", "wilt", "thirsty", "parched"]],
  ["pests", "Caterpillars", ["caterpillar"]],
  ["pests", "Slugs and snails", ["slug", "snail"]],
  ["pests", "Aphids", ["aphid", "greenfly", "blackfly"]],
  ["pests", "Vine weevil", ["vine weevil", "weevil"]],
  ["pests", "Something else", ["pigeon", "bird", "rabbit", "squirrel", "deer", "mice", "eaten", "nibbled", "chewed"]],
  ["disease", "Blight", ["blight"]],
  ["disease", "Mildew", ["mildew"]],
  ["disease", "Rust", ["rust"]],
  ["disease", "Rot", ["rot"]],
  ["neglect", undefined, ["forgot", "neglect", "didn't water", "didnt water", "never watered"]],
];

/** Guess reasons from free text. Never decides for the gardener: the app only offers these. */
export function guessReasons(text: string): Guess[] {
  const t = text.toLowerCase().replace(/[’']/g, "'");
  const found: Guess[] = [];
  for (const [key, detail, words] of GUESSES) {
    // Match at the start of a word, so "rot" finds "rotted" but not "carrot".
    // Each entry is a small pattern; "wind(y|s)?\\b" means wind, windy or winds, but not window.
    const hit = words.some((w) => new RegExp(`(^|[^a-z])${w}`).test(t));
    if (hit && !found.some((g) => g.key === key)) found.push({ key, detail });
  }
  return found;
}

export function reasonLabel(key: ReasonKey, detail?: string): string {
  if (detail) return detail;
  return REASONS.find((r) => r.key === key)?.label ?? key;
}

/** A short summary like "Wind, Caterpillars" or "not sure why". */
export function setbackSummary(s: Pick<Setback, "reasons" | "details">): string {
  const known = s.reasons.filter((r) => r !== "dontKnow");
  if (!known.length) return s.reasons.includes("dontKnow") ? "not sure why" : "";
  return known.map((k) => reasonLabel(k, s.details[k])).join(", ");
}

/** A practical tip for next time. General UK advice. */
export function lessonFor(key: ReasonKey, detail?: string): string {
  const advice: Partial<Record<ReasonKey, Record<string, string>>> = {
    weather: {
      Frost: "Protect it with fleece, or bring it under cover, before the first frost.",
      Heat: "Water it early in the day and give it some shade during a heatwave.",
      Wind: "Try a more sheltered spot, or tougher plants that cope with wind here.",
      "": "Keep an eye on the weather here, and choose plants that suit it.",
    },
    water: {
      "Too wet": "Try plants that cope with damp, or a pot with better drainage.",
      "Too dry": "Try plants that cope with dry spells, or water more often in summer.",
      "": "Check how wet or dry this spot gets before planting here again.",
    },
    pests: {
      "Slugs and snails": "Protect young plants from slugs, or choose plants slugs tend to leave alone.",
      Caterpillars: "Net it from late spring, before the butterflies lay their eggs.",
      Aphids: "Check for aphids in spring and squash or hose them off early.",
      "": "Keep an eye out for pests and act early.",
    },
    disease: { "": "Look for a disease-resistant variety, and give it room for air to move." },
    neglect: { "": "A gentle reminder to keep it watered and fed would help this one." },
  };
  const group = advice[key];
  if (!group) return "";
  return group[detail ?? ""] ?? group[""] ?? "";
}

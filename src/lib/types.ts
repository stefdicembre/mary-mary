// The shapes of everything Mary Mary remembers.
// All of it is saved on the phone (in the browser's IndexedDB storage).

export type Aspect = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export type AreaKind = "border" | "bed" | "pots" | "greenhouse" | "veg" | "water" | "lawn" | "other";

export interface Area {
  id: string;
  name: string;
  kind: AreaKind;
  aspect?: Aspect;
  soil?: string;
  colours?: ColourScheme;
  notes?: string;
  createdAt: string; // ISO date-time
}

export type ColourScheme = "hot" | "pastel" | "cool" | "white" | "any";

export type PlantStatus = "growing" | "struggling" | "lost";

export type PlantSource = "seed" | "plug" | "cutting" | "shop" | "gift" | "unknown";

export interface Plant {
  id: string;
  name: string; // common name, e.g. "Musa basjoo" or "Dahlia"
  variety?: string; // e.g. "Bishop of Llandaff"
  latinName?: string;
  areaId: string;
  section: string; // e.g. "Perennials"
  plantedOn?: string; // YYYY-MM-DD
  source?: PlantSource;
  notes?: string;
  status: PlantStatus;
  doesWell?: boolean; // marked "Does well here"
  createdAt: string;
  lostOn?: string; // YYYY-MM-DD, when it didn't make it
}

// Reason groups, following the wireframe's "What went wrong?" chips.
export type ReasonKey = "weather" | "water" | "pests" | "disease" | "neglect" | "dontKnow";

export type SetbackOutcome = "struggling" | "died" | "removed";

export interface Setback {
  id: string;
  plantId: string;
  areaId: string; // where it was at the time
  date: string; // YYYY-MM-DD
  outcome: SetbackOutcome;
  reasons: ReasonKey[];
  details: Partial<Record<ReasonKey, string>>; // e.g. { weather: "Wind", pests: "Caterpillars" }
  inOwnWords?: string; // kept exactly as written
  journalEntryId?: string;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  plantIds: string[];
  areaIds: string[];
  setbackId?: string;
  taskId?: string; // written when a job was done
  photoIds?: string[]; // photos are kept separately on the phone (see photos.ts)
}

/** A job: one the gardener added, or a seasonal one from Mary Mary's calendar that was done. */
export interface Task {
  id: string;
  title: string;
  areaId?: string;
  plantId?: string;
  dueOn?: string; // YYYY-MM-DD; none = whenever
  minutes?: number;
  notes?: string;
  doneOn?: string; // YYYY-MM-DD
  /** Set when this records a seasonal job from the calendar: "<seasonal id>:<year>". */
  seasonalKey?: string;
  /** "Add something I did": a job that wasn't on the list. */
  extra?: boolean;
  /** Supplies this job used up when it was done, so Undo can put them back (v0.5). */
  supplyUse?: SupplyUse[];
  createdAt: string;
}

// ── Supplies (v0.5) ──────────────────────────────────────────────

export type SupplyLevel = "plenty" | "low" | "out";

/** Something kept in the shed: fleece, twine, compost, bone meal. */
export interface Supply {
  id: string;
  name: string;
  level: SupplyLevel;
  /**
   * How much has been used since the level last changed, in thirds of a level.
   * A small job adds 1, a big one (like mulching) adds 3. At 3 the level drops.
   */
  wear: number;
  /** Set when Mary Mary lowered the level after a job, rather than the gardener. */
  lowered?: { by: string; on: string }; // job title, YYYY-MM-DD
  createdAt: string;
}

export interface SupplyUse {
  supplyId: string;
  amount: number; // thirds of a level, as for Supply.wear
}

export interface GardenSettings {
  gardenName: string;
  yourName: string;
  postcode?: string;
  /** Found from the postcode, used for the weather forecast. */
  location?: { lat: number; lon: number; place: string; forPostcode: string };
}

/** A plant Mary Mary suggested and the gardener chose, waiting to be planted. */
export interface PlannedPlant {
  id: string;
  areaId: string;
  catalogueId?: string;
  name: string;
  section: string;
  /** Month number (1 to 12) when it's best planted. */
  plantMonth?: number;
  addedOn: string; // YYYY-MM-DD
}

export interface GardenData {
  version: 1;
  settings: GardenSettings;
  areas: Area[];
  plants: Plant[];
  setbacks: Setback[];
  journal: JournalEntry[];
  planned: PlannedPlant[];
  /** Suggestions the gardener said "Not for me" to, per area: "areaId:catalogueId". */
  notForMe: string[];
  tasks: Task[];
  /** Jobs put off with "Not now": job key → YYYY-MM-DD to show again from. */
  snoozed: Record<string, string>;
  /** The whole-garden map (v0.4). */
  map: GardenMap;
  /** What's where inside each area: area id → its bed plan (v0.4). */
  bedPlans: Record<string, BedPlan>;
  /** What's in the shed (v0.5). */
  supplies: Supply[];
  /** What's been picked: fruit, veg and herbs (v0.6). */
  harvests: Harvest[];
}

// ── Harvest log (v0.6) ───────────────────────────────────────────

/** Quick sizes for muddy hands. */
export type HarvestSize = "few" | "handful" | "bowl" | "trug";

/** One picking: "a bowlful of tomatoes from the greenhouse". */
export interface Harvest {
  id: string;
  date: string; // YYYY-MM-DD
  /** The plant it came from, if it's one of the garden's plants. */
  plantId?: string;
  /** What was picked, kept as written (or the plant's name at the time). */
  name: string;
  areaId?: string;
  /** How much: a quick size, or a count. Either, both or neither. */
  size?: HarvestSize;
  count?: number;
  /** Weight in grams, if it was weighed. */
  grams?: number;
  note?: string;
  /** The diary entry made with it, if "Add to the garden diary" was on. */
  journalEntryId?: string;
  /** The picking job it was logged from, if any. */
  taskId?: string;
  createdAt: string;
}

// ── Garden layout (v0.4) ─────────────────────────────────────────

/** A rectangle on a grid. On the garden map one square is about a metre. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FeatureKind = "house" | "shed" | "patio" | "path" | "tree" | "compost" | "other";

/** Something on the map that isn't a planted area: the house, a shed, a path. */
export interface MapFeature extends Box {
  id: string;
  kind: FeatureKind;
  label: string;
}

export type North = "up" | "right" | "down" | "left";

export interface GardenMap {
  /** Size of the garden in squares (about a metre each). */
  width: number;
  length: number;
  /** Which way north is on the map. */
  north: North;
  /** Where each area sits: area id → box. Areas not in here aren't on the map yet. */
  areas: Record<string, Box>;
  features: MapFeature[];
}

/** One plant (or planned plant) placed in a square of a bed plan. */
export interface BedSpot {
  id: string;
  x: number;
  y: number;
  plantId?: string;
  plannedId?: string;
}

export interface BedPlan {
  cols: number;
  rows: number;
  spots: BedSpot[];
}

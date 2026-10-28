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
}

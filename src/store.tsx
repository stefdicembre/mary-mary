// Holds the garden while the app is open, and saves every change to the phone.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { upgrade } from "./lib/data";
import { newInstall } from "./lib/setup";
import { askToKeepData, loadGarden, saveGarden } from "./lib/db";
import { photosInUse } from "./lib/actions";
import { tidyBedPlans } from "./lib/layout";
import { tidyPhotos } from "./lib/photos";
import { bringIn } from "./lib/sync";
import type { GardenData } from "./lib/types";

interface Toast {
  text: string;
  undo?: GardenData; // the garden as it was before, if this can be undone
}

interface Store {
  garden: GardenData;
  /** Apply a change. Pass undoable text to show a toast with an Undo button. */
  update: (fn: (g: GardenData) => GardenData, toastText?: string, undoable?: boolean) => void;
  replaceAll: (g: GardenData) => void;
  /**
   * Changes that came in from the shared garden online (v1.1). Keeps anything changed
   * on this phone meanwhile, and is saved before it returns.
   */
  fromCloud: (shared: GardenData, from: GardenData, by?: string) => Promise<GardenData>;
  toast: Toast | null;
  undo: () => void;
  dismissToast: () => void;
  saveError: boolean;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [garden, setGarden] = useState<GardenData | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [saveError, setSaveError] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    loadGarden()
      .then((g) => {
        const garden = g ? upgrade(g) : newInstall();
        setGarden(garden);
        // Clear out photos from diary entries removed in an earlier session.
        if (g) tidyPhotos(photosInUse(garden)).catch(() => undefined);
      })
      .catch(() => setGarden(newInstall()));
    askToKeepData();
  }, []);

  useEffect(() => {
    if (!garden) return;
    saveGarden(garden)
      .then(() => setSaveError(false))
      .catch(() => setSaveError(true));
  }, [garden]);

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 6000);
  }, []);

  const latest = useRef<GardenData | null>(null);
  latest.current = garden;

  const update = useCallback(
    (fn: (g: GardenData) => GardenData, toastText?: string, undoable = false) => {
      const prev = latest.current;
      if (!prev) return;
      // Bed plans forget plants that were deleted, moved or taken off the plan.
      const next = tidyBedPlans(fn(prev));
      latest.current = next;
      setGarden(next);
      if (toastText) showToast({ text: toastText, undo: undoable ? prev : undefined });
    },
    [showToast],
  );

  const fromCloud = useCallback(
    async (shared: GardenData, from: GardenData, by?: string) => {
      const prev = latest.current!;
      const next = tidyBedPlans(upgrade(bringIn(prev, shared, from)));
      latest.current = next;
      setGarden(next);
      await saveGarden(next).catch(() => undefined);
      if (by) showToast({ text: `${by}'s changes are in` });
      return next;
    },
    [showToast],
  );

  if (!garden) return null;

  const store: Store = {
    garden,
    update,
    replaceAll: (g) => {
      const next = upgrade(g);
      latest.current = next;
      setGarden(next);
    },
    fromCloud,
    toast,
    undo: () => {
      if (toast?.undo) setGarden(toast.undo);
      setToast(null);
    },
    dismissToast: () => setToast(null),
    saveError,
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

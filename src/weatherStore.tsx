// Keeps the forecast while the app is open, shared by Home and the Weather screen.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Forecast } from "./lib/weather";
import { getForecast, savedForecast } from "./lib/weatherApi";
import { useStore } from "./store";

type Status = "no-place" | "loading" | "ok" | "offline";

interface WeatherState {
  forecast?: Forecast;
  status: Status;
  refresh: () => void;
}

const Ctx = createContext<WeatherState>({ status: "no-place", refresh: () => undefined });

export const useWeather = () => useContext(Ctx);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const { garden } = useStore();
  const loc = garden.settings.location;
  const [forecast, setForecast] = useState<Forecast>();
  const [status, setStatus] = useState<Status>(loc ? "loading" : "no-place");

  const load = useCallback(
    (force: boolean) => {
      if (!loc) {
        setStatus("no-place");
        setForecast(undefined);
        return;
      }
      setStatus("loading");
      savedForecast().then((f) => {
        if (f && f.place === loc.place) setForecast((cur) => cur ?? f);
      });
      getForecast(loc, force)
        .then((f) => {
          setForecast(f);
          setStatus("ok");
        })
        .catch(() => setStatus("offline"));
    },
    [loc?.lat, loc?.lon, loc?.place],
  );

  useEffect(() => {
    load(false);
    // Refresh when the app comes back to the front after a while.
    const onShow = () => {
      if (document.visibilityState === "visible") load(false);
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [load]);

  return <Ctx.Provider value={{ forecast, status, refresh: () => load(true) }}>{children}</Ctx.Provider>;
}

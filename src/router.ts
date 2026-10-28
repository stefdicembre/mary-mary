// Simple page addresses after the # in the web address, e.g. #/area/abc.
// This works on GitHub Pages without any server set-up.

import { useEffect, useState } from "react";

export type Route =
  | { page: "home" }
  | { page: "menu" }
  | { page: "settings" }
  | { page: "lost" }
  | { page: "weather" }
  | { page: "jobs" }
  | { page: "newJob" }
  | { page: "didJob" }
  | { page: "diary"; areaId?: string; plantId?: string }
  | { page: "diaryNew"; areaId?: string; plantId?: string; taskId?: string }
  | { page: "diaryEntry"; id: string }
  | { page: "diaryEdit"; id: string }
  | { page: "plan"; areaId: string }
  | { page: "newArea" }
  | { page: "area"; id: string }
  | { page: "editArea"; id: string }
  | { page: "newPlant"; areaId: string }
  | { page: "plant"; id: string }
  | { page: "editPlant"; id: string }
  | { page: "setback"; id: string; outcome: "struggling" | "died" | "removed" };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [a, b, c, d] = parts;
  switch (a) {
    case "jobs":
      if (b === "new") return { page: "newJob" };
      if (b === "did") return { page: "didJob" };
      return { page: "jobs" };
    case "diary":
      if (b === "area" && c) return { page: "diary", areaId: c };
      if (b === "plant" && c) return { page: "diary", plantId: c };
      if (b === "entry" && c) return d === "edit" ? { page: "diaryEdit", id: c } : { page: "diaryEntry", id: c };
      if (b === "new") {
        if (c === "area" && d) return { page: "diaryNew", areaId: d };
        if (c === "plant" && d) return { page: "diaryNew", plantId: d };
        if (c === "task" && d) return { page: "diaryNew", taskId: d };
        return { page: "diaryNew" };
      }
      return { page: "diary" };
    case "menu":
      return { page: "menu" };
    case "settings":
      return { page: "settings" };
    case "lost":
      return { page: "lost" };
    case "weather":
      return { page: "weather" };
    case "new-area":
      return { page: "newArea" };
    case "area":
      if (b && c === "edit") return { page: "editArea", id: b };
      if (b && c === "new-plant") return { page: "newPlant", areaId: b };
      if (b && c === "plan") return { page: "plan", areaId: b };
      if (b) return { page: "area", id: b };
      break;
    case "plant":
      if (b && c === "edit") return { page: "editPlant", id: b };
      if (b && (c === "struggling" || c === "died" || c === "removed")) return { page: "setback", id: b, outcome: c };
      if (b) return { page: "plant", id: b };
      break;
  }
  return { page: "home" };
}

export function href(r: Route): string {
  switch (r.page) {
    case "home":
      return "#/";
    case "menu":
      return "#/menu";
    case "settings":
      return "#/settings";
    case "lost":
      return "#/lost";
    case "weather":
      return "#/weather";
    case "jobs":
      return "#/jobs";
    case "newJob":
      return "#/jobs/new";
    case "didJob":
      return "#/jobs/did";
    case "diary":
      if (r.areaId) return `#/diary/area/${encodeURIComponent(r.areaId)}`;
      if (r.plantId) return `#/diary/plant/${encodeURIComponent(r.plantId)}`;
      return "#/diary";
    case "diaryNew":
      if (r.areaId) return `#/diary/new/area/${encodeURIComponent(r.areaId)}`;
      if (r.plantId) return `#/diary/new/plant/${encodeURIComponent(r.plantId)}`;
      if (r.taskId) return `#/diary/new/task/${encodeURIComponent(r.taskId)}`;
      return "#/diary/new";
    case "diaryEntry":
      return `#/diary/entry/${encodeURIComponent(r.id)}`;
    case "diaryEdit":
      return `#/diary/entry/${encodeURIComponent(r.id)}/edit`;
    case "plan":
      return `#/area/${encodeURIComponent(r.areaId)}/plan`;
    case "newArea":
      return "#/new-area";
    case "area":
      return `#/area/${encodeURIComponent(r.id)}`;
    case "editArea":
      return `#/area/${encodeURIComponent(r.id)}/edit`;
    case "newPlant":
      return `#/area/${encodeURIComponent(r.areaId)}/new-plant`;
    case "plant":
      return `#/plant/${encodeURIComponent(r.id)}`;
    case "editPlant":
      return `#/plant/${encodeURIComponent(r.id)}/edit`;
    case "setback":
      return `#/plant/${encodeURIComponent(r.id)}/${r.outcome}`;
  }
}

export function go(r: Route, replace = false): void {
  if (replace) location.replace(href(r));
  else location.hash = href(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

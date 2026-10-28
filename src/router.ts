// Simple page addresses after the # in the web address, e.g. #/area/abc.
// This works on GitHub Pages without any server set-up.

import { useEffect, useState } from "react";

export type Route =
  | { page: "home" }
  | { page: "menu" }
  | { page: "settings" }
  | { page: "lost" }
  | { page: "newArea" }
  | { page: "area"; id: string }
  | { page: "editArea"; id: string }
  | { page: "newPlant"; areaId: string }
  | { page: "plant"; id: string }
  | { page: "editPlant"; id: string }
  | { page: "setback"; id: string; outcome: "struggling" | "died" | "removed" };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = parts;
  switch (a) {
    case "menu":
      return { page: "menu" };
    case "settings":
      return { page: "settings" };
    case "lost":
      return { page: "lost" };
    case "new-area":
      return { page: "newArea" };
    case "area":
      if (b && c === "edit") return { page: "editArea", id: b };
      if (b && c === "new-plant") return { page: "newPlant", areaId: b };
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

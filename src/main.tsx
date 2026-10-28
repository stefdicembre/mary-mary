import { createRoot } from "react-dom/client";
import "./styles.css";
import { useRoute } from "./router";
import { StoreProvider } from "./store";
import { ToastBar } from "./ui";
import { Home } from "./screens/Home";
import { AreaPage } from "./screens/AreaPage";
import { AreaForm } from "./screens/AreaForm";
import { PlantPage } from "./screens/PlantPage";
import { PlantForm } from "./screens/PlantForm";
import { SetbackForm } from "./screens/SetbackForm";
import { Lost, Menu, Settings } from "./screens/Other";
import { WeatherScreen } from "./screens/Weather";
import { PlanScreen } from "./screens/Plan";
import { WeatherProvider } from "./weatherStore";

function Screen() {
  const r = useRoute();
  switch (r.page) {
    case "home":
      return <Home />;
    case "menu":
      return <Menu />;
    case "settings":
      return <Settings />;
    case "lost":
      return <Lost />;
    case "weather":
      return <WeatherScreen />;
    case "plan":
      return <PlanScreen key={r.areaId} areaId={r.areaId} />;
    case "newArea":
      return <AreaForm key="new" />;
    case "area":
      return <AreaPage key={r.id} id={r.id} />;
    case "editArea":
      return <AreaForm key={r.id} id={r.id} />;
    case "newPlant":
      return <PlantForm key={`new-${r.areaId}`} areaId={r.areaId} />;
    case "plant":
      return <PlantPage key={r.id} id={r.id} />;
    case "editPlant":
      return <PlantForm key={r.id} id={r.id} />;
    case "setback":
      return <SetbackForm key={`${r.id}-${r.outcome}`} id={r.id} outcome={r.outcome} />;
  }
}

function App() {
  return (
    <StoreProvider>
      <WeatherProvider>
        <main className="app">
          <Screen />
        </main>
        <ToastBar />
      </WeatherProvider>
    </StoreProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

// Lets the app open without signal, and picks up new versions automatically.
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* the app still works without it */
    });
  });
}

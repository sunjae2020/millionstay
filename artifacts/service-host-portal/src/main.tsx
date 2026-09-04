import { createRoot } from "react-dom/client";
import "@/i18n";
import App from "./App";
import "./index.css";
import { initDarkMode } from "@/lib/darkMode";
import { setupPwa } from "@/lib/pwa";

initDarkMode();
// Installable web app + offline shell — the field crew runs this from the
// phone home screen.
setupPwa();

createRoot(document.getElementById("root")!).render(<App />);

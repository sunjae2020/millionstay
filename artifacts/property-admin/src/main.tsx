import { createRoot } from "react-dom/client";
import App from "./App";
import "./i18n";
import "./index.css";
import { setupPwa } from "@/lib/pwa";

// Installable web app + offline shell.
setupPwa();

createRoot(document.getElementById("root")!).render(<App />);

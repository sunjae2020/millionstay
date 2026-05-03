import { createRoot } from "react-dom/client";
import "@/i18n";
import App from "./App";
import "./index.css";
import { initDarkMode } from "@/lib/darkMode";

initDarkMode();

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { APP_NAME } from "./lib/appName";

// White-label: browser-tab title follows the per-instance app name (spec §2.3).
document.title = APP_NAME;

createRoot(document.getElementById("root")!).render(<App />);

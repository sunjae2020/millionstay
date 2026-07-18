import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { APP_NAME } from "./lib/appName";
import { FAVICON_URL } from "./lib/brand";

// White-label: browser-tab title + favicon follow the per-instance brand (spec §2.3/§2.4).
document.title = APP_NAME;
if (FAVICON_URL) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = FAVICON_URL;
}

createRoot(document.getElementById("root")!).render(<App />);

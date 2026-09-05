import { createRoot } from "react-dom/client";
import "@/i18n";
import App from "./App";
import "./index.css";
import { initDarkMode } from "@/lib/darkMode";
import { setupPwa } from "@/lib/pwa";
import { installPhotoOptimizer } from "@/lib/photo";
import { installDomGuard } from "@/lib/domGuard";

// Survive browsers that translate the page underneath React (see lib/domGuard).
installDomGuard();

initDarkMode();
// Installable web app + offline shell — the field crew runs this from the
// phone home screen.
setupPwa();

// 폰 카메라 원본을 업로드 전에 줄인다 — 앱의 모든 파일 입력에 걸린다.
installPhotoOptimizer();

createRoot(document.getElementById("root")!).render(<App />);

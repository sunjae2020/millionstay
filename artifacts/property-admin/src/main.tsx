import { createRoot } from "react-dom/client";
import App from "./App";
import "./i18n";
import "./index.css";
import { setupPwa } from "@/lib/pwa";
import { installPhotoOptimizer } from "@/lib/photo";

// Installable web app + offline shell.
setupPwa();

// 폰 카메라 원본을 업로드 전에 줄인다 — 앱의 모든 파일 입력에 걸린다.
installPhotoOptimizer();

createRoot(document.getElementById("root")!).render(<App />);

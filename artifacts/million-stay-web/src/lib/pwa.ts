import { APP_NAME } from "./appName";
import { FAVICON_URL } from "./brand";

// PWA setup (Phase 3): make the guest web installable to the home screen and
// give it a basic offline shell. The manifest is generated at RUNTIME from the
// per-instance brand (APP_NAME / FAVICON_URL) so each white-label tenant (e.g.
// Metheim) gets its own name + icon without a per-tenant build of a static file.
export function setupPwa(): void {
  try {
    const origin = window.location.origin;
    const icon = FAVICON_URL || `${origin}/logo-mark.png`;
    const manifest = {
      name: APP_NAME,
      short_name: APP_NAME.slice(0, 12),
      start_url: `${origin}/`,
      scope: `${origin}/`,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#E8621A",
      icons: [
        { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: icon, sizes: "any", purpose: "maskable" },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    const url = URL.createObjectURL(blob);
    let link = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = url;

    // Theme colour for the mobile browser chrome.
    let meta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = "#E8621A";
  } catch { /* non-fatal */ }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* offline shell is best-effort */ });
    });
  }
}

import { APP_NAME } from "./appName";

// Web app (PWA) setup: makes the portal installable to the phone's home screen
// and keeps an offline shell so an already-visited page still renders in a
// basement with no signal — which is where field work happens.
//
// The manifest is built at RUNTIME from the per-instance brand so each
// white-label tenant gets its own name + icon without a per-tenant build of a
// static file. Everything is scoped to BASE_URL because the portals can be
// served from a sub-path.
export function setupPwa(themeColor = "#E8621A"): void {
  const base = import.meta.env.BASE_URL || "/";
  try {
    const origin = window.location.origin;
    const scope = new URL(base, origin).href;
    const icon = (import.meta.env.VITE_LOGO_MARK_URL as string | undefined)?.trim()
      || (import.meta.env.VITE_FAVICON_URL as string | undefined)?.trim()
      || `${scope}millionstay-logo.png`;
    const manifest = {
      name: APP_NAME,
      short_name: APP_NAME.slice(0, 12),
      start_url: scope,
      scope,
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: themeColor,
      icons: [
        { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: icon, sizes: "any", purpose: "maskable" },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    let link = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = URL.createObjectURL(blob);

    let meta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = themeColor;

    // iOS ignores the manifest for home-screen installs and reads these instead.
    if (!document.querySelector("meta[name='apple-mobile-web-app-capable']")) {
      const m = document.createElement("meta");
      m.name = "apple-mobile-web-app-capable";
      m.content = "yes";
      document.head.appendChild(m);
    }
    if (!document.querySelector("link[rel='apple-touch-icon']")) {
      const l = document.createElement("link");
      l.rel = "apple-touch-icon";
      l.href = icon;
      document.head.appendChild(l);
    }
  } catch { /* non-fatal */ }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
        .catch(() => { /* offline shell is best-effort */ });
    });
  }
}

/**
 * Install prompt plumbing. Chrome/Android fires `beforeinstallprompt`, which we
 * stash so the UI can offer a button at a sensible moment; iOS fires nothing,
 * so callers fall back to instructions.
 */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferredPrompt: InstallPrompt | null = null;
const listeners = new Set<(available: boolean) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPrompt;
    listeners.forEach((l) => l(true));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((l) => l(false));
  });
}

export function onInstallAvailability(listener: (available: boolean) => void): () => void {
  listeners.add(listener);
  listener(deferredPrompt !== null);
  return () => { listeners.delete(listener); };
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

/** True once the app runs from the home screen rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const p = deferredPrompt;
  deferredPrompt = null;
  listeners.forEach((l) => l(false));
  await p.prompt();
  const choice = await p.userChoice;
  return choice.outcome === "accepted";
}

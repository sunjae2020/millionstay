import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Share } from "lucide-react";
import { onInstallAvailability, promptInstall, isStandalone, isIos } from "@/lib/pwa";

/**
 * "Install the app" affordance.
 *
 * Chrome/Android hands us a real prompt; iOS Safari has no API, so there we can
 * only show the Share → Add to Home Screen instruction. Once the app already
 * runs from the home screen this renders nothing.
 */
export function InstallAppButton({ railed = false }: { railed?: boolean }) {
  const { t } = useTranslation();
  const [available, setAvailable] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => onInstallAvailability(setAvailable), []);

  if (isStandalone()) return null;
  const iosFallback = isIos() && !available;
  if (!available && !iosFallback) return null;

  const cls = `flex items-center py-2 w-full rounded-lg text-sm text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors ${railed ? "justify-center" : "gap-3 px-3"}`;

  return (
    <>
      <button
        onClick={() => { if (available) void promptInstall(); else setShowIosHint((v) => !v); }}
        className={cls}
        title={railed ? t("nav.install_app", "Install app") : undefined}
        aria-label={t("nav.install_app", "Install app")}
      >
        <Download className="w-4 h-4" />
        {!railed && t("nav.install_app", "Install app")}
      </button>
      {showIosHint && !railed && (
        <p className="px-3 pb-2 text-xs text-sidebar-accent-foreground/80 flex items-start gap-1.5">
          <Share className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {t("nav.install_ios_hint", "Tap Share, then “Add to Home Screen”.")}
        </p>
      )}
    </>
  );
}

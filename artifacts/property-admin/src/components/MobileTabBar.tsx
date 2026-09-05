import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Check, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { NavChild, NavSection } from "@/components/Layout";

// ── MobileTabBar ─────────────────────────────────────────────────────────────
// App-like bottom navigation for small screens (< md). Each user picks up to
// four quick-access pages; until they do, it falls back to a sensible default
// set. A fifth "More" tab opens the full sidebar drawer. The selectable pages
// come from the SAME nav tree the sidebar renders, so the bar can never expose
// a page the sidebar hides (e.g. a disabled module).
//
// The choice is personal and per-device: localStorage keyed by user id. Open the
// customizer by long-pressing any tab, or from the "탭 편집" button in the
// drawer, which dispatches the CUSTOMIZE_EVENT below.

const MAX_TABS = 4;
export const CUSTOMIZE_TABS_EVENT = "ms:customize-tabs";

const prefsKey = (userId: string) => `ms_mobile_tabs_v1:${userId}`;

/** Default tabs when the user hasn't picked any (first match wins). */
const DEFAULT_HREFS = [
  "/dashboard",
  "/calendar",
  "/booking/bookings",
  "/booking/contracts",
];

function readPrefs(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

function matchHref(location: string, href: string): boolean {
  if (href === "/dashboard") return location === "/" || location.startsWith("/dashboard");
  return location === href || location.startsWith(href + "/");
}

export function MobileTabBar({
  sections,
  onMore,
}: {
  sections: NavSection[];
  onMore: () => void;
}) {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const userId = user?.id != null ? String(user.id) : "anon";

  // Flat pool of pinnable pages, deduped by href, in sidebar order. The
  // dashboard is prepended because it lives outside the section list.
  const pool: NavChild[] = useMemo(() => {
    const seen = new Set<string>();
    const out: NavChild[] = [];
    const push = (item: NavChild) => {
      if (seen.has(item.href)) return;
      seen.add(item.href);
      out.push({ href: item.href, label: item.label, icon: item.icon });
    };
    for (const section of sections) {
      for (const item of section.items) {
        push(item);
        item.children?.forEach(push);
      }
    }
    return out;
  }, [sections]);

  const byHref = useMemo(() => new Map(pool.map((p) => [p.href, p])), [pool]);

  const [prefs, setPrefs] = useState<string[] | null>(() => readPrefs(userId));
  useEffect(() => { setPrefs(readPrefs(userId)); }, [userId]);

  const savePrefs = useCallback((hrefs: string[]) => {
    try { localStorage.setItem(prefsKey(userId), JSON.stringify(hrefs)); } catch { /* ignore */ }
    setPrefs(hrefs);
  }, [userId]);

  const resetPrefs = useCallback(() => {
    try { localStorage.removeItem(prefsKey(userId)); } catch { /* ignore */ }
    setPrefs(null);
  }, [userId]);

  const tabs: NavChild[] = useMemo(() => {
    const valid = (prefs ?? []).filter((h) => byHref.has(h)).slice(0, MAX_TABS);
    if (valid.length) return valid.map((h) => byHref.get(h)!);
    const fallback = DEFAULT_HREFS.filter((h) => byHref.has(h)).map((h) => byHref.get(h)!);
    return (fallback.length ? fallback : pool).slice(0, MAX_TABS);
  }, [prefs, byHref, pool]);

  const anyActive = tabs.some((tb) => matchHref(location, tb.href));

  // ── Customizer — opened by long-press or by the drawer button's event.
  const [customizerOpen, setCustomizerOpen] = useState(false);
  useEffect(() => {
    const open = () => setCustomizerOpen(true);
    window.addEventListener(CUSTOMIZE_TABS_EVENT, open);
    return () => window.removeEventListener(CUSTOMIZE_TABS_EVENT, open);
  }, []);

  const pressTimer = useRef<number | null>(null);
  const didLongPress = useRef(false);
  const startPress = () => {
    didLongPress.current = false;
    pressTimer.current = window.setTimeout(() => {
      didLongPress.current = true;
      try { navigator.vibrate?.(15); } catch { /* ignore */ }
      setCustomizerOpen(true);
    }, 500);
  };
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };
  const onTabClick = (href: string) => {
    if (didLongPress.current) { didLongPress.current = false; return; } // swallow the tap ending a long-press
    navigate(href);
  };

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch border-t bg-card shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label={t("nav.dashboard")}
      >
        {tabs.map((tb) => (
          <button
            key={tb.href}
            type="button"
            className="flex-1 touch-none"
            onClick={() => onTabClick(tb.href)}
            onPointerDown={startPress}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            <TabButton icon={tb.icon} label={tb.label} active={matchHref(location, tb.href)} />
          </button>
        ))}
        <button
          type="button"
          className="flex-1"
          onClick={onMore}
          aria-label={t("common.open_menu")}
        >
          <TabButton icon={MoreHorizontal} label={t("nav.more")} active={!anyActive} />
        </button>
      </nav>

      <MobileTabsCustomizer
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        pool={pool}
        selected={tabs.map((tb) => tb.href)}
        onSave={savePrefs}
        onReset={resetPrefs}
      />
    </>
  );
}

function TabButton({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <div className="flex h-14 select-none flex-col items-center justify-center gap-0.5">
      <span
        className={cn(
          "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
          active ? "bg-primary/10" : "bg-transparent"
        )}
      >
        <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
      </span>
      <span
        className={cn(
          "max-w-[72px] truncate text-[10px] font-medium leading-none",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function MobileTabsCustomizer({
  open,
  onClose,
  pool,
  selected,
  onSave,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  pool: NavChild[];
  selected: string[];
  onSave: (hrefs: string[]) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string[]>(selected);

  // Re-seed the working set every time the sheet opens.
  useEffect(() => { if (open) setPicked(selected); }, [open, selected]);

  const toggle = (href: string) =>
    setPicked((p) =>
      p.includes(href)
        ? p.filter((h) => h !== href)
        : p.length >= MAX_TABS
          ? p
          : [...p, href]
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{t("mobile_tabs.title")}</DialogTitle>
          <DialogDescription>{t("mobile_tabs.desc", { max: MAX_TABS })}</DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex-1 overflow-y-auto">
          {pool.map((item) => {
            const on = picked.includes(item.href);
            const disabled = !on && picked.length >= MAX_TABS;
            const Icon = item.icon;
            const order = picked.indexOf(item.href);
            return (
              <button
                key={item.href}
                type="button"
                disabled={disabled}
                onClick={() => toggle(item.href)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors disabled:opacity-40",
                  on ? "bg-primary/10" : "hover:bg-muted"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    on ? "bg-transparent" : "bg-muted"
                  )}
                >
                  <Icon className={cn("h-4 w-4", on ? "text-primary" : "text-muted-foreground")} />
                </span>
                <span className="flex-1 truncate text-sm text-foreground">{item.label}</span>
                {on && (
                  <span className="flex items-center gap-1 text-primary">
                    <span className="text-[11px] font-semibold">{order + 1}</span>
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          {t("mobile_tabs.count", { n: picked.length, max: MAX_TABS })}
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => { onReset(); onClose(); }}>
            {t("mobile_tabs.reset")}
          </Button>
          <Button size="sm" disabled={picked.length === 0} onClick={() => { onSave(picked); onClose(); }}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { type ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { HomestayNavbar } from "./HomestayNavbar";
import { HomestayFooter } from "./HomestayFooter";
import { HS_FONT } from "@/lib/homestay-theme";

// Shared shell for all Million Homestay pages: navbar + body + footer, with the
// brand body font applied. `title` sets the document title per page.
export function HomestayLayout({ children, title }: { children: ReactNode; title?: string }) {
  const [location] = useLocation();

  useEffect(() => {
    document.title = title ? `${title} — Million Homestay` : "Million Homestay";
  }, [title]);

  // Since the site collapsed to single-tier pages, sub-topics live as #anchored
  // sections. On every navigation, scroll to the hash target (old sub-page URLs
  // redirect here with a hash) or to the top when there's none. A `hashchange`
  // listener covers same-page anchor jumps that don't change the wouter path.
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash;
      if (!hash) {
        window.scrollTo(0, 0);
        return;
      }
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo(0, 0);
    };
    // Defer a tick so freshly-mounted page content is in the DOM first.
    const t = setTimeout(scrollToHash, 60);
    window.addEventListener("hashchange", scrollToHash);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-800" style={{ fontFamily: HS_FONT.body }}>
      <HomestayNavbar />
      <main className="flex-1">{children}</main>
      <HomestayFooter />
    </div>
  );
}

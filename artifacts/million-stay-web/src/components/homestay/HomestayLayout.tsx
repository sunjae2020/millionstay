import { type ReactNode, useEffect } from "react";
import { HomestayNavbar } from "./HomestayNavbar";
import { HomestayFooter } from "./HomestayFooter";
import { HS_FONT } from "@/lib/homestay-theme";

// Shared shell for all Million Homestay pages: navbar + body + footer, with the
// brand body font applied. `title` sets the document title per page.
export function HomestayLayout({ children, title }: { children: ReactNode; title?: string }) {
  useEffect(() => {
    document.title = title ? `${title} — Million Homestay` : "Million Homestay";
  }, [title]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-800" style={{ fontFamily: HS_FONT.body }}>
      <HomestayNavbar />
      <main className="flex-1">{children}</main>
      <HomestayFooter />
    </div>
  );
}

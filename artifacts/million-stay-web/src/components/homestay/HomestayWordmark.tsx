import { HS, HS_FONT } from "@/lib/homestay-theme";
import markUrl from "@assets/05.OR_NB_Mark_simple_ver_1775381659302.png";

// Million Homestay wordmark — the shared MillionStay symbol + split text.
// Uses the existing MillionStay brand mark (05.OR_NB_Mark_simple_ver, the same
// symbol the main million-stay-web site uses) so the symbol is unified across
// products. Text: "Million" = Navy (structure), "Homestay" = Orange (the product
// word). `knockout` is the light version for dark surfaces (footer): the mark is
// inverted to white (matching the main-site footer treatment) and "Million" goes
// white; "Homestay" stays orange. One accessible label covers the whole lockup.
export function HomestayWordmark({
  knockout = false,
  className = "",
  markSize = 28,
}: {
  knockout?: boolean;
  className?: string;
  markSize?: number;
}) {
  const millionColor = knockout ? "#FFFFFF" : HS.navy;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Million Homestay" role="img">
      <img
        src={markUrl}
        alt=""
        aria-hidden
        className={knockout ? "w-auto brightness-0 invert" : "w-auto"}
        style={{ height: markSize }}
      />
      <span
        aria-hidden
        className="font-extrabold tracking-tight leading-none"
        style={{ fontFamily: HS_FONT.display, fontSize: markSize * 0.72, letterSpacing: "-0.02em" }}
      >
        <span style={{ color: millionColor }}>Million</span>
        <span style={{ color: HS.orange }}>Homestay</span>
      </span>
    </span>
  );
}

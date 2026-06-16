import { HS, HS_FONT } from "@/lib/homestay-theme";

// Million Homestay wordmark — Brand Guideline v2.0.
// Twin-gable house mark + split wordmark: "Million" = Navy (structure),
// "Homestay" = Orange (the product word, the variable). `knockout` renders the
// light version for dark surfaces (footer): "Million" goes white, the mark
// inverts, "Homestay" stays orange. A single accessible label covers both words.
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
  const gableStroke = knockout ? "#FFFFFF" : HS.navy;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Million Homestay" role="img">
      <TwinGable size={markSize} stroke={gableStroke} accent={HS.orange} />
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

// Two overlapping gable rooflines — the "twin" in twin-gable. The front gable
// carries the orange accent; the back gable is the structural navy/white stroke.
function TwinGable({ size, stroke, accent }: { size: number; stroke: string; accent: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden focusable="false">
      {/* back gable */}
      <path
        d="M6 17 L13.5 9 L21 17"
        stroke={stroke}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      {/* front gable (accent) + body */}
      <path
        d="M11 23 L11 16 L18.5 8.5 L26 16 L26 23"
        stroke={accent}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* doorway */}
      <path d="M17 23 L17 18.5 L20 18.5 L20 23" stroke={accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

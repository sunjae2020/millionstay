import { APP_NAME } from "../lib/appName";
import { LOGO_HORIZONTAL, LOGO_MARK, LOGO_MODE } from "../lib/brand";

/**
 * Brand mark — renders the instance logo image, or a text wordmark (the app
 * name in the display font) when `VITE_LOGO_MODE=text` (white-label instances
 * without a logo asset, e.g. the MetHeim pilot). Spec §2.3/§2.4.
 *
 * `className` sizes the <img> in image mode (existing `h-9 w-auto` etc.).
 * `invert` renders a light wordmark for dark backgrounds (footer).
 * `textClassName` overrides the wordmark text size per placement.
 */
interface BrandMarkProps {
  variant?: "horizontal" | "mark";
  className?: string;
  invert?: boolean;
  textClassName?: string;
}

export function BrandMark({
  variant = "horizontal",
  className,
  invert = false,
  textClassName,
}: BrandMarkProps) {
  if (LOGO_MODE === "text") {
    return (
      <span
        className={`font-display font-extrabold tracking-tight leading-none whitespace-nowrap ${
          invert ? "text-white" : "text-primary"
        } ${textClassName ?? "text-2xl"}`}
      >
        {APP_NAME}
      </span>
    );
  }
  const src = variant === "mark" ? LOGO_MARK : LOGO_HORIZONTAL;
  return <img src={src} alt={APP_NAME} className={className} />;
}

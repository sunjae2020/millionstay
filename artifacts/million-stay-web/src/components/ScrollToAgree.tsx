import { useEffect, useRef, useState, type ReactNode } from "react";

// A scrollable terms box gated to an "I agree" checkbox: the checkbox stays
// disabled until the reader scrolls to the bottom of the box (or the content is
// short enough that there is nothing to scroll). Used on the homestay student
// and host application forms so applicants must scroll through the full Terms
// before they can consent.
export function ScrollToAgree({
  children,
  checked,
  onChange,
  label,
  accent = "#ed6b1b",
  maxHeightClass = "max-h-72",
  scrollHint = "Please scroll to the bottom to read the full terms before you can agree.",
  doneHint = "You've reached the end — you can now agree below.",
}: {
  children: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  accent?: string;
  maxHeightClass?: string;
  scrollHint?: string;
  doneHint?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [reachedBottom, setReachedBottom] = useState(false);

  // If the content fits without scrolling, there's nothing to scroll through —
  // unlock immediately so a short terms box never traps the user.
  useEffect(() => {
    const el = boxRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 8) setReachedBottom(true);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReachedBottom(true);
  };

  return (
    <div>
      <div
        ref={boxRef}
        onScroll={handleScroll}
        className={`${maxHeightClass} overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-600`}
      >
        {children}
      </div>

      <p className={`mt-2 text-xs ${reachedBottom ? "text-green-600" : "text-gray-400"}`}>
        {reachedBottom ? doneHint : scrollHint}
      </p>

      <label
        className={`mt-3 flex items-start gap-3 ${reachedBottom ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={!reachedBottom}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ accentColor: accent }}
        />
        <span className="text-sm text-gray-700">{label}</span>
      </label>
    </div>
  );
}

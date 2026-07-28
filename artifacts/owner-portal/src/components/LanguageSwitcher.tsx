import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Globe } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "th", label: "ภาษาไทย" },
  { code: "vi", label: "Tiếng Việt" },
];

export function LanguageSwitcher({ variant = "header" }: { variant?: "header" | "sidebar" }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function changeLang(code: string) {
    void i18n.changeLanguage(code);
    setOpen(false);
  }

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  if (variant === "sidebar") {
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Globe className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1 text-left truncate">{current.label}</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute bottom-full left-0 mb-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 w-full">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${
                  l.code === i18n.language ? "font-semibold text-primary" : "text-foreground"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors"
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{current.label}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[130px]">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => changeLang(l.code)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${
                l.code === i18n.language ? "font-semibold text-primary" : "text-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

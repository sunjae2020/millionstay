import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useDisplayCurrency } from "@/contexts/DisplayCurrencyContext";

const CURRENCIES = [
  { code: "AUD", label: "AUD", flag: "🇦🇺", name: "Australian Dollar" },
  { code: "USD", label: "USD", flag: "🇺🇸", name: "US Dollar" },
  { code: "KRW", label: "KRW", flag: "🇰🇷", name: "Korean Won" },
  { code: "JPY", label: "JPY", flag: "🇯🇵", name: "Japanese Yen" },
  { code: "CNY", label: "CNY", flag: "🇨🇳", name: "Chinese Yuan" },
  { code: "MYR", label: "MYR", flag: "🇲🇾", name: "Malaysian Ringgit" },
  { code: "SGD", label: "SGD", flag: "🇸🇬", name: "Singapore Dollar" },
  { code: "THB", label: "THB", flag: "🇹🇭", name: "Thai Baht" },
  { code: "PHP", label: "PHP", flag: "🇵🇭", name: "Philippine Peso" },
  { code: "EUR", label: "EUR", flag: "🇪🇺", name: "Euro" },
  { code: "GBP", label: "GBP", flag: "🇬🇧", name: "British Pound" },
];

export function CurrencySelector({ variant = "default" }: { variant?: "default" | "mobile" }) {
  const { displayCurrency, setDisplayCurrency, rates } = useDisplayCurrency();
  const available = CURRENCIES.filter((c) => c.code === "AUD" || rates[c.code]);
  const current = available.find((c) => c.code === displayCurrency) ?? available[0]!;

  if (variant === "mobile") {
    return (
      <div className="border-t border-gray-100 mt-2 pt-2">
        <p className="px-3 py-1 text-xs text-gray-400 font-medium uppercase tracking-wide">Currency</p>
        <div className="grid grid-cols-4 gap-1 px-3 py-2">
          {available.map((c) => {
            const isActive = displayCurrency === c.code;
            return (
              <button
                key={c.code}
                onClick={() => setDisplayCurrency(c.code)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg text-xs transition-colors ${
                  isActive ? "bg-primary/5 text-primary font-bold border border-primary/20" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <span className="text-lg leading-none">{c.flag}</span>
                <span className="font-mono leading-none">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-primary border border-gray-200 rounded-lg hover:border-primary/40 transition-colors">
          <span className="text-base leading-none">{current.flag}</span>
          <span className="hidden sm:inline">{current.label}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 p-1">
        {available.map((c) => {
          const isActive = displayCurrency === c.code;
          return (
            <button
              key={c.code}
              onClick={() => setDisplayCurrency(c.code)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors text-left ${
                isActive
                  ? "bg-primary/5 text-primary font-semibold border-l-2 border-primary"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="text-lg leading-none">{c.flag}</span>
              <span className="flex-1">{c.name}</span>
              <span className={`text-xs font-mono ${isActive ? "text-primary" : "text-gray-400"}`}>
                {c.label}
              </span>
            </button>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

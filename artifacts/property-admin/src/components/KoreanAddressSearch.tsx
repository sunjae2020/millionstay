import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";

/**
 * 우편번호 찾기 — Daum (Kakao) Postcode.
 *
 * Korean addresses are not typed, they are looked up: staff search a road name
 * or building, pick the match, and the postcode / 도로명주소 / 시군구 / 시도 all
 * come back together. Typing a 우편번호 by hand is how you get 91 accounts with
 * an empty postcode column.
 *
 * The widget is a free, key-less script, loaded on first use rather than on
 * every page load.
 */

const SCRIPT_SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
const SCRIPT_ID = "daum-postcode-script";

export interface KoreanAddress {
  postcode: string;
  /** 도로명 주소 (falls back to 지번 when the road address is absent). */
  address: string;
  /** 시/군/구 */
  suburb: string;
  /** 시/도 */
  state: string;
  country: string;
}

/** Shape of the fields the widget hands back. */
interface DaumPostcodeData {
  zonecode?: string;
  roadAddress?: string;
  jibunAddress?: string;
  autoRoadAddress?: string;
  autoJibunAddress?: string;
  buildingName?: string;
  sido?: string;
  sigungu?: string;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
        onclose?: () => void;
      }) => { open: () => void };
    };
  }
}

function loadScript(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("script failed")), { once: true });
      return;
    }
    const el = document.createElement("script");
    el.id = SCRIPT_ID;
    el.src = SCRIPT_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("script failed"));
    document.head.appendChild(el);
  });
}

interface Props {
  onSelect: (address: KoreanAddress) => void;
  className?: string;
}

export function KoreanAddressSearch({ onSelect, className }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);
    try {
      await loadScript();
      if (!window.daum?.Postcode) throw new Error("unavailable");
      new window.daum.Postcode({
        oncomplete: (data) => {
          const road = data.roadAddress || data.autoRoadAddress || "";
          const jibun = data.jibunAddress || data.autoJibunAddress || "";
          const base = road || jibun;
          // The building name is part of how people write the address here.
          const address = data.buildingName ? `${base} (${data.buildingName})` : base;
          onSelect({
            postcode: data.zonecode ?? "",
            address,
            suburb: data.sigungu ?? "",
            state: data.sido ?? "",
            country: "대한민국",
          });
        },
      }).open();
    } catch {
      // Offline, blocked, or the CDN is down — the fields stay hand-editable.
      setError(t("account.postcode_search_failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button type="button" variant="outline" size="sm" className="gap-1.5"
        disabled={loading} onClick={() => void open()}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        {t("account.postcode_search")}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default KoreanAddressSearch;

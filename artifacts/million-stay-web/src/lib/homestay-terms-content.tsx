import { useTranslation } from "react-i18next";
import { HS } from "@/lib/homestay-theme";

// Shared Terms of Service content for homestay.millionstay.com.
//
// The clause text is managed as i18n keys under "homestay.terms.*" — translated
// in every supported locale and editable by admins in
//   property-admin → Content → Page Translations → "Homestay · Terms".
// The same keys drive both the standalone /terms page (HomestayTerms.tsx) and
// this compact version, which is embedded inside the scroll-to-agree box on the
// student and host application forms. That keeps a single source of truth: an
// edit in the admin translations editor updates the public terms page and the
// in-form consent text together, in whichever language the applicant is viewing.
export const EFFECTIVE_DATE = "12 June 2026";

// Clauses are numbered 01–16, matching the homestay.terms.clause_<n>_title /
// homestay.terms.clause_<n>_body keys.
const CLAUSE_NUMBERS = Array.from({ length: 16 }, (_, i) => i + 1);

// Compact renderer for the clause list — used inside the scroll-to-agree box on
// the application forms. The standalone /terms page renders its own larger layout
// from the same keys.
export function HomestayTermsBody() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">
        {t("homestay.terms.effective_date_label")}:{" "}
        <span className="font-semibold" style={{ color: HS.darkBrown }}>{EFFECTIVE_DATE}</span>
        {" "}· {t("homestay.terms.effective_date_note")}
      </p>
      {CLAUSE_NUMBERS.map((n) => {
        const num = String(n).padStart(2, "0");
        return (
          <div key={num} className="flex gap-3">
            <span className="shrink-0 font-black text-sm leading-tight" style={{ color: HS.brand }}>{num}</span>
            <div>
              <h3 className="font-bold text-sm mb-1" style={{ color: HS.darkBrown }}>{t(`homestay.terms.clause_${n}_title`)}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{t(`homestay.terms.clause_${n}_body`)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

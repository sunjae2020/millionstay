import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero } from "@/components/homestay/sections";
import { HS } from "@/lib/homestay-theme";
import { CLAUSES, EFFECTIVE_DATE } from "@/lib/homestay-terms-content";

// Terms of Service for homestay.millionstay.com. The clause content lives in
// lib/homestay-terms-content.tsx so it can be reused inside the scroll-to-agree
// box on the student and host application forms.
export default function HomestayTerms() {
  return (
    <HomestayLayout title="Terms of Service">
      <HsPageHero
        eyebrow="Legal"
        title="Terms of Service"
        lead={<p>The terms on which Million Homestay provides its review-and-match homestay service.</p>}
      />
      <section>
        <div className="max-w-4xl mx-auto px-5 py-12 md:py-16">
          <div className="rounded-xl px-6 py-4 mb-10" style={{ backgroundColor: "#f6efec" }}>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Effective date</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: HS.darkBrown }}>{EFFECTIVE_DATE}</p>
            <p className="mt-2 text-xs text-gray-500">
              Operated by Million Homestay Australia Pty Ltd, Melbourne, Victoria, Australia.
            </p>
          </div>

          <div className="space-y-8">
            {CLAUSES.map((c) => (
              <div key={c.n} className="flex gap-4">
                <span className="shrink-0 font-black text-base leading-tight" style={{ color: HS.brand }}>{c.n}</span>
                <div>
                  <h2 className="font-bold text-base mb-1.5" style={{ color: HS.darkBrown }}>{c.title}</h2>
                  <p className="text-sm leading-relaxed text-gray-600">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </HomestayLayout>
  );
}

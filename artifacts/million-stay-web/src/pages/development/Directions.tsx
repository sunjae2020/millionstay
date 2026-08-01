import { useTranslation } from "react-i18next";
import { MapPin, Phone, Mail, Clock, Train, Car } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { InquiryForm } from "@/components/development/InquiryForm";
import { submitContactInquiry } from "@/lib/development-api";
import { usePageContent } from "@/lib/usePageContent";

// 찾아오기 (Directions) — address, map, transit/parking and contact. Content-only,
// CMS-editable per-locale via usePageContent("dev-directions"). The map embeds a
// CMS-provided URL, or is auto-built from the address (no API key needed).

export default function DevDirections() {
  const { t } = useTranslation();
  const pc = usePageContent("dev-directions");

  const address = pc("address", t("dev.directions.address"));
  const mapEmbed = pc("map_embed_url", "");
  const mapSrc = mapEmbed || (address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`
    : "");

  const contact = [
    { icon: MapPin, label: pc("address_label", t("dev.directions.address_label")), value: address },
    { icon: Phone, label: pc("phone_label", t("dev.directions.phone_label")), value: pc("phone", t("dev.directions.phone")) },
    { icon: Mail, label: pc("email_label", t("dev.directions.email_label")), value: pc("email", t("dev.directions.email")) },
    { icon: Clock, label: pc("hours_label", t("dev.directions.hours_label")), value: pc("hours", t("dev.directions.hours")) },
  ];

  return (
    <DevLayout title={t("dev.directions.hero_title")}>
      {/* Hero */}
      <section className="bg-[hsl(var(--brand-navy))] dev-tex-units text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <p className="text-sm font-semibold tracking-widest uppercase text-white/80">{pc("eyebrow", t("dev.directions.eyebrow"))}</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl">
            {pc("hero_title", t("dev.directions.hero_title"))}
          </h1>
          <p className="mt-5 text-lg text-white/90 max-w-2xl leading-relaxed">
            {pc("hero_subtitle", t("dev.directions.hero_subtitle"))}
          </p>
        </div>
      </section>

      {/* Address + map */}
      <section className="max-w-7xl mx-auto px-6 py-14 md:py-20 grid gap-10 lg:grid-cols-2 items-start">
        <div>
          <div className="space-y-5">
            {contact.map(({ icon: Icon, label, value }) => (
              value ? (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[hsl(var(--brand-navy))]">{label}</p>
                    <p className="mt-0.5 text-gray-600 leading-relaxed whitespace-pre-line">{value}</p>
                  </div>
                </div>
              ) : null
            ))}
          </div>
        </div>
        {mapSrc && (
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            <iframe
              title={t("dev.directions.map_title")}
              src={mapSrc}
              className="w-full h-[360px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </section>

      {/* Transit + parking */}
      <section className="bg-[hsl(var(--brand-cream))] dev-tex-wave border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-14 md:py-20 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-7 border border-gray-100">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Train className="w-5 h-5" />
            </div>
            <h3 className="mt-4 font-semibold text-lg text-[hsl(var(--brand-navy))]">{pc("transit_title", t("dev.directions.transit_title"))}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 whitespace-pre-line">{pc("transit_body", t("dev.directions.transit_body"))}</p>
          </div>
          <div className="rounded-2xl bg-white p-7 border border-gray-100">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Car className="w-5 h-5" />
            </div>
            <h3 className="mt-4 font-semibold text-lg text-[hsl(var(--brand-navy))]">{pc("parking_title", t("dev.directions.parking_title"))}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 whitespace-pre-line">{pc("parking_body", t("dev.directions.parking_body"))}</p>
          </div>
        </div>
      </section>

      {/* General inquiry — lands as a ContactUs lead in the admin Leads pipeline */}
      <section className="border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-6 py-14 md:py-20">
          <div className="text-center">
            <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-[hsl(var(--brand-navy))]">
              {pc("form_title", t("dev.directions.form_title"))}
            </h2>
            <p className="mt-3 text-gray-600 leading-relaxed">
              {pc("form_subtitle", t("dev.directions.form_subtitle"))}
            </p>
          </div>
          <div className="mt-8">
            <InquiryForm
              requireMessage
              onSubmit={(v) =>
                submitContactInquiry({
                  first_name: v.first_name,
                  last_name: v.last_name,
                  email: v.email,
                  phone: v.phone,
                  message: v.message ?? "",
                })
              }
            />
          </div>
        </div>
      </section>
    </DevLayout>
  );
}

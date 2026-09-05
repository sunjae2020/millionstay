/**
 * 임차인 안내 — 신청부터 퇴거까지 무엇이 언제 오는지 한 장으로 알려 주는 페이지.
 *
 * 세입자에게 나가는 링크는 여섯 종류이고, 각각 다른 시점에 문자·메일로 도착한다.
 * 받는 쪽에서는 "이건 또 뭔가" 싶은 링크가 갑자기 오는 셈이라, 순서를 미리
 * 보여 주는 자리가 필요하다. 담당자가 이 주소 하나를 공유하면 그다음 링크들이
 * 무엇인지 다시 설명하지 않아도 된다.
 */
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import {
  ArrowRight, ClipboardList, FileSignature, FileText, Home,
  KeyRound, Receipt, ShieldCheck,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DevNavbar, DevFooter } from "@/components/development/DevLayout";
import { isDevelopmentSite } from "@/lib/site-mode";

const DEV_SITE = isDevelopmentSite();

/** 실제로 나가는 링크와 같은 순서. 번호는 장식이 아니라 진행 순서다. */
const STEPS = [
  { key: "apply", icon: ClipboardList, path: "/apply" },
  { key: "review", icon: Home, path: null },
  { key: "documents", icon: FileText, path: null },
  { key: "sign", icon: FileSignature, path: null },
  { key: "deposit", icon: Receipt, path: null },
  { key: "intake", icon: KeyRound, path: null },
  { key: "moveout", icon: ShieldCheck, path: null },
] as const;

const FAQS = ["login", "id", "link_expired"] as const;

export default function ForTenant() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {DEV_SITE ? <DevNavbar /> : <Navbar />}

      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
          <p className="text-sm font-medium uppercase tracking-wide opacity-80">{t("tenantGuide.eyebrow")}</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{t("tenantGuide.hero_title")}</h1>
          <p className="mt-3 leading-relaxed opacity-90">{t("tenantGuide.hero_lead")}</p>
          <Link
            href="/apply"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:opacity-90"
          >
            {t("tenantGuide.cta")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 space-y-12">
        {/* 진행 순서 — 좌우 교차 타임라인.
            가운데 세로선이 하나의 진행 축이고, 각 단계의 아이콘이 점선으로 그 축에
            걸린다. 순서가 있는 내용이라 번호가 장식이 아니라 정보다. 좁은 화면에서는
            교차가 오히려 읽기 어려워지므로 축을 왼쪽으로 보내고 한 줄로 편다. */}
        <section>
          <h2 className="font-display text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl">
            {t("tenantGuide.steps_title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("tenantGuide.steps_lead")}
          </p>

          <ol className="relative mt-10 md:mt-14">
            {/* 진행 축 */}
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-[22px] top-[22px] w-px bg-brand-navy/25 md:left-1/2"
            />

            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const left = i % 2 === 0;
              return (
                <li
                  key={s.key}
                  className={[
                    "relative pl-16 md:pl-0",
                    i > 0 ? "mt-9 md:-mt-10" : "",
                    "md:grid md:grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_56px] md:items-start",
                    i < STEPS.length - 1 ? "md:pb-10" : "",
                  ].join(" ")}
                >
                  {/* 아이콘 → 축 점선. 아이콘 지름 44px 의 중심(22px)에 맞춘다. */}
                  <span
                    aria-hidden="true"
                    className={[
                      "absolute top-[22px] hidden border-t border-dashed border-brand-navy/45 md:block",
                      left ? "left-[44px] right-1/2" : "left-1/2 right-[44px]",
                    ].join(" ")}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute top-[22px] left-[22px] h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-navy md:left-1/2"
                  />

                  <div
                    className={[
                      "absolute left-0 top-0 md:static md:row-start-1",
                      left ? "md:col-start-1 md:justify-self-start" : "md:col-start-4 md:justify-self-end",
                    ].join(" ")}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-navy text-white shadow-sm">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                  </div>

                  <div
                    className={[
                      "md:row-start-1 md:pt-[3px]",
                      left
                        ? "md:col-start-2 md:pr-9 md:text-right"
                        : "md:col-start-3 md:pl-9",
                    ].join(" ")}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-navy/60">
                      {t("tenantGuide.step_label", { n: i + 1 })}
                    </p>
                    <h3 className="mt-1.5 font-display text-lg font-bold leading-snug tracking-tight text-brand-navy sm:text-xl">
                      {t(`tenantGuide.step_${s.key}_title`)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(`tenantGuide.step_${s.key}_desc`)}
                    </p>
                    {s.path && (
                      <Link
                        href={s.path}
                        className={[
                          "mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand-navy/25 px-4 py-1.5",
                          "text-sm font-semibold text-brand-navy transition hover:bg-brand-navy hover:text-white",
                        ].join(" ")}
                      >
                        {t("tenantGuide.step_apply_link")} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold tracking-tight text-brand-navy">{t("tenantGuide.prepare_title")}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("tenantGuide.prepare_lead")}</p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {["id", "bank", "employment", "residence", "seal", "foreign"].map((k) => (
              <li key={k} className="flex items-start gap-2.5">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-navy/60" />
                <span>{t(`tenantGuide.prepare_${k}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">{t("tenantGuide.prepare_note")}</p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl">{t("tenantGuide.faq_title")}</h2>
          <dl className="mt-5 space-y-5">
            {FAQS.map((k) => (
              <div key={k}>
                <dt className="font-semibold text-brand-navy">{t(`tenantGuide.faq_${k}_q`)}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`tenantGuide.faq_${k}_a`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border bg-muted/40 p-5 text-center sm:p-6">
          <p className="font-display text-lg font-bold tracking-tight text-brand-navy">{t("tenantGuide.closing_title")}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("tenantGuide.closing_desc")}</p>
          <Link
            href="/apply"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {t("tenantGuide.cta")} <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      {DEV_SITE ? <DevFooter /> : <Footer />}
    </div>
  );
}

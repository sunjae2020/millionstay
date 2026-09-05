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
        <section>
          <h2 className="text-xl font-bold">{t("tenantGuide.steps_title")}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("tenantGuide.steps_lead")}</p>
          <ol className="mt-6 space-y-5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold tabular-nums text-primary">
                      {i + 1}
                    </span>
                    {i < STEPS.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-1">
                    <p className="flex items-center gap-2 font-semibold">
                      <Icon className="h-4 w-4 text-primary" />
                      {t(`tenantGuide.step_${s.key}_title`)}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {t(`tenantGuide.step_${s.key}_desc`)}
                    </p>
                    {s.path && (
                      <Link href={s.path} className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
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
          <h2 className="text-lg font-bold">{t("tenantGuide.prepare_title")}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("tenantGuide.prepare_lead")}</p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {["id", "bank", "employment", "residence", "seal", "foreign"].map((k) => (
              <li key={k} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{t(`tenantGuide.prepare_${k}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">{t("tenantGuide.prepare_note")}</p>
        </section>

        <section>
          <h2 className="text-xl font-bold">{t("tenantGuide.faq_title")}</h2>
          <dl className="mt-5 space-y-5">
            {FAQS.map((k) => (
              <div key={k}>
                <dt className="font-semibold">{t(`tenantGuide.faq_${k}_q`)}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`tenantGuide.faq_${k}_a`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border bg-muted/40 p-5 text-center sm:p-6">
          <p className="font-semibold">{t("tenantGuide.closing_title")}</p>
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

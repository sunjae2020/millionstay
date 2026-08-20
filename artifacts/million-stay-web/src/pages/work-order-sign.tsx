/**
 * 작업 확인서 — 시설 담당자 확인 서명 페이지(토큰 링크, 로그인 없음).
 *
 * 관리자가 작업 지시서 상세에서 링크를 뽑아 카톡으로 보내면, 담당자는 휴대폰에서
 * 이 화면을 열어 작업 내용과 전/후 사진(회차별)을 훑고 이름과 서명을 남긴다.
 * 서명 시각의 IP·기기 정보는 서버가 찍는다 — 이 화면은 보내지 않는다.
 *
 * 계정을 요구하지 않는 이유는 세대점검표와 같다: 현장 담당자에게 포털 로그인을
 * 요구하는 순간 종이가 이긴다.
 */
import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { AlertCircle, CalendarPlus, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DevNavbar, DevFooter } from "@/components/development/DevLayout";
import { isDevelopmentSite } from "@/lib/site-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SignaturePad from "@/components/SignaturePad";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import {
  getSigningRequest, submitSignatures, previewUrl, signedPdfUrl, workOrderIcsUrl, SigningError,
  type SigningRequest, type WorkOrderSummary, type WorkOrderSummaryPhoto,
} from "@/lib/signing-api";

const DEV_SITE = isDevelopmentSite();

/** 회차(세션)별로 접는다 — 재방문 작업이면 1차·2차가 따로 보여야 한다. */
function bySession(photos: WorkOrderSummaryPhoto[], kind: string): Array<[number, WorkOrderSummaryPhoto[]]> {
  const map = new Map<number, WorkOrderSummaryPhoto[]>();
  for (const p of photos.filter((x) => (kind === "before" ? x.kind === "before" : x.kind !== "before"))) {
    const no = p.session_no > 0 ? p.session_no : 1;
    map.set(no, [...(map.get(no) ?? []), p]);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export default function WorkOrderSign() {
  const { t, i18n } = useTranslation();
  const [, params] = useRoute("/work-order/:token");
  const token = params?.token ?? "";

  const [req, setReq] = useState<SigningRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ code: string; message: string } | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSigningRequest(token)
      .then((r) => {
        if (!active) return;
        setReq(r);
        setLoadError(null);
        // 서명자 이름이 미리 잡혀 있으면 채워 준다(현장에서 타이핑을 줄인다).
        const preset = r.signers?.find((s) => s.required)?.name ?? "";
        setSignerName(preset);
      })
      .catch((e: unknown) => {
        if (!active) return;
        const err = e instanceof SigningError ? e : null;
        setLoadError({
          code: err?.code ?? "error",
          message: err?.message ?? t("wosign.load_failed", "링크를 열 수 없습니다."),
        });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const wo: WorkOrderSummary | null = req?.summary?.kind === "work_order" ? req.summary : null;
  const before = useMemo(() => bySession(wo?.photos ?? [], "before"), [wo]);
  const after = useMemo(() => bySession(wo?.photos ?? [], "after"), [wo]);

  // 작업분류는 표준값(`cleaning`)으로 내려온다 — 읽는 사람 언어로 바꿔 준다.
  const categoryLabel = (v: string | null | undefined) =>
    v ? t(`wosign.cat_${v}` as any, v) : null;

  const consentText = t(
    "wosign.consent",
    "위 작업 내용을 확인하였으며, 기재된 대로 작업이 완료되었음을 확인합니다.",
  );

  async function handleSubmit() {
    if (!req) return;
    setSubmitError(null);
    if (!signerName.trim()) { setSubmitError(t("wosign.err_name", "확인하시는 분의 성함을 입력해 주세요.")); return; }
    if (!signature) { setSubmitError(t("wosign.err_signature", "서명을 입력해 주세요.")); return; }
    if (!consent) { setSubmitError(t("wosign.err_consent", "확인 동의가 필요합니다.")); return; }

    const role = req.signers?.find((s) => s.required)?.role ?? "facility_manager";
    setSubmitting(true);
    try {
      await submitSignatures(token, [{ role, name: signerName.trim(), signatureImage: signature }], consent, i18n.language);
      setDone(true);
    } catch (e) {
      const err = e instanceof SigningError ? e : null;
      setSubmitError(err?.message ?? t("wosign.err_submit", "제출에 실패했습니다. 다시 시도해 주세요."));
    } finally {
      setSubmitting(false);
    }
  }

  const Header = DEV_SITE ? DevNavbar : Navbar;
  const FooterC = DEV_SITE ? DevFooter : Footer;
  const card = "bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6";

  function Frame({ children }: { children: React.ReactNode }) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 sm:py-12">{children}</main>
        <FooterC />
      </div>
    );
  }

  if (loading) {
    return (
      <Frame>
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> {t("wosign.loading", "불러오는 중…")}
        </div>
      </Frame>
    );
  }

  if (loadError) {
    // 이미 서명된 링크는 오류가 아니라 "끝난 일"이다 — 그렇게 읽히게 둔다.
    const alreadySigned = loadError.code === "already_signed";
    return (
      <Frame>
        <div className={card}>
          <div className="flex items-start gap-3">
            {alreadySigned
              ? <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
              : <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />}
            <div>
              <h1 className="text-lg font-semibold">
                {alreadySigned
                  ? t("wosign.already_title", "이미 확인 서명이 완료되었습니다")
                  : t("wosign.error_title", "링크를 열 수 없습니다")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{loadError.message}</p>
            </div>
          </div>
          {alreadySigned && (
            <Button
              variant="outline" className="mt-4 gap-2"
              onClick={() => openPreview({
                title: t("wosign.doc_title", "작업 확인서"),
                filename: `${wo?.order_ref ?? token}.pdf`,
                href: signedPdfUrl(token),
              })}
            >
              <FileText className="h-4 w-4" /> {t("wosign.view_document", "확인서 보기")}
            </Button>
          )}
        </div>
        <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
      </Frame>
    );
  }

  if (done) {
    return (
      <Frame>
        <div className={`${card} text-center`}>
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <h1 className="text-xl font-semibold">{t("wosign.done_title", "확인 서명이 완료되었습니다")}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {t("wosign.done_body", "확인해 주셔서 감사합니다. 서명 내역은 작업 기록에 함께 보관됩니다.")}
          </p>
          <Button
            variant="outline" className="mt-5 gap-2"
            onClick={() => openPreview({
              title: t("wosign.doc_title", "작업 확인서"),
              filename: `${wo?.order_ref ?? token}.pdf`,
              href: signedPdfUrl(token),
            })}
          >
            <FileText className="h-4 w-4" /> {t("wosign.view_document", "확인서 보기")}
          </Button>
        </div>
        <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
      </Frame>
    );
  }

  const expires = req?.expires_at ? new Date(req.expires_at).toLocaleDateString(i18n.language) : null;

  return (
    <Frame>
      <div className="space-y-4">
        <div className={card}>
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            {t("wosign.eyebrow", "작업 확인 요청")}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold mt-1">{t("wosign.doc_title", "작업 확인서")}</h1>
          {wo && (
            <p className="text-sm text-muted-foreground mt-1">
              {wo.order_ref}
              {wo.unit_no ? ` · ${wo.unit_no}` : ""}
              {wo.property_name ? ` · ${wo.property_name}` : ""}
            </p>
          )}
          {expires && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("wosign.expires", "링크 유효기간: {{date}}까지", { date: expires })}
            </p>
          )}
        </div>

        {wo && (
          <div className={card}>
            <h2 className="text-sm font-semibold mb-3">{t("wosign.section_work", "작업 내용")}</h2>
            <dl className="text-sm divide-y divide-gray-100">
              <Row label={t("wosign.field_title", "작업명")} value={wo.title} />
              <Row label={t("wosign.field_category", "작업분류")} value={categoryLabel(wo.category)} />
              <Row label={t("wosign.field_unit", "대상 세대")} value={[wo.unit_no, wo.unit_type].filter(Boolean).join(" · ")} />
              <Row label={t("wosign.field_scheduled", "예정일")} value={fmtDate(wo.scheduled_at, i18n.language)} />
              <Row label={t("wosign.field_completed", "완료일")} value={fmtDate(wo.completed_at, i18n.language)} />
              <Row label={t("wosign.field_partner", "작업 파트너")} value={wo.partner_name} />
              <Row label={t("wosign.field_description", "상세")} value={wo.description} multiline />
              <Row label={t("wosign.field_notes", "비고")} value={wo.notes} multiline />
            </dl>
          </div>
        )}

        {wo && (before.length > 0 || after.length > 0) && (
          <div className={card}>
            <h2 className="text-sm font-semibold mb-3">{t("wosign.section_photos", "사진")}</h2>
            <PhotoBlock title={t("wosign.photos_before", "작업 전")} sessions={before} />
            <PhotoBlock title={t("wosign.photos_after", "작업 후")} sessions={after} />
          </div>
        )}

        <div className={`${card} flex flex-wrap gap-2`}>
          <Button
            variant="outline" className="gap-2"
            onClick={() => openPreview({
              title: t("wosign.doc_title", "작업 확인서"),
              filename: `${wo?.order_ref ?? token}.pdf`,
              href: previewUrl(token),
            })}
          >
            <FileText className="h-4 w-4" /> {t("wosign.view_full", "확인서 전문 보기")}
          </Button>
          {/* 일정이 잡힌 작업만 캘린더에 넣을 것이 있다. 링크로 두어야
              iOS 는 캘린더 추가 시트, 안드로이드는 캘린더 앱 열기로 이어진다. */}
          {wo?.scheduled_at && (
            <Button asChild variant="outline" className="gap-2">
              <a href={workOrderIcsUrl(token, i18n.language)}>
                <CalendarPlus className="h-4 w-4" /> {t("wosign.add_to_calendar", "캘린더에 저장")}
              </a>
            </Button>
          )}
        </div>

        <div className={card}>
          <h2 className="text-sm font-semibold mb-3">{t("wosign.section_sign", "확인 서명")}</h2>

          <label className="block text-sm font-medium mb-1">{t("wosign.label_name", "확인자 성함")}</label>
          <Input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder={t("wosign.ph_name", "예: 김철수")}
            className="mb-4"
          />

          <label className="block text-sm font-medium mb-1">{t("wosign.label_signature", "서명")}</label>
          <SignaturePad onChange={setSignature} />

          <label className="flex items-start gap-2 mt-4 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            <span>{consentText}</span>
          </label>

          <p className="text-xs text-muted-foreground mt-3">
            {t("wosign.audit_notice", "서명 시각과 접속 IP·기기 정보가 확인 기록으로 함께 저장됩니다.")}
          </p>

          {submitError && <p className="text-sm text-red-600 mt-3">{submitError}</p>}

          <Button className="w-full mt-4" onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t("wosign.submitting", "제출 중…")}</>
              : t("wosign.submit", "확인 서명 제출")}
          </Button>
        </div>
      </div>
      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </Frame>
  );
}

function Row({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
  if (!value) return null;
  return (
    <div className="py-2 flex gap-3">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className={multiline ? "whitespace-pre-wrap flex-1" : "flex-1"}>{value}</dd>
    </div>
  );
}

function PhotoBlock({ title, sessions }: { title: string; sessions: Array<[number, WorkOrderSummaryPhoto[]]> }) {
  const { t } = useTranslation();
  if (sessions.length === 0) return null;
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="text-xs font-semibold text-slate-700 mb-2">{title}</h3>
      {sessions.map(([no, group]) => (
        <div key={no} className="mb-3 last:mb-0">
          {sessions.length > 1 && (
            <p className="text-[11px] text-muted-foreground mb-1">
              {t("wosign.session_no", "{{n}}차", { n: no })}
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {group.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-slate-100">
                <img src={p.url} alt={p.caption ?? title} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function fmtDate(value: string | null | undefined, lang: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(lang);
}

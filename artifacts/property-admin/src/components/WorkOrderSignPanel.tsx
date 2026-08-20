/**
 * 작업 확인 서명 — 링크 발급 · 복사 · 서명 결과.
 *
 * 시설 담당자는 포털 계정이 없다. 여기서 뽑은 주소를 카톡으로 그대로 보내면
 * 담당자가 휴대폰에서 작업 내용과 전/후 사진을 확인하고 손서명을 남긴다.
 * 서명이 끝나면 **누가·언제·어느 IP·어떤 기기에서** 서명했는지가 이 자리에
 * 그대로 남는다 — 전자서명의 효력이 그 기록에서 나오기 때문에 접어 두지 않는다.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import { formatDateTime } from "@/lib/date";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { Check, Copy, FileSignature, FileText, Link2, Loader2, RotateCw, XCircle } from "lucide-react";

interface SignatureEntry {
  role: string;
  name: string;
  email?: string;
  signatureImage?: string;
  signedAt?: string;
  serverSignedAt?: string;
  ip?: string;
  userAgent?: string;
  consent?: { accepted: boolean; text: string; acceptedAt: string };
}

interface SigningRow {
  id: number;
  token: string;
  url: string;
  status: string; // pending | signed | expired | cancelled
  expires_at: string | null;
  signers: Array<{ role: string; name: string; email: string; required: boolean }>;
  signatures: SignatureEntry[];
  content_hash: string | null;
  signed_at: string | null;
  created_at: string;
}

/** 상세 화면 헤더 버튼이 이 앵커로 스크롤한다. */
export const WORK_ORDER_SIGN_ANCHOR = "wo-sign";

export type WorkOrderSignStatus = "none" | "pending" | "signed";

export function WorkOrderSignPanel({
  workOrderId, onStatusChange,
}: {
  workOrderId: number;
  /** 헤더 버튼이 라벨을 바꿀 수 있게 상태를 올려 준다(요청은 여기서 한 번만 한다). */
  onStatusChange?: (status: WorkOrderSignStatus) => void;
}) {
  const { t } = useTranslation();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  const [rows, setRows] = useState<SigningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/work-orders/${workOrderId}/sign-link`);
      const body = await res.json();
      const next: SigningRow[] = body?.success ? (body.data ?? []) : [];
      setRows(next);
      onStatusChange?.(
        next.some((r) => r.status === "signed") ? "signed"
        : next.some((r) => r.status === "pending") ? "pending"
        : "none",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [workOrderId]);

  const signed = rows.find((r) => r.status === "signed");
  const active = rows.find((r) => r.status === "pending");

  async function issue() {
    setIssuing(true); setError(null);
    try {
      const res = await apiFetch(`/api/v1/work-orders/${workOrderId}/sign-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signer_name: signerName.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error?.message ?? t("workorder.sign_issue_failed", "Could not create the link."));
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? t("workorder.sign_issue_failed", "Could not create the link."));
    } finally {
      setIssuing(false);
    }
  }

  async function cancel(id: number) {
    if (!confirm(t("workorder.sign_cancel_confirm", "Disable this signing link?"))) return;
    await apiFetch(`/api/v1/contract-signing/${id}/cancel`, { method: "DELETE" });
    await load();
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드가 막힌 브라우저 — 주소창 입력을 그대로 쓸 수 있게 선택만 시킨다.
      window.prompt(t("workorder.sign_copy_manual", "Copy this link:"), url);
    }
  }

  return (
    <div id={WORK_ORDER_SIGN_ANCHOR} className="border rounded-lg bg-white p-4 sm:p-6 scroll-mt-4">
      <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4 flex items-center gap-1.5">
        <FileSignature className="h-4 w-4" /> {t("workorder.section_sign", "Confirmation signature")}
      </h2>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading", "Loading…")}
        </div>
      ) : signed ? (
        <SignedRecord row={signed} onPreview={() => openPreview({
          title: t("workorder.sign_document", "Work completion confirmation"),
          filename: `${signed.token}.pdf`,
          source: { kind: "api", path: `/api/v1/public/contract-signing/${signed.token}/pdf` },
        })} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {t("workorder.sign_intro", "Create a link and send it to the facility manager (e.g. by KakaoTalk). They confirm the work and sign on their phone — no login needed.")}
          </p>

          {active ? (
            <div className="rounded-lg border bg-slate-50 p-3">
              <Label className="text-xs">{t("workorder.sign_link_label", "Signing link")}</Label>
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <Input readOnly value={active.url} className="bg-white font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" onClick={() => copyLink(active.url)} className="gap-1.5 shrink-0">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t("common.copied", "Copied") : t("common.copy", "Copy")}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                <span>{t("workorder.sign_signer", "Signer")}: {active.signers?.[0]?.name ?? "—"}</span>
                {active.expires_at && <span>{t("workorder.sign_expires", "Expires")}: {formatDateTime(active.expires_at)}</span>}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={issue} disabled={issuing}>
                  {issuing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                  {t("workorder.sign_reissue", "Reissue")}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-red-600 hover:text-red-700" onClick={() => cancel(active.id)}>
                  <XCircle className="h-3.5 w-3.5" /> {t("workorder.sign_disable", "Disable link")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t("workorder.sign_reissue_hint", "Reissuing invalidates the previous link.")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex-1">
                <Label>{t("workorder.sign_signer_name", "Facility manager (optional)")}</Label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder={t("workorder.ph_sign_signer_name", "Prefilled on the signing page")}
                />
              </div>
              <Button type="button" onClick={issue} disabled={issuing} className="gap-1.5">
                {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {t("workorder.sign_create", "Create signing link")}
              </Button>
            </div>
          )}

          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </>
      )}

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </div>
  );
}

/** 서명 완료 — 서명 그림과 함께 인증 정보를 펼쳐 둔다. */
function SignedRecord({ row, onPreview }: { row: SigningRow; onPreview: () => void }) {
  const { t } = useTranslation();
  const sig = row.signatures?.find((s) => s.signatureImage) ?? row.signatures?.[0];

  const facts: Array<[string, string | null | undefined]> = [
    [t("workorder.sign_signer", "Signer"), sig?.name],
    [t("workorder.sign_signed_at", "Signed at"), formatDateTime(sig?.serverSignedAt ?? row.signed_at ?? undefined)],
    [t("workorder.sign_ip", "IP address"), sig?.ip],
    [t("workorder.sign_device", "Device"), sig?.userAgent],
    [t("workorder.sign_consent", "Consent"), sig?.consent?.text],
    [t("workorder.sign_hash", "Document hash"), row.content_hash],
  ];

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-green-700 mb-3">
        <Check className="h-4 w-4" />
        {t("workorder.sign_done", "Confirmed and signed.")}
      </div>

      {sig?.signatureImage && (
        <div className="inline-block rounded-lg border bg-white p-2 mb-4">
          <img src={sig.signatureImage} alt={sig.name} className="h-16" />
        </div>
      )}

      <dl className="text-sm divide-y divide-gray-100 border-t border-gray-100">
        {facts.map(([label, value]) => value ? (
          <div key={label} className="py-2 flex gap-3">
            <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
            <dd className="flex-1 break-all">{value}</dd>
          </div>
        ) : null)}
      </dl>

      <Button type="button" variant="outline" size="sm" className="gap-1.5 mt-4" onClick={onPreview}>
        <FileText className="h-3.5 w-3.5" /> {t("workorder.sign_view_document", "View signed confirmation")}
      </Button>
    </div>
  );
}

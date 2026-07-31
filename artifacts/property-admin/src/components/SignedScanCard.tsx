/**
 * 서명본 스캔 보관 — 출력·날인한 계약서를 다시 계약서 서류함에 넣는다.
 *
 * 1달을 초과하는 계약은 온라인 서명을 쓰지 않으므로(→ ContractIssueWizard),
 * 날인한 원본을 스캔해 올리는 이 카드가 유일한 체결 증빙 경로다.
 * 업로드일과 실제 날인일이 다를 수 있어 날인일을 따로 받는다.
 *
 * 파일 목록은 일부러 두지 않는다. 저장 위치가 계약 서류함(documents 테이블)
 * 하나이므로 목록도 한 곳 — 이 카드 바로 아래 서류 표 — 에서만 보여준다.
 * 이 카드가 맡는 건 보관이 아니라 체결 처리(날인일·상태 전이·발행본 동결)다.
 */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui/date-input";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { FileUp } from "lucide-react";

interface Props {
  contractId: number;
}

/** 오늘 날짜를 YYYY-MM-DD 로. 날인일 기본값. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SignedScanCard({ contractId }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [signedOn, setSignedOn] = useState(today());
  const [setSigned, setSetSigned] = useState(true);
  const [freezeIssued, setFreezeIssued] = useState(true);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      body.append("signed_on", signedOn);
      body.append("set_signed", String(setSigned));
      body.append("freeze_issued", String(freezeIssued));
      const res = await apiFetch(`/api/v1/contracts/${contractId}/signed-scan`, { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? t("contract.scan_upload_failed"));
      return json;
    },
    onSuccess: () => {
      toast({ title: t("contract.scan_uploaded") });
      // 목록은 아래 서류 표가 갖고 있으므로 그쪽 쿼리를 갱신한다.
      qc.invalidateQueries({ queryKey: ["entity-documents", "contract", String(contractId)] });
      qc.invalidateQueries({ queryKey: ["/api/v1/contracts"] });
      qc.invalidateQueries({ queryKey: ["document-snapshots", "contract", contractId] });
      if (fileInput.current) fileInput.current.value = "";
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  return (
    <div className="border rounded-lg bg-white p-4 sm:p-6">
      <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-1">{t("contract.scan_section")}</h2>
      <p className="text-xs text-muted-foreground mb-4">{t("contract.scan_help")}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <Label>{t("contract.scan_signed_on")}</Label>
          <DateInput value={signedOn} onChange={(v) => setSignedOn(v ?? "")} />
        </div>
        <div className="space-y-2 sm:pt-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={setSigned} onCheckedChange={(c) => setSetSigned(c === true)} />
            {t("contract.scan_set_signed")}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={freezeIssued} onCheckedChange={(c) => setFreezeIssued(c === true)} />
            {t("contract.scan_freeze_issued")}
          </label>
        </div>
      </div>

      <input
        ref={fileInput} type="file" className="hidden"
        accept="application/pdf,image/png,image/jpeg,image/tiff"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
        }}
      />
      <Button type="button" variant="outline" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
        <FileUp className="h-4 w-4 mr-2" />
        {upload.isPending ? t("contract.scan_uploading") : t("contract.scan_upload")}
      </Button>
      <p className="text-[11px] text-muted-foreground mt-1.5">{t("contract.scan_formats")}</p>
    </div>
  );
}

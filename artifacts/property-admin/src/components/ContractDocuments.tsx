/**
 * 계약 서류 — 업로드 한 곳, 목록 한 곳.
 *
 * 예전엔 "서명본 스캔 보관" 카드와 범용 서류 패널이 각자 업로드 버튼과 목록을
 * 갖고 있어서 같은 파일이 두 번 보이고 버튼도 두 개였다. 저장 위치가 documents
 * 테이블 하나뿐이므로 화면도 하나여야 한다.
 *
 * 파일 종류는 묻지 않는다. 종류는 보존기간을 정하려고 있는 값이지 사람이 고를
 * 값이 아니다 — 계약에 올린 서류는 계약과 같은 7년(`contract`), 체결 체크를 켠
 * 파일만 서명 원본(`signed_contract`)으로 저장된다.
 *
 * 체결 처리(날인일·상태 전이·발행본 동결)는 단순 보관과 다른 동작이라 체크박스
 * 뒤에 접어 둔다. 켜면 파일 하나만 받는다 — 상태 전이를 여러 번 반복할 일은
 * 없기 때문이다.
 */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui/date-input";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { FolderUp, Upload } from "lucide-react";
import EntityDocuments, { entityDocumentsKey } from "@/components/EntityDocuments";
import { FileDropZone, DIRECTORY_INPUT_PROPS } from "@/components/FileDropZone";
import { CameraInput } from "@/components/CameraButton";

/** 오늘 날짜를 YYYY-MM-DD 로. 날인일 기본값. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ContractDocuments({ contractId }: { contractId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const [isExecution, setIsExecution] = useState(false);
  const [signedOn, setSignedOn] = useState(today());
  const [setSigned, setSetSigned] = useState(true);
  const [freezeIssued, setFreezeIssued] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listKey = entityDocumentsKey("contract", contractId);

  /** 날인 원본: 상태 전이·발행본 동결까지 하는 체결 처리 경로. */
  async function uploadSignedScan(file: File): Promise<string | null> {
    const body = new FormData();
    body.append("file", file);
    body.append("signed_on", signedOn);
    body.append("set_signed", String(setSigned));
    body.append("freeze_issued", String(freezeIssued));
    const res = await apiFetch(`/api/v1/contracts/${contractId}/signed-scan`, { method: "POST", body });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.error ?? t("contract.scan_upload_failed");
  }

  /** 그 밖의 서류: 계약 보존기간을 따르는 일반 첨부. */
  async function uploadAttachment(file: File): Promise<string | null> {
    const body = new FormData();
    body.append("file", file);
    body.append("entity_type", "contract");
    body.append("entity_id", String(contractId));
    body.append("doc_type", "contract");
    const res = await apiFetch("/api/v1/documents", { method: "POST", body });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return `${file.name}: ${data?.error ?? res.status}`;
  }

  async function handleUpload(input?: FileList | File[] | null) {
    const files = (input ? Array.from(input) : []).filter((f) => f.size > 0);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    const failures: string[] = [];
    try {
      if (isExecution) {
        const failure = await uploadSignedScan(files[0]);
        if (failure) failures.push(failure);
      } else {
        // 한 건씩 — 하나가 거부돼도 나머지는 올라간다.
        for (const file of files) {
          const failure = await uploadAttachment(file);
          if (failure) failures.push(failure);
        }
      }
      if (failures.length) setError(failures.join(" / "));
      else toast({ title: t("contract.scan_uploaded") });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("entity_docs.upload_failed"));
    } finally {
      setUploading(false);
      qc.invalidateQueries({ queryKey: listKey });
      qc.invalidateQueries({ queryKey: ["/api/v1/contracts"] });
      // 체결 처리에서 발행본을 동결하면 새 버전이 생긴다 — DocumentVersions 가
      // 쓰는 키와 정확히 같아야 그 목록이 새로고침된다.
      qc.invalidateQueries({ queryKey: ["doc-snapshots", "contract", String(contractId)] });
      if (fileRef.current) fileRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {/* 파인더/탐색기에서 끌어다 놓거나 ⌘/Ctrl+V 로 붙여넣어도 같은 경로로 올라간다. */}
      <FileDropZone
        onFiles={(files) => void handleUpload(files)}
        busy={uploading}
        hideHint
        className="border rounded-lg bg-white p-4 sm:p-6"
      >
        <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-1">{t("contract_docs.section")}</h2>
        <p className="text-xs text-muted-foreground mb-4">{t("entity_docs.description")}</p>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox checked={isExecution} onCheckedChange={(c) => setIsExecution(c === true)} className="mt-0.5" />
          <span>
            {t("contract_docs.is_signed_original")}
            <span className="block text-xs text-muted-foreground">{t("contract_docs.is_signed_original_help")}</span>
          </span>
        </label>

        {isExecution && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-md border bg-muted/30 p-3">
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
        )}

        <input
          ref={fileRef} type="file" className="hidden"
          // 체결 처리는 상태 전이를 동반하므로 한 건만 받는다.
          multiple={!isExecution}
          accept="application/pdf,image/png,image/jpeg,image/tiff"
          onChange={(e) => void handleUpload(e.target.files)}
        />
        {/* 폰에서는 찍는 것이 곧 첨부다. 같은 핸들러로 들어간다. */}
        <CameraInput onChange={(e) => void handleUpload(e.target.files)} />
        <input
          ref={folderRef} type="file" multiple className="hidden"
          {...DIRECTORY_INPUT_PROPS}
          accept="application/pdf,image/png,image/jpeg,image/tiff"
          onChange={(e) => void handleUpload(e.target.files)}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-1.5"
            disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {uploading ? t("contract.scan_uploading") : t("entity_docs.upload")}
          </Button>
          {/* 체결 처리는 한 건만 받으므로 폴더 통째 업로드는 일반 첨부일 때만. */}
          {!isExecution && (
            <Button type="button" variant="outline" className="gap-1.5"
              disabled={uploading} onClick={() => folderRef.current?.click()}>
              <FolderUp className="h-4 w-4" />
              {t("file_drop.upload_folder", "Upload folder")}
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">{t("contract.scan_formats")}</p>
        <p className="text-[11px] text-muted-foreground">{t("file_drop.hint", "Drag files or a folder here, or press ⌘/Ctrl+V to paste them")}</p>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </FileDropZone>

      <EntityDocuments entityType="contract" entityId={contractId} hideUpload />
    </div>
  );
}

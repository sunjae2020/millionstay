import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, FileUp, Link2, Loader2, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";

/**
 * 은행 명세서 가져오기 — 원본 → 검토 → 확정.
 *
 * 회계 데이터를 한 번에 수십 건 밀어 넣는 일이라 **중간에 반드시 사람이 본다.**
 * 중복과 애매한 매칭을 화면에서 확인하고, 계정과목까지 정한 뒤에 확정한다.
 */

type Step = "source" | "review" | "done";

interface MatchedRow {
  key: string;
  txn_date: string;
  withdrawal: number;
  deposit: number;
  memo: string;
  kind: string;
  confidence: "certain" | "review";
  reason: string;
  contract_id: number | null;
  contract_ref: string | null;
  unit_name: string | null;
  tenant_name: string | null;
  invoice_id: number | null;
  invoice_ref: string | null;
  gl_account_code: string | null;
  txn_type: "income" | "expense" | "transfer";
  duplicate_of: string | null;
}

interface PreviewMeta {
  header_line: number; skipped: number; warnings: string[];
  total: number; duplicates: number; review: number;
  deposit_total: number; withdrawal_total: number;
  period: { from: string; to: string } | null;
}

const KIND_LABEL: Record<string, string> = {
  invoice: "청구서 수납", deposit: "보증금", multi_rent: "선납(여러 달)",
  rent_no_invoice: "월세(청구서 없음)", contract_only: "계약만 확인",
  internal: "자사 이체", unmatched: "미매칭",
};

export function BankStatementImportDialog({
  open, onOpenChange, onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const brand = useBrand();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("source");
  const [bank, setBank] = useState("auto");
  const [bankAccount, setBankAccount] = useState<string>("_none");
  const [mode, setMode] = useState<"file" | "paste" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [link, setLink] = useState("");
  const [rows, setRows] = useState<MatchedRow[]>([]);
  const [meta, setMeta] = useState<PreviewMeta | null>(null);
  const [include, setInclude] = useState<Record<string, boolean>>({});
  const [settleInvoices, setSettleInvoices] = useState(true);
  const [result, setResult] = useState<{ created: number; settled: number; failed: Array<{ memo: string; error: string }> } | null>(null);

  const money = (n: number) => formatMoney(n, brand.currency, brand.currencyPosition);

  const { data: opts } = useQuery<{
    data: {
      banks: Array<{ id: string; label: string; notes: string | null }>;
      bank_accounts: Array<{ id: number; name: string }>;
      chart_of_accounts: Array<{ code: string; name: string; type: string }>;
    };
  }>({
    queryKey: ["bank-import-options"],
    enabled: open,
    queryFn: async () => {
      const r = await apiFetch("/api/v1/bank-import/banks");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const preview = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("bank", bank);
      if (bankAccount !== "_none") fd.append("bank_account_id", bankAccount);
      if (mode === "file" && file) fd.append("file", file);
      else if (mode === "paste") fd.append("csv_text", pasted);
      else if (mode === "link") fd.append("source_url", link.trim());
      const r = await apiFetch("/api/v1/bank-import/preview", { method: "POST", body: fd });
      const p = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(p?.error ?? "읽지 못했습니다");
      return p.data as { rows: MatchedRow[]; meta: PreviewMeta };
    },
    onSuccess: (d) => {
      setRows(d.rows);
      setMeta(d.meta);
      // 중복은 기본적으로 **뺀다.** 같은 명세서를 다시 올리는 일이 가장 흔한 실수다.
      setInclude(Object.fromEntries(d.rows.map((r) => [r.key, !r.duplicate_of])));
      setStep("review");
    },
    onError: (e: Error) => toast({ title: "가져오기 실패", description: e.message, variant: "destructive" }),
  });

  const commit = useMutation({
    mutationFn: async () => {
      const picked = rows.filter((r) => include[r.key]);
      const r = await apiFetch("/api/v1/bank-import/commit", {
        method: "POST",
        body: JSON.stringify({
          bank,
          bank_account_id: bankAccount !== "_none" ? Number(bankAccount) : null,
          settle_invoices: settleInvoices,
          rows: picked.map((x) => ({
            txn_date: x.txn_date,
            amount: x.deposit > 0 ? x.deposit : x.withdrawal,
            txn_type: x.txn_type,
            memo: x.memo,
            description: `${KIND_LABEL[x.kind] ?? ""} — ${x.memo}`.trim(),
            contract_id: x.contract_id,
            invoice_id: x.invoice_id,
            gl_account_code: x.gl_account_code,
            kind: x.kind,
            reason: x.reason,
          })),
        }),
      });
      const p = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(p?.error ?? "실패");
      return p.data as { created: number; settled: number; failed: Array<{ memo: string; error: string }> };
    },
    onSuccess: (d) => { setResult(d); setStep("done"); onImported(); },
    onError: (e: Error) => toast({ title: "등록 실패", description: e.message, variant: "destructive" }),
  });

  const chosen = rows.filter((r) => include[r.key]);
  const chosenTotal = chosen.reduce((s, r) => s + (r.deposit || r.withdrawal), 0);

  function reset() {
    setStep("source"); setRows([]); setMeta(null); setInclude({});
    setFile(null); setPasted(""); setLink(""); setResult(null);
  }

  const patch = (key: string, p: Partial<MatchedRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            은행 명세서 가져오기
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {step === "source" ? "1/3 원본" : step === "review" ? "2/3 검토" : "3/3 완료"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {step === "source" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">은행</Label>
                <Select value={bank} onValueChange={setBank}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(opts?.data.banks ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  은행마다 컬럼 이름이 달라 형식을 골라야 합니다. 모르면 “자동 인식”으로 두세요.
                </p>
              </div>
              <div>
                <Label className="text-xs">입금 통장</Label>
                <Select value={bankAccount} onValueChange={setBankAccount}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">지정 안 함</SelectItem>
                    {(opts?.data.bank_accounts ?? []).map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-1 border-b">
              {([["file", "파일 올리기", FileUp], ["paste", "붙여넣기", Upload], ["link", "Google 링크", Link2]] as const)
                .map(([m, label, Icon]) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      mode === m ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
            </div>

            {mode === "file" && (
              <div>
                <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <FileUp className="h-4 w-4 mr-1" />CSV 파일 선택
                </Button>
                {file && <span className="ml-2 text-sm text-muted-foreground">{file.name}</span>}
                <p className="text-xs text-muted-foreground mt-2">
                  가장 권장하는 방법입니다. 엑셀(xlsx)은 “다른 이름으로 저장 → CSV”로 내보낸 뒤 올려 주세요.
                </p>
              </div>
            )}

            {mode === "paste" && (
              <div>
                <Label className="text-xs">명세서 붙여넣기</Label>
                <Textarea rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)}
                  placeholder="엑셀에서 헤더 줄을 포함해 복사한 뒤 그대로 붙여넣으세요." className="font-mono text-xs" />
              </div>
            )}

            {mode === "link" && (
              <div className="space-y-2">
                <Label className="text-xs">Google 스프레드시트 / 드라이브 링크</Label>
                <Input value={link} onChange={(e) => setLink(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..." />
                {/* 비공개 파일은 서버가 열 수 없다. 눌러 보고 나서 알게 하지 말고 미리 알린다. */}
                <div className="flex gap-2 items-start border border-amber-200 bg-amber-50 rounded-md px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">비공개 파일은 열 수 없습니다.</p>
                    <p className="mt-0.5">
                      서버에는 Google 계정이 연결돼 있지 않습니다. 링크로 가져오려면 Google에서
                      <strong> 파일 → 공유 → “링크가 있는 모든 사용자”</strong>로 바꿔야 합니다.
                      통장 내역을 공개로 돌리기 부담스러우시면 <strong>파일 올리기</strong>를 쓰세요 — 공개 전환이 필요 없습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
              <Button
                onClick={() => preview.mutate()}
                disabled={preview.isPending || (mode === "file" ? !file : mode === "paste" ? !pasted.trim() : !link.trim())}>
                {preview.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}불러오기
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "review" && meta && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <Tile label="읽은 거래" value={`${meta.total}건`} />
              <Tile label="입금 합계" value={money(meta.deposit_total)} />
              <Tile label="출금 합계" value={money(meta.withdrawal_total)} />
              <Tile label="중복 의심" value={`${meta.duplicates}건`} cls={meta.duplicates ? "text-amber-600" : ""} />
              <Tile label="확인 필요" value={`${meta.review}건`} cls={meta.review ? "text-amber-600" : ""} />
            </div>

            {meta.warnings.map((w, i) => (
              <div key={i} className="flex gap-2 items-start border border-amber-200 bg-amber-50 rounded-md px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{w}
              </div>
            ))}

            <div className="border rounded-lg overflow-x-auto max-h-[46vh] overflow-y-auto">
              <table className="w-full min-w-max text-xs">
                <thead className="border-b bg-muted/30 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 w-8"></th>
                    <th className="text-left px-2 py-2">거래일</th>
                    <th className="text-right px-2 py-2">금액</th>
                    <th className="text-left px-2 py-2">적요</th>
                    <th className="text-left px-2 py-2">매칭</th>
                    <th className="text-left px-2 py-2">계약 / 청구서</th>
                    <th className="text-left px-2 py-2">계정과목</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className={`border-b last:border-0 ${r.duplicate_of ? "bg-amber-50/60" : ""} ${!include[r.key] ? "opacity-45" : ""}`}>
                      <td className="px-2 py-1.5">
                        <Checkbox checked={!!include[r.key]}
                          onCheckedChange={(v) => setInclude((s) => ({ ...s, [r.key]: !!v }))} />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.txn_date}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${r.withdrawal > 0 ? "text-red-600" : ""}`}>
                        {r.withdrawal > 0 ? `−${money(r.withdrawal)}` : money(r.deposit)}
                      </td>
                      <td className="px-2 py-1.5 max-w-[180px] truncate" title={r.memo}>{r.memo}</td>
                      <td className="px-2 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded ${r.confidence === "certain" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {KIND_LABEL[r.kind] ?? r.kind}
                        </span>
                        {r.duplicate_of && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">중복 {r.duplicate_of}</span>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-0.5 max-w-[220px]">{r.reason}</div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {r.contract_ref
                          ? <span>{r.unit_name ?? ""} {r.tenant_name ?? ""}<br /><span className="text-muted-foreground">{r.invoice_ref ?? r.contract_ref}</span></span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={r.gl_account_code ?? "_none"}
                          onValueChange={(v) => patch(r.key, { gl_account_code: v === "_none" ? null : v })}>
                          <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">자동(유형 기준)</SelectItem>
                            {(opts?.data.chart_of_accounts ?? []).map((a) => (
                              <SelectItem key={a.code} value={a.code}>{a.code} · {a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={settleInvoices} onCheckedChange={(v) => setSettleInvoices(!!v)} />
              청구서가 붙은 건은 수납 처리까지 진행
            </label>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setStep("source")}>
                <ArrowLeft className="h-4 w-4 mr-1" />원본 다시 선택
              </Button>
              <div className="flex-1 text-sm text-muted-foreground self-center">
                선택 {chosen.length}건 · {money(chosenTotal)}
              </div>
              <Button onClick={() => commit.mutate()} disabled={commit.isPending || chosen.length === 0}>
                {commit.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {chosen.length}건 등록
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{result.created}건이 거래 원장에 등록됐습니다.</span>
              </div>
              {result.settled > 0 && (
                <p className="text-sm text-muted-foreground pl-7">
                  이 중 {result.settled}건은 청구서 수납 처리까지 완료됐습니다(미납 → 완납, 원장 전기 포함).
                </p>
              )}
            </div>
            {result.failed.length > 0 && (
              <div className="border border-red-200 bg-red-50 rounded-md px-3 py-2 text-xs">
                <p className="font-medium text-red-700">{result.failed.length}건 실패</p>
                {result.failed.slice(0, 6).map((f, i) => (
                  <p key={i} className="text-red-600 mt-0.5">{f.memo} — {f.error}</p>
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              매칭이 틀린 건은 목록에서 거래를 열어 계약·청구서·계정과목을 고칠 수 있습니다.
              수납된 거래에서는 영수증도 바로 발급됩니다.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>계속 가져오기</Button>
              <Button onClick={() => onOpenChange(false)}>닫기</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Tile({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="border rounded-md px-2.5 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

/**
 * 청구 내역(라인 항목) 편집기 — 인보이스 상세에서 항목을 직접 추가·수정·삭제한다.
 *
 * 임대료 청구서는 월 전액만으로 끝나지 않는다. 월 중간 입주·퇴거분은 일할계산으로
 * 실리고(예: 7/25 입주 → 7일/31일), 그 줄이 다음 달 청구서에 이월되기도 한다.
 * 통합 청구서 생성기(consolidatedInvoices.ts)가 자동으로 만들어 주지만, 실제 운영에서는
 * 렌트프리·중도 정산·직원 교체처럼 자동 규칙 밖의 조정이 늘 생기므로 사람이 손으로
 * 고칠 수 있어야 한다. 이 편집기가 그 창구다.
 *
 * 저장은 PUT /v1/invoices/:id 에 `line_items` 만 보낸다 — 서버가 인보이스 총액을
 * 라인 합계로 다시 계산하므로 금액 필드를 따로 맞출 필요가 없다.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, CalendarClock, Save } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/currency";

/** GET /v1/invoices/:id 가 돌려주는 라인 항목. */
export interface InvoiceLineItem {
  id?: number;
  label: string;
  description?: string | null;
  quantity?: string | number | null;
  unit_amount?: string | number | null;
  total_amount?: string | number | null;
  period_start?: string | null;
  period_end?: string | null;
  space_id?: number | null;
  contract_id?: number | null;
}

interface EditableLine {
  key: string;
  label: string;
  description: string;
  quantity: string;
  unit_amount: string;
  period_start: string;
  period_end: string;
  space_id: number | null;
  contract_id: number | null;
}

/**
 * 일할계산 절사 규칙. 서버(`roundProrata`)의 기본값은 KRW·JPY 1,000단위 절사지만,
 * 과거 발행분은 10원 단위로 끊긴 것도 있어 실제 청구서를 그대로 재현하려면
 * 사람이 고를 수 있어야 한다.
 */
type RoundingMode = "floor1000" | "round10" | "exact";

export function applyRounding(amount: number, mode: RoundingMode): number {
  if (mode === "floor1000") return Math.floor(amount / 1000) * 1000;
  if (mode === "round10") return Math.round(amount / 10) * 10;
  return Math.round(amount * 100) / 100;
}

/** 그 달의 일수 — 일할계산의 분모(전체일수). */
function daysInMonthOf(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return 0;
  return new Date(y, m, 0).getDate();
}

/** 두 날짜를 포함한 사용일수(양끝 포함). */
function inclusiveDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

let keySeq = 0;
const nextKey = () => `line-${++keySeq}`;

function toEditable(li: InvoiceLineItem): EditableLine {
  return {
    key: nextKey(),
    label: li.label ?? "",
    description: li.description ?? "",
    quantity: String(Number(li.quantity ?? 1)),
    unit_amount: String(Number(li.unit_amount ?? 0)),
    period_start: li.period_start ?? "",
    period_end: li.period_end ?? "",
    space_id: li.space_id ?? null,
    contract_id: li.contract_id ?? null,
  };
}

const lineTotal = (l: EditableLine) => Number(l.quantity || 0) * Number(l.unit_amount || 0);

export function InvoiceLineItemsEditor({
  invoiceId,
  currency,
  items,
  isConsolidated,
  onSaved,
}: {
  invoiceId: number;
  currency: string;
  items: InvoiceLineItem[];
  isConsolidated?: boolean;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [lines, setLines] = useState<EditableLine[]>(() => items.map(toEditable));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prorataOpen, setProrataOpen] = useState(false);

  // 서버에서 다시 불러온 내역으로 되돌린다(저장 직후·다른 화면에서 재계산된 경우).
  useEffect(() => {
    if (!dirty) setLines(items.map(toEditable));
  }, [items, dirty]);

  const total = useMemo(() => lines.reduce((s, l) => s + lineTotal(l), 0), [lines]);

  const patch = (key: string, next: Partial<EditableLine>) => {
    setDirty(true);
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...next } : l)));
  };

  const addBlank = () => {
    setDirty(true);
    setLines(prev => [...prev, {
      key: nextKey(), label: "", description: "", quantity: "1", unit_amount: "0",
      period_start: "", period_end: "", space_id: null, contract_id: null,
    }]);
  };

  const remove = (key: string) => {
    setDirty(true);
    setLines(prev => prev.filter(l => l.key !== key));
  };

  const save = async () => {
    const payload = lines
      .filter(l => l.label.trim())
      .map(l => ({
        label: l.label.trim(),
        description: l.description.trim() || null,
        quantity: Number(l.quantity || 1),
        unit_amount: Number(l.unit_amount || 0),
        period_start: l.period_start || null,
        period_end: l.period_end || null,
        space_id: l.space_id,
        contract_id: l.contract_id,
      }));
    setSaving(true);
    try {
      const res = await apiFetch(`/api/v1/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_items: payload }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      setDirty(false);
      toast({ title: t("invoice.lines_saved"), description: t("invoice.lines_saved_desc") });
      onSaved?.();
    } catch (err) {
      toast({
        title: t("invoice.lines_save_failed"),
        description: err instanceof Error ? err.message : t("invoice.error"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-lg bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="text-sm font-semibold uppercase text-primary tracking-wide">{t("invoice.section_lines")}</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setProrataOpen(true)}>
            <CalendarClock className="h-4 w-4" /> {t("invoice.btn_add_prorata")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addBlank}>
            <Plus className="h-4 w-4" /> {t("invoice.btn_add_line")}
          </Button>
          <Button type="button" size="sm" className="gap-1.5" disabled={!dirty || saving} onClick={save}>
            <Save className="h-4 w-4" /> {t("invoice.btn_save_lines")}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {isConsolidated ? t("invoice.lines_hint_consolidated") : t("invoice.lines_hint")}
      </p>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">{t("invoice.lines_empty")}</p>
      ) : (
        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-3 py-2.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">{t("invoice.col_line_label")}</th>
                <th className="text-left px-3 py-2.5 text-xs uppercase tracking-wide text-muted-foreground font-medium w-[230px]">{t("invoice.col_line_period")}</th>
                <th className="text-right px-3 py-2.5 text-xs uppercase tracking-wide text-muted-foreground font-medium w-[80px]">{t("invoice.col_qty")}</th>
                <th className="text-right px-3 py-2.5 text-xs uppercase tracking-wide text-muted-foreground font-medium w-[140px]">{t("invoice.col_unit_amount")}</th>
                <th className="text-right px-3 py-2.5 text-xs uppercase tracking-wide text-muted-foreground font-medium w-[130px]">{t("common.amount")}</th>
                <th className="w-[44px]" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map(l => (
                <tr key={l.key} className="align-top">
                  <td className="px-3 py-2">
                    <Input value={l.label} onChange={e => patch(l.key, { label: e.target.value })}
                      placeholder={t("invoice.ph_line_label")} />
                    <Input className="mt-1.5 text-xs" value={l.description}
                      onChange={e => patch(l.key, { description: e.target.value })}
                      placeholder={t("invoice.ph_line_desc")} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <DateInput value={l.period_start} onChange={v => patch(l.key, { period_start: v })} />
                      <span className="text-muted-foreground">~</span>
                      <DateInput value={l.period_end} onChange={v => patch(l.key, { period_end: v })} />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" step="0.01" className="text-right" value={l.quantity}
                      onChange={e => patch(l.key, { quantity: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" step="0.01" className="text-right" value={l.unit_amount}
                      onChange={e => patch(l.key, { unit_amount: e.target.value })} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap pt-4">
                    {formatMoney(lineTotal(l), currency)}
                  </td>
                  <td className="px-2 py-2">
                    <Button type="button" variant="ghost" size="icon" className="text-destructive"
                      onClick={() => remove(l.key)} aria-label={t("common.delete")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/30">
              <tr>
                <td colSpan={4} className="px-3 py-2.5 text-right font-medium">{t("invoice.line_total")}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatMoney(total, currency)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ProrataDialog
        open={prorataOpen}
        currency={currency}
        onClose={() => setProrataOpen(false)}
        onAdd={line => {
          setDirty(true);
          setLines(prev => [...prev, { ...line, key: nextKey() }]);
          setProrataOpen(false);
        }}
      />
    </div>
  );
}

/** 일할계산 항목 추가 — 기준 월액과 사용 구간을 넣으면 금액·설명을 만들어 준다. */
function ProrataDialog({
  open, currency, onClose, onAdd,
}: {
  open: boolean;
  currency: string;
  onClose: () => void;
  onAdd: (line: Omit<EditableLine, "key">) => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");
  const [baseRent, setBaseRent] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rounding, setRounding] = useState<RoundingMode>("floor1000");

  useEffect(() => {
    if (open) { setLabel(""); setBaseRent(""); setFrom(""); setTo(""); setRounding("floor1000"); }
  }, [open]);

  const usedDays = inclusiveDays(from, to);
  const totalDays = daysInMonthOf(from);
  const raw = totalDays > 0 ? Number(baseRent || 0) * usedDays / totalDays : 0;
  const amount = applyRounding(raw, rounding);
  const valid = usedDays > 0 && totalDays > 0 && amount > 0 && !!label.trim();

  const add = () => {
    onAdd({
      label: label.trim(),
      description: t("invoice.prorata_desc", { from, to, used: usedDays, total: totalDays }),
      quantity: "1",
      unit_amount: String(amount),
      period_start: from,
      period_end: to,
      space_id: null,
      contract_id: null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("invoice.prorata_title")}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <Label>{t("invoice.col_line_label")} *</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder={t("invoice.ph_prorata_label")} />
          </div>
          <div>
            <Label>{t("invoice.prorata_base")} *</Label>
            <Input type="number" step="0.01" value={baseRent} onChange={e => setBaseRent(e.target.value)} placeholder="350000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("invoice.prorata_from")} *</Label>
              <DateInput value={from} onChange={setFrom} />
            </div>
            <div>
              <Label>{t("invoice.prorata_to")} *</Label>
              <DateInput value={to} onChange={setTo} />
            </div>
          </div>
          <div>
            <Label>{t("invoice.prorata_rounding")}</Label>
            <Select value={rounding} onValueChange={v => setRounding(v as RoundingMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="floor1000">{t("invoice.rounding_floor1000")}</SelectItem>
                <SelectItem value="round10">{t("invoice.rounding_round10")}</SelectItem>
                <SelectItem value="exact">{t("invoice.rounding_exact")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("invoice.prorata_days")}</span>
              <span className="tabular-nums">{t("invoice.prorata_days_value", { used: usedDays, total: totalDays })}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">{t("common.amount")}</span>
              <span className="font-semibold tabular-nums">{formatMoney(amount, currency)}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!valid} onClick={add}>{t("invoice.btn_add_line")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

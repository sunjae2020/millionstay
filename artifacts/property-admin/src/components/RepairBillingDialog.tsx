import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LookupSelect } from "@/components/LookupSelect";
import { AccountLookupSelect } from "@/components/AccountLookupSelect";
import { WORK_ORDER_CATEGORIES } from "@/lib/workOrderCategories";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { apiJson } from "@/lib/apiFetch";
import { formatMoney } from "@/lib/currency";
import { useBrand } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";

/**
 * 하자·청소 청구 명세서 발행 — 기간 안의 작업지시를 한 장으로 묶어 회사에
 * 청구한다. 손으로 쓰던 "임대청소 & 하자 청구서" 시트가 원본이라 컬럼 순서
 * (순번 · 작업일자 · 호수 · 타입 · 작업분류 · 작업비용 · 청구비용 · 작업내용)를
 * 그대로 지키고, 각 호수의 사진이 같은 PDF 뒤에 증빙으로 붙는다.
 *
 * 청구비용은 원장의 실지급액(net_cost)이 먼저다. 그 값이 없는 행에만 아래
 * 원천징수율이 적용된다 — 3.3%면 ₩100,000 → ₩96,700.
 */

/**
 * 자주 청구되는 분류를 위에 둔다. 값은 `@workspace/api-zod`의 분류표(canonical)
 * 그대로이고, 하나도 고르지 않으면 전체다. 서버가 옛 표기(`하자보수`)까지
 * 별칭으로 잡아 주므로 이관 전 데이터도 함께 걸린다.
 */
const BILLABLE_CATEGORIES = WORK_ORDER_CATEGORIES.filter((c) => c.common);

/** 이번 달 1일 / 말일 — 명세서는 월 단위로 끊는 것이 기본이다. */
function monthRange(): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(last)}` };
}

interface StatementRow {
  seq: number;
  work_order_id: number;
  order_ref: string;
  unit_no: string | null;
  unit_type: string | null;
  category: string | null;
  cost: number;
  billed: number;
  photo_count: number;
  /** 이미 청구서에 실린 줄 — 발행 시 건너뛴다. */
  invoiced_invoice_id: number | null;
}

interface StatementTotals {
  count: number;
  cost: number;
  billed: number;
  billable_count: number;
  billable_amount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RepairBillingDialog({ open, onOpenChange }: Props) {
  const { t, i18n } = useTranslation();
  const { currency: brandCurrency, currencyPosition } = useBrand();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const defaults = useMemo(monthRange, []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [status, setStatus] = useState("_all");
  const [withholdingPct, setWithholdingPct] = useState("3.3");
  const [includePhotos, setIncludePhotos] = useState(true);
  const [photosPerUnit, setPhotosPerUnit] = useState("6");
  const [billTo, setBillTo] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (propertyId) p.set("property_id", String(propertyId));
    if (categories.length) p.set("category", categories.join(","));
    if (status !== "_all") p.set("status", status);
    if (Number(withholdingPct) > 0) p.set("withholding_pct", withholdingPct);
    p.set("photos_per_unit", includePhotos ? photosPerUnit : "0");
    return p;
  }, [from, to, propertyId, categories, status, withholdingPct, includePhotos, photosPerUnit]);

  const { data: summary, isFetching } = useQuery({
    queryKey: ["wo-billing-statement", query.toString()],
    queryFn: () =>
      apiJson<{ data: { rows: StatementRow[]; totals: StatementTotals } }>(
        `/api/v1/work-orders/billing-statement?${query.toString()}`,
      ).then((r) => r.data),
    enabled: open,
  });

  const money = (v: number) => formatMoney(v, brandCurrency, currencyPosition);

  function preview() {
    const p = new URLSearchParams(query);
    if (accountId) p.set("account_id", String(accountId));
    if (billTo.trim()) p.set("bill_to", billTo.trim());
    p.set("lang", i18n.language);
    openPreview({
      title: t("workorder.billing_title", "Repair & cleaning billing statement"),
      filename: `repair-billing-${from}_${to}.pdf`,
      source: { kind: "api", path: `/api/v1/work-orders/billing-statement.pdf?${p.toString()}` },
    });
  }

  // 청구서 발행 — 명세서 한 줄이 청구서 한 줄이 된다. 이미 청구된 건은 서버가
  // 건너뛰고 몇 건을 건너뛰었는지 함께 돌려준다.
  const issue = useMutation({
    mutationFn: async () => {
      const p = new URLSearchParams(query);
      if (accountId) p.set("account_id", String(accountId));
      if (dueDate) p.set("due_date", dueDate);
      return apiJson<{ data: { id: number; invoice_ref: string }; lines: number; skipped: number }>(
        `/api/v1/work-orders/billing-statement/invoice?${p.toString()}`,
        { method: "POST", body: JSON.stringify({}) },
      );
    },
    onSuccess: (r) => {
      toast({
        title: t("workorder.billing_invoice_created", "Invoice {{ref}} created", { ref: r.data.invoice_ref }),
        description: r.skipped
          ? t("workorder.billing_invoice_skipped", "{{n}} already-invoiced item(s) skipped.", { n: r.skipped })
          : undefined,
      });
      onOpenChange(false);
      navigate(`/finance/invoices/${r.data.id}`);
    },
    onError: (err: unknown) =>
      toast({
        title: t("workorder.billing_invoice_failed", "Could not create the invoice"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      }),
  });

  const toggleCategory = (c: string) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("workorder.billing_title", "Repair & cleaning billing statement")}</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground -mt-2">
            {t("workorder.billing_desc", "Bundles the work orders in a period into one statement, with each unit's photos attached as evidence.")}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("workorder.billing_from", "From")}</Label>
              <DateInput value={from} onChange={(v) => setFrom(v ?? "")} />
            </div>
            <div>
              <Label>{t("workorder.billing_to", "To")}</Label>
              <DateInput value={to} onChange={(v) => setTo(v ?? "")} />
            </div>
          </div>

          <div>
            <Label>{t("workorder.billing_property", "Property")}</Label>
            <LookupSelect
              value={propertyId}
              onChange={setPropertyId}
              lookupUrl="/api/v1/lookup/properties"
              placeholder={t("workorder.billing_all_properties", "All properties")}
            />
          </div>

          <div>
            <Label>{t("workorder.billing_category", "Work type")}</Label>
            <div className="flex flex-wrap gap-3 mt-1">
              {BILLABLE_CATEGORIES.map((c) => (
                <label key={c.value} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={categories.includes(c.value)} onCheckedChange={() => toggleCategory(c.value)} />
                  {t(c.labelKey as any)}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("workorder.billing_category_hint", "Nothing ticked = every work type.")}
            </p>
          </div>

          <div>
            <Label>{t("workorder.label_status")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t("workorder.all_statuses")}</SelectItem>
                <SelectItem value="Completed">{t("workorder.status_completed")}</SelectItem>
                <SelectItem value="PendingReview">{t("workorder.status_pending_review")}</SelectItem>
                <SelectItem value="InProgress">{t("workorder.status_in_progress")}</SelectItem>
                <SelectItem value="Open">{t("workorder.status_open")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("workorder.billing_withholding", "Withholding %")}</Label>
              <Input value={withholdingPct} onChange={(e) => setWithholdingPct(e.target.value)} inputMode="decimal" />
              <p className="text-xs text-muted-foreground mt-1">
                {t("workorder.billing_withholding_hint", "Applied only to rows with no net amount stored.")}
              </p>
            </div>
            <div>
              <Label>{t("workorder.billing_bill_to", "Bill to")}</Label>
              <AccountLookupSelect
                value={accountId}
                onChange={setAccountId}
                lookupUrl="/api/v1/lookup/accounts"
                placeholder={t("workorder.billing_ph_bill_to", "Company or account name")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("workorder.billing_bill_to_hint", "Leave empty to bill the unit owner.")}
              </p>
            </div>
          </div>

          <div>
            <Label>{t("workorder.billing_due_date", "Due date")}</Label>
            <DateInput value={dueDate} onChange={(v) => setDueDate(v ?? "")} />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={includePhotos} onCheckedChange={(v) => setIncludePhotos(v === true)} />
              {t("workorder.billing_include_photos", "Attach unit photos")}
            </label>
            {includePhotos && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">{t("workorder.billing_photos_per_unit", "Photos per unit")}</Label>
                <Input
                  className="w-20"
                  value={photosPerUnit}
                  onChange={(e) => setPhotosPerUnit(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            )}
          </div>

          <div className="border rounded-lg bg-muted/40 p-3 text-sm">
            {isFetching && !summary ? (
              t("common.loading")
            ) : summary && summary.totals.count > 0 ? (
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span>{t("workorder.billing_count", "Items")}: <strong>{summary.totals.count}</strong></span>
                <span>{t("workorder.col_cost")}: <strong>{money(summary.totals.cost)}</strong></span>
                <span>{t("workorder.billing_billed_total", "Billed")}: <strong>{money(summary.totals.billed)}</strong></span>
                {summary.totals.billable_count < summary.totals.count && (
                  <span className="text-amber-700">
                    {t("workorder.billing_already_invoiced", "{{n}} already invoiced", {
                      n: summary.totals.count - summary.totals.billable_count,
                    })}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{t("workorder.billing_no_rows", "No work orders match these filters.")}</span>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
            <Button variant="outline" onClick={preview} disabled={!summary || summary.totals.count === 0}>
              {t("workorder.billing_preview", "Preview")}
            </Button>
            <Button
              onClick={() => issue.mutate()}
              disabled={issue.isPending || !summary || summary.totals.billable_count === 0}
            >
              {t("workorder.billing_issue_invoice", "Create invoice")}
              {summary && summary.totals.billable_count > 0 ? ` · ${money(summary.totals.billable_amount)}` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </>
  );
}

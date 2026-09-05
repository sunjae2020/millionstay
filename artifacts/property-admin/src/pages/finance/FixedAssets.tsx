/** 재무 → 자산대장 — FIN-001 제11조.
 *
 *  대부분의 행은 지출결의가 승인될 때 초안으로 자동 생성된다. 이 화면이 할 일은
 *  그 초안에 **내용연수·설치 장소·관리 책임자**를 채워 확정하는 것이다. 초안으로
 *  남아 있는 자산은 감가상각이 시작되지 않은 것이나 마찬가지이므로 요약 줄 맨
 *  앞에 선다.
 *
 *  장부가액은 서버가 기준일에 계산해서 준다 — 저장된 값이 아니다. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Package } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";

type Asset = {
  id: number;
  asset_no: string;
  name: string;
  account_code: string | null;
  account_name: string | null;
  acquired_on: string;
  acquisition_cost: number;
  currency: string;
  useful_life_years: number;
  depreciation_method: string;
  space_name: string | null;
  custodian_name: string | null;
  location_note: string | null;
  source_txn_ref: string | null;
  status: string;
  notes: string | null;
  monthly_depreciation: number;
  elapsed_months: number;
  accumulated_depreciation: number;
  book_value: number;
  fully_depreciated: boolean;
};

type ListResponse = {
  data: Asset[];
  meta: { total: number; draft: number; active: number; acquisition_total: number; book_value_total: number; as_of: string };
};

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  disposed: "bg-muted text-muted-foreground",
};

export default function FixedAssetsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState({ useful_life_years: "5", location_note: "", name: "" });

  const { data } = useQuery<ListResponse>({
    queryKey: ["fixed-assets", filter],
    queryFn: async () => {
      const qs = filter === "all" ? "" : `?status=${filter}`;
      const res = await apiFetch(`/api/v1/fixed-assets${qs}`);
      if (!res.ok) throw new Error("Failed to load assets");
      return res.json();
    },
  });
  const assets = data?.data ?? [];
  const meta = data?.meta;
  const currency = assets[0]?.currency ?? "KRW";

  const save = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Record<string, unknown> }) => {
      const res = await apiFetch(`/api/v1/fixed-assets/${id}`, { method: "PUT", body: JSON.stringify(patch) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Failed");
      return body;
    },
    onSuccess: () => {
      toast({ title: t("asset.saved_toast") });
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["fixed-assets"] });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  function openEdit(a: Asset) {
    setEditing(a);
    setForm({
      useful_life_years: String(a.useful_life_years),
      location_note: a.location_note ?? "",
      name: a.name,
    });
  }

  const stats = [
    { key: "draft", value: String(meta?.draft ?? 0), tone: "text-amber-600 dark:text-amber-400" },
    { key: "active", value: String(meta?.active ?? 0), tone: "" },
    { key: "acquisition_total", value: formatMoney(meta?.acquisition_total ?? 0, currency), tone: "" },
    { key: "book_value_total", value: formatMoney(meta?.book_value_total ?? 0, currency), tone: "" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("asset.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t("asset.subtitle")}</p>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.key} className="flex flex-col gap-0.5 bg-card p-4">
              <span className="text-xs text-muted-foreground">{t(`asset.stat.${s.key}`)}</span>
              <span className={`text-xl font-semibold tabular-nums ${s.tone}`}>{s.value}</span>
            </div>
          ))}
        </div>
        {meta && <p className="text-xs text-muted-foreground">{t("asset.as_of", { date: formatDate(meta.as_of) })}</p>}

        <div className="flex flex-wrap gap-2 border-b pb-3">
          {["all", "draft", "active", "disposed"].map((k) => (
            <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 ${
                filter === k ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              }`}>
              {k === "all" ? t("asset.filter_all") : t(`asset.status.${k}`)}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">{t("asset.col.no")}</TableHead>
                <TableHead className="min-w-[180px]">{t("asset.col.name")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("asset.col.account")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("asset.col.acquired")}</TableHead>
                <TableHead className="whitespace-nowrap text-right">{t("asset.col.cost")}</TableHead>
                <TableHead className="whitespace-nowrap text-right">{t("asset.col.life")}</TableHead>
                <TableHead className="whitespace-nowrap text-right">{t("asset.col.accumulated")}</TableHead>
                <TableHead className="whitespace-nowrap text-right">{t("asset.col.book_value")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("asset.col.location")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("asset.col.status")}</TableHead>
                <TableHead className="whitespace-nowrap text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.id} className={a.status === "draft" ? "bg-amber-50/40 dark:bg-amber-950/10" : undefined}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-primary">{a.asset_no}</TableCell>
                  <TableCell>
                    <button className="text-left hover:underline" onClick={() => openEdit(a)}>{a.name}</button>
                    {a.source_txn_ref && (
                      <div className="font-mono text-xs text-muted-foreground">{a.source_txn_ref}</div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {a.account_code ? `${a.account_code} ${a.account_name ?? ""}` : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDate(a.acquired_on)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatMoney(a.acquisition_cost, a.currency)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                    {t("asset.years", { count: a.useful_life_years })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                    {formatMoney(a.accumulated_depreciation, a.currency)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums font-medium">
                    {formatMoney(a.book_value, a.currency)}
                    {a.fully_depreciated && <span className="ml-1 text-xs text-muted-foreground">{t("asset.fully_depreciated")}</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {a.space_name ?? a.location_note ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[a.status] ?? ""}`}>
                      {t(`asset.status.${a.status}`)}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {a.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                        <Check className="mr-1 h-3.5 w-3.5" />{t("asset.confirm")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {assets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                    <Package className="mx-auto mb-2 h-5 w-5 opacity-40" />
                    {t("asset.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("asset.confirm_title")}</DialogTitle>
            <DialogDescription>{editing?.asset_no}</DialogDescription>
          </DialogHeader>

          {editing?.notes && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              {editing.notes}
            </p>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("asset.col.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("asset.field.useful_life")}</Label>
              <Input type="number" min={0} max={100} value={form.useful_life_years}
                onChange={(e) => setForm({ ...form, useful_life_years: e.target.value })} />
              <p className="text-xs text-muted-foreground">{t("asset.field.useful_life_hint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("asset.field.location")}</Label>
              <Input value={form.location_note} onChange={(e) => setForm({ ...form, location_note: e.target.value })}
                placeholder={t("asset.field.location_hint")} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button disabled={save.isPending || form.name.trim() === ""}
              onClick={() => editing && save.mutate({
                id: editing.id,
                patch: {
                  name: form.name.trim(),
                  useful_life_years: Number(form.useful_life_years) || 0,
                  location_note: form.location_note.trim() || null,
                  status: "active",
                },
              })}>
              {t("asset.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

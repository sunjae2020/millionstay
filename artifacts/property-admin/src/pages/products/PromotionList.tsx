import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tag, Plus, Search, Pencil, Copy } from "lucide-react";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import {
  useListPromotions,
  getListPromotionsQueryKey,
  type ListPromotionsParams,
  type PromotionResponse,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Scheduled: "bg-yellow-100 text-yellow-700",
  Expired: "bg-gray-100 text-gray-700",
  Disabled: "bg-red-100 text-red-700",
  Draft: "bg-slate-100 text-slate-600",
};

const TERM_COLORS: Record<string, string> = {
  ShortTerm: "bg-sky-100 text-sky-700",
  MidTerm: "bg-violet-100 text-violet-700",
  LongTerm: "bg-amber-100 text-amber-700",
};
function formatDiscount(promo: { promotion_type?: string; discount_percentage?: number | null; discount_amount?: number | null; free_nights?: number | null }) {
  if (promo.promotion_type === "Percentage" && promo.discount_percentage != null) return `${promo.discount_percentage}%`;
  if (promo.promotion_type === "Fixed" && promo.discount_amount != null) return `$${promo.discount_amount.toFixed(0)}`;
  if (promo.promotion_type === "FreeNights" && promo.free_nights != null) return `${promo.free_nights} nights`;
  if (promo.promotion_type === "None") return "—";
  return "—";
}

function stayRange(promo: { min_stay_weeks?: number | null; max_stay_weeks?: number | null }) {
  const min = promo.min_stay_weeks;
  const max = promo.max_stay_weeks;
  if (min != null && max != null) return `${min}–${max}w`;
  if (min != null && max == null) return `${min}w+`;
  return "—";
}

export default function PromotionList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("_all");
  const [termType, setTermType] = useState("_all");
  const [cloningId, setCloningId] = useState<number | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const TERM_LABELS: Record<string, string> = {
    ShortTerm: t("promotion.term_short"),
    MidTerm: t("promotion.term_mid"),
    LongTerm: t("promotion.term_long"),
  };
  const FREQ_LABELS: Record<string, string> = {
    Weekly: t("common.weekly"),
    Biweekly: t("common.biweekly"),
    Monthly: t("common.monthly"),
  };

  async function handleClone(p: any) {
    setCloningId(p.id);
    try {
      const { id: _id, created_at, updated_at, code, ...rest } = p;
      const res = await apiFetch("/api/v1/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, name: `Copy of ${p.name}`, status: "Draft", code: null }),
      });
      if (!res.ok) throw new Error("Clone failed");
      const cloned = await res.json();
      navigate(`/products/promotions/${cloned.id}`);
    } finally {
      setCloningId(null);
    }
  }

  const params: ListPromotionsParams & { deleted?: string } = {
    search: search || undefined,
    status: status !== "_all" ? status : undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const { data: promotions = [], isLoading } = useListPromotions(params, {
    query: { queryKey: getListPromotionsQueryKey(params) },
  });

  const filtered = termType !== "_all" ? promotions.filter(p => p.term_type === termType) : promotions;

  const columns: ColumnDef<PromotionResponse>[] = useMemo(
    () => [
      {
        key: "name",
        header: "promotion.col_name",
        hideable: false,
        cell: (p) => (
          <Link href={`/products/promotions/${p.id}`} className="text-primary hover:underline font-medium">{p.name}</Link>
        ),
      },
      {
        key: "term_type",
        header: "promotion.col_term",
        cell: (p) => (
          <Badge className={TERM_COLORS[p.term_type ?? ""] ?? "bg-gray-100 text-gray-600"}>{TERM_LABELS[p.term_type ?? ""] ?? p.term_type}</Badge>
        ),
      },
      {
        key: "discount",
        header: "promotion.col_discount",
        sortable: false,
        cell: (p) => <span className="text-sm font-mono font-semibold">{formatDiscount(p)}</span>,
      },
      {
        key: "min_stay_weeks",
        header: "promotion.col_stay",
        cell: (p) => <span className="text-sm text-muted-foreground">{stayRange(p)}</span>,
      },
      {
        key: "billing_frequency",
        header: "promotion.col_billing",
        cell: (p) => <span className="text-sm text-muted-foreground">{FREQ_LABELS[p.billing_frequency ?? ""] ?? (p.billing_frequency ?? "—")}</span>,
      },
      {
        key: "code",
        header: "promotion.col_code",
        cell: (p) => (p.code ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{p.code}</code> : "—"),
      },
      {
        key: "status",
        header: "promotion.col_status",
        cell: (p) => <Badge className={STATUS_COLORS[p.status ?? ""] ?? "bg-gray-100 text-gray-700"}>{p.status}</Badge>,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (p) => (
          <div className="flex items-center gap-1 justify-end">
            <Link href={`/products/promotions/${p.id}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
            </Link>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              disabled={cloningId === p.id}
              onClick={() => handleClone(p)}
              title={t("promotion.clone_title")}
            >
              <Copy className={`h-3.5 w-3.5 ${cloningId === p.id ? "animate-pulse" : ""}`} />
            </Button>
          </div>
        ),
      },
    ],
    [t, cloningId],
  );

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Tag className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">{t("nav.promotion")}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {isLoading ? t("common.loading") : `${filtered.length} ${t("nav.promotion")}`}
            </p>
          </div>
          <Link href="/products/promotions/new">
            <Button><Plus className="h-4 w-4 mr-2" />{t("common.new")} {t("nav.promotion")}</Button>
          </Link>
        </div>

        <DataTable
          tableKey="promotions"
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          rowKey={(p) => p.id}
          emptyText={t("promotion.no_promotions")}
          selection={{
            enable: true,
            resource: "promotions",
            onChanged: () => qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t("promotion.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={termType} onValueChange={setTermType}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={t("promotion.all_terms")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("promotion.all_terms")}</SelectItem>
                  <SelectItem value="ShortTerm">{t("promotion.term_short")}</SelectItem>
                  <SelectItem value="MidTerm">{t("promotion.term_mid")}</SelectItem>
                  <SelectItem value="LongTerm">{t("promotion.term_long")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t("promotion.all_statuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("promotion.all_statuses")}</SelectItem>
                  <SelectItem value="Draft">{t("promotion.status_draft")}</SelectItem>
                  <SelectItem value="Scheduled">{t("promotion.status_scheduled")}</SelectItem>
                  <SelectItem value="Active">{t("common.active")}</SelectItem>
                  <SelectItem value="Expired">{t("promotion.status_expired")}</SelectItem>
                  <SelectItem value="Disabled">{t("promotion.status_disabled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
      </div>
    </Layout>
  );
}

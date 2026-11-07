import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Pencil, Archive } from "lucide-react";
import { DataTable, useServerList, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";

const PROMO_PERIOD: Record<number, string> = {
  1: "Weekly",
  2: "Biweekly",
  3: "Monthly",
  4: "Daily",
};

function fmtDate(val: string | null | undefined): string {
  return formatDate(val);
}

type Product = {
  id: number;
  name: string;
  item_description: string | null;
  price: number | null;
  currency: string;
  space_name: string | null;
  space_id: number | null;
  promotion_id: number | null;
  promotion_name: string | null;
  min_contract_period: number | null;
  min_contract_period_unit: string | null;
  packed_services: string[];
  display_on_booking_page: boolean;
  status: string;
  created_at: string | null;
  promotion_valid_from: string | null;
  promotion_valid_to: string | null;
};

type Promotion = { id: number; display: string };

/** 서버가 정렬할 수 있는 컬럼(api-server routes/product-catalog.ts 의 PRODUCT_SORT 와 1:1). */
const SORTABLE_KEYS = ["name", "price", "currency", "promotion_id", "status", "created_at", "updated_at"];

async function fetchPromotions(): Promise<Promotion[]> {
  const res = await apiFetch("/api/v1/lookup/promotions");
  if (!res.ok) return [];
  return res.json();
}

export default function ProductList() {
  const { t } = useTranslation();
  const { currencyPosition } = useBrand();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("_all");
  const [promotionFilter, setPromotionFilter] = useState("_all");
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const { toast } = useToast();

  const filters = {
    q: q || undefined,
    promotion_id: promotionFilter !== "_all" ? promotionFilter : undefined,
    status: statusFilter !== "_all" ? statusFilter : undefined,
    deleted: showDeleted ? "only" : undefined,
  };
  const { rows: products, total, isLoading, server, invalidate } = useServerList<Product>("/api/v1/accommodations", {
    filters,
    sortableKeys: SORTABLE_KEYS,
    defaultSort: { key: "name", dir: "asc" },
  });

  const { data: promotions = [] } = useQuery<Promotion[]>({
    queryKey: ["lookup-promotions"],
    queryFn: fetchPromotions,
  });

  // 단건 삭제 = 보관(소프트 삭제). 영구 삭제·복원은 DataTable 선택 툴바가 맡는다.
  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/v1/accommodations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Archive failed");
    },
    onSuccess: () => {
      invalidate();
      toast({ title: t("product.archived") });
      setArchiveTarget(null);
    },
    onError: () => toast({ title: t("common.error"), description: t("product.archive_fail"), variant: "destructive" }),
  });

  const columns: ColumnDef<Product>[] = useMemo(
    () => [
      {
        key: "name",
        header: "product.col_name",
        hideable: false,
        defaultWidth: 220,
        editable: { type: "text", getValue: (p) => p.name },
        cell: (p) => (
          <Link href={`/products/products/${p.id}`} className="text-primary hover:underline line-clamp-2 font-medium">
            {p.name}
          </Link>
        ),
      },
      {
        key: "promotion_name",
        header: "product.col_promotion",
        cell: (p) => (
          <div className="max-w-[200px]">
            <div className="text-xs text-muted-foreground truncate">{p.promotion_name ?? "—"}</div>
            {p.promotion_id != null && PROMO_PERIOD[p.promotion_id] && (
              <div className="text-[10px] text-muted-foreground/60 mt-0.5">{PROMO_PERIOD[p.promotion_id]}</div>
            )}
            {(p.promotion_valid_from || p.promotion_valid_to) && (
              <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                {fmtDate(p.promotion_valid_from)} – {fmtDate(p.promotion_valid_to)}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "promotion_id",
        header: "product.col_unit",
        align: "right",
        cell: (p) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {p.promotion_id === 4 ? "1 Day" : "1 Week"}
          </span>
        ),
      },
      {
        key: "price",
        header: "product.col_price",
        align: "right",
        editable: { type: "number", getValue: (p) => p.price ?? null, min: 0, step: 0.01 },
        cell: (p) => (
          <span className="text-xs tabular-nums font-medium text-primary">
            {p.price != null ? formatMoney(p.price, p.currency, currencyPosition) : "—"}
          </span>
        ),
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
            <Link href={`/products/products/${p.id}`}>
              <button className="p-1.5 rounded hover:bg-muted transition-colors">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </Link>
            {!showDeleted && (
              <button
                className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                title={t("common.archive")}
                onClick={() => setArchiveTarget(p)}
              >
                <Archive className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [t, currencyPosition, showDeleted],
  );

  return (
    <Layout>
      <PageHeader
        title={t("nav.accommodation")}
        subtitle={`${total} ${t("common.total")}`}
        actions={
          <Link href="/products/products/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("common.new")} {t("nav.products")}
            </Button>
          </Link>
        }
      />

      <div className="p-6">
        <DataTable
          server={server}
          tableKey="accommodation-products"
          columns={columns}
          data={products}
          isLoading={isLoading}
          rowKey={(p) => p.id}
          emptyText={t("product.no_products")}
          selection={{
            enable: true,
            resource: "accommodations",
            onChanged: () => invalidate(),
          }}
          editing={{ resource: "accommodations", onEdited: () => invalidate() }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={t("product.search_placeholder")}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <Select value={promotionFilter} onValueChange={setPromotionFilter}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder={t("product.all_promotions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("product.all_promotions")}</SelectItem>
                  {promotions.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.display}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t("product.all_statuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("product.all_statuses")}</SelectItem>
                  <SelectItem value="Active">{t("common.active")}</SelectItem>
                  <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
                  <SelectItem value="Archived">{t("product.status_archived")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
      </div>

      <AlertDialog open={archiveTarget !== null} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("product.archive_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("product.archive_desc", { name: archiveTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
            >
              {t("common.archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

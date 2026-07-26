import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
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

async function fetchProducts(q: string, promotionId: string): Promise<Product[]> {
  const params = new URLSearchParams({ limit: "200" });
  if (q) params.set("q", q);
  if (promotionId && promotionId !== "_all") params.set("promotion_id", promotionId);
  const res = await apiFetch(`/api/v1/accommodations?${params}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

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
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["accommodation-products", q, promotionFilter],
    queryFn: () => fetchProducts(q, promotionFilter),
  });

  const { data: promotions = [] } = useQuery<Promotion[]>({
    queryKey: ["lookup-promotions"],
    queryFn: fetchPromotions,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/v1/accommodations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accommodation-products"] });
      toast({ title: t("product.delete_title") });
      setDeleteId(null);
    },
    onError: () => toast({ title: t("common.error"), description: t("product.delete_fail"), variant: "destructive" }),
  });

  const filtered = products.filter((p) => {
    if (statusFilter !== "_all" && p.status !== statusFilter) return false;
    return true;
  });

  const deleteTarget = products.find(p => p.id === deleteId);

  const columns: ColumnDef<Product>[] = useMemo(
    () => [
      {
        key: "name",
        header: "product.col_name",
        hideable: false,
        defaultWidth: 220,
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
            <button
              className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
              onClick={() => setDeleteId(p.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ),
      },
    ],
    [t, currencyPosition],
  );

  return (
    <Layout>
      <PageHeader
        title={t("nav.accommodation")}
        subtitle={`${filtered.length} of ${products.length} ${t("common.total")}`}
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
          tableKey="accommodation-products"
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          rowKey={(p) => p.id}
          defaultSort={{ key: "name", dir: "asc" }}
          emptyText={t("product.no_products")}
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

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("product.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("product.delete_desc_1")} <strong>{deleteTarget?.name}</strong>? {t("common.cannot_undo")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

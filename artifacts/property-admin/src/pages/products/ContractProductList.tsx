import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListContractProducts,
  getListContractProductsQueryKey,
  type ListContractProductsParams,
  type ContractProduct,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Package, Tag } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-red-100 text-red-700",
};
const TERM_COLORS: Record<string, string> = {
  ShortTerm: "bg-sky-100 text-sky-700",
  MidTerm: "bg-violet-100 text-violet-700",
  LongTerm: "bg-amber-100 text-amber-700",
};
const TERM_LABELS: Record<string, string> = {
  ShortTerm: "Short-term",
  MidTerm: "Mid-term",
  LongTerm: "Long-term",
};

const PRODUCT_TYPES = ["Room", "Suite", "Apartment", "House", "Studio", "Service"];

export default function ContractProductList() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("_all");
  const [productType, setProductType] = useState("_all");
  const [termType, setTermType] = useState("_all");
  const [showDeleted, setShowDeleted] = useState(false);
  const qc = useQueryClient();

  const params: ListContractProductsParams & { deleted?: string } = {
    q: q || undefined,
    status: status === "_all" ? undefined : status,
    product_type: productType === "_all" ? undefined : productType,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const { data: products, isLoading } = useListContractProducts(params, {
    query: { queryKey: getListContractProductsQueryKey(params) },
  });

  const filtered = termType !== "_all" ? (products ?? []).filter(p => p.term_type === termType) : (products ?? []);

  const columns: ColumnDef<ContractProduct>[] = useMemo(
    () => [
      {
        key: "name",
        header: "contract_product.col_name",
        hideable: false,
        cell: (p) => (
          <div>
            <Link href={`/products/contract-products/${p.id}`} className="text-primary hover:underline font-medium">
              {p.name}
            </Link>
            <div className="text-xs text-muted-foreground">{p.product_type}</div>
          </div>
        ),
      },
      {
        key: "term_type",
        header: "contract_product.col_term",
        cell: (p) =>
          p.term_type ? (
            <Badge className={`${TERM_COLORS[p.term_type] ?? "bg-gray-100 text-gray-600"} text-[10px] px-1.5 py-0`}>
              {TERM_LABELS[p.term_type] ?? p.term_type}
            </Badge>
          ) : "—",
      },
      {
        key: "space_name",
        header: "contract_product.col_space",
        cell: (p) => <span className="text-sm text-muted-foreground">{p.space_name ?? "—"}</span>,
      },
      {
        key: "promotion_name",
        header: "contract_product.col_promotion",
        cell: (p) =>
          p.promotion_name ? (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Tag className="h-3 w-3" />{p.promotion_name}
            </span>
          ) : "—",
      },
      {
        key: "weekly_rate",
        header: "contract_product.col_weekly_rate",
        cell: (p) => (
          <span className="text-sm font-mono">{p.weekly_rate != null ? `$${p.weekly_rate.toFixed(0)}/wk` : "—"}</span>
        ),
      },
      {
        key: "effective_weekly_rate",
        header: "contract_product.col_eff_rate",
        cell: (p) => (
          <span className="text-sm font-mono font-semibold text-primary">
            {p.effective_weekly_rate != null && p.effective_weekly_rate !== p.weekly_rate
              ? `$${p.effective_weekly_rate.toFixed(0)}/wk`
              : (p.weekly_rate != null ? `$${p.weekly_rate.toFixed(0)}/wk` : "—")}
          </span>
        ),
      },
      {
        key: "billing_frequency",
        header: "contract_product.col_billing",
        cell: (p) => <span className="text-sm text-muted-foreground">{p.billing_frequency ?? "—"}</span>,
      },
      {
        key: "status",
        header: "contract_product.col_status",
        cell: (p) => <Badge className={statusColors[p.status] ?? "bg-gray-100 text-gray-700"}>{p.status}</Badge>,
      },
    ],
    [t],
  );

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{t("nav.contract_product")}</h1>
              <p className="text-sm text-muted-foreground">{filtered.length} {t("nav.products")}</p>
            </div>
          </div>
          <Link href="/products/contract-products/new">
            <Button className="bg-primary hover:bg-[#d4561a] text-white"><Plus className="h-4 w-4 mr-2" />{t("common.new")} {t("nav.products")}</Button>
          </Link>
        </div>

        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t("contract_product.search_placeholder")} value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select value={termType} onValueChange={setTermType}>
            <SelectTrigger className="w-44"><SelectValue placeholder={t("contract_product.all_terms")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("contract_product.all_terms")}</SelectItem>
              <SelectItem value="ShortTerm">{t("contract_product.term_short")}</SelectItem>
              <SelectItem value="MidTerm">{t("contract_product.term_mid")}</SelectItem>
              <SelectItem value="LongTerm">{t("contract_product.term_long")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder={t("contract_product.all_statuses")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("contract_product.all_statuses")}</SelectItem>
              <SelectItem value="Draft">{t("contract_product.status_draft")}</SelectItem>
              <SelectItem value="Active">{t("common.active")}</SelectItem>
              <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
              <SelectItem value="Archived">{t("contract_product.status_archived")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger className="w-40"><SelectValue placeholder={t("contract_product.all_types")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("contract_product.all_types")}</SelectItem>
              {PRODUCT_TYPES.map(t_val => <SelectItem key={t_val} value={t_val}>{t_val}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <DataTable
          tableKey="contract-products"
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          rowKey={(p) => p.id}
          emptyText={t("contract_product.no_products")}
          selection={{
            enable: true,
            resource: "contract-products",
            onChanged: () => qc.invalidateQueries({ queryKey: getListContractProductsQueryKey() }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
        />
      </div>
    </Layout>
  );
}

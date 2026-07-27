import { useMemo, useState } from "react";
import { Link } from "wouter";
import { formatDate as fmtDate } from "@/lib/date";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, ImageOff, Lock } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";

const CATEGORY_COLORS: Record<string, string> = {
  presale: "bg-indigo-100 text-indigo-700",
  sale: "bg-emerald-100 text-emerald-700",
};
const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-700",
  reserved: "bg-amber-100 text-amber-700",
  sold: "bg-gray-200 text-gray-600",
};

// Show the best-available copy for the admin table: prefer Korean (Metheim is a
// Korean building), then English, then any filled locale.
function pickCopy(translations: any, field: string): string {
  const t = translations ?? {};
  for (const lang of ["ko", "en", ...Object.keys(t)]) {
    const v = t?.[lang]?.[field];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "";
}

async function fetchListings(params: Record<string, string>) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
  const res = await apiFetch(`/api/v1/sale-listings?${qs}`);
  if (!res.ok) throw new Error("Failed to load listings");
  const json = await res.json();
  return json.data ?? [];
}

export default function SaleListingsList() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [category, setCategory] = useState("_all");
  const [status, setStatus] = useState("_all");

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["sale-listings", category, status],
    queryFn: () => fetchListings({
      category: category !== "_all" ? category : "",
      status: status !== "_all" ? status : "",
    }),
  });

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: "cover_image",
        header: "listings.col_image",
        sortable: false,
        hideable: false,
        defaultWidth: 80,
        cell: (row) => (
          <Link href={`/content/listings/${row.id}`}>
            {row.cover_image ? (
              <img src={row.cover_image} alt="" className="w-16 h-12 rounded object-cover border" />
            ) : (
              <div className="w-16 h-12 rounded border bg-muted flex items-center justify-center text-muted-foreground/40">
                <ImageOff className="h-4 w-4" />
              </div>
            )}
          </Link>
        ),
      },
      {
        key: "title",
        header: "listings.col_title",
        hideable: false,
        defaultWidth: 260,
        sortAccessor: (r) => pickCopy(r.translations, "title"),
        cell: (row) => (
          <div className="font-medium">
            <Link href={`/content/listings/${row.id}`} className="text-primary hover:underline line-clamp-1">
              {pickCopy(row.translations, "title") || t("listings.untitled")}
            </Link>
            {pickCopy(row.translations, "location") && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{pickCopy(row.translations, "location")}</p>
            )}
          </div>
        ),
      },
      {
        key: "category",
        header: "listings.col_category",
        sortAccessor: (r) => r.category,
        editable: {
          type: "select",
          getValue: (r) => r.category,
          options: [
            { value: "presale", label: t("listings.category_presale") },
            { value: "sale", label: t("listings.category_sale") },
          ],
        },
        cell: (row) => (
          <Badge className={`${CATEGORY_COLORS[row.category] ?? "bg-gray-100 text-gray-600"} text-[10px] px-1.5 py-0`}>
            {t(`listings.category_${row.category}`, { defaultValue: row.category })}
          </Badge>
        ),
      },
      {
        key: "status",
        header: "common.status",
        sortAccessor: (r) => r.status,
        editable: {
          type: "select",
          getValue: (r) => r.status,
          options: [
            { value: "available", label: t("listings.status_available") },
            { value: "reserved", label: t("listings.status_reserved") },
            { value: "sold", label: t("listings.status_sold") },
          ],
        },
        cell: (row) => (
          <Badge className={`${STATUS_COLORS[row.status] ?? "bg-gray-100 text-gray-600"} text-[10px] px-1.5 py-0`}>
            {t(`listings.status_${row.status}`, { defaultValue: row.status })}
          </Badge>
        ),
      },
      {
        key: "price_label",
        header: "listings.col_price",
        sortAccessor: (r) => pickCopy(r.translations, "price_label"),
        cell: (row) => (
          <span className="text-sm text-muted-foreground">{pickCopy(row.translations, "price_label") || "—"}</span>
        ),
      },
      {
        key: "published",
        header: "listings.col_published",
        sortAccessor: (r) => (r.published ? 1 : 0),
        editable: { type: "boolean", getValue: (r) => !!r.published },
        cell: (row) =>
          row.published ? (
            <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">{t("listings.published")}</Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0">{t("listings.draft")}</Badge>
          ),
      },
      {
        key: "created_at",
        header: "listings.col_created",
        sortAccessor: (r) => r.created_at,
        cell: (row) => <span className="text-sm text-muted-foreground">{fmtDate(row.created_at)}</span>,
      },
    ],
    [t],
  );

  return (
    <Layout>
      <PageHeader
        title={<><Building2 className="h-5 w-5" />{t("listings.title")}</>}
        subtitle={t("listings.total", { count: listings.length })}
        actions={
          <div className="flex gap-2">
            <Link href="/content/sale-inquiries">
              <Button variant="outline"><Lock className="h-4 w-4 mr-2" />{t("listings.inquiries", "Inquiries")}</Button>
            </Link>
            <Link href="/content/listings/new">
              <Button><Plus className="h-4 w-4 mr-2" />{t("listings.new")}</Button>
            </Link>
          </div>
        }
      />

      <div className="p-6">
        <DataTable
          tableKey="sale-listings"
          columns={columns}
          data={listings}
          isLoading={isLoading}
          rowKey={(row) => row.id}
          editing={{ resource: "sale-listings", onEdited: () => qc.invalidateQueries({ queryKey: ["sale-listings"] }) }}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-40"><SelectValue placeholder={t("listings.col_category")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("listings.all_categories")}</SelectItem>
                  <SelectItem value="presale">{t("listings.category_presale")}</SelectItem>
                  <SelectItem value="sale">{t("listings.category_sale")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("listings.all_status")}</SelectItem>
                  <SelectItem value="available">{t("listings.status_available")}</SelectItem>
                  <SelectItem value="reserved">{t("listings.status_reserved")}</SelectItem>
                  <SelectItem value="sold">{t("listings.status_sold")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          emptyText={
            <div className="flex flex-col items-center gap-3">
              <Building2 className="h-8 w-8 text-muted-foreground/40" />
              <span>
                {t("listings.empty")}{" "}
                <Link href="/content/listings/new" className="text-primary hover:underline">
                  {t("listings.create_first")}
                </Link>
              </span>
            </div>
          }
        />
      </div>
    </Layout>
  );
}

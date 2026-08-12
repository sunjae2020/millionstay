import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListContracts,
  getListContractsQueryKey,
  type ListContractsParams,
  type Contract,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { useDocumentRowActions } from "@/components/DocumentRowActions";
import { apiJson } from "@/lib/apiFetch";
import { LeaseAmountCell, monthlyEquivalent } from "@/components/LeaseAmountCell";

/** 계약 구분 / 서식 코드 → i18n 키. 이관 데이터는 자유 문자열이라 매핑이 없으면 값 그대로 보여준다. */
const CATEGORY_LABELS: Record<string, string> = {
  sale: "contract.cat_sale",
  jeonse: "contract.cat_jeonse",
  wolse: "contract.cat_wolse",
  short_term: "contract.cat_short",
  long_term: "contract.cat_long",
};
const LEASE_FORM_LABELS: Record<string, string> = {
  general: "contract.form_general",
  housing_standard: "contract.form_housing_standard",
  mlt_standard: "contract.form_mlt_standard",
};

type ContractFacets = { years: string[]; categories: string[]; lease_forms: string[] };

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Sent: "bg-blue-100 text-blue-700",
  Signed: "bg-purple-100 text-purple-700",
  Active: "bg-green-100 text-green-700",
  Expired: "bg-orange-100 text-orange-700",
  Terminated: "bg-red-100 text-red-700",
};

export default function ContractList() {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("_all");
  const [category, setCategory] = useState("_all");
  const [leaseForm, setLeaseForm] = useState("_all");
  const [leaseMode, setLeaseMode] = useState("_all");
  const [year, setYear] = useState("_all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const qc = useQueryClient();

  const { data: facets } = useQuery<ContractFacets>({
    queryKey: ["contract-facets", showDeleted],
    queryFn: () => apiJson<ContractFacets>(`/api/v1/contracts/facets${showDeleted ? "?deleted=only" : ""}`),
  });

  const params: ListContractsParams & Record<string, string | undefined> = {
    q: q || undefined,
    status: status === "_all" ? undefined : status,
    contract_category: category === "_all" ? undefined : category,
    lease_form: leaseForm === "_all" ? undefined : leaseForm,
    lease_mode: leaseMode === "_all" ? undefined : leaseMode,
    year: year === "_all" ? undefined : year,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const hasFilters =
    !!q || status !== "_all" || category !== "_all" || leaseForm !== "_all" ||
    leaseMode !== "_all" || year !== "_all" || !!dateFrom || !!dateTo;
  const resetFilters = () => {
    setQ(""); setStatus("_all"); setCategory("_all");
    setLeaseForm("_all"); setLeaseMode("_all"); setYear("_all"); setDateFrom(""); setDateTo("");
  };
  const categoryOptions = facets?.categories ?? [];
  const leaseFormOptions = facets?.lease_forms ?? [];
  const yearOptions = facets?.years ?? [];

  const { data: contracts, isLoading } = useListContracts(params, {
    query: { queryKey: getListContractsQueryKey(params) },
  });

  const { documentActionsColumn, documentPreview } = useDocumentRowActions<Contract>((c) => ({
    ref: c.contract_ref,
    typeLabel: t("nav.contract"),
    pdfPath: `/api/v1/contracts/${c.id}/pdf`,
    emailPath: `/api/v1/contracts/${c.id}/email`,
    detailUrl: `/contracts/contracts/${c.id}`,
  }));

  const columns: ColumnDef<Contract>[] = useMemo(
    () => [
      {
        key: "contract_ref",
        header: "contract.col_ref",
        hideable: false,
        cell: (c) => (
          <Link href={`/contracts/contracts/${c.id}`} className="text-primary hover:underline font-medium font-mono">
            {c.contract_ref}
          </Link>
        ),
      },
      {
        key: "tenant_name",
        header: "contract.col_tenant",
        cell: (c) => <span className="text-sm">{c.tenant_name ?? "—"}</span>,
      },
      {
        key: "space_name",
        header: "contract.col_space",
        cell: (c) => <span className="text-sm text-muted-foreground">{c.space_name ?? "—"}</span>,
      },
      {
        key: "contract_product_name",
        header: "contract.col_product",
        cell: (c) => <span className="text-sm text-muted-foreground">{c.contract_product_name ?? "—"}</span>,
      },
      {
        key: "start_date",
        header: "contract.col_start",
        cell: (c) => <span className="text-sm">{formatDate(c.start_date)}</span>,
      },
      {
        key: "end_date",
        header: "contract.col_end",
        cell: (c) => <span className="text-sm">{formatDate(c.end_date)}</span>,
      },
      {
        // 장기/단기를 한 칸에 — 유형 배지 + 그 유형의 문법으로 쓴 금액.
        // 정렬은 월 환산액으로 통일해 유형이 달라도 줄 세울 수 있게 한다.
        key: "amount",
        header: "contract.col_amount",
        defaultWidth: 260,
        cell: (c) => <LeaseAmountCell record={c as any} />,
        sortAccessor: (c) => monthlyEquivalent(c as any),
        csv: (c) => monthlyEquivalent(c as any),
      },
      {
        key: "status",
        header: "contract.col_status",
        cell: (c) => (
          <Badge className={statusColors[c.status] ?? "bg-gray-100 text-gray-700"}>
            {t(`contract.status_${c.status.toLowerCase()}`)}
          </Badge>
        ),
      },
      documentActionsColumn,
    ],
    [t, currency, currencyPosition, documentActionsColumn],
  );

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t("nav.contract")}</h1>
            <p className="text-sm text-muted-foreground">{contracts?.length ?? 0} {t("common.total")}</p>
          </div>
          <Link href="/contracts/contracts/new">
            <Button><Plus className="h-4 w-4 mr-2" />{t("contract.new")}</Button>
          </Link>
        </div>

        <DataTable
          tableKey="contracts"
          columns={columns}
          data={contracts ?? []}
          isLoading={isLoading}
          rowKey={(c) => c.id}
          emptyText={t("contract.no_contracts")}
          selection={{
            enable: true,
            resource: "contracts",
            onChanged: () => qc.invalidateQueries({ queryKey: getListContractsQueryKey() }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={t("contract.search_placeholder")}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t("contract.all_statuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("contract.all_statuses")}</SelectItem>
                  <SelectItem value="Draft">{t("contract.status_draft")}</SelectItem>
                  <SelectItem value="Sent">{t("contract.status_sent")}</SelectItem>
                  <SelectItem value="Signed">{t("contract.status_signed")}</SelectItem>
                  <SelectItem value="Active">{t("contract.status_active")}</SelectItem>
                  <SelectItem value="Expired">{t("contract.status_expired")}</SelectItem>
                  <SelectItem value="Terminated">{t("contract.status_terminated")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={leaseMode} onValueChange={setLeaseMode}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder={t("lease.all_modes")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("lease.all_modes")}</SelectItem>
                  <SelectItem value="long">{t("lease.mode_long")}</SelectItem>
                  <SelectItem value="short">{t("lease.mode_short")}</SelectItem>
                </SelectContent>
              </Select>
              {categoryOptions.length > 0 && (
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t("contract.all_categories")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">{t("contract.all_categories")}</SelectItem>
                    {categoryOptions.map(c => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c] ? t(CATEGORY_LABELS[c]) : c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {leaseFormOptions.length > 0 && (
                <Select value={leaseForm} onValueChange={setLeaseForm}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder={t("contract.all_forms")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">{t("contract.all_forms")}</SelectItem>
                    {leaseFormOptions.map(f => (
                      <SelectItem key={f} value={f}>
                        {LEASE_FORM_LABELS[f] ? t(LEASE_FORM_LABELS[f]) : f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {yearOptions.length > 0 && (
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder={t("contract.all_years")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">{t("contract.all_years")}</SelectItem>
                    {yearOptions.map(y => (
                      <SelectItem key={y} value={y}>{t("contract.year_value", { year: y })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  className="w-36"
                  aria-label={t("contract.filter_date_from")}
                  title={t("contract.filter_date_from")}
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
                <span className="text-muted-foreground text-sm">~</span>
                <Input
                  type="date"
                  className="w-36"
                  aria-label={t("contract.filter_date_to")}
                  title={t("contract.filter_date_to")}
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <X className="h-4 w-4 mr-1" />{t("contract.filter_reset")}
                </Button>
              )}
            </div>
          }
        />
      </div>

      {documentPreview}
    </Layout>
  );
}

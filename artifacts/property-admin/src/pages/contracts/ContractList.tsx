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
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";

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
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("_all");
  const [showDeleted, setShowDeleted] = useState(false);
  const qc = useQueryClient();

  const params: ListContractsParams & { deleted?: string } = {
    q: q || undefined,
    status: status === "_all" ? undefined : status,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const { data: contracts, isLoading } = useListContracts(params, {
    query: { queryKey: getListContractsQueryKey(params) },
  });

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
        cell: (c) => <span className="text-sm">{c.start_date ?? "—"}</span>,
      },
      {
        key: "end_date",
        header: "contract.col_end",
        cell: (c) => <span className="text-sm">{c.end_date ?? "—"}</span>,
      },
      {
        key: "weekly_rate",
        header: "contract.col_weekly_rate",
        cell: (c) => <span className="text-sm">{c.weekly_rate != null ? `$${c.weekly_rate}/wk` : "—"}</span>,
      },
      {
        key: "total_rent",
        header: "contract.col_total_rent",
        cell: (c) => <span className="text-sm">{c.total_rent != null ? `$${c.total_rent.toLocaleString()}` : "—"}</span>,
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
    ],
    [t],
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
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={t("contract.search_placeholder")}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40">
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
            </div>
          }
        />
      </div>
    </Layout>
  );
}

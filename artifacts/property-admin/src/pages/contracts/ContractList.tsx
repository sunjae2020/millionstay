import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListContracts } from "@workspace/api-client-react";
import { Plus, Search } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";

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

  const { data: contracts } = useListContracts({
    q: q || undefined,
    status: status === "_all" ? undefined : status,
  });

  const pagination = usePagination(contracts ?? []);

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

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
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

        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("contract.col_ref")}</TableHead>
                <TableHead>{t("contract.col_tenant")}</TableHead>
                <TableHead>{t("contract.col_space")}</TableHead>
                <TableHead>{t("contract.col_product")}</TableHead>
                <TableHead>{t("contract.col_start")}</TableHead>
                <TableHead>{t("contract.col_end")}</TableHead>
                <TableHead>{t("contract.col_weekly_rate")}</TableHead>
                <TableHead>{t("contract.col_total_rent")}</TableHead>
                <TableHead>{t("contract.col_status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!contracts || contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                    {t("contract.no_contracts")}
                  </TableCell>
                </TableRow>
              ) : pagination.paginatedItems.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/contracts/contracts/${c.id}`} className="text-[#E8621A] hover:underline font-medium font-mono">
                      {c.contract_ref}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{c.tenant_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.space_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.contract_product_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.start_date ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.end_date ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {c.weekly_rate != null ? `$${c.weekly_rate}/wk` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.total_rent != null ? `$${c.total_rent.toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[c.status] ?? "bg-gray-100 text-gray-700"}>
                      {t(`contract.status_${c.status.toLowerCase()}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>
    </Layout>
  );
}

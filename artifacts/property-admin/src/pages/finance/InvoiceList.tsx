import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useListInvoices } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
  Void: "bg-red-100 text-red-600",
};

export default function InvoiceList() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("_all");

  const { data: invoicesRaw = [] } = useListInvoices({
    q: q || undefined,
    status: status === "_all" ? undefined : status,
  });

  const pagination = usePagination(invoicesRaw);

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.invoice")}</h1>
            <p className="text-sm text-muted-foreground">{invoicesRaw.length} {t("common.total")}</p>
          </div>
          <Button onClick={() => navigate("/finance/invoices/new")}>
            <Plus className="h-4 w-4 mr-1" />
            {t("invoice.new")}
          </Button>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Input
              placeholder={t("invoice.search_placeholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-4"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("invoice.all_statuses")}</SelectItem>
              <SelectItem value="Draft">{t("invoice.status_draft")}</SelectItem>
              <SelectItem value="Sent">{t("invoice.status_sent")}</SelectItem>
              <SelectItem value="Paid">{t("invoice.status_paid")}</SelectItem>
              <SelectItem value="Void">{t("invoice.status_void")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("invoice.col_ref")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("invoice.col_booking")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("invoice.col_contract")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("invoice.col_account")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("invoice.col_amount")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("invoice.col_due_date")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("invoice.col_status")}</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                  onClick={() => navigate(`/finance/invoices/${inv.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-[#E8621A]">{inv.invoice_ref}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(inv as any).booking_ref ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(inv as any).contract_ref ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(inv as any).account_name ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">
                    ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {inv.currency}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.due_date ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {t(`invoice.status_${inv.status.toLowerCase()}`)}
                    </span>
                  </td>
                </tr>
              ))}
              {invoicesRaw.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("invoice.no_invoices")}</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>
    </Layout>
  );
}

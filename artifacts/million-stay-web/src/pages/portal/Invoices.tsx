import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { listMyInvoices } from "@/lib/api";

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  Paid: { label: "Paid", icon: <CheckCircle className="w-3.5 h-3.5" />, cls: "bg-green-100 text-green-800 border-green-200" },
  Sent: { label: "Due", icon: <Clock className="w-3.5 h-3.5" />, cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  Draft: { label: "Draft", icon: <FileText className="w-3.5 h-3.5" />, cls: "bg-gray-100 text-gray-700 border-gray-200" },
  Void: { label: "Void", icon: <AlertCircle className="w-3.5 h-3.5" />, cls: "bg-red-100 text-red-700 border-red-200" },
};

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function Invoices() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-invoices"],
    queryFn: listMyInvoices,
  });

  const invoices = data?.data ?? [];

  const totalPaid = invoices
    .filter((i) => i.invoice_status === "Paid")
    .reduce((sum, i) => sum + (i.amount ? Number(i.amount) : 0), 0);

  const totalDue = invoices
    .filter((i) => i.invoice_status === "Sent")
    .reduce((sum, i) => sum + (i.amount ? Number(i.amount) : 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {isLoading ? "Loading..." : `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Summary cards */}
      {!isLoading && invoices.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs text-green-700 font-medium mb-1 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Total Paid
            </p>
            <p className="text-2xl font-bold text-green-800">AUD ${totalPaid.toLocaleString()}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-xs text-yellow-700 font-medium mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Outstanding
            </p>
            <p className="text-2xl font-bold text-yellow-800">AUD ${totalDue.toLocaleString()}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-20 bg-card border rounded-xl">
          <div className="text-5xl mb-4">📄</div>
          <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
          <p className="text-muted-foreground text-sm">
            Invoices will appear here once your bookings are confirmed.
          </p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Invoice</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Due</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, idx) => {
                const status = STATUS_MAP[inv.invoice_status] ?? { label: inv.invoice_status, icon: null, cls: "bg-muted text-muted-foreground border-border" };
                return (
                  <tr key={inv.id} className={`border-b last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoice_ref}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px]">{inv.description ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {inv.amount ? `${inv.currency ?? "AUD"} $${Number(inv.amount).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${status.cls}`}>
                        {status.icon}
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, FileText } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-500",
  Sent: "bg-blue-100 text-blue-700",
  Accepted: "bg-green-100 text-green-700",
  Declined: "bg-red-100 text-red-600",
  Expired: "bg-amber-100 text-amber-700",
  Archived: "bg-gray-100 text-gray-400",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
}

async function fetchQuotes(q: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const res = await apiFetch(`/api/v1/quotes?${params}`);
  if (!res.ok) throw new Error("Failed to fetch quotes");
  return res.json();
}

export default function QuoteList() {
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["quotes", q], queryFn: () => fetchQuotes(q) });
  const rows: any[] = Array.isArray(data) ? data : [];
  const pagination = usePagination(rows);

  return (
    <Layout>
      <PageHeader title="Quotes" subtitle={`${rows.length} quotation${rows.length === 1 ? "" : "s"}`} />
      <div className="p-6">
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by reference…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button className="bg-[#E8621A] hover:bg-[#d4561a] text-white" onClick={() => navigate("/documents/quotes/new")}>
            <Plus className="h-4 w-4 mr-1" /> New Quote
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Reference</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Party</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Valid Until</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-muted-foreground">No quotes yet</p>
                    </div>
                  </td></tr>
                ) : pagination.paginatedItems.map((r: any) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/documents/quotes/${r.id}`} className="text-[#E8621A] hover:underline font-mono text-xs font-semibold">
                        {r.quote_ref}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">{r.account_name ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(r.total).toLocaleString("en-AU", { minimumFractionDigits: 2 })} {r.currency}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.valid_until)}</td>
                    <td className="px-4 py-3"><Badge className={`text-xs ${STATUS_COLORS[r.status] ?? ""}`}>{r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>
    </Layout>
  );
}

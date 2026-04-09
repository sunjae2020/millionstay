import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tag, Plus, Search, Pencil, Copy } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { useListPromotions } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/apiFetch";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Scheduled: "bg-yellow-100 text-yellow-700",
  Expired: "bg-gray-100 text-gray-700",
  Disabled: "bg-red-100 text-red-700",
  Draft: "bg-slate-100 text-slate-600",
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
const FREQ_LABELS: Record<string, string> = {
  Weekly: "Weekly",
  Biweekly: "Biweekly",
  Monthly: "Monthly",
};

function formatDiscount(promo: { promotion_type: string; discount_percentage?: number | null; discount_amount?: number | null; free_nights?: number | null }) {
  if (promo.promotion_type === "Percentage" && promo.discount_percentage != null) return `${promo.discount_percentage}%`;
  if (promo.promotion_type === "Fixed" && promo.discount_amount != null) return `$${promo.discount_amount.toFixed(0)}`;
  if (promo.promotion_type === "FreeNights" && promo.free_nights != null) return `${promo.free_nights} nights`;
  if (promo.promotion_type === "None") return "—";
  return "—";
}

function stayRange(promo: { min_stay_weeks?: number | null; max_stay_weeks?: number | null }) {
  const min = promo.min_stay_weeks;
  const max = promo.max_stay_weeks;
  if (min != null && max != null) return `${min}–${max}w`;
  if (min != null && max == null) return `${min}w+`;
  return "—";
}

export default function PromotionList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("_all");
  const [termType, setTermType] = useState("_all");
  const [cloningId, setCloningId] = useState<number | null>(null);
  const [, navigate] = useLocation();

  async function handleClone(p: any) {
    setCloningId(p.id);
    try {
      const { id: _id, created_at, updated_at, code, ...rest } = p;
      const res = await apiFetch("/api/v1/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, name: `Copy of ${p.name}`, status: "Draft", code: null }),
      });
      if (!res.ok) throw new Error("Clone failed");
      const cloned = await res.json();
      navigate(`/products/promotions/${cloned.id}`);
    } finally {
      setCloningId(null);
    }
  }

  const { data: promotions = [], isLoading } = useListPromotions({
    search: search || undefined,
    status: status !== "_all" ? status : undefined,
    promotion_type: termType !== "_all" ? undefined : undefined,
  });

  const filtered = termType !== "_all" ? promotions.filter(p => p.term_type === termType) : promotions;
  const pagination = usePagination(filtered);

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Tag className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Promotions</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `${filtered.length} promotion${filtered.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/products/promotions/new">
            <Button><Plus className="h-4 w-4 mr-2" />New Promotion</Button>
          </Link>
        </div>

        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search promotions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={termType} onValueChange={setTermType}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All terms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All term types</SelectItem>
              <SelectItem value="ShortTerm">Short-term (under 4 weeks)</SelectItem>
              <SelectItem value="MidTerm">Mid-term (4–25 weeks)</SelectItem>
              <SelectItem value="LongTerm">Long-term (26+ weeks)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Scheduled">Scheduled</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="Disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Stay (weeks)</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">Loading...</TableCell></TableRow>
                ) : pagination.paginatedItems.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No promotions found</TableCell></TableRow>
                ) : pagination.paginatedItems.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <Link href={`/products/promotions/${p.id}`} className="text-[#E8621A] hover:underline">{p.name}</Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={TERM_COLORS[p.term_type] ?? "bg-gray-100 text-gray-600"}>{TERM_LABELS[p.term_type] ?? p.term_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono font-semibold">{formatDiscount(p)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{stayRange(p)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{FREQ_LABELS[p.billing_frequency ?? ""] ?? (p.billing_frequency ?? "—")}</TableCell>
                    <TableCell>
                      {p.code ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{p.code}</code> : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-700"}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/products/promotions/${p.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          disabled={cloningId === p.id}
                          onClick={() => handleClone(p)}
                          title="Clone promotion"
                        >
                          <Copy className={`h-3.5 w-3.5 ${cloningId === p.id ? "animate-pulse" : ""}`} />
                        </Button>
                      </div>
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

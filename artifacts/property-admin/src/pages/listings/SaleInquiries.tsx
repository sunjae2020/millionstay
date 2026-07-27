import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { apiJson } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { EyeOff, Eye, Send, Lock, Mail, Phone, MessageSquare, ArrowLeft } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/date";

// Privacy-gated sale-inquiry review queue (vision "1차 문의 비공개"). The
// enquirer's identity is withheld until an admin explicitly reveals it; the admin
// then decides whether to forward the inquiry on.
type Inquiry = {
  id: number; listing_id: number | null; listing_title: string | null;
  message: string | null; status: string; revealed: boolean;
  name: string | null; email: string | null; phone: string | null;
  forwarded_at: string | null; forward_note: string | null; admin_notes: string | null; created_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  reviewed: "bg-amber-100 text-amber-700",
  forwarded: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

export default function SaleInquiries() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const key = ["sale-inquiries", status];
  const { data } = useQuery<{ data: Inquiry[] }>({
    queryKey: key,
    queryFn: () => apiJson(`/api/v1/sale-inquiries${status ? `?status=${status}` : ""}`),
  });
  const rows = data?.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sale-inquiries"] });

  const reveal = useMutation({ mutationFn: (id: number) => apiJson(`/api/v1/sale-inquiries/${id}/reveal`, { method: "POST" }), onSuccess: invalidate });
  const forward = useMutation({ mutationFn: (id: number) => apiJson(`/api/v1/sale-inquiries/${id}/forward`, { method: "POST", body: "{}" }), onSuccess: invalidate });
  const setStatusM = useMutation({ mutationFn: (v: { id: number; status: string }) => apiJson(`/api/v1/sale-inquiries/${v.id}`, { method: "PATCH", body: JSON.stringify({ status: v.status }) }), onSuccess: invalidate });

  return (
    <Layout>
      <PageHeader
        title={<><Lock className="h-5 w-5" />{t("sale_inquiries.title", "Sale Inquiries")}</>}
        subtitle={t("sale_inquiries.subtitle", "Enquirer identity is withheld until you reveal it. Then decide whether to forward.")}
      />
      <div className="px-8 py-6 space-y-4 max-w-4xl">
        <div className="flex items-center gap-3">
          <Link href="/content/listings"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />{t("sale_inquiries.back_to_listings", "Listings")}</Button></Link>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm ml-auto">
            <option value="">{t("sale_inquiries.filter_all", "All")}</option>
            {["new", "reviewed", "forwarded", "closed"].map((s) => <option key={s} value={s}>{t(`sale_inquiries.status_${s}`, s)}</option>)}
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">{t("common.no_data", "No inquiries")}</div>
        ) : rows.map((r) => (
          <div key={r.id} className="rounded-lg border bg-white overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{r.listing_title ?? t("sale_inquiries.general", "General inquiry")}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status] ?? "bg-gray-100"}`}>{t(`sale_inquiries.status_${r.status}`, r.status)}</span>
              </div>
              <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
            </div>
            <div className="p-4 space-y-3">
              {/* Identity — masked until revealed */}
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <span className="flex items-center gap-1.5">
                  {r.revealed ? <Eye className="h-3.5 w-3.5 text-green-600" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className={r.revealed ? "font-medium" : "text-muted-foreground italic"}>{r.name ?? "—"}</span>
                </span>
                {r.revealed && r.email && <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{r.email}</span>}
                {r.revealed && r.phone && <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{r.phone}</span>}
                {!r.revealed && <span className="text-xs text-muted-foreground">({t("sale_inquiries.withheld", "identity withheld")})</span>}
              </div>

              {r.message && <p className="text-sm bg-gray-50 border rounded-lg px-3 py-2 flex gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />{r.message}</p>}

              <div className="flex gap-2 flex-wrap">
                {!r.revealed && (
                  <Button size="sm" variant="outline" disabled={reveal.isPending} onClick={() => reveal.mutate(r.id)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> {t("sale_inquiries.btn_reveal", "Reveal identity")}
                  </Button>
                )}
                {r.status !== "forwarded" && r.status !== "closed" && (
                  <Button size="sm" disabled={forward.isPending} onClick={() => forward.mutate(r.id)}>
                    <Send className="h-3.5 w-3.5 mr-1" /> {t("sale_inquiries.btn_forward", "Forward")}
                  </Button>
                )}
                {r.status !== "closed" && (
                  <Button size="sm" variant="ghost" onClick={() => setStatusM.mutate({ id: r.id, status: "closed" })}>{t("sale_inquiries.btn_close", "Close")}</Button>
                )}
                {r.forwarded_at && <span className="text-xs text-green-600 self-center">✓ {t("sale_inquiries.forwarded_on", "forwarded")} {formatDate(r.forwarded_at)}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

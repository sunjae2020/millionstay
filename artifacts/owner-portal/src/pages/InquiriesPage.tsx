import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { Inbox, Mail, Phone } from "lucide-react";

export interface Inquiry {
  id: number;
  lead_ref: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  lead_status: string;
  created_at: string;
}

const STATUS_CLS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  Contacted: "bg-yellow-100 text-yellow-700",
  Converted: "bg-green-100 text-green-700",
  Closed: "bg-gray-100 text-gray-600",
};

export function InquiryRow({ q }: { q: Inquiry }) {
  const { t } = useTranslation();
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {[q.first_name, q.last_name].filter(Boolean).join(" ") || "—"}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
            <a href={`mailto:${q.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
              <Mail className="w-3 h-3" /> {q.email}
            </a>
            {q.phone && (
              <a href={`tel:${q.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="w-3 h-3" /> {q.phone}
              </a>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[q.lead_status] ?? "bg-gray-100 text-gray-600"}`}>
            {t(`status.${q.lead_status}`, q.lead_status)}
          </span>
          <p className="text-xs text-muted-foreground mt-1">
            {q.created_at ? new Date(q.created_at).toLocaleDateString() : ""}
          </p>
        </div>
      </div>
      {q.message && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{q.message}</p>}
    </div>
  );
}

export default function InquiriesPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; data: Inquiry[] }>("/v1/owner/site/inquiries?limit=200")
      .then((d) => setItems(d.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Inbox className="w-6 h-6 text-primary" /> {t("inquiries.title", "Inquiries")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("inquiries.subtitle", "Messages from guests via your landing site.")}</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="bg-card border border-card-border rounded-xl p-6 animate-pulse h-64" />
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 bg-card border border-card-border rounded-xl">
          {t("inquiries.empty", "No inquiries yet.")}
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl divide-y divide-border">
          {items.map((q) => <InquiryRow key={q.id} q={q} />)}
        </div>
      )}
    </Layout>
  );
}

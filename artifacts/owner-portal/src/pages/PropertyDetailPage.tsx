import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet, apiPatch } from "@/lib/api";
import {
  ArrowLeft,
  MapPin,
  Home,
  FileText,
  Eye,
  Calendar,
  DollarSign,
  Percent,
  Users,
  Pencil,
  Save,
  Loader2,
} from "lucide-react";
import { formatDate } from "@/lib/dateFormat";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { formatPostalAddress, orderFallbackFromLang, type AddressLang } from "@workspace/address";
import { formatMoney } from "@/lib/money";

interface Space {
  id: number;
  name: string;
  space_type: string;
  status: string;
}

interface LineItem {
  id: number;
  item_type: string;
  name: string;
  billing_trigger: string;
  billing_frequency: string | null;
  unit_price: string;
  quantity: number;
  total_price: string;
  currency: string;
  notes: string | null;
}

interface Contract {
  id: number;
  contract_ref: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  weekly_rate: number | null;
  total_rent: number | null;
  bond_amount: number | null;
  advance_amount: number | null;
  currency: string;
  document_url: string | null;
  terms_text: string | null;
  notes: string | null;
  signed_at: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  space_name: string | null;
  tenant_name: string | null;
  monthly_rent: number;
  owner_share_weekly: number;
  owner_share_pct: number | null;
  line_items: LineItem[];
}

interface DocumentItem {
  kind: string;
  contract_id: number;
  contract_ref: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}

interface PropertyDetail {
  property: {
    id: number;
    name: string;
    address: string | null;
    address2: string | null;
    city: string | null;
    state: string | null;
    postcode: string | null;
    country_code: string | null;
    description: string | null;
    approval_status: string;
  };
  spaces: Space[];
  contracts: Contract[];
  documents: DocumentItem[];
  stats: {
    total_spaces: number;
    active_contracts: number;
    total_contracts: number;
  };
}

const STATUS_CLS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Sent: "bg-blue-100 text-blue-700",
  Draft: "bg-gray-100 text-gray-600",
  Terminated: "bg-red-100 text-red-700",
  Expired: "bg-orange-100 text-orange-700",
};

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const addressLang = (i18n.language.slice(0, 2) || "en") as AddressLang;
  const [data, setData] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Inline editing of the property intro ("숙소 소개").
  const [desc, setDesc] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  useEffect(() => {
    setLoading(true);
    apiGet<{ success: boolean; data: PropertyDetail }>(`/v1/owner/properties/${params.id}`)
      .then((d) => { setData(d.data); setDesc(d.data.property.description ?? ""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function saveDesc() {
    setSavingDesc(true);
    setError("");
    try {
      await apiPatch(`/v1/owner/properties/${params.id}`, { description: desc });
      setData((prev) => (prev ? { ...prev, property: { ...prev.property, description: desc } } : prev));
      setEditingDesc(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingDesc(false);
    }
  }

  const fmtMoney = (n: number | null | undefined, currency?: string | null) =>
    n == null ? "—" : formatMoney(n, currency);

  return (
    <Layout>
      <div className="mb-4">
        <Link
          href="/properties"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("property_detail.back")}
        </Link>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-xl p-6 animate-pulse h-32" />
          <div className="bg-card border border-card-border rounded-xl p-6 animate-pulse h-48" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Property header */}
          <div className="bg-card border border-card-border rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mt-0.5">
                  <Home className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{data.property.name}</h1>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3" />
                    {formatPostalAddress(
                      {
                        line1: data.property.address,
                        line2: data.property.address2,
                        suburb: data.property.city,
                        state: data.property.state,
                        postcode: data.property.postcode,
                      },
                      addressLang,
                      { orderFallbackCountry: orderFallbackFromLang(addressLang) },
                    )}
                  </div>
                </div>
              </div>
              <span
                className={`text-xs font-medium px-3 py-1 rounded-full ${
                  data.property.approval_status === "Approved"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {t(`status.${data.property.approval_status}`, data.property.approval_status)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-border">
              <Stat icon={<Home className="w-4 h-4" />} label={t("property_detail.stat_spaces")} value={data.stats.total_spaces} />
              <Stat icon={<FileText className="w-4 h-4" />} label={t("property_detail.stat_active_contracts")} value={data.stats.active_contracts} />
              <Stat icon={<Users className="w-4 h-4" />} label={t("property_detail.stat_total_contracts")} value={data.stats.total_contracts} />
            </div>
          </div>

          {/* Property intro — editable by the owner */}
          <Section title={t("property_detail.about_title", "About this property")}>
            {editingDesc ? (
              <div className="space-y-3">
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={5}
                  placeholder={t("property_detail.about_placeholder", "Describe your property for guests…")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveDesc}
                    disabled={savingDesc}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {savingDesc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t("common.save", "Save")}
                  </button>
                  <button
                    onClick={() => { setDesc(data.property.description ?? ""); setEditingDesc(false); }}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {t("common.cancel", "Cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap max-w-2xl">
                  {data.property.description || t("property_detail.no_description", "No description yet. Add one so guests learn about your property.")}
                </p>
                <button
                  onClick={() => setEditingDesc(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline flex-shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" /> {t("common.edit", "Edit")}
                </button>
              </div>
            )}
          </Section>

          {/* Spaces */}
          <Section title={t("property_detail.spaces_title")}>
            {data.spaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("properties.no_spaces")}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.spaces.map((space) => (
                  <div key={space.id} className="border border-border rounded-lg p-3 bg-muted/20">
                    <p className="font-medium text-foreground text-sm truncate">{space.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{space.space_type}</p>
                    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-2 bg-gray-100 text-gray-600">
                      {t(`status.${space.status}`, space.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Contracts */}
          <Section title={t("property_detail.contracts_title")}>
            {data.contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("property_detail.no_contracts")}</p>
            ) : (
              <div className="space-y-4">
                {data.contracts.map((c) => (
                  <div key={c.id} className="border border-border rounded-lg p-4 bg-muted/10">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-medium text-foreground">{c.contract_ref}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {t(`status.${c.status}`, c.status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {c.space_name && <span className="mr-2">{c.space_name}</span>}
                          {c.tenant_name && <span>· {c.tenant_name}</span>}
                        </p>
                      </div>
                      {c.document_url && (
                        <a
                          href={c.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <FileText className="w-3 h-3" />
                          {t("property_detail.view_document")}
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
                      <KV
                        icon={<Calendar className="w-3 h-3" />}
                        label={t("property_detail.term")}
                        value={`${formatDate(c.start_date)} → ${formatDate(c.end_date)}`}
                      />
                      <KV
                        icon={<DollarSign className="w-3 h-3" />}
                        label={t("property_detail.weekly_rent")}
                        value={fmtMoney(c.weekly_rate, c.currency)}
                      />
                      <KV
                        icon={<DollarSign className="w-3 h-3" />}
                        label={t("property_detail.monthly_rent")}
                        value={fmtMoney(c.monthly_rent, c.currency)}
                      />
                      <KV
                        icon={<DollarSign className="w-3 h-3" />}
                        label={t("property_detail.bond")}
                        value={fmtMoney(c.bond_amount, c.currency)}
                      />
                    </div>

                    {/* Revenue share */}
                    <div className="mt-4 p-3 rounded-lg bg-orange-50 border border-orange-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Percent className="w-4 h-4 text-orange-600" />
                        <p className="text-sm font-medium text-foreground">
                          {t("property_detail.revenue_share")}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <KV
                          label={t("property_detail.gross_weekly")}
                          value={fmtMoney(c.weekly_rate, c.currency)}
                        />
                        <KV
                          label={t("property_detail.owner_share_weekly")}
                          value={fmtMoney(c.owner_share_weekly, c.currency)}
                        />
                        <KV
                          label={t("property_detail.owner_share_pct")}
                          value={c.owner_share_pct != null ? `${c.owner_share_pct}%` : "—"}
                        />
                      </div>
                      {c.line_items.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-orange-100">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            {t("property_detail.line_items")}
                          </p>
                          <div className="space-y-1">
                            {c.line_items.map((li) => (
                              <div key={li.id} className="flex items-center justify-between text-xs">
                                <span className="text-foreground">
                                  {li.name}
                                  <span className="text-muted-foreground ml-1">
                                    ({li.billing_frequency ?? li.billing_trigger})
                                  </span>
                                </span>
                                <span className="font-medium">{fmtMoney(parseFloat(li.total_price), li.currency)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {c.terms_text && (
                      <details className="mt-4">
                        <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                          {t("property_detail.show_terms")}
                        </summary>
                        <pre className="text-xs text-muted-foreground mt-2 p-3 bg-muted/30 rounded whitespace-pre-wrap font-sans">
                          {c.terms_text}
                        </pre>
                      </details>
                    )}
                    {c.notes && (
                      <p className="text-xs text-muted-foreground mt-3 italic">{c.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Documents */}
          <Section title={t("property_detail.documents_title")}>
            {data.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("property_detail.no_documents")}</p>
            ) : (
              <div className="space-y-2">
                {data.documents.map((doc, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openPreview({ title: doc.file_name, filename: doc.file_name, href: doc.file_url })}
                    className="w-full text-left flex items-center justify-between gap-3 p-3 border border-border rounded-lg bg-muted/10 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.contract_ref} · {formatDate(doc.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </Layout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function KV({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
        {icon}
        {label}
      </div>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}

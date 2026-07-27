import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/money";
import { ArrowLeft, User, Home, Calendar, DollarSign } from "lucide-react";

interface BookingData {
  id: number;
  booking_ref: string;
  booking_status: string;
  check_in_date: string;
  check_out_date: string;
  agreed_weekly_rate: string;
  total_rent: string;
  bond_amount: string | null;
  admin_fee: string | null;
  cleaning_fee: string | null;
  special_conditions: string | null;
  created_at: string;
  space_name: string;
  property_name: string;
  property_address: string;
  tenant: { display_name: string; email: string } | null;
  contract: {
    id: number;
    contract_ref: string;
    status: string;
    start_date: string;
    end_date: string;
  } | null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-6">
      <h3 className="font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

const STATUS_CLS: Record<string, string> = {
  Confirmed: "bg-green-100 text-green-700",
  Active: "bg-blue-100 text-blue-700",
  Draft: "bg-gray-100 text-gray-600",
  CheckedOut: "bg-purple-100 text-purple-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default function BookingDetailPage() {
  const { t } = useTranslation();
  const [, params] = useRoute("/bookings/:id");
  const id = params?.id;
  const [data, setData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiGet<{ success: boolean; data: BookingData }>(`/v1/agent/bookings/${id}`)
      .then((d) => setData(d.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout><div className="text-muted-foreground">{t("common.loading")}</div></Layout>;
  if (error) return <Layout><div className="text-destructive">{error}</div></Layout>;
  if (!data) return <Layout><div className="text-muted-foreground">{t("booking_detail.not_found")}</div></Layout>;

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/bookings">
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors mb-3">
            <ArrowLeft className="w-4 h-4" /> {t("booking_detail.back")}
          </span>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{data.booking_ref ?? `${t("booking_detail.booking_label")} #${data.id}`}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{data.property_name} — {data.space_name}</p>
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${STATUS_CLS[data.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
            {t(`status.${data.booking_status}`, data.booking_status)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title={t("booking_detail.tenant_info")}>
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{data.tenant?.display_name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{data.tenant?.email ?? "—"}</p>
            </div>
          </div>
        </Section>

        <Section title={t("booking_detail.property")}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Home className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-foreground">{data.property_name}</p>
              <p className="text-sm text-muted-foreground">{data.property_address}</p>
              <p className="text-sm text-muted-foreground">{data.space_name}</p>
            </div>
          </div>
        </Section>

        <Section title={t("booking_detail.dates_financials")}>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {formatDate(data.check_in_date, t("common.tbd"))}
              {" → "}
              {formatDate(data.check_out_date, t("common.ongoing"))}
            </span>
          </div>
          <Row label={t("booking_detail.weekly_rate")} value={formatMoney(data.agreed_weekly_rate ?? 0)} />
          <Row label={t("booking_detail.total_rent")} value={formatMoney(data.total_rent ?? 0)} />
          <Row label={t("booking_detail.bond")} value={data.bond_amount ? formatMoney(data.bond_amount) : "—"} />
          <Row label={t("booking_detail.admin_fee")} value={data.admin_fee ? formatMoney(data.admin_fee) : "—"} />
          <Row label={t("booking_detail.cleaning_fee")} value={data.cleaning_fee ? formatMoney(data.cleaning_fee) : "—"} />
        </Section>

        {data.contract && (
          <Section title={t("booking_detail.contract")}>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{data.contract.contract_ref}</span>
            </div>
            <Row label={t("booking_detail.status")} value={
              <span className={`text-xs px-2 py-0.5 rounded-full ${data.contract.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {t(`status.${data.contract.status}`, data.contract.status)}
              </span>
            } />
            <Row label={t("booking_detail.start_date")} value={formatDate(data.contract.start_date)} />
            <Row label={t("booking_detail.end_date")} value={formatDate(data.contract.end_date)} />
          </Section>
        )}

        {data.special_conditions && (
          <div className="lg:col-span-2">
            <Section title={t("booking_detail.special_conditions")}>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.special_conditions}</p>
            </Section>
          </div>
        )}
      </div>
    </Layout>
  );
}

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { Briefcase, MapPin, Calendar, DollarSign, FileText, ChevronRight } from "lucide-react";

interface Job {
  id: number;
  booking_id: number;
  name: string;
  service_type: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  currency: string;
  billing_trigger: string;
  frequency: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  booking: {
    booking_ref: string;
    booking_status: string;
    check_in_date: string;
    check_out_date: string;
    space: { id: number; name: string } | null;
    property: { id: number; name: string; address: string | null } | null;
  } | null;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Confirmed: "bg-blue-100 text-blue-700",
  CheckedOut: "bg-gray-100 text-gray-600",
  Draft: "bg-yellow-100 text-yellow-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default function JobsPage() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; data: Job[] }>("/v1/service-host/jobs")
      .then((r) => { if (r.success) setJobs(r.data); })
      .catch(() => setError(t("jobs.load_failed")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase();
    return (
      j.name.toLowerCase().includes(q) ||
      (j.booking?.booking_ref ?? "").toLowerCase().includes(q) ||
      (j.booking?.property?.name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("jobs.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("jobs.subtitle")}</p>
          </div>
          <div className="text-sm text-muted-foreground">
            {t("jobs.count", { count: filtered.length })}
          </div>
        </div>

        <input
          type="search"
          placeholder={t("jobs.search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">{t("jobs.no_jobs")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? t("jobs.no_jobs_search") : t("jobs.no_jobs_assigned")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="block bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/40 transition cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Briefcase className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground">{job.name}</h3>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {job.service_type === "one_time" ? t("jobs.one_time") : t("jobs.recurring")}
                        </span>
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {t(`trigger.${job.billing_trigger}`, job.billing_trigger)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {job.booking && (
                          <>
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {job.booking.booking_ref}
                              <span className={`ml-1 px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.booking.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                                {t(`status.${job.booking.booking_status}`, job.booking.booking_status)}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(job.booking.check_in_date)} → {formatDate(job.booking.check_out_date)}
                            </span>
                          </>
                        )}
                        {job.booking?.property && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.booking.property.name}
                            {job.booking.property.address ? ` · ${job.booking.property.address}` : ""}
                          </span>
                        )}
                        {job.booking?.space && (
                          <span className="text-primary font-medium">{t("jobs.room", { name: job.booking.space.name })}</span>
                        )}
                      </div>

                      {job.notes && (
                        <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 italic">
                          {job.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <DollarSign className="w-3.5 h-3.5 text-primary" />
                      <span className="text-lg font-bold text-foreground">
                        {parseFloat(job.total_price).toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">{job.currency}</span>
                    </div>
                    {job.quantity > 1 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {job.quantity} × ${parseFloat(job.unit_price).toFixed(2)}
                      </p>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground inline-block mt-2" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

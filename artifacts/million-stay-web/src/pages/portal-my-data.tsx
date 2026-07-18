import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/store";
import {
  Shield, Download, RefreshCw, User, FileText, Receipt,
  Mail, AlertTriangle, Building2, Phone,
} from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { APP_NAME } from "../lib/appName";

const API_BASE = getApiBase();

type MyDataResponse = {
  success: true;
  generated_at: string;
  generated_for: string;
  legal_basis: string;
  data: {
    profile: Record<string, unknown>;
    account: Record<string, unknown> | null;
    emergency_contacts: Array<Record<string, unknown>>;
    bookings: Array<{
      id: number;
      booking_ref: string;
      booking_status: string;
      check_in_date: string | null;
      check_out_date: string | null;
      space_name: string | null;
      total_rent: string | null;
      currency: string | null;
    }>;
    invoices: Array<{
      id: number;
      invoice_ref: string;
      amount: string;
      currency: string;
      status: string;
      due_date: string | null;
      paid_at: string | null;
    }>;
    documents: Array<{
      id: string;
      doc_type: string;
      file_name: string;
      file_size: number;
      retention_until: string;
      created_at: string;
    }>;
    marketing_consents: Array<{
      channel: string;
      opted_in_at: string | null;
      opted_out_at: string | null;
      source: string | null;
    }>;
  };
  counts: Record<string, number>;
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number | string; color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center shrink-0`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
        <p className="text-lg font-bold text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children, count }: {
  icon: React.ElementType; title: string; count?: number; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 md:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h2 className="font-semibold text-gray-800">{title}</h2>
        {typeof count === "number" && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function KvRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-b border-gray-50 last:border-0 text-sm">
      <span className="text-gray-500 font-medium">{k}</span>
      <span className="col-span-2 text-gray-800 break-words">{v ?? "—"}</span>
    </div>
  );
}

export default function PortalMyData() {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [data, setData] = useState<MyDataResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/guest/me/data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const json = (await res.json()) as MyDataResponse;
      setData(json);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load your data";
      setError(msg);
      toast({ title: "Could not load your data", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/guest/me/data?format=download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") ?? "";
      const fname = /filename="?([^"]+)"?/.exec(cd)?.[1] ?? `millionstay-mydata-${Date.now()}.json`;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: "Your personal data file has been saved." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      toast({ title: "Download failed", description: msg, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const profile = data?.data.profile as Record<string, string | null | undefined> | undefined;

  return (
    <PortalLayout active="/portal/my-data">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-5">
        {/* Header */}
        <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-orange-50/30 p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">My Data</h1>
                <p className="text-sm text-gray-600 mt-1 max-w-2xl">
                  Under <span className="font-medium">Australian Privacy Principle 12</span>, you have the right to access
                  the personal information {APP_NAME} holds about you. Review or download your full data below.
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={fetchData}
                disabled={loading}
                className="h-10"
                data-testid="button-refresh-data"
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                onClick={handleDownload}
                disabled={!data || downloading}
                className="h-10 bg-primary hover:bg-primary/90 text-white"
                data-testid="button-download-data"
              >
                <Download className="h-4 w-4 mr-1.5" />
                {downloading ? "Preparing…" : "Download (JSON)"}
              </Button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-white border border-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <>
            {/* Counts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={FileText} label="Bookings" value={data.counts["bookings"] ?? 0} color="bg-orange-400" />
              <StatCard icon={Receipt} label="Invoices" value={data.counts["invoices"] ?? 0} color="bg-blue-400" />
              <StatCard icon={Building2} label="Documents" value={data.counts["documents"] ?? 0} color="bg-purple-400" />
              <StatCard icon={Mail} label="Marketing" value={data.counts["marketing_consents"] ?? 0} color="bg-green-400" />
            </div>

            {/* Profile */}
            <Section icon={User} title="Profile">
              <div className="divide-y divide-gray-50">
                <KvRow k="Email" v={profile?.["email"]} />
                <KvRow k="First name" v={profile?.["first_name"]} />
                <KvRow k="Last name" v={profile?.["last_name"]} />
                <KvRow k="Phone" v={profile?.["phone"]} />
                <KvRow k="Nationality" v={profile?.["nationality"]} />
                <KvRow k="Date of birth" v={profile?.["date_of_birth"]} />
                <KvRow k="Gender" v={profile?.["gender"]} />
                <KvRow k="University" v={profile?.["university"]} />
                <KvRow k="Account created" v={fmtDate(profile?.["created_at"])} />
              </div>
            </Section>

            {/* Banking — sensitive, masked notice */}
            {(profile?.["bank_account_number"] || profile?.["bank_name"]) && (
              <Section icon={Building2} title="Banking details">
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800 mb-3 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  This information is stored encrypted at rest. The full record is included in the JSON download.
                </div>
                <div className="divide-y divide-gray-50">
                  <KvRow k="Bank" v={profile?.["bank_name"]} />
                  <KvRow k="Account name" v={profile?.["bank_account_name"]} />
                  <KvRow
                    k="BSB"
                    v={
                      profile?.["bank_bsb"]
                        ? `***-${String(profile["bank_bsb"]).slice(-3)}`
                        : "—"
                    }
                  />
                  <KvRow
                    k="Account number"
                    v={
                      profile?.["bank_account_number"]
                        ? `••••${String(profile["bank_account_number"]).slice(-4)}`
                        : "—"
                    }
                  />
                </div>
              </Section>
            )}

            {/* Emergency contacts */}
            <Section
              icon={Phone}
              title="Emergency contacts"
              count={data.data.emergency_contacts.length}
            >
              {data.data.emergency_contacts.length === 0 ? (
                <p className="text-sm text-gray-400">No emergency contacts on record.</p>
              ) : (
                <div className="space-y-2">
                  {data.data.emergency_contacts.map((c, i) => (
                    <div key={i} className="rounded-lg border border-gray-100 p-3 text-sm">
                      <p className="font-medium text-gray-800">
                        {String(c["name"] ?? "—")}
                        {c["is_primary"] ? (
                          <span className="ml-2 text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            Primary
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {String(c["relationship"] ?? "—")} · {String(c["phone"] ?? "—")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Bookings */}
            <Section icon={FileText} title="Bookings" count={data.data.bookings.length}>
              {data.data.bookings.length === 0 ? (
                <p className="text-sm text-gray-400">No bookings on record.</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                        <th className="px-2 py-2 font-medium">Ref</th>
                        <th className="px-2 py-2 font-medium">Space</th>
                        <th className="px-2 py-2 font-medium">Dates</th>
                        <th className="px-2 py-2 font-medium">Status</th>
                        <th className="px-2 py-2 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.data.bookings.map((b) => (
                        <tr key={b.id}>
                          <td className="px-2 py-2 font-mono text-xs">{b.booking_ref}</td>
                          <td className="px-2 py-2">{b.space_name ?? "—"}</td>
                          <td className="px-2 py-2 text-gray-500 text-xs">
                            {b.check_in_date ?? "—"} → {b.check_out_date ?? "—"}
                          </td>
                          <td className="px-2 py-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {b.booking_status}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right font-medium">
                            {b.total_rent ? `${b.currency ?? ""} ${b.total_rent}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Invoices */}
            <Section icon={Receipt} title="Invoices" count={data.data.invoices.length}>
              {data.data.invoices.length === 0 ? (
                <p className="text-sm text-gray-400">No invoices on record.</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                        <th className="px-2 py-2 font-medium">Ref</th>
                        <th className="px-2 py-2 font-medium">Status</th>
                        <th className="px-2 py-2 font-medium">Due</th>
                        <th className="px-2 py-2 font-medium">Paid</th>
                        <th className="px-2 py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.data.invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="px-2 py-2 font-mono text-xs">{inv.invoice_ref}</td>
                          <td className="px-2 py-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-gray-500 text-xs">{inv.due_date ?? "—"}</td>
                          <td className="px-2 py-2 text-gray-500 text-xs">{fmtDate(inv.paid_at)}</td>
                          <td className="px-2 py-2 text-right font-medium">
                            {inv.currency} {inv.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Documents */}
            <Section icon={Building2} title="Uploaded documents" count={data.data.documents.length}>
              {data.data.documents.length === 0 ? (
                <p className="text-sm text-gray-400">No documents on record.</p>
              ) : (
                <div className="space-y-2">
                  {data.data.documents.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 text-sm">
                      <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 truncate">{d.file_name}</p>
                        <p className="text-xs text-gray-500">
                          {d.doc_type} · {fmtBytes(d.file_size)} · uploaded {fmtDate(d.created_at)}
                        </p>
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0">
                        Retained until {new Date(d.retention_until).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Marketing consents */}
            <Section icon={Mail} title="Marketing consents" count={data.data.marketing_consents.length}>
              {data.data.marketing_consents.length === 0 ? (
                <p className="text-sm text-gray-400">
                  You have not opted in to any marketing communications. Booking confirmations and receipts
                  are sent regardless and are not marketing.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.data.marketing_consents.map((c, i) => {
                    const subscribed = c.opted_in_at && !c.opted_out_at;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-gray-800 capitalize">{c.channel}</p>
                          <p className="text-xs text-gray-500">
                            Source: {c.source ?? "—"} · Last update {fmtDate(c.opted_out_at ?? c.opted_in_at)}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            subscribed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {subscribed ? "Subscribed" : "Unsubscribed"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Footer / rights */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-600">
              <h3 className="font-semibold text-gray-800 mb-2">Need to correct or delete your data?</h3>
              <p>
                You may request a correction or full erasure at any time. Please email{" "}
                <a href="mailto:millionstay.com@gmail.com" className="text-primary hover:underline">
                  millionstay.com@gmail.com
                </a>{" "}
                from the address on file ({profile?.["email"] ?? "—"}). We respond within 30 days.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Data generated at {fmtDate(data.generated_at)}.
              </p>
            </div>
          </>
        )}
      </div>
    </PortalLayout>
  );
}

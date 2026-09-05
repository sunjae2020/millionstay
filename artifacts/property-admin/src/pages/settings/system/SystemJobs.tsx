import { Clock, Zap } from "lucide-react";
import { Card } from "./ui";

/* Curated reference of the scheduled jobs registered in api-server/src/index.ts.
 * MillionStay schedules crons inline (no runtime stats registry), so this is the
 * single readable place that answers "what runs on a timer". Keep in sync with
 * the cron.schedule() calls in index.ts. */
type Job = {
  name: string;
  schedule: string;
  tz: string;
  desc: string;
  boot?: boolean; // also runs once at boot
  gated?: string; // self-gated on this setting (off by default)
};

const JOBS: Job[] = [
  { name: "exchange-rate-sync", schedule: "00:00 daily", tz: "Australia/Sydney", desc: "Per-pair FX rate refresh (only when a currency pair is registered)", boot: true },
  { name: "ical-import-sync", schedule: "hourly (:00)", tz: "server", desc: "OTA inbound iCal import → space_availability (source=ical)", boot: true },
  { name: "homestay-rent-billing", schedule: "02:00 daily", tz: "Australia/Sydney", desc: "PENDING per-cycle rent charge for each Active homestay placement due" },
  { name: "recurring-invoices", schedule: "02:30 daily", tz: "Australia/Sydney", desc: "Recurring rent invoice per due cycle (incremental billing_mode)", gated: "RECURRING_INVOICES_ENABLED" },
  { name: "lease-rent-invoices", schedule: "03:00 daily", tz: "Australia/Sydney", desc: "Korean monthly-lease rent invoice + overdue flagging (월세/납입일)", gated: "LEASE_RENT_INVOICES_ENABLED" },
  { name: "consolidated-invoicing", schedule: "03:10 daily", tz: "Australia/Sydney", desc: "통합(단체) 청구 — bundle per-space invoices into one consolidated bill" },
  { name: "retention-purge", schedule: "03:15 daily", tz: "Australia/Sydney", desc: "APP 11.5 retention purge — destroy expired / DSAR-deleted documents", boot: true },
  { name: "work-order-sla", schedule: "every 10 min", tz: "server", desc: "Work-order SLA watchdog — flag unacknowledged dispatches past deadline" },
];

export default function SystemJobs() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-bold text-foreground">{JOBS.length}</span> scheduled jobs registered
      </p>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left font-semibold px-4 py-2.5 w-[220px]">Job</th>
                <th className="text-left font-semibold px-3 py-2.5 w-[130px]">Schedule</th>
                <th className="text-left font-semibold px-3 py-2.5 w-[150px]">Timezone</th>
                <th className="text-left font-semibold px-4 py-2.5">Description</th>
              </tr>
            </thead>
            <tbody>
              {JOBS.map((j) => (
                <tr key={j.name} className="border-b last:border-0 align-top">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-foreground font-mono text-[12.5px]">{j.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {j.boot && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          <Zap className="h-2.5 w-2.5" /> runs at boot
                        </span>
                      )}
                      {j.gated && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 font-mono">
                          {j.gated} · off by default
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[12.5px] text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {j.schedule}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[12.5px] text-muted-foreground">{j.tz}</td>
                  <td className="px-4 py-2.5 text-[12.5px] text-muted-foreground leading-snug">{j.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Schedules run on the single api-server instance (Railway) via node-cron. Self-gated jobs check their setting at
        run time, so ops can toggle them from Integrations with no redeploy. Curated reference — keep in sync with
        <span className="font-mono"> index.ts</span>.
      </p>
    </div>
  );
}

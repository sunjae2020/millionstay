import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiJson } from "@/lib/apiFetch";
import { Loader2, ShieldCheck, ShieldAlert, Route } from "lucide-react";
import { Card } from "./ui";

type Census = {
  available: boolean;
  reason?: string;
  totalRoutes: number;
  totalEndpoints: number;
  guardedRoutes: number;
  unguardedRoutes: number;
  byMethod: Record<string, number>;
  groups: { name: string; count: number }[];
  generatedAt: string;
};

const METHOD_COLOR: Record<string, string> = {
  GET: "#059669", POST: "#0369A1", PUT: "#A16207", PATCH: "#7C3AED", DELETE: "#DC2626",
};

export default function SystemApi() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<Census>({
    queryKey: ["system-map-endpoints"],
    queryFn: () => apiJson<Census>("/api/v1/admin/system-map/endpoints"),
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );

  if (!data?.available)
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          {t("system_map.api_unavailable")}{data?.reason ? ` — ${data.reason}` : ""}.
        </p>
      </Card>
    );

  const guardPct = data.totalRoutes ? Math.round((data.guardedRoutes / data.totalRoutes) * 100) : 0;
  const methodMax = Math.max(1, ...Object.values(data.byMethod));
  const groupMax = Math.max(1, ...data.groups.map((g) => g.count));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><Route className="h-4 w-4" /><p className="text-xs font-medium uppercase tracking-wide">{t("system_map.api_endpoints")}</p></div>
          <p className="text-3xl font-bold text-foreground mt-1">{data.totalEndpoints}</p>
          <p className="text-[11px] text-muted-foreground">{t("system_map.api_route_paths", { n: data.totalRoutes })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><ShieldCheck className="h-4 w-4" /><p className="text-xs font-medium uppercase tracking-wide">{t("system_map.api_guarded")}</p></div>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{data.guardedRoutes}</p>
          <p className="text-[11px] text-muted-foreground">{t("system_map.api_pct_routes", { n: guardPct })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><ShieldAlert className="h-4 w-4" /><p className="text-xs font-medium uppercase tracking-wide">{t("system_map.api_unguarded")}</p></div>
          <p className="text-3xl font-bold text-amber-600 mt-1">{data.unguardedRoutes}</p>
          <p className="text-[11px] text-muted-foreground">{t("system_map.api_unguarded_sub")}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><Route className="h-4 w-4" /><p className="text-xs font-medium uppercase tracking-wide">{t("system_map.api_route_groups")}</p></div>
          <p className="text-3xl font-bold text-foreground mt-1">{data.groups.length}</p>
          <p className="text-[11px] text-muted-foreground">{t("system_map.api_top_segments")}</p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("system_map.api_by_method")}</p>
        <div className="space-y-2">
          {["GET", "POST", "PUT", "PATCH", "DELETE"].filter((m) => data.byMethod[m]).map((m) => (
            <div key={m} className="flex items-center gap-3">
              <span className="w-16 text-[12px] font-mono font-semibold" style={{ color: METHOD_COLOR[m] }}>{m}</span>
              <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                <div className="h-full rounded" style={{ width: `${(data.byMethod[m] / methodMax) * 100}%`, background: METHOD_COLOR[m] }} />
              </div>
              <span className="w-12 text-right text-[12px] font-semibold text-muted-foreground">{data.byMethod[m]}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("system_map.api_by_group")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {data.groups.map((g) => (
            <div key={g.name} className="flex items-center gap-3">
              <span className="w-32 text-[12px] font-mono text-foreground truncate">/{g.name}</span>
              <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
                <div className="h-full rounded bg-primary" style={{ width: `${(g.count / groupMax) * 100}%` }} />
              </div>
              <span className="w-10 text-right text-[12px] font-semibold text-muted-foreground">{g.count}</span>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        {t("system_map.api_footer", { time: new Date(data.generatedAt).toLocaleString() })}
      </p>
    </div>
  );
}

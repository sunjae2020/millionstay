import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date";
import { ExternalLink, Plus, Wrench } from "lucide-react";

// 하자보수 — the 서비스 & 건물관리 work orders raised against ONE space.
// Work orders already carry space_id, so this tab is the space-side view of the
// same records. Every link opens in a new tab so the space form (which may hold
// unsaved edits) is never navigated away from.
const BASE = import.meta.env.BASE_URL;
const woHref = (path: string) => `${BASE.replace(/\/$/, "")}${path}`;

const STATUS_CHIP: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  InProgress: "bg-yellow-100 text-yellow-700",
  Dispatched: "bg-indigo-100 text-indigo-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-gray-100 text-gray-600",
};

export function SpaceWorkOrdersPanel({ spaceId }: { spaceId: string | number }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["space-work-orders", String(spaceId)],
    queryFn: () => apiJson(`/api/v1/work-orders?space_id=${spaceId}`),
  });
  const orders = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Wrench className="h-4 w-4 text-primary" />
          {t("space.tab_work_orders", "하자보수")} ({orders.length})
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={woHref(`/maintenance/work-orders?space_id=${spaceId}`)} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              {t("space.work_orders_open_list", "서비스 & 건물관리에서 보기")}
            </a>
          </Button>
          <Button size="sm" asChild className="bg-primary hover:bg-[#d4561a] text-white">
            <a href={woHref(`/maintenance/work-orders/new?space_id=${spaceId}`)} target="_blank" rel="noreferrer">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("space.work_orders_new", "하자보수 등록")}
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {[
                t("workorder.label_ref", "번호"),
                t("common.title", "제목"),
                t("workorder.label_category", "분류"),
                t("workorder.label_assigned_host", "담당 파트너"),
                t("common.status", "상태"),
                t("common.created_at", "등록일"),
              ].map((h) => (
                <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">{t("common.loading", "불러오는 중…")}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">{t("space.work_orders_empty", "이 공간에 등록된 하자보수 건이 없습니다.")}</td></tr>
            ) : (
              orders.map((w) => (
                <tr key={w.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                    <a href={woHref(`/maintenance/work-orders/${w.id}`)} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      {w.order_ref}<ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="px-3 py-2">{w.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{w.category ?? "—"}</td>
                  <td className="px-3 py-2">{w.service_host_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CHIP[w.status] ?? "bg-gray-100 text-gray-600"}`}>{w.status}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{w.created_at ? formatDate(w.created_at) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SpaceWorkOrdersPanel;

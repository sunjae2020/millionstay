import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/date";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { SearchBox } from "@/components/list-filters";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface UploadSession {
  id: string;
  date: string;
  spacesCount: number;
  photosCount: number;
  failedCount: number;
}

const SESSION_KEY = "ms_bulk_upload_sessions";

export function loadSessions(): UploadSession[] {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as UploadSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: UploadSession) {
  const sessions = loadSessions();
  sessions.unshift(session);
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions.slice(0, 50)));
}

export default function BulkPhotoUploadList() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [sessions, setSessions] = useState<UploadSession[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  function handleDelete(id: string) {
    const updated = sessions.filter((s) => s.id !== id);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    setSessions(updated);
    setDeleteId(null);
  }

  // 업로드 이력은 브라우저에 남는 로컬 기록이라 서버 검색이 없다 — 표시 항목으로 훑는다.
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return sessions;
    return sessions.filter((s) => JSON.stringify(s).toLowerCase().includes(term));
  }, [sessions, q]);

  const columns: ColumnDef<UploadSession>[] = useMemo(
    () => [
      {
        key: "date",
        header: "common.date",
        hideable: false,
        defaultWidth: 200,
        sortAccessor: (session) => session.date,
        cell: (session) => <span className="font-medium">{formatDateTime(session.date)}</span>,
      },
      {
        key: "spacesCount",
        header: "property.bulk_col_spaces",
        cell: (session) => (
          <span className="text-muted-foreground text-xs">
            {t("property.bulk_spaces", { count: session.spacesCount })}
          </span>
        ),
      },
      {
        key: "photosCount",
        header: "property.bulk_col_photos",
        cell: (session) => (
          <span className="text-muted-foreground text-xs">
            {t("property.bulk_photos", { count: session.photosCount })}
          </span>
        ),
      },
      {
        key: "failedCount",
        header: "common.status",
        cell: (session) =>
          session.failedCount === 0 ? (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {t("property.bulk_completed")}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-300 text-amber-700 gap-1">
              <AlertCircle className="h-3 w-3" />
              {t("property.bulk_partial", { count: session.failedCount })}
            </Badge>
          ),
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 70,
        cell: (session) => (
          <div className="flex items-center justify-end">
            <button
              className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
              onClick={() => setDeleteId(session.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <Layout>
      <PageHeader
        title={t("nav.bulk_photo")}
        subtitle={t("property.bulk_sessions", { count: sessions.length })}
        actions={
          <Button onClick={() => navigate("/property/bulk-photo-upload/new")}>
            <Plus className="h-4 w-4 mr-2" />
            {t("property.bulk_new_upload")}
          </Button>
        }
      />

      <div className="p-6">
        <DataTable
          tableKey="bulk-photo-upload"
          columns={columns}
          data={rows}
          rowKey={(session) => session.id}
          toolbarExtra={<SearchBox value={q} onChange={setQ} placeholder={t("common.search_ph_generic")} />}
          emptyText={
            <div className="flex flex-col items-center gap-3 text-muted-foreground py-10">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium text-foreground">{t("property.bulk_empty_title")}</p>
                <p className="text-sm mt-1">{t("property.bulk_empty_desc")}</p>
              </div>
              <Button onClick={() => navigate("/property/bulk-photo-upload/new")}>
                <Plus className="h-4 w-4 mr-2" />
                {t("property.bulk_start_upload")}
              </Button>
            </div>
          }
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("property.bulk_remove_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("property.bulk_remove_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              {t("property.bulk_remove_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/date";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
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

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  function handleDelete(id: string) {
    const updated = sessions.filter((s) => s.id !== id);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    setSessions(updated);
    setDeleteId(null);
  }

  const columns: ColumnDef<UploadSession>[] = useMemo(
    () => [
      {
        key: "date",
        header: "Date",
        hideable: false,
        defaultWidth: 200,
        sortAccessor: (session) => session.date,
        cell: (session) => <span className="font-medium">{formatDateTime(session.date)}</span>,
      },
      {
        key: "spacesCount",
        header: "Spaces",
        cell: (session) => (
          <span className="text-muted-foreground text-xs">
            {session.spacesCount} space{session.spacesCount !== 1 ? "s" : ""}
          </span>
        ),
      },
      {
        key: "photosCount",
        header: "Photos",
        cell: (session) => (
          <span className="text-muted-foreground text-xs">
            {session.photosCount} photo{session.photosCount !== 1 ? "s" : ""}
          </span>
        ),
      },
      {
        key: "failedCount",
        header: "Status",
        cell: (session) =>
          session.failedCount === 0 ? (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-300 text-amber-700 gap-1">
              <AlertCircle className="h-3 w-3" />
              Partial ({session.failedCount} failed)
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
        subtitle={`${sessions.length} upload session${sessions.length !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={() => navigate("/property/bulk-photo-upload/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Upload
          </Button>
        }
      />

      <div className="p-6">
        <DataTable
          tableKey="bulk-photo-upload"
          columns={columns}
          data={sessions}
          rowKey={(session) => session.id}
          emptyText={
            <div className="flex flex-col items-center gap-3 text-muted-foreground py-10">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium text-foreground">No upload sessions yet</p>
                <p className="text-sm mt-1">Start a new bulk upload to assign photos to multiple spaces at once.</p>
              </div>
              <Button onClick={() => navigate("/property/bulk-photo-upload/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Start New Upload
              </Button>
            </div>
          }
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Session</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this upload session from the history. Photos already uploaded will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

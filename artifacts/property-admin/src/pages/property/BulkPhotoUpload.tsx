import { useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FolderOpen, Upload, CheckCircle2, XCircle, AlertCircle, ImageIcon, Loader2 } from "lucide-react";
import { saveSession } from "./BulkPhotoUploadList";

interface SpaceRow {
  id: number;
  name: string;
  property_name: string;
}

interface FolderGroup {
  folderName: string;
  files: File[];
  matchedSpaceId: number | null;
  previews: string[];
}

type UploadStatus = "idle" | "uploading" | "done" | "error";

interface GroupStatus {
  status: UploadStatus;
  uploaded: number;
  total: number;
  error?: string;
}

function fuzzyScore(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[_\-\s]/g, "");
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 80;
  let matches = 0;
  for (const ch of na) if (nb.includes(ch)) matches++;
  return Math.round((matches / Math.max(na.length, nb.length)) * 60);
}

function bestMatch(folderName: string, spaces: SpaceRow[]): number | null {
  if (!spaces.length) return null;
  let best: { id: number; score: number } = { id: spaces[0].id, score: -1 };
  for (const sp of spaces) {
    const score = fuzzyScore(folderName, sp.name);
    if (score > best.score) best = { id: sp.id, score };
  }
  return best.score >= 30 ? best.id : null;
}

export default function BulkPhotoUpload() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [groups, setGroups] = useState<FolderGroup[]>([]);
  const [statuses, setStatuses] = useState<Record<string, GroupStatus>>({});
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const { data: spaces = [] } = useQuery<SpaceRow[]>({
    queryKey: ["spaces-all"],
    queryFn: () => apiFetch("/api/v1/spaces").then((r) => r.json()),
  });

  const handleFolderSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;

      const map = new Map<string, File[]>();
      for (const file of files) {
        const parts = file.webkitRelativePath.split("/");
        const key = parts.length >= 3 ? parts[1] : parts[0];
        const arr = map.get(key) ?? [];
        arr.push(file);
        map.set(key, arr);
      }

      const newGroups: FolderGroup[] = [];
      for (const [folderName, groupFiles] of map.entries()) {
        const imageFiles = groupFiles.filter((f) => f.type.startsWith("image/"));
        if (!imageFiles.length) continue;
        const previews = imageFiles.slice(0, 4).map((f) => URL.createObjectURL(f));
        newGroups.push({
          folderName,
          files: imageFiles,
          matchedSpaceId: bestMatch(folderName, spaces),
          previews,
        });
      }

      newGroups.sort((a, b) => a.folderName.localeCompare(b.folderName));
      setGroups(newGroups);
      setStatuses({});
      setDone(false);
    },
    [spaces],
  );

  const setMatch = (folderName: string, spaceId: number | null) => {
    setGroups((prev) =>
      prev.map((g) => (g.folderName === folderName ? { ...g, matchedSpaceId: spaceId } : g)),
    );
  };

  const handleUpload = async () => {
    const matched = groups.filter((g) => g.matchedSpaceId !== null);
    if (!matched.length) {
      toast({ title: t("bulk_photo.no_matched_spaces"), description: t("bulk_photo.no_matched_spaces_desc"), variant: "destructive" });
      return;
    }

    setUploading(true);
    const initial: Record<string, GroupStatus> = {};
    for (const g of matched) {
      initial[g.folderName] = { status: "uploading", uploaded: 0, total: g.files.length };
    }
    setStatuses(initial);

    let totalUploaded = 0;
    let failedCount = 0;

    for (const group of matched) {
      const spaceId = group.matchedSpaceId!;
      const formData = new FormData();
      for (const file of group.files) {
        formData.append("images", file, file.name);
      }

      try {
        const res = await apiFetch(`/api/v1/spaces/${spaceId}/images`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const uploaded = data.data?.length ?? group.files.length;
        totalUploaded += uploaded;
        setStatuses((prev) => ({
          ...prev,
          [group.folderName]: { status: "done", uploaded, total: group.files.length },
        }));
      } catch (err: any) {
        failedCount++;
        setStatuses((prev) => ({
          ...prev,
          [group.folderName]: {
            status: "error",
            uploaded: 0,
            total: group.files.length,
            error: err?.message ?? t("bulk_photo.upload_error"),
          },
        }));
      }
    }

    setUploading(false);
    setDone(true);

    saveSession({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: new Date().toISOString(),
      spacesCount: matched.length,
      photosCount: totalUploaded,
      failedCount,
    });

    toast({
      title: t("bulk_photo.bulk_upload_complete"),
      description: t("bulk_photo.bulk_upload_complete_desc", { photos: totalUploaded, spaces: matched.length }),
    });
  };

  const totalPhotos = groups.reduce((s, g) => s + g.files.length, 0);
  const matchedCount = groups.filter((g) => g.matchedSpaceId !== null).length;
  const unmatchedCount = groups.filter((g) => g.matchedSpaceId === null).length;
  const doneCount = Object.values(statuses).filter((s) => s.status === "done").length;
  const errorCount = Object.values(statuses).filter((s) => s.status === "error").length;
  const hasResults = Object.keys(statuses).length > 0;

  const progress =
    hasResults && matchedCount > 0
      ? Math.round(
          (Object.values(statuses).filter((s) => s.status === "done" || s.status === "error").length /
            groups.filter((g) => g.matchedSpaceId !== null).length) *
            100,
        )
      : 0;

  return (
    <Layout>
      <PageHeader
        title={t("bulk_photo.new_bulk_upload")}
        subtitle={t("bulk_photo.new_bulk_upload_subtitle")}
        actions={
          <Link href="/property/bulk-photo-upload">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("bulk_photo.back_to_sessions")}
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6 max-w-5xl">
        {/* Step 1 — Folder picker */}
        <div className="border rounded-lg p-8 bg-muted/30 flex flex-col items-center gap-4">
          <FolderOpen className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">{t("bulk_photo.select_root_folder")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("bulk_photo.structure_label")} <span className="font-mono">root&nbsp;/&nbsp;Space Name&nbsp;/&nbsp;photo.jpg</span>
            </p>
          </div>
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <FolderOpen className="h-4 w-4 mr-2" />
            {t("bulk_photo.choose_folder")}
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            /* @ts-ignore */
            webkitdirectory=""
            accept="image/*"
            onChange={handleFolderSelect}
          />
        </div>

        {/* Summary badges */}
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary">{t("bulk_photo.folders_count", { count: groups.length })}</Badge>
            <Badge variant="secondary">{t("bulk_photo.photos_count", { count: totalPhotos })}</Badge>
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {t("bulk_photo.auto_matched_count", { count: matchedCount })}
            </Badge>
            {unmatchedCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {t("bulk_photo.unmatched_count", { count: unmatchedCount })}
              </Badge>
            )}
            {hasResults && (
              <>
                {doneCount > 0 && (
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                    ✓ {t("bulk_photo.completed_count", { count: doneCount })}
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">{t("bulk_photo.failed_count", { count: errorCount })}</Badge>
                )}
              </>
            )}
          </div>
        )}

        {/* Matching table */}
        {groups.length > 0 && (
          <div className="border rounded-lg overflow-hidden bg-card">
            <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("bulk_photo.col_folder")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("bulk_photo.col_preview")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("bulk_photo.col_matched_space")}</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide w-24">{t("bulk_photo.col_photos")}</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide w-28">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {groups.map((group) => {
                  const st = statuses[group.folderName];
                  return (
                    <tr key={group.folderName} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs max-w-[180px] truncate" title={group.folderName}>
                        {group.folderName}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {group.previews.map((src, i) => (
                            <img key={i} src={src} alt="" className="h-10 w-10 rounded object-cover border" />
                          ))}
                          {group.files.length > 4 && (
                            <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                              +{group.files.length - 4}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 min-w-[220px]">
                        <Select
                          value={group.matchedSpaceId?.toString() ?? "__none__"}
                          onValueChange={(v) =>
                            setMatch(group.folderName, v === "__none__" ? null : Number(v))
                          }
                          disabled={!!st && st.status !== "error"}
                        >
                          <SelectTrigger className={`h-8 text-xs ${!group.matchedSpaceId ? "border-destructive" : ""}`}>
                            <SelectValue placeholder={t("bulk_photo.select_space_placeholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{t("bulk_photo.skip_this_folder")}</SelectItem>
                            {spaces.map((sp) => (
                              <SelectItem key={sp.id} value={sp.id.toString()}>
                                {sp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <ImageIcon className="h-3 w-3" />
                          {group.files.length}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {!st && (
                          <span className="text-muted-foreground text-xs">{t("bulk_photo.status_pending")}</span>
                        )}
                        {st?.status === "uploading" && (
                          <span className="inline-flex items-center gap-1 text-[#E8621A] text-xs">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t("bulk_photo.status_uploading")}
                          </span>
                        )}
                        {st?.status === "done" && (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            {t("bulk_photo.status_uploaded_count", { count: st.uploaded })}
                          </span>
                        )}
                        {st?.status === "error" && (
                          <span className="inline-flex items-center gap-1 text-destructive text-xs" title={st.error}>
                            <XCircle className="h-3 w-3" />
                            {t("bulk_photo.status_failed")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {uploading && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("bulk_photo.uploading_photos")}</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {/* Action buttons */}
        {groups.length > 0 && !hasResults && (
          <div className="flex justify-end">
            <Button onClick={handleUpload} disabled={uploading || matchedCount === 0} size="lg">
              <Upload className="h-4 w-4 mr-2" />
              {t("bulk_photo.upload_to_spaces", { photos: totalPhotos, spaces: matchedCount })}
            </Button>
          </div>
        )}

        {hasResults && !uploading && (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate("/property/bulk-photo-upload")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("bulk_photo.back_to_sessions")}
            </Button>
            {errorCount > 0 && (
              <Button onClick={handleUpload}>
                <Upload className="h-4 w-4 mr-2" />
                {t("bulk_photo.retry_failed")}
              </Button>
            )}
            {done && errorCount === 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setGroups([]);
                  setStatuses({});
                  setDone(false);
                }}
              >
                {t("bulk_photo.upload_another_folder")}
              </Button>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

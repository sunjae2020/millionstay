import { useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Upload, CheckCircle2, XCircle, AlertCircle, ImageIcon, Loader2 } from "lucide-react";

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

/** Simple fuzzy score: count matching chars (case-insensitive, ignoring separators) */
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
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [groups, setGroups] = useState<FolderGroup[]>([]);
  const [statuses, setStatuses] = useState<Record<string, GroupStatus>>({});
  const [uploading, setUploading] = useState(false);

  const { data: spaces = [] } = useQuery<SpaceRow[]>({
    queryKey: ["spaces-all"],
    queryFn: () => apiFetch("/api/v1/spaces").then((r) => r.json()),
  });

  const handleFolderSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;

      // Group by first subfolder segment (the folder the user selected)
      const map = new Map<string, File[]>();
      for (const file of files) {
        const parts = file.webkitRelativePath.split("/");
        // parts[0] = root folder selected, parts[1] = subfolder (or file if flat)
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

      // Sort by folder name
      newGroups.sort((a, b) => a.folderName.localeCompare(b.folderName));
      setGroups(newGroups);
      setStatuses({});
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
      toast({ title: "매칭된 Space가 없습니다", variant: "destructive" });
      return;
    }

    setUploading(true);
    const initial: Record<string, GroupStatus> = {};
    for (const g of matched) {
      initial[g.folderName] = { status: "uploading", uploaded: 0, total: g.files.length };
    }
    setStatuses(initial);

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
        setStatuses((prev) => ({
          ...prev,
          [group.folderName]: { status: "done", uploaded, total: group.files.length },
        }));
      } catch (err: any) {
        setStatuses((prev) => ({
          ...prev,
          [group.folderName]: {
            status: "error",
            uploaded: 0,
            total: group.files.length,
            error: err?.message ?? "업로드 실패",
          },
        }));
      }
    }

    setUploading(false);
    toast({ title: "일괄 업로드 완료", description: `${matched.length}개 Space에 사진을 업로드했습니다.` });
  };

  const totalPhotos = groups.reduce((s, g) => s + g.files.length, 0);
  const matchedCount = groups.filter((g) => g.matchedSpaceId !== null).length;
  const unmatchedCount = groups.filter((g) => g.matchedSpaceId === null).length;
  const doneCount = Object.values(statuses).filter((s) => s.status === "done").length;
  const errorCount = Object.values(statuses).filter((s) => s.status === "error").length;
  const hasResults = Object.keys(statuses).length > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Bulk Photo Upload</h1>
        <p className="text-muted-foreground mt-1">
          폴더를 선택하면 하위 폴더명 기준으로 Space를 자동 매칭합니다. 매칭을 확인 후 일괄 업로드하세요.
        </p>
      </div>

      {/* Step 1 — Folder Select */}
      <div className="border rounded-lg p-6 bg-muted/30 flex flex-col items-center gap-4">
        <FolderOpen className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">사진 폴더를 선택하세요</p>
          <p className="text-sm text-muted-foreground mt-1">
            루트 폴더 선택 → 하위 폴더(Space명) → 사진 파일 구조로 준비해 주세요
          </p>
        </div>
        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          <FolderOpen className="h-4 w-4 mr-2" />
          폴더 선택
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
          <Badge variant="secondary">{groups.length}개 폴더</Badge>
          <Badge variant="secondary">{totalPhotos}장 사진</Badge>
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {matchedCount}개 자동 매칭
          </Badge>
          {unmatchedCount > 0 && (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              {unmatchedCount}개 미매칭 — 수동 선택 필요
            </Badge>
          )}
          {hasResults && (
            <>
              {doneCount > 0 && (
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                  ✓ {doneCount}개 완료
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive">{errorCount}개 오류</Badge>
              )}
            </>
          )}
        </div>
      )}

      {/* Matching Table */}
      {groups.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">폴더명</th>
                <th className="text-left p-3 font-medium">미리보기</th>
                <th className="text-left p-3 font-medium">매칭 Space</th>
                <th className="text-center p-3 font-medium w-24">사진 수</th>
                <th className="text-center p-3 font-medium w-28">상태</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const st = statuses[group.folderName];
                return (
                  <tr key={group.folderName} className="border-t hover:bg-muted/20">
                    {/* Folder name */}
                    <td className="p-3 font-mono text-xs max-w-[180px] truncate" title={group.folderName}>
                      {group.folderName}
                    </td>

                    {/* Previews */}
                    <td className="p-3">
                      <div className="flex gap-1">
                        {group.previews.map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt=""
                            className="h-10 w-10 rounded object-cover border"
                          />
                        ))}
                        {group.files.length > 4 && (
                          <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                            +{group.files.length - 4}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Space selector */}
                    <td className="p-3 min-w-[220px]">
                      <Select
                        value={group.matchedSpaceId?.toString() ?? "__none__"}
                        onValueChange={(v) =>
                          setMatch(group.folderName, v === "__none__" ? null : Number(v))
                        }
                        disabled={!!st && st.status !== "error"}
                      >
                        <SelectTrigger className={`h-8 text-xs ${!group.matchedSpaceId ? "border-destructive" : ""}`}>
                          <SelectValue placeholder="Space 선택..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— 매칭 안 함 —</SelectItem>
                          {spaces.map((sp) => (
                            <SelectItem key={sp.id} value={sp.id.toString()}>
                              {sp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Photo count */}
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <ImageIcon className="h-3 w-3" />
                        {group.files.length}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="p-3 text-center">
                      {!st && (
                        <span className="text-muted-foreground text-xs">대기</span>
                      )}
                      {st?.status === "uploading" && (
                        <span className="inline-flex items-center gap-1 text-[#E8621A] text-xs">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          업로드 중
                        </span>
                      )}
                      {st?.status === "done" && (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          {st.uploaded}장 완료
                        </span>
                      )}
                      {st?.status === "error" && (
                        <span className="inline-flex items-center gap-1 text-destructive text-xs" title={st.error}>
                          <XCircle className="h-3 w-3" />
                          오류
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Progress bar during upload */}
      {uploading && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">업로드 진행 중...</p>
          <Progress
            value={Math.round(
              (Object.values(statuses).filter((s) => s.status === "done" || s.status === "error").length /
                groups.filter((g) => g.matchedSpaceId !== null).length) *
                100,
            )}
          />
        </div>
      )}

      {/* Upload Button */}
      {groups.length > 0 && !hasResults && (
        <div className="flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={uploading || matchedCount === 0}
            size="lg"
          >
            <Upload className="h-4 w-4 mr-2" />
            {matchedCount}개 Space에 {totalPhotos}장 업로드
          </Button>
        </div>
      )}

      {/* Re-upload option after completion */}
      {hasResults && !uploading && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => { setGroups([]); setStatuses({}); }}>
            초기화
          </Button>
          {errorCount > 0 && (
            <Button onClick={handleUpload}>
              <Upload className="h-4 w-4 mr-2" />
              오류 항목 재시도
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

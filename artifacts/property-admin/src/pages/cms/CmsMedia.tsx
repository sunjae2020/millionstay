import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Images, Folder, Search, RefreshCw, Loader2, Check, X } from "lucide-react";
import { MediaGrid, MEDIA_FOLDERS, type MediaFolder } from "@/components/MediaLibrary";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";

// Media centre — browse, upload and delete every marketing / website image, and
// describe it so it can be found again. Sensitive folders (private documents,
// condition reports, CS attachments, ID photos) are excluded server-side and
// never appear here.
//
// Alt text is not decoration: it is what a screen reader announces and what a
// search engine reads, and the block renderer puts it straight into the img tag.

const FOLDER_LABEL_KEYS: Record<string, string> = {
  content: "cms.folder_content",
  spaces: "cms.folder_spaces",
  listings: "cms.folder_listings",
  branding: "cms.folder_branding",
};

interface IndexedAsset {
  id: number;
  public_id: string;
  url: string;
  folder: string;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  tags: string[];
}

export default function CmsMedia() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [folder, setFolder] = useState<MediaFolder>("content");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const searching = search.trim().length > 0 || tag.length > 0;

  const { data: assets = [], isFetching } = useQuery<IndexedAsset[]>({
    queryKey: ["cms-media-assets", folder, search, tag],
    queryFn: async () => {
      const qs = new URLSearchParams({ folder });
      if (search.trim()) qs.set("q", search.trim());
      if (tag) qs.set("tag", tag);
      const res = await apiFetch(`/api/v1/cms/media/assets?${qs}`);
      if (!res.ok) throw new Error("Failed to load media");
      return res.json();
    },
  });

  const { data: tags = [] } = useQuery<{ tag: string; count: number }[]>({
    queryKey: ["cms-media-tags"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/cms/media/tags");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const sync = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/v1/cms/media/sync", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Sync failed");
      return res.json();
    },
    onSuccess: (result: { indexed: number; added: number }) => {
      qc.invalidateQueries({ queryKey: ["cms-media-assets"] });
      qc.invalidateQueries({ queryKey: ["cms-media-tags"] });
      toast({ title: t("cms.media_synced", { indexed: result.indexed, added: result.added }) });
    },
    onError: (err: Error) =>
      toast({ title: t("cms.media_sync_failed"), description: err.message, variant: "destructive" }),
  });

  const current = assets.find((a) => a.public_id === selected) ?? null;

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Images className="h-5 w-5" />
            {t("cms.media_title")}
          </>
        }
        subtitle={t("cms.media_subtitle")}
        actions={
          <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t("cms.media_sync")}
          </Button>
        }
      />

      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_300px] gap-6">
          <nav className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 pb-1">{t("cms.folders")}</p>
            {MEDIA_FOLDERS.map((name) => (
              <button
                key={name}
                onClick={() => {
                  setFolder(name);
                  setSelected(null);
                }}
                className={`w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                  folder === name ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <Folder className="h-4 w-4" />
                <span className="flex-1 text-left">
                  {t(FOLDER_LABEL_KEYS[name] ?? "", { defaultValue: name })}
                </span>
              </button>
            ))}

            {tags.length > 0 && (
              <div className="pt-4">
                <p className="text-xs font-medium text-muted-foreground px-2 pb-1">{t("cms.media_tags")}</p>
                <div className="flex flex-wrap gap-1 px-2">
                  {tags.map((row) => (
                    <button
                      key={row.tag}
                      onClick={() => setTag(tag === row.tag ? "" : row.tag)}
                      className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                        tag === row.tag
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {row.tag} {row.count}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 px-2">
              <Badge variant="outline" className="text-[10px] font-normal">
                {t("cms.media_privacy_note")}
              </Badge>
            </div>
          </nav>

          <div className="min-w-0">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={t("cms.media_search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Searching filters the INDEX; browsing shows the folder itself, so
                an image Cloudinary has but the index has not seen is still
                visible — and describing it is what puts it in the index. */}
            {searching ? (
              isFetching ? (
                <div className="p-10 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : assets.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">{t("cms.media_no_results")}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {assets.map((asset) => (
                    <button
                      key={asset.public_id}
                      onClick={() => setSelected(asset.public_id)}
                      className={`overflow-hidden rounded-lg border text-left transition-colors ${
                        selected === asset.public_id ? "border-primary" : "hover:border-primary/50"
                      }`}
                    >
                      <img src={asset.url} alt={asset.alt_text ?? ""} className="h-28 w-full object-cover" />
                      <p className="truncate px-2 py-1 text-[11px] text-muted-foreground">
                        {asset.alt_text || asset.public_id.split("/").pop()}
                      </p>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <MediaGrid
                key={folder}
                mode="manage"
                initialFolder={folder}
                onPick={(url) => setSelected(assets.find((a) => a.url === url)?.public_id ?? null)}
              />
            )}
          </div>

          <AssetDetail
            asset={current}
            folder={folder}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["cms-media-assets"] });
              qc.invalidateQueries({ queryKey: ["cms-media-tags"] });
            }}
          />
        </div>
      </div>
    </Layout>
  );
}

/** Caption and tag one image. */
function AssetDetail({
  asset,
  folder,
  onSaved,
}: {
  asset: IndexedAsset | null;
  folder: string;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [alt, setAlt] = useState("");
  const [tagText, setTagText] = useState("");

  useEffect(() => {
    setAlt(asset?.alt_text ?? "");
    setTagText((asset?.tags ?? []).join(", "));
  }, [asset]);

  const save = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      const res = await apiFetch(`/api/v1/cms/media/assets/${encodeURIComponent(asset.public_id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: asset.url,
          alt_text: alt.trim() || null,
          tags: tagText.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
    },
    onSuccess: () => {
      onSaved();
      toast({ title: t("cms.saved") });
    },
    onError: (err: Error) =>
      toast({ title: t("cms.save_failed"), description: err.message, variant: "destructive" }),
  });

  if (!asset) {
    return (
      <aside className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground h-fit">
        {t("cms.media_select_hint")}
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border p-4 space-y-4 h-fit">
      <img src={asset.url} alt={asset.alt_text ?? ""} className="w-full rounded-md object-cover" />
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p className="break-all">{asset.public_id}</p>
        {asset.width && asset.height && (
          <p>
            {asset.width} × {asset.height}
          </p>
        )}
        <p>{folder}</p>
      </div>
      <div>
        <Label className="text-xs">{t("cms.media_alt")}</Label>
        <Input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder={t("cms.alt_text_placeholder")} />
        <p className="text-[11px] text-muted-foreground mt-1">{t("cms.media_alt_hint")}</p>
      </div>
      <div>
        <Label className="text-xs">{t("cms.media_tags")}</Label>
        <Input
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          placeholder={t("cms.media_tags_placeholder")}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
          {t("common.save")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAlt(asset.alt_text ?? "");
            setTagText((asset.tags ?? []).join(", "));
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}

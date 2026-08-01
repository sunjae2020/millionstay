import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, LayoutTemplate } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { BLOCK_CATEGORIES, resolveTokens, type BlockCategory, type DesignTokens } from "@workspace/cms-blocks";
import { BlockPreview } from "./BlockPreview";

// The "UI Blocks" catalog modal. Options come from the API so a site can
// override a block's name/description/default props without a code change.

interface CatalogEntry {
  type: string;
  name: string;
  description: string;
  category: BlockCategory;
  previewImageUrl: string | null;
  isCustom: boolean;
  defaultProps: Record<string, unknown>;
}

export function BlockInsertDialog({
  open,
  onOpenChange,
  siteKey,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteKey: string;
  onPick: (type: string, defaultProps: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("_all");

  // Previews use the site's tokens so the picker shows the real thing.
  const { data: settings } = useQuery({
    queryKey: ["cms-site-settings", siteKey],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/cms/site-settings/${siteKey}`);
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    enabled: open && Boolean(siteKey),
  });
  const tokens: DesignTokens = resolveTokens(settings?.design_tokens);

  const { data: catalog = [] } = useQuery<CatalogEntry[]>({
    queryKey: ["cms-block-catalog", siteKey],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/cms/blocks?site=${encodeURIComponent(siteKey)}`);
      if (!res.ok) throw new Error("Failed to load blocks");
      return res.json();
    },
    enabled: open,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((entry) => {
      if (category !== "_all" && entry.category !== category) return false;
      if (!q) return true;
      return `${entry.name} ${entry.description} ${entry.type}`.toLowerCase().includes(q);
    });
  }, [catalog, search, category]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" />
            {t("cms.ui_blocks")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 pb-3 border-b">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("cms.search_blocks")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <CategoryChip active={category === "_all"} onClick={() => setCategory("_all")}>
              {t("cms.all_categories")}
            </CategoryChip>
            {BLOCK_CATEGORIES.map((c) => (
              <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)}>
                {t(`cms.category_${c.toLowerCase()}`, { defaultValue: c })}
              </CategoryChip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto py-3">
          {filtered.map((entry) => (
            <button
              key={entry.type}
              onClick={() => {
                onPick(entry.type, entry.defaultProps);
                onOpenChange(false);
              }}
              className="text-left rounded-lg border overflow-hidden hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <BlockPreview type={entry.type} props={entry.defaultProps} tokens={tokens} height={112} />
              <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-sm">{entry.name}</span>
                {entry.isCustom && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {t("cms.custom_preset")}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.description}</p>
              <Badge variant="outline" className="text-[10px] px-1 py-0 mt-2 font-normal">
                {t(`cms.category_${entry.category.toLowerCase()}`, { defaultValue: entry.category })}
              </Badge>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-8">
              {t("cms.no_blocks_found")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

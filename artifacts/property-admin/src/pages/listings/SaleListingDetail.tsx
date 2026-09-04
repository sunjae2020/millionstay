import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Save, Trash2, Building2, FileText, Settings, Languages, ImagePlus,
  Loader2, X, Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FileDropZone } from "@/components/FileDropZone";
import { apiFetch } from "@/lib/apiFetch";
import { ImagePreviewDialog, useImagePreview } from "@/components/ImagePreviewDialog";
import { CameraInput } from "@/components/CameraButton";

// Non-English locales the guest site (million-stay-web) ships. English is the
// source of truth, edited in the Content tab; these are the Translations tab.
const LANGUAGES = [
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "th", label: "Thai", flag: "🇹🇭" },
  { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
];

type LangCopy = { title: string; subtitle: string; location: string; price_label: string; description: string };
const EMPTY_COPY: LangCopy = { title: "", subtitle: "", location: "", price_label: "", description: "" };

const CATEGORY_OPTIONS = ["presale", "sale"] as const;
const STATUS_OPTIONS = ["available", "reserved", "sold"] as const;

const EMPTY_STRUCT = {
  category: "presale" as string,
  status: "available" as string,
  cover_image: "",
  gallery: [] as string[],
  area_m2: "",
  bedrooms: "",
  bathrooms: "",
  price_amount: "",
  sort_order: "0",
  published: false,
};

// Editable per-language copy fields (shared by Content + Translations tabs).
function CopyFields({
  copy, langLabel, onChange,
}: { copy: LangCopy; langLabel: string; onChange: (field: keyof LangCopy, val: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <Label>{t("listings.field_title")} ({langLabel})</Label>
          <Input className="mt-1" value={copy.title} onChange={(e) => onChange("title", e.target.value)} placeholder={t("listings.title_ph")} />
        </div>
        <div>
          <Label>{t("listings.field_subtitle")} ({langLabel})</Label>
          <Input className="mt-1" value={copy.subtitle} onChange={(e) => onChange("subtitle", e.target.value)} placeholder={t("listings.subtitle_ph")} />
        </div>
        <div>
          <Label>{t("listings.field_location")} ({langLabel})</Label>
          <Input className="mt-1" value={copy.location} onChange={(e) => onChange("location", e.target.value)} placeholder={t("listings.location_ph")} />
        </div>
        <div>
          <Label>{t("listings.field_price_label")} ({langLabel})</Label>
          <Input className="mt-1" value={copy.price_label} onChange={(e) => onChange("price_label", e.target.value)} placeholder={t("listings.price_label_ph")} />
        </div>
      </div>
      <div>
        <Label>{t("listings.field_description")} ({langLabel})</Label>
        <Textarea className="mt-1 resize-y" rows={6} value={copy.description} onChange={(e) => onChange("description", e.target.value)} placeholder={t("listings.description_ph")} />
      </div>
    </div>
  );
}

export default function SaleListingDetail() {
  const { t } = useTranslation();
  const { imagePreview, openImagePreview, closeImagePreview } = useImagePreview();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !params.id || params.id === "new";
  const [isSaving, setIsSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [struct, setStruct] = useState({ ...EMPTY_STRUCT });
  const [translations, setTranslations] = useState<Record<string, LangCopy>>({ en: { ...EMPTY_COPY } });
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["sale-listing", params.id],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/sale-listings/${params.id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (!listing) return;
    setStruct({
      category: listing.category ?? "presale",
      status: listing.status ?? "available",
      cover_image: listing.cover_image ?? "",
      gallery: Array.isArray(listing.gallery) ? listing.gallery : [],
      area_m2: listing.area_m2 != null ? String(listing.area_m2) : "",
      bedrooms: listing.bedrooms != null ? String(listing.bedrooms) : "",
      bathrooms: listing.bathrooms != null ? String(listing.bathrooms) : "",
      price_amount: listing.price_amount != null ? String(listing.price_amount) : "",
      sort_order: listing.sort_order != null ? String(listing.sort_order) : "0",
      published: !!listing.published,
    });
    const tr = (listing.translations && typeof listing.translations === "object") ? listing.translations : {};
    const parsed: Record<string, LangCopy> = { en: { ...EMPTY_COPY, ...(tr.en ?? {}) } };
    for (const lang of LANGUAGES) {
      if (tr[lang.code]) parsed[lang.code] = { ...EMPTY_COPY, ...tr[lang.code] };
    }
    setTranslations(parsed);
  }, [listing]);

  const setStructField = (key: keyof typeof EMPTY_STRUCT, val: any) =>
    setStruct((prev) => ({ ...prev, [key]: val }));

  const setCopy = (lang: string) => (field: keyof LangCopy, val: string) =>
    setTranslations((prev) => ({ ...prev, [lang]: { ...(prev[lang] ?? EMPTY_COPY), [field]: val } }));

  // Upload files → Cloudinary (via backend) → return URLs.
  async function uploadFiles(files: FileList | File[]): Promise<string[]> {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("images", f));
    const res = await apiFetch("/api/v1/sale-listings/images", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    return (data.urls ?? []) as string[];
  }

  async function onCoverSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setUploading(true);
    try {
      const [url] = await uploadFiles(e.target.files);
      if (url) setStructField("cover_image", url);
    } catch (err: any) {
      toast({ title: t("listings.upload_error"), description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function onGallerySelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    await addGalleryFiles(Array.from(e.target.files));
  }

  /** Shared by the picker and by drag-drop / ⌘V of a group of photos. */
  async function addGalleryFiles(picked: File[]) {
    const files = picked.filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await uploadFiles(files);
      setStruct((prev) => ({ ...prev, gallery: [...prev.gallery, ...urls] }));
    } catch (err: any) {
      toast({ title: t("listings.upload_error"), description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  const handleSave = async () => {
    if (!translations.en?.title?.trim()) {
      toast({ title: t("listings.title_required"), variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      // Drop empty locales so we don't persist blank objects.
      const cleanTr: Record<string, LangCopy> = {};
      for (const [lang, c] of Object.entries(translations)) {
        if (c && Object.values(c).some((v) => String(v ?? "").trim() !== "")) cleanTr[lang] = c;
      }
      const payload = {
        category: struct.category,
        status: struct.status,
        cover_image: struct.cover_image || null,
        gallery: struct.gallery,
        area_m2: struct.area_m2 === "" ? null : struct.area_m2,
        bedrooms: struct.bedrooms === "" ? null : struct.bedrooms,
        bathrooms: struct.bathrooms === "" ? null : struct.bathrooms,
        price_amount: struct.price_amount === "" ? null : struct.price_amount,
        sort_order: struct.sort_order === "" ? 0 : struct.sort_order,
        published: struct.published,
        translations: cleanTr,
      };
      const res = await apiFetch(isNew ? "/api/v1/sale-listings" : `/api/v1/sale-listings/${params.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      qc.invalidateQueries({ queryKey: ["sale-listings"] });
      toast({ title: isNew ? t("listings.created") : t("listings.updated") });
      if (isNew) navigate(`/content/listings/${data.id}`);
    } catch (err: any) {
      toast({ title: t("listings.error"), description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`/api/v1/sale-listings/${params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      qc.invalidateQueries({ queryKey: ["sale-listings"] });
      toast({ title: t("listings.deleted") });
      navigate("/content/listings");
    } catch (err: any) {
      toast({ title: t("listings.error"), description: err.message, variant: "destructive" });
    }
    setDeleteOpen(false);
  };

  if (!isNew && isLoading) {
    return <Layout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></Layout>;
  }

  return (
    <Layout>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/content/listings")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Building2 className="h-5 w-5" />
            {isNew ? t("listings.new") : translations.en?.title || t("listings.edit")}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="content" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="content" className="gap-1.5"><FileText className="h-3.5 w-3.5" />{t("listings.tab_content")}</TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5"><ImagePlus className="h-3.5 w-3.5" />{t("listings.tab_media")}</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-3.5 w-3.5" />{t("listings.tab_settings")}</TabsTrigger>
            <TabsTrigger value="translations" className="gap-1.5"><Languages className="h-3.5 w-3.5" />{t("listings.tab_translations")}</TabsTrigger>
          </TabsList>

          {/* Content — English (source of truth) */}
          <TabsContent value="content">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 mb-4">
              {t("listings.content_info")}
            </div>
            <CopyFields copy={translations.en ?? EMPTY_COPY} langLabel="English" onChange={setCopy("en")} />
          </TabsContent>

          {/* Media */}
          <TabsContent value="media" className="space-y-6 max-w-3xl">
            <div>
              <Label className="mb-2 block">{t("listings.field_cover")}</Label>
              <div className="flex items-center gap-4">
                <div className="w-40 h-28 rounded-lg border bg-muted overflow-hidden flex items-center justify-center">
                  {struct.cover_image
                    ? <img
                        src={struct.cover_image}
                        alt=""
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => openImagePreview([{ url: struct.cover_image }])}
                      />
                    : <ImagePlus className="h-6 w-6 text-muted-foreground/40" />}
                </div>
                <div className="space-y-2">
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onCoverSelected} />
                  {/* 폰에서는 찍는 것이 곧 첨부다. 같은 핸들러로 들어간다. */}
                  <CameraInput onChange={onCoverSelected} multiple={false} />
                  <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => coverInputRef.current?.click()}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ImagePlus className="h-3.5 w-3.5 mr-1.5" />}
                    {t("listings.upload_cover")}
                  </Button>
                  {struct.cover_image && (
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setStructField("cover_image", "")}>
                      <X className="h-3.5 w-3.5 mr-1.5" />{t("listings.remove")}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">{t("listings.field_gallery")}</Label>
              <FileDropZone onFiles={(files) => void addGalleryFiles(files)} busy={uploading}>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {struct.gallery.map((url, i) => (
                  <div key={`${url}-${i}`} className="relative group aspect-[4/3] rounded-lg border overflow-hidden bg-muted">
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover cursor-zoom-in"
                      onClick={() => openImagePreview(struct.gallery.map((u) => ({ url: u })), i)}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 [&>*]:pointer-events-auto">
                      <Button type="button" size="icon" variant="secondary" className="h-7 w-7" title={t("listings.set_cover")}
                        onClick={() => setStructField("cover_image", url)}>
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="destructive" className="h-7 w-7"
                        onClick={() => setStruct((prev) => ({ ...prev, gallery: prev.gallery.filter((_, j) => j !== i) }))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <button type="button" disabled={uploading} onClick={() => galleryInputRef.current?.click()}
                  className="aspect-[4/3] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  <span className="text-xs">{t("listings.add_images")}</span>
                </button>
                <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onGallerySelected} />
                {/* 폰에서는 찍는 것이 곧 첨부다. 같은 핸들러로 들어간다. */}
                <CameraInput onChange={onGallerySelected} />
              </div>
              </FileDropZone>
            </div>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="space-y-5 max-w-2xl">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label>{t("listings.col_category")}</Label>
                <Select value={struct.category} onValueChange={(v) => setStructField("category", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{t(`listings.category_${c}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("common.status")}</Label>
                <Select value={struct.status} onValueChange={(v) => setStructField("status", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{t(`listings.status_${s}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label>{t("listings.field_area")}</Label>
                <Input className="mt-1" type="number" step="0.01" value={struct.area_m2} onChange={(e) => setStructField("area_m2", e.target.value)} placeholder="84.50" />
              </div>
              <div>
                <Label>{t("listings.field_bedrooms")}</Label>
                <Input className="mt-1" type="number" value={struct.bedrooms} onChange={(e) => setStructField("bedrooms", e.target.value)} placeholder="3" />
              </div>
              <div>
                <Label>{t("listings.field_bathrooms")}</Label>
                <Input className="mt-1" type="number" value={struct.bathrooms} onChange={(e) => setStructField("bathrooms", e.target.value)} placeholder="2" />
              </div>
              <div>
                <Label>{t("listings.field_sort_order")}</Label>
                <Input className="mt-1" type="number" value={struct.sort_order} onChange={(e) => setStructField("sort_order", e.target.value)} placeholder="0" />
              </div>
            </div>

            <div>
              <Label>{t("listings.field_price_amount")}</Label>
              <Input className="mt-1 max-w-xs" type="number" step="0.01" value={struct.price_amount} onChange={(e) => setStructField("price_amount", e.target.value)} placeholder="320000000" />
              <p className="text-xs text-muted-foreground mt-1">{t("listings.price_amount_hint")}</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch checked={struct.published} onCheckedChange={(v) => setStructField("published", v)} />
              <div>
                <Label className="cursor-pointer">{t("listings.field_published")}</Label>
                <p className="text-xs text-muted-foreground">{t("listings.published_hint")}</p>
              </div>
            </div>
          </TabsContent>

          {/* Translations */}
          <TabsContent value="translations">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 mb-4">
              {t("listings.translations_info")}
            </div>
            <Tabs defaultValue="ko">
              <TabsList className="flex flex-wrap gap-1 h-auto mb-4">
                {LANGUAGES.map((lang) => {
                  const hasData = !!(translations[lang.code]?.title || translations[lang.code]?.description);
                  return (
                    <TabsTrigger key={lang.code} value={lang.code} className="gap-1.5 relative">
                      <span>{lang.flag}</span>
                      <span>{t(`listings.lang_${lang.code}`, { defaultValue: lang.label })}</span>
                      {hasData && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {LANGUAGES.map((lang) => {
                const langLabel = t(`listings.lang_${lang.code}`, { defaultValue: lang.label });
                return (
                  <TabsContent key={lang.code} value={lang.code}>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                      <span className="text-xl">{lang.flag}</span>
                      {t("listings.lang_fill_in", { lang: langLabel })}
                    </div>
                    <CopyFields copy={translations[lang.code] ?? EMPTY_COPY} langLabel={langLabel} onChange={setCopy(lang.code)} />
                  </TabsContent>
                );
              })}
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("listings.delete_this")}</AlertDialogTitle>
            <AlertDialogDescription>{t("listings.delete_confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete}>{t("common.delete")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImagePreviewDialog config={imagePreview} onClose={closeImagePreview} />
    </Layout>
  );
}

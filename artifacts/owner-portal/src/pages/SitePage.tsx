import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet, apiPut, apiUpload, ApiError } from "@/lib/api";
import { Globe, ExternalLink, Check, X, Loader2, Save, Upload, Image as ImageIcon, Trash2 } from "lucide-react";
import { CameraInput } from "@/components/CameraButton";

// Mirror of owner_sites: the editable shape of an owner's landing site.
interface OwnerSite {
  slug: string;
  status: "draft" | "published";
  logo_url: string | null;
  primary_color: string;
  hero_image_url: string | null;
  content: Record<string, LangContent>;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
}

interface LangContent {
  hero_title?: string;
  hero_subtitle?: string;
  about?: string;
  contact_email?: string;
  contact_phone?: string;
}

const ROOT_DOMAIN = "millionstay.com";

// One-click colour themes so owners can brand without picking hex codes.
const THEME_PRESETS = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#0f172a"];

const EMPTY: OwnerSite = {
  slug: "",
  status: "published",
  logo_url: "",
  primary_color: "#0ea5e9",
  hero_image_url: "",
  content: {},
  seo_title: "",
  seo_description: "",
  og_image_url: "",
};

export default function SitePage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.slice(0, 2) || "en";

  const [site, setSite] = useState<OwnerSite>(EMPTY);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Slug availability: null = unchecked, true/false = result.
  const [slugState, setSlugState] = useState<{ checking: boolean; available: boolean | null; reason: string | null }>({
    checking: false, available: null, reason: null,
  });
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiGet<{ success: boolean; data: OwnerSite | null }>("/v1/owner/site")
      .then((d) => {
        if (d.data) {
          setSite({ ...EMPTY, ...d.data, content: d.data.content ?? {} });
          setExists(true);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function patch<K extends keyof OwnerSite>(key: K, value: OwnerSite[K]) {
    setSite((s) => ({ ...s, [key]: value }));
    setSaved(false);
  }

  function patchContent(field: keyof LangContent, value: string) {
    setSite((s) => ({
      ...s,
      content: { ...s.content, [lang]: { ...(s.content[lang] ?? {}), [field]: value } },
    }));
    setSaved(false);
  }

  function onSlugChange(raw: string) {
    const slug = raw.trim().toLowerCase();
    patch("slug", slug);
    setSlugState({ checking: !!slug, available: null, reason: null });
    if (slugTimer.current) clearTimeout(slugTimer.current);
    if (!slug) { setSlugState({ checking: false, available: null, reason: null }); return; }
    slugTimer.current = setTimeout(async () => {
      try {
        const r = await apiGet<{ available: boolean; reason: string | null }>(
          `/v1/owner/site/slug-available?slug=${encodeURIComponent(slug)}`,
        );
        setSlugState({ checking: false, available: r.available, reason: r.reason });
      } catch {
        setSlugState({ checking: false, available: null, reason: null });
      }
    }, 400);
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const r = await apiPut<{ success: boolean; data: OwnerSite }>("/v1/owner/site", site);
      setSite({ ...EMPTY, ...r.data, content: r.data.content ?? {} });
      setExists(true);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const c = site.content[lang] ?? {};
  const liveUrl = site.slug ? `https://${site.slug}.${ROOT_DOMAIN}` : null;
  const canSave = !!site.slug && slugState.available !== false && !saving;

  return (
    <Layout>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" /> {t("site.title", "My Landing Site")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("site.subtitle", "Your own public page where guests browse and book only your accommodation.")}</p>
        </div>
        {exists && liveUrl && site.status === "published" && (
          <a href={liveUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ExternalLink className="w-4 h-4" /> {t("site.view_site", "View site")}
          </a>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="bg-card border border-card-border rounded-xl p-6 animate-pulse h-96" />
      ) : (
        <div className="space-y-6 max-w-3xl">
          {/* ── Subdomain + publish ── */}
          <section className="bg-card border border-card-border rounded-xl p-6">
            <h2 className="font-semibold text-foreground mb-4">{t("site.address", "Address & visibility")}</h2>

            <label className="block text-sm font-medium text-foreground mb-1.5">{t("site.subdomain", "Subdomain")}</label>
            <div className="flex items-center gap-2">
              <input
                value={site.slug}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder="harbourview"
                className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.{ROOT_DOMAIN}</span>
            </div>
            <div className="h-5 mt-1.5 text-xs">
              {slugState.checking && <span className="text-muted-foreground inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {t("site.checking", "Checking…")}</span>}
              {!slugState.checking && slugState.available === true && <span className="text-green-600 inline-flex items-center gap-1"><Check className="w-3 h-3" /> {t("site.available", "Available")}</span>}
              {!slugState.checking && slugState.available === false && <span className="text-destructive inline-flex items-center gap-1"><X className="w-3 h-3" /> {t(`site.slug_${slugState.reason}`, t("site.unavailable", "Not available"))}</span>}
            </div>

            <label className="mt-4 flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={site.status === "published"}
                onChange={(e) => patch("status", e.target.checked ? "published" : "draft")}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm text-foreground">{t("site.published", "Published (live to the public)")}</span>
            </label>
          </section>

          {/* ── Branding ── */}
          <section className="bg-card border border-card-border rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-foreground">{t("site.branding", "Branding")}</h2>
            <ImageField label={t("site.logo", "Logo")} value={site.logo_url ?? ""} onChange={(v) => patch("logo_url", v)} aspect="h-16 w-16" />
            <ImageField label={t("site.hero_image", "Hero background")} value={site.hero_image_url ?? ""} onChange={(v) => patch("hero_image_url", v)} aspect="h-28 w-full" />
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t("site.primary_color", "Primary color")}</label>
              <div className="flex items-center gap-3 flex-wrap">
                <input type="color" value={site.primary_color} onChange={(e) => patch("primary_color", e.target.value)} className="h-9 w-12 rounded border border-border bg-background p-1" />
                <input value={site.primary_color} onChange={(e) => patch("primary_color", e.target.value)} className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <div className="flex items-center gap-1.5">
                  {THEME_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patch("primary_color", c)}
                      aria-label={c}
                      className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${site.primary_color.toLowerCase() === c ? "border-foreground" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Content (per language) ── */}
          <section className="bg-card border border-card-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">{t("site.content", "Content")}</h2>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground uppercase">{lang}</span>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">{t("site.content_hint", "Editing the {{lang}} version — switch language in the sidebar to translate.", { lang })}</p>
            <Field label={t("site.hero_title", "Hero title")} value={c.hero_title ?? ""} onChange={(v) => patchContent("hero_title", v)} />
            <Field label={t("site.hero_subtitle", "Hero subtitle")} value={c.hero_subtitle ?? ""} onChange={(v) => patchContent("hero_subtitle", v)} />
            <TextArea label={t("site.about", "About / introduction")} value={c.about ?? ""} onChange={(v) => patchContent("about", v)} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("site.contact_email", "Contact email")} value={c.contact_email ?? ""} onChange={(v) => patchContent("contact_email", v)} />
              <Field label={t("site.contact_phone", "Contact phone")} value={c.contact_phone ?? ""} onChange={(v) => patchContent("contact_phone", v)} />
            </div>
          </section>

          {/* ── SEO ── */}
          <section className="bg-card border border-card-border rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-foreground">{t("site.seo", "Search & sharing (SEO)")}</h2>
            <Field label={t("site.seo_title", "SEO title")} value={site.seo_title ?? ""} onChange={(v) => patch("seo_title", v)} />
            <TextArea label={t("site.seo_description", "SEO description")} value={site.seo_description ?? ""} onChange={(v) => patch("seo_description", v)} />
            <ImageField label={t("site.og_image", "Social share image")} value={site.og_image_url ?? ""} onChange={(v) => patch("og_image_url", v)} aspect="h-28 w-full" />
          </section>

          <div className="flex items-center gap-3 sticky bottom-0 bg-background/80 backdrop-blur py-3">
            <button
              onClick={save}
              disabled={!canSave}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {exists ? t("site.save", "Save changes") : t("site.create", "Create site")}
            </button>
            {saved && <span className="text-sm text-green-600 inline-flex items-center gap-1"><Check className="w-4 h-4" /> {t("site.saved", "Saved")}</span>}
          </div>
        </div>
      )}
    </Layout>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}

function ImageField({ label, value, onChange, aspect }: { label: string; value: string; onChange: (v: string) => void; aspect: string }) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await apiUpload<{ url: string }>("/v1/owner/site/upload-image", fd);
      onChange(r.url);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : String(e2));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <div className={`${aspect} max-w-[12rem] rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center flex-shrink-0`}>
          {value ? (
            <img src={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
          {/* 폰에서는 찍는 것이 곧 첨부다. 같은 핸들러로 들어간다. */}
          <CameraInput onChange={onPick} multiple={false} disabled={uploading} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? t("site.uploading", "Uploading…") : t("site.upload", "Upload")}
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3 h-3" /> {t("site.remove", "Remove")}
            </button>
          )}
        </div>
      </div>
      {err && <p className="text-xs text-destructive mt-1.5">{err}</p>}
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
      />
    </div>
  );
}

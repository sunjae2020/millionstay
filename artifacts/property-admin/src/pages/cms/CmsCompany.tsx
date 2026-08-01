import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Save, Info, Loader2, Images } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { MediaPickerDialog } from "@/components/MediaLibrary";

// The CMS view of company information: the fields the PUBLIC sites show
// (footer, legal pages, contact block). It reads and writes the SAME
// `company_info` blob that Settings → Organisation owns — one source of truth,
// two entry points. Editing here changes the documents issuer block too, so the
// screen says so rather than pretending the two are separate.

interface CompanyInfo {
  company_name?: string;
  trading_name?: string;
  ceo?: string;
  biz_no?: string;
  abn?: string;
  phone?: string;
  email?: string;
  website?: string;
  address1?: string;
  address2?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
  logo_url?: string;
  privacy_officer?: string;
}

const FIELDS: { key: keyof CompanyInfo; labelKey: string; wide?: boolean }[] = [
  { key: "company_name", labelKey: "cms.company_name" },
  { key: "trading_name", labelKey: "cms.trading_name" },
  { key: "ceo", labelKey: "cms.company_ceo" },
  { key: "biz_no", labelKey: "cms.company_biz_no" },
  { key: "abn", labelKey: "cms.company_abn" },
  { key: "phone", labelKey: "cms.company_phone" },
  { key: "email", labelKey: "cms.company_email" },
  { key: "website", labelKey: "cms.company_website" },
  { key: "address1", labelKey: "cms.company_address1", wide: true },
  { key: "address2", labelKey: "cms.company_address2", wide: true },
  { key: "suburb", labelKey: "cms.company_suburb" },
  { key: "state", labelKey: "cms.company_state" },
  { key: "postcode", labelKey: "cms.company_postcode" },
  { key: "country", labelKey: "cms.company_country" },
  { key: "privacy_officer", labelKey: "cms.company_privacy_officer" },
];

export default function CmsCompany() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [info, setInfo] = useState<CompanyInfo>({});
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);

  const { data, isLoading } = useQuery<CompanyInfo>({
    queryKey: ["company-info"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/company-info");
      if (!res.ok) throw new Error("Failed to load company info");
      return res.json();
    },
  });

  useEffect(() => {
    if (data) setInfo(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/v1/company-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-info"] });
      toast({ title: t("cms.saved") });
    },
    onError: (err: Error) => toast({ title: t("cms.save_failed"), description: err.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Building2 className="h-5 w-5" />
            {t("cms.company_title")}
          </>
        }
        subtitle={t("cms.company_subtitle")}
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {t("common.save")}
          </Button>
        }
      />

      <div className="p-6 max-w-4xl space-y-6">
        <div className="flex items-start gap-2 rounded-lg border bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {t("cms.company_shared_notice")}{" "}
            <Link href="/settings/organisation" className="underline">
              {t("cms.company_settings_link")}
            </Link>
          </span>
        </div>

        {isLoading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("cms.company_details")}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FIELDS.map((field) => (
                  <div key={field.key} className={field.wide ? "sm:col-span-2" : ""}>
                    <Label className="text-sm">{t(field.labelKey)}</Label>
                    <Input
                      value={info[field.key] ?? ""}
                      onChange={(e) => setInfo({ ...info, [field.key]: e.target.value })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("cms.company_logo")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <div className="h-20 w-32 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden">
                    {info.logo_url ? (
                      <img src={info.logo_url} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <Images className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={info.logo_url ?? ""}
                      placeholder="https://…"
                      onChange={(e) => setInfo({ ...info, logo_url: e.target.value })}
                    />
                    <Button variant="outline" onClick={() => setLogoPickerOpen(true)}>
                      {t("cms.choose_image")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("cms.company_public_preview")}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* What the public footer / legal pages will read from these fields. */}
                <div className="rounded-md border bg-muted/20 p-4 text-sm space-y-1 text-muted-foreground">
                  <p className="font-medium text-foreground">{info.trading_name || info.company_name || "—"}</p>
                  {info.ceo && <p>{t("cms.company_ceo")}: {info.ceo}</p>}
                  {info.biz_no && <p>{t("cms.company_biz_no")}: {info.biz_no}</p>}
                  <p>{[info.address1, info.address2, info.suburb, info.state, info.postcode, info.country].filter(Boolean).join(", ") || "—"}</p>
                  <p>{[info.phone, info.email].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{t("cms.company_preview_hint")}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <MediaPickerDialog
        open={logoPickerOpen}
        onOpenChange={setLogoPickerOpen}
        initialFolder="branding"
        onPick={(url) => setInfo({ ...info, logo_url: url })}
      />
    </Layout>
  );
}

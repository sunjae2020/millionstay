import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

// Shared intake form for the development site's three lead funnels (Buy /
// long-term Rent / Management). The caller supplies the submit fn and which
// optional structured fields to show; on success the form flips to a thank-you
// state showing the lead reference. Styled with the instance brand tokens.

export interface InquiryExtraField {
  name: string;        // maps to the submit payload key
  labelKey: string;    // i18n key for the field label
  placeholderKey?: string;
  type?: "text" | "textarea";
}

export interface InquiryFormValues {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  message?: string;
  [k: string]: string | undefined;
}

export function InquiryForm({
  extraFields = [],
  submitLabelKey = "dev.form.submit",
  onSubmit,
}: {
  extraFields?: InquiryExtraField[];
  submitLabelKey?: string;
  onSubmit: (values: InquiryFormValues) => Promise<{ lead_ref: string }>;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [values, setValues] = useState<InquiryFormValues>({ first_name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [doneRef, setDoneRef] = useState<string | null>(null);

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.first_name.trim() || !/^\S+@\S+\.\S+$/.test(values.email)) {
      toast({ title: t("dev.form.invalid"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await onSubmit(values);
      setDoneRef(res.lead_ref);
    } catch (err) {
      toast({ title: t("dev.form.error"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (doneRef) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
        <CheckCircle2 className="w-12 h-12 mx-auto text-primary" />
        <h3 className="mt-4 text-xl font-bold text-gray-900">{t("dev.form.thanks_title")}</h3>
        <p className="mt-2 text-sm text-gray-600">{t("dev.form.thanks_body")}</p>
        <p className="mt-3 text-xs text-gray-500">
          {t("dev.form.ref")}: <span className="font-mono font-semibold text-primary">{doneRef}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("dev.form.name")} *</Label>
          <Input value={values.first_name} onChange={(e) => set("first_name", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>{t("dev.form.phone")}</Label>
          <Input value={values.phone ?? ""} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("dev.form.email")} *</Label>
        <Input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} required />
      </div>

      {extraFields.map((f) => (
        <div key={f.name} className="space-y-1.5">
          <Label>{t(f.labelKey)}</Label>
          {f.type === "textarea" ? (
            <Textarea
              rows={3}
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholderKey ? t(f.placeholderKey) : undefined}
            />
          ) : (
            <Input
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholderKey ? t(f.placeholderKey) : undefined}
            />
          )}
        </div>
      ))}

      <div className="space-y-1.5">
        <Label>{t("dev.form.message")}</Label>
        <Textarea rows={4} value={values.message ?? ""} onChange={(e) => set("message", e.target.value)} />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {t(submitLabelKey)}
      </button>
      <p className="text-xs text-center text-gray-400">{t("dev.form.privacy_note")}</p>
    </form>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LookupSelect } from "@/components/LookupSelect";
import { apiFetch } from "@/lib/apiFetch";

/**
 * Attach a person to an account, from the account's 연락처 tab.
 *
 * Two modes on one dialog: create a brand-new contact inline (the common case —
 * a new 담당자 handed over on the phone), or link a contact that already exists.
 * The role picker chooses between the account's two designated slots
 * (주/부 연락처, stored on the account row) and a plain link with a free-text
 * role, which is what `account_contacts` is for.
 */
export type ContactRoleChoice = "primary" | "secondary" | "member";

interface Props {
  accountId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ids already attached — hidden from the existing-contact picker. */
  linkedContactIds?: number[];
  onSaved: () => void;
}

export function AddAccountContactDialog({ accountId, open, onOpenChange, linkedContactIds, onSaved }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [role, setRole] = useState<ContactRoleChoice>("member");
  const [roleLabel, setRoleLabel] = useState("");
  const [contactId, setContactId] = useState<number | null>(null);
  const [form, setForm] = useState({
    last_name: "", first_name: "", email: "", mobile_number: "", job_title: "", department: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("new");
    setRole("member");
    setRoleLabel("");
    setContactId(null);
    setForm({ last_name: "", first_name: "", email: "", mobile_number: "", job_title: "", department: "" });
    setError(null);
  }, [open]);

  const canSave = mode === "existing"
    ? !!contactId
    : !!(form.last_name.trim() || form.first_name.trim());

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...(mode === "existing" ? { contact_id: contactId } : { contact: form }),
        ...(role === "member" ? { role: roleLabel.trim() || null } : { as_slot: role }),
      };
      const res = await apiFetch(`/api/v1/accounts/${accountId}/contacts`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t("account.contact_link_failed"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account.contact_link_failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("account.add_contact")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={mode === "new" ? "default" : "outline"}
              onClick={() => setMode("new")}>
              {t("account.contact_mode_new")}
            </Button>
            <Button type="button" size="sm" variant={mode === "existing" ? "default" : "outline"}
              onClick={() => setMode("existing")}>
              {t("account.contact_mode_existing")}
            </Button>
          </div>

          {mode === "existing" ? (
            <div className="grid gap-1.5">
              <Label>{t("account.contact_pick_existing")}</Label>
              <LookupSelect
                value={contactId}
                onChange={setContactId}
                lookupUrl="/api/v1/lookup/contacts"
                placeholder={t("contact.search_placeholder")}
                excludeIds={linkedContactIds ?? []}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>{t("contact.label_last_name")} *</Label>
                  <Input value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("contact.label_first_name")}</Label>
                  <Input value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>{t("contact.label_email")}</Label>
                  <Input type="email" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("contact.label_mobile")}</Label>
                  <Input value={form.mobile_number}
                    onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>{t("contact.label_department")}</Label>
                  <Input value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("contact.label_job_title")}</Label>
                  <Input value={form.job_title}
                    onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("account.col_role")}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as ContactRoleChoice)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t("account.role_member")}</SelectItem>
                  <SelectItem value="primary">{t("account.role_primary")}</SelectItem>
                  <SelectItem value="secondary">{t("account.role_secondary")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === "member" && (
              <div className="grid gap-1.5">
                <Label>{t("account.contact_role_label")}</Label>
                <Input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)}
                  placeholder={t("account.contact_role_placeholder")} />
              </div>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddAccountContactDialog;

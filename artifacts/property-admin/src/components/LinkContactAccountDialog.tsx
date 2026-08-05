import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountLookupSelect } from "@/components/AccountLookupSelect";
import { apiFetch } from "@/lib/apiFetch";

/**
 * The mirror of AddAccountContactDialog: attach this contact to an account from
 * the contact's 계정 tab. Only existing accounts — an account is a company
 * record with its own onboarding, not something to create from a person's page.
 */
interface Props {
  contactId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedAccountIds?: number[];
  onSaved: () => void;
}

export function LinkContactAccountDialog({ contactId, open, onOpenChange, linkedAccountIds, onSaved }: Props) {
  const { t } = useTranslation();
  const [accountId, setAccountId] = useState<number | null>(null);
  const [role, setRole] = useState<"member" | "primary" | "secondary">("member");
  const [roleLabel, setRoleLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAccountId(null);
    setRole("member");
    setRoleLabel("");
    setError(null);
  }, [open]);

  async function handleSave() {
    if (!accountId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/contacts/${contactId}/accounts`, {
        method: "POST",
        body: JSON.stringify({
          account_id: accountId,
          ...(role === "member" ? { role: roleLabel.trim() || null } : { as_slot: role }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t("contact.account_link_failed"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("contact.account_link_failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("contact.link_account")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label>{t("contact.pick_account")}</Label>
            <AccountLookupSelect
              value={accountId}
              onChange={setAccountId}
              lookupUrl="/api/v1/lookup/accounts"
              placeholder={t("account.search_placeholder")}
              excludeIds={linkedAccountIds ?? []}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("account.col_role")}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
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
          <Button onClick={handleSave} disabled={!accountId || saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LinkContactAccountDialog;

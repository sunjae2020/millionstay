import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { convertProspect, type Prospect } from "@/lib/marketing/api";

/**
 * Account types a prospect can graduate into. Deliberately a subset of the full
 * account_type vocabulary — Guest and Tenant are outcomes of a booking or a
 * lease, not of partner development.
 */
const ACCOUNT_TYPES = [
  { value: "Agent", i18n: "account.type_agent" },
  { value: "SpaceOwner", i18n: "account.type_space_owner" },
  { value: "Partner", i18n: "account.type_partner" },
  { value: "ServiceHost", i18n: "account.type_service_host" },
  { value: "HomestayHost", i18n: "account.type_homestay_host" },
] as const;

/** Which account type a segment usually becomes; the admin can override it. */
const SEGMENT_DEFAULT: Record<string, string> = {
  owner: "SpaceOwner",
  agency: "Agent",
  education: "Agent",
  corporate: "Partner",
  service: "ServiceHost",
};

interface Props {
  prospect: Prospect | null;
  onOpenChange: (open: boolean) => void;
  onConverted: () => void;
}

export function ConvertToAccountModal({ prospect, onOpenChange, onConverted }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [accountType, setAccountType] = useState<string>("Agent");
  const [accountName, setAccountName] = useState("");
  const [createTask, setCreateTask] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!prospect) return;
    setAccountType(SEGMENT_DEFAULT[prospect.segment] ?? "Agent");
    setAccountName(prospect.company_name);
    setCreateTask(true);
  }, [prospect]);

  async function handleConvert() {
    if (!prospect) return;
    setBusy(true);
    try {
      const result = await convertProspect(prospect.id, {
        account_type: accountType,
        account_name: accountName.trim() || undefined,
        create_task: createTask,
      });
      toast({
        title: t("marketing.convert_success"),
        description: t("marketing.convert_success_desc", { name: result.account.name }),
      });
      onConverted();
    } catch (err) {
      toast({
        title: t("marketing.convert_failed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!prospect} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("marketing.convert_to_account")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("marketing.convert_explain")}</p>

          <div className="space-y-2">
            <Label>{t("marketing.account_name")}</Label>
            <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t("marketing.account_type")}</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {t(type.i18n, { defaultValue: type.value })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={createTask} onCheckedChange={(v) => setCreateTask(v === true)} />
            {t("marketing.create_onboarding_task")}
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConvert} disabled={busy || !accountName.trim()}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
            {t("marketing.convert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

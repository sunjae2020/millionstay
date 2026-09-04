import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/date";
import { useToast } from "@/hooks/use-toast";
import {
  passkeysSupported,
  isPasskeyCancel,
  listPasskeys,
  registerPasskey,
  deletePasskey,
  type PasskeyCredential,
} from "@/lib/passkey";
import { ArrowLeft, KeyRound, Loader2, Plus, Smartphone, Trash2 } from "lucide-react";

// Per-user passkey management. Registering a device here is what enables the
// one-tap sign-in on the login screen; the password keeps working regardless.
export default function PasskeysPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [rows, setRows] = useState<PasskeyCredential[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await listPasskeys()); } catch { setRows([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    setBusy(true);
    try {
      const created = await registerPasskey();
      toast({
        title: t("passkeys.toast_added_title", "Passkey added"),
        description: created.device_name ?? undefined,
      });
      await load();
    } catch (err: any) {
      if (!isPasskeyCancel(err)) {
        toast({
          variant: "destructive",
          title: t("passkeys.toast_add_failed", "Could not add the passkey"),
          description: err?.message,
        });
      }
    } finally { setBusy(false); }
  }

  async function remove(row: PasskeyCredential) {
    if (!window.confirm(t("passkeys.remove_confirm", "Remove this passkey? That device will have to use its password again."))) return;
    try {
      await deletePasskey(row.id);
      await load();
    } catch (err: any) {
      toast({ variant: "destructive", title: t("passkeys.toast_remove_failed", "Could not remove the passkey"), description: err?.message });
    }
  }

  return (
    <Layout>
      <PageHeader
        title={t("passkeys.title", "Passkeys")}
        subtitle={t("passkeys.subtitle", "Sign in with Face ID, a fingerprint or your device PIN instead of a password.")}
        actions={
          <div className="flex gap-2">
            <Link href="/settings">
              <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t("common.back_to_settings")}</Button>
            </Link>
            {passkeysSupported() && (
              <Button size="sm" className="gap-1.5" onClick={add} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t("passkeys.add", "Add this device")}
              </Button>
            )}
          </div>
        }
      />

      <div className="p-4 sm:p-6 max-w-3xl">
        {!passkeysSupported() && (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            {t("passkeys.unsupported", "This browser does not support passkeys.")}
          </p>
        )}

        {rows === null ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <KeyRound className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("passkeys.empty", "No passkeys registered yet. Add the device you use most.")}
            </p>
          </div>
        ) : (
          <ul className="rounded-xl border bg-card divide-y">
            {rows.map((c) => (
              <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.device_name ?? t("passkeys.unnamed", "Passkey")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("passkeys.added_on", "Added")} {formatDateTime(c.created_at)}
                      {c.last_used_at ? ` · ${t("passkeys.last_used", "Last used")} ${formatDateTime(c.last_used_at)}` : ""}
                      {c.backed_up ? ` · ${t("passkeys.synced", "Synced")}` : ""}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(c)} title={t("passkeys.remove", "Remove")}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}

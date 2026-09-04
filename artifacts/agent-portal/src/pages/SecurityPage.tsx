import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { formatDateTime } from "@/lib/dateFormat";
import {
  passkeysSupported,
  isPasskeyCancel,
  listPasskeys,
  registerPasskey,
  deletePasskey,
  type PasskeyCredential,
} from "@/lib/passkey";
import { KeyRound, Plus, Trash2, ShieldCheck, Loader2 } from "lucide-react";

// Passkey management. Registering here is what makes the one-tap sign-in on the
// login screen possible — the password stays valid either way.
export default function SecurityPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<PasskeyCredential[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try { setRows(await listPasskeys()); } catch { setRows([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    setError(""); setNotice(""); setBusy(true);
    try {
      const created = await registerPasskey();
      setNotice(t("security.added", "Passkey added: {{name}}", { name: created.device_name ?? "" }));
      await load();
    } catch (err: any) {
      if (!isPasskeyCancel(err)) setError(err?.message ?? t("security.add_failed", "Could not add the passkey"));
    } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!window.confirm(t("security.remove_confirm", "Remove this passkey? That device will have to use its password again."))) return;
    setError(""); setNotice("");
    try { await deletePasskey(id); await load(); }
    catch (err: any) { setError(err?.message ?? t("security.remove_failed", "Could not remove the passkey")); }
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-primary" /> {t("security.title", "Security")}
        </h1>
        <p className="text-sm text-muted-foreground mb-5">
          {t("security.subtitle", "Sign in with Face ID, a fingerprint or your device PIN instead of a password.")}
        </p>

        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-2">
            <span className="font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> {t("security.passkeys", "Passkeys")}
            </span>
            {passkeysSupported() && (
              <button
                type="button"
                onClick={add}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t("security.add", "Add this device")}
              </button>
            )}
          </div>

          {!passkeysSupported() && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {t("security.unsupported", "This browser does not support passkeys.")}
            </p>
          )}

          {error && <p className="px-4 pt-3 text-sm text-red-600">{error}</p>}
          {notice && <p className="px-4 pt-3 text-sm text-green-700">{notice}</p>}

          {rows === null ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">{t("common.loading", "Loading…")}</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {t("security.empty", "No passkeys registered yet.")}
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map((c) => (
                <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.device_name ?? t("security.unnamed", "Passkey")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("security.added_on", "Added")} {formatDateTime(c.created_at)}
                      {c.last_used_at ? ` · ${t("security.last_used", "Last used")} ${formatDateTime(c.last_used_at)}` : ""}
                      {c.backed_up ? ` · ${t("security.synced", "Synced")}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors"
                    title={t("security.remove", "Remove")}
                    aria-label={t("security.remove", "Remove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { apiPost } from "@/lib/api";
import { APP_NAME } from "@/lib/appName";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

/**
 * 임시 비밀번호로 들어온 사람에게 강제로 보여 주는 화면.
 *
 * 담당자가 계정 → 포털 사용에서 임시 비밀번호를 발급하면
 * `force_password_change` 가 켜지고, 서버는 비밀번호를 바꾸기 전까지 다른 모든
 * 파트너 API 를 403 으로 막는다(requirePartnerAuth). 그러니 이 화면은 예의가
 * 아니라 실제 관문이다 — 여기를 지나지 않으면 볼 수 있는 데이터가 없다.
 *
 * 비밀번호를 바꾸면 서버가 발급된 토큰을 전부 무효로 하므로, 지금 세션도 함께
 * 끝난다. 그래서 성공 후에는 새 비밀번호로 다시 로그인하도록 안내한다.
 */
export default function ForcePasswordChangePage() {
  const { t } = useTranslation();
  const { logout } = useAuth();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit = current.length > 0 && next.length >= 12 && next === confirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await apiPost("/v1/auth/partner/change-password", {
        current_password: current,
        new_password: next,
      });
      setDone(true);
      // 새 비밀번호가 저장되는 순간 이 세션의 토큰도 무효가 된다. 잠깐 결과를
      // 보여 준 뒤 로그인 화면으로 돌려보낸다.
      setTimeout(() => logout(), 2500);
    } catch (err: any) {
      setError(err?.message ?? t("force_password.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <KeyRound className="h-5 w-5 text-[hsl(var(--brand-orange))]" />
          <span className="font-semibold">{APP_NAME}</span>
        </div>

        <h1 className="text-xl font-semibold">{t("force_password.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1.5">{t("force_password.subtitle")}</p>

        {done ? (
          <p className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {t("force_password.done")}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="fpc-current">
                {t("force_password.current")}
              </label>
              <input
                id="fpc-current" type="password" value={current} autoComplete="current-password"
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="fpc-next">
                {t("force_password.new")}
              </label>
              <div className="relative">
                <input
                  id="fpc-next" type={show ? "text" : "password"} value={next} autoComplete="new-password"
                  onChange={(e) => setNext(e.target.value)}
                  className="w-full h-10 rounded-md border bg-background px-3 pr-10 text-sm"
                />
                <button type="button" onClick={() => setShow((v) => !v)}
                  aria-label={t("force_password.toggle_visibility")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{t("force_password.policy")}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="fpc-confirm">
                {t("force_password.confirm")}
              </label>
              <input
                id="fpc-confirm" type={show ? "text" : "password"} value={confirm} autoComplete="new-password"
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              />
              {confirm.length > 0 && confirm !== next && (
                <p className="text-xs text-destructive">{t("force_password.mismatch")}</p>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit" disabled={!canSubmit || busy}
              className="w-full h-10 rounded-md bg-[hsl(var(--brand-orange))] text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("force_password.submit")}
            </button>

            <button type="button" onClick={logout}
              className="w-full text-xs text-muted-foreground hover:text-foreground">
              {t("force_password.sign_out")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

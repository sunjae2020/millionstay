import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";

/**
 * 관리자가 어드민의 "대신 열기"로 이 포털을 연 세션이면 화면 맨 위에 띄운다.
 * 서버(/v1/auth/partner/me)가 토큰의 `impersonated_by` 클레임을 보고
 * `impersonated: true` 를 내려 준다. 세션은 30분이면 끝나고 연장되지 않는다.
 */
export default function ImpersonationBanner() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  if (!user?.impersonated) return null;
  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-black"
    >
      <span>{t("impersonation.banner", { email: user.email })}</span>
      <button
        type="button"
        onClick={logout}
        className="rounded border border-black/30 bg-white/40 px-2 py-0.5 text-xs font-semibold hover:bg-white/70"
      >
        {t("impersonation.end")}
      </button>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson, apiPost, ApiError } from "@/lib/apiFetch";
import { formatDateTime } from "@/lib/date";
import {
  Check, Copy, Eye, EyeOff, Key, LogIn, Mail, MessageSquare,
  RefreshCw, Send, Unlock,
} from "lucide-react";
import type { PortalUser } from "./AccountPortalUsers";
import { useAuth } from "@/contexts/AuthContext";

/** 서버의 IMPERSONATION_ROLES 와 같은 목록 — 버튼 노출용일 뿐, 실제 차단은 서버가 한다. */
const IMPERSONATION_ROLES = new Set(["SuperAdmin", "Super Admin", "superadmin", "super_admin", "Admin"]);

/**
 * 포털 사용 — 한 로그인의 상세 패널.
 *
 * 목록이 "누가 들어올 수 있는가"라면 이 패널은 그 사람을 실제로 앉히기까지의
 * 일들이다: 안내 문구를 만들어 카톡·메일·문자로 넘기고, 임시 비밀번호를 쥐여
 * 주고, 못 들어온다는 전화를 받아 잠금을 확인하고 풀어 준다.
 *
 * 안내 문구는 서버가 만든다(POST …/guide). 화면에서 따로 조립하면 미리보기와
 * 실제 발송이 언젠가 갈라지기 때문이다.
 */

interface LoginStatus {
  last_login_at: string | null;
  is_active: boolean;
  force_password_change: boolean;
  temp_password_expires_at: string | null;
  temp_password_active: boolean;
  locked: boolean;
  retry_after_seconds: number | null;
  failed_attempts: number;
  max_attempts: number;
}

interface GuidePreview {
  subject: string;
  text: string;
  sms_bytes: number;
  sms_type: "SMS" | "LMS";
  can_email: boolean;
  can_sms: boolean;
}

type Notice = { kind: "ok" | "error"; text: string };

export function AccountPortalUserPanel({
  accountId, user, onNotice, onChanged, onSetPassword,
}: {
  accountId: number;
  user: PortalUser;
  onNotice: (n: Notice) => void;
  /** 서버 상태가 바뀌어 목록을 다시 읽어야 할 때. */
  onChanged: () => void;
  /** 기존 "비밀번호 직접 설정" 모달을 연다. */
  onSetPassword: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { user: me } = useAuth();
  const canImpersonate = !!me && IMPERSONATION_ROLES.has(me.role);
  const base = `/api/v1/accounts/${accountId}/portal-users/${user.id}`;
  const lang = (i18n.language ?? "ko").toLowerCase().startsWith("en") ? "en" : "ko";

  const [status, setStatus] = useState<LoginStatus | null>(null);
  const [guide, setGuide] = useState<GuidePreview | null>(null);
  // 미리보기를 못 만든 이유. 읽기 전용(Viewer) 계정은 이 POST 자체가 막히므로,
  // 안내 문구 자리에 "불러오는 중"이 영영 남지 않도록 이유를 적어 준다.
  const [guideError, setGuideError] = useState<string | null>(null);
  const [guidePw, setGuidePw] = useState("");
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [showTempPw, setShowTempPw] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const message = (err: unknown, fallback: string) =>
    err instanceof ApiError || err instanceof Error ? err.message : fallback;

  async function loadStatus() {
    try {
      setStatus(await apiJson<LoginStatus>(`${base}/login-status`));
    } catch {
      setStatus(null);
    }
  }

  useEffect(() => {
    setTempPw(null);
    setGuidePw("");
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // 안내 문구 미리보기. 비밀번호 칸은 타이핑 중이라 한 글자마다 부르지 않는다.
  const pwRef = useRef(guidePw);
  pwRef.current = guidePw;
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      apiPost<GuidePreview>(`${base}/guide`, { password: pwRef.current, lang })
        .then((g) => { if (!cancelled) { setGuide(g); setGuideError(null); } })
        .catch((err) => {
          if (cancelled) return;
          setGuide(null);
          setGuideError(message(err, t("account.portal_guide_failed")));
        });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, guidePw, lang, user.email, user.phone, user.portal_type]);

  function copy(key: string, text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 2000);
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      onNotice({ kind: "error", text: message(err, t("account.portal_save_failed")) });
    } finally {
      setBusy(null);
    }
  }

  const generateTempPassword = () =>
    run("temp", async () => {
      if (!window.confirm(t("account.portal_temp_confirm"))) return;
      const d = await apiPost<{ temp_password: string; expires_at: string }>(`${base}/temp-password`);
      setTempPw(d.temp_password);
      setShowTempPw(true);
      // 방금 만든 비밀번호를 안내 문구에 그대로 태운다 — 다시 볼 수 없는 값이라
      // 담당자가 옮겨 적을 틈을 만들지 않는 편이 안전하다.
      setGuidePw(d.temp_password);
      onNotice({ kind: "ok", text: t("account.portal_temp_created") });
      onChanged();
      await loadStatus();
    });

  const sendGuide = (channel: "email" | "sms") =>
    run(channel, async () => {
      await apiPost(`${base}/guide/send`, { channel, password: guidePw, lang });
      onNotice({
        kind: "ok",
        text: channel === "email"
          ? t("account.portal_guide_emailed", { to: user.email })
          : t("account.portal_guide_texted", { to: user.phone ?? "" }),
      });
    });

  const unlock = () =>
    run("unlock", async () => {
      await apiPost(`${base}/unlock`);
      onNotice({ kind: "ok", text: t("account.portal_unlocked") });
      await loadStatus();
    });

  const openAsUser = () => {
    // 팝업 차단기가 죽이지 않도록 클릭 제스처 안에서 빈 탭을 먼저 연다.
    const w = window.open("", "_blank");
    // 새 탭(파트너 포털)이 window.opener 로 어드민 창을 건드리지 못하게.
    if (w) w.opener = null;
    void run("impersonate", async () => {
      try {
        const d = await apiPost<{ token: string; portal_url: string }>(`${base}/impersonate`);
        // 토큰은 쿼리가 아니라 프래그먼트로 — 서버 로그·Referer 에 남지 않는다.
        const url = `${d.portal_url}/#sso=${encodeURIComponent(d.token)}`;
        if (w) w.location.href = url;
        else window.open(url, "_blank", "noopener");
      } catch (err) {
        w?.close();
        throw err;
      }
    });
  };

  const statusCards = useMemo(() => {
    const failed = status?.failed_attempts ?? 0;
    return [
      { key: "last_login", label: t("account.portal_col_last_login"), value: status?.last_login_at ? formatDateTime(status.last_login_at) : t("account.portal_never") },
      { key: "failed", label: t("account.portal_failed_attempts"), value: `${failed} / ${status?.max_attempts ?? 5}`, warn: failed >= 3 },
      {
        key: "lock",
        label: t("account.portal_account_lock"),
        value: status?.locked
          ? t("account.portal_locked_for", { minutes: Math.ceil((status.retry_after_seconds ?? 0) / 60) })
          : t("account.portal_lock_normal"),
        danger: !!status?.locked,
      },
      {
        key: "password",
        label: t("account.portal_password_status"),
        value: status?.temp_password_active
          ? t("account.portal_temp_active", { when: formatDateTime(status.temp_password_expires_at) })
          : status?.force_password_change
            ? t("account.portal_temp_expired")
            : t("account.portal_lock_normal"),
        warn: !!status?.force_password_change,
      },
    ];
  }, [status, t]);

  return (
    <div className="space-y-3 border-t bg-muted/20 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{user.email}</p>
        {canImpersonate && (
          <Button size="sm" variant="outline" className="gap-1.5"
            disabled={!user.is_active || user.force_password_change || busy === "impersonate"}
            title={!user.is_active
              ? t("account.portal_open_as_disabled")
              : user.force_password_change
                ? t("account.portal_open_as_temp_pw")
                : t("account.portal_open_as_hint")}
            onClick={openAsUser}>
            <LogIn className="h-4 w-4" />
            {busy === "impersonate" ? t("account.portal_opening") : t("account.portal_open_as")}
          </Button>
        )}
      </div>

      {/* ── 이용 안내 문구 ─────────────────────────────────────────────── */}
      <section className="rounded-md border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> {t("account.portal_guide_title")}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">{t("account.portal_guide_hint")}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button size="sm" className="gap-1.5" disabled={!guide}
              onClick={() => guide && copy("guide", guide.text)}>
              {copied === "guide" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === "guide" ? t("account.portal_copied") : t("common.copy")}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5"
              disabled={!guide?.can_email || busy === "email"}
              title={guide?.can_email ? undefined : t("account.portal_no_email")}
              onClick={() => void sendGuide("email")}>
              <Send className="h-4 w-4" /> {t("account.portal_send_email")}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5"
              disabled={!guide?.can_sms || busy === "sms"}
              title={guide?.can_sms ? undefined : t("account.portal_no_phone")}
              onClick={() => void sendGuide("sms")}>
              <Mail className="h-4 w-4" /> {t("account.portal_send_sms")}
            </Button>
          </div>
        </div>

        <div className="max-w-sm space-y-1.5">
          <Label>{t("account.portal_guide_password")}</Label>
          <Input value={guidePw} onChange={(e) => setGuidePw(e.target.value)} className="font-mono"
            autoComplete="off" placeholder={t("account.portal_guide_password_ph")} />
        </div>

        {guideError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {guideError}
          </p>
        ) : (
          <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-sm font-sans">
            {guide?.text ?? t("common.loading")}
          </pre>
        )}
        {guide && (
          <p className="text-xs text-muted-foreground">
            {t("account.portal_sms_cost", { type: guide.sms_type, bytes: guide.sms_bytes })}
          </p>
        )}
      </section>

      {/* ── 비밀번호 관리 ──────────────────────────────────────────────── */}
      <section className="rounded-md border bg-card p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Key className="h-3.5 w-3.5" /> {t("account.portal_password_management")}
        </h4>
        <div>
          <p className="text-sm font-medium">{t("account.portal_temp_password")}</p>
          <p className="text-xs text-muted-foreground">{t("account.portal_temp_hint")}</p>
        </div>

        {tempPw && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-medium">{t("account.portal_temp_shown_once")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded border bg-background px-3 py-1.5 text-sm font-mono tracking-widest">
                {showTempPw ? tempPw : "•".repeat(tempPw.length)}
              </code>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowTempPw((v) => !v)}>
                {showTempPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copy("temp", tempPw)}>
                {copied === "temp" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy === "temp"}
            onClick={() => void generateTempPassword()}>
            <RefreshCw className="h-4 w-4" /> {t("account.portal_temp_generate")}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onSetPassword}>
            <Key className="h-4 w-4" /> {t("account.portal_set_password")}
          </Button>
        </div>
      </section>

      {/* ── 로그인 상태 ────────────────────────────────────────────────── */}
      <section className="rounded-md border bg-card p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("account.portal_login_status")}
        </h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {statusCards.map((c) => (
            <div key={c.key} className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
              <p className={`text-sm font-medium ${
                c.danger ? "text-destructive" : c.warn ? "text-amber-600" : ""
              }`}>{c.value}</p>
            </div>
          ))}
        </div>
        {status?.locked && (
          <Button variant="outline" size="sm" disabled={busy === "unlock"}
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => void unlock()}>
            <Unlock className="h-4 w-4" /> {t("account.portal_unlock")}
          </Button>
        )}
      </section>
    </div>
  );
}

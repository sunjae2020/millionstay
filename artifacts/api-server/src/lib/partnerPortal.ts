/**
 * Partner portal account helpers — shared by the partner auth routes (self-serve
 * "forgot password") and the admin 계정 → 포털 사용 section, which issues the very
 * same link when an operator invites a partner or resets their password.
 *
 * Keeping the token shape in one place means a link minted by an admin and one
 * minted by the portal are indistinguishable to /auth/partner/reset-password.
 */
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, partnerUsersTable, type PartnerUser } from "@workspace/db";
import { sendPasswordResetEmail } from "./email";
import { formatPersonName } from "../lib/nameFormat";
import { formatDocDateTime } from "./documents/i18n";

export const PORTAL_TYPES = ["agent", "owner", "service_host"] as const;
export type PortalTypeName = (typeof PORTAL_TYPES)[number];

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const BCRYPT_COST = 12;

/** The portal this user signs into — env-configurable per tenant deployment. */
export function portalBaseUrl(portalType: string): string {
  const base = process.env["CLIENT_URL"] || "https://millionstay.com";
  switch (portalType) {
    case "agent": return process.env["AGENT_PORTAL_URL"] || `${base}/agent`;
    case "owner": return process.env["OWNER_PORTAL_URL"] || `${base}/owner`;
    case "service_host": return process.env["SERVICE_HOST_PORTAL_URL"] || `${base}/service-host`;
    default: return base;
  }
}

/**
 * Stamp a fresh reset token on the user and email them the link.
 * Returns false when the mail could not be sent (the token is still stored, so
 * the operator can retry) — callers decide whether that is fatal.
 */
export async function issuePartnerResetLink(
  user: Pick<PartnerUser, "id" | "email" | "first_name" | "last_name" | "portal_type">,
): Promise<boolean> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await db
    .update(partnerUsersTable)
    .set({ reset_token_hash: tokenHash, reset_token_expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS) })
    .where(eq(partnerUsersTable.id, user.id));

  const resetUrl = `${portalBaseUrl(user.portal_type)}/reset-password#token=${rawToken}`;
  return sendPasswordResetEmail({
    to: user.email,
    name: formatPersonName(user.first_name, user.last_name) || "Partner",
    resetUrl,
  });
}

/* ── 임시 비밀번호 ────────────────────────────────────────────────────────── */

/** 발급된 임시 비밀번호가 살아 있는 시간. 지나면 로그인 자체가 거부된다. */
export const TEMP_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000; // 72h

// 사람이 전화로 불러 주고 카톡으로 옮겨 적는 값이라, 서로 헷갈리는 글자
// (0/O, 1/l/I)는 아예 빼고 기호도 눈에 띄는 것만 남긴다. 그러면서도
// validatePassword(12자 이상 + 대/소문자 + 숫자 + 기호)를 항상 만족해야 한다.
const PW_LOWER = "abcdefghijkmnpqrstuvwxyz";
const PW_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PW_DIGIT = "23456789";
const PW_SYMBOL = "!@#$%&*?";

function pick(alphabet: string): string {
  return alphabet[crypto.randomInt(alphabet.length)]!;
}

/**
 * 비밀번호 정책을 반드시 통과하는 14자 임시 비밀번호.
 * 각 문자군에서 하나씩 먼저 뽑아 넣고 나머지를 채운 뒤 섞는다 — "무작위로 뽑고
 * 정책에 걸리면 다시" 식으로 하면 드물게 오래 도는 경우가 생긴다.
 */
export function generateTempPassword(length = 14): string {
  const all = PW_LOWER + PW_UPPER + PW_DIGIT + PW_SYMBOL;
  const chars = [pick(PW_LOWER), pick(PW_UPPER), pick(PW_DIGIT), pick(PW_SYMBOL)];
  while (chars.length < length) chars.push(pick(all));
  // Fisher–Yates. 위에서 넣은 4글자가 앞자리에 몰리지 않도록.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

/* ── 포털 이용 안내 문구 ──────────────────────────────────────────────────── */

export type GuideLang = "ko" | "en";

export interface PortalGuideInput {
  portalType: string;
  /** 로그인 아이디 — 이메일이 없으면 휴대폰 번호가 아이디다. */
  loginId: string;
  /** 안내에 넣을 비밀번호. 비우면 "별도 안내"로 나간다. */
  password?: string | null;
  /** 임시 비밀번호라면 만료 시각 — 안내에 한 줄 더 붙는다. */
  tempPasswordExpiresAt?: Date | string | null;
  brandName: string;
  lang: GuideLang;
}

const GUIDE_COPY = {
  ko: {
    title: (brand: string) => `[${brand} 파트너 포털 이용 안내]`,
    portal: "포털 주소", id: "아이디", pw: "비밀번호",
    pwFallback: "(별도 안내)",
    expires: (when: string) => `※ 임시 비밀번호는 ${when} 까지만 쓸 수 있습니다.`,
    footer: "로그인하신 뒤 비밀번호를 바꿔 주세요.",
    subject: (brand: string) => `${brand} 파트너 포털 이용 안내`,
  },
  en: {
    title: (brand: string) => `[${brand} Partner Portal Access]`,
    portal: "Portal", id: "ID", pw: "Password",
    pwFallback: "(sent separately)",
    expires: (when: string) => `* The temporary password works until ${when}.`,
    footer: "Please change your password after signing in.",
    subject: (brand: string) => `${brand} Partner Portal Access`,
  },
} as const;

function guideExpiryLabel(value: Date | string, lang: GuideLang): string {
  return formatDocDateTime(value, lang);
}

/**
 * 담당자가 카카오톡·문자·메일로 그대로 옮길 수 있는 안내 문구.
 * 화면 미리보기와 실제 발송이 같은 글을 쓰도록 여기 한 곳에서만 만든다.
 */
export function buildPortalGuide(input: PortalGuideInput): { subject: string; text: string } {
  const L = GUIDE_COPY[input.lang];
  const lines = [L.title(input.brandName), ""];
  lines.push(`· ${L.portal}: ${portalBaseUrl(input.portalType)}`);
  lines.push(`· ${L.id}: ${input.loginId}`);
  lines.push(`· ${L.pw}: ${input.password?.trim() || L.pwFallback}`);
  if (input.password?.trim() && input.tempPasswordExpiresAt) {
    lines.push("", L.expires(guideExpiryLabel(input.tempPasswordExpiresAt, input.lang)));
  }
  lines.push("", L.footer);
  return { subject: L.subject(input.brandName), text: lines.join("\n") };
}

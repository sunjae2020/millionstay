/**
 * 발행 문서 파일명 — 단일 규칙, 단일 구현.
 *
 *     [고객ID]-[대상][-발행사]-[서류종류]-[발행일 YYYYMMDD][순번]
 *
 *     MH2607C001-김용식-계약서-20260803A.pdf
 *     MH2607B012-홍길동_재원산업-계약서-20260803A.pdf
 *
 * 서류종류는 **한글**이다 — 폴더를 훑는 사람이 읽는 값이라 코드보다 이름이 낫다.
 * 3자리 코드(`DOC_CODES`)는 내부 키로 남아 `document_file_names.doc_code`와 옛
 * 파일명 해석에 쓰인다. 구문은 필드 간 `-`, 필드 내부 `_`, 공백 없음.
 * 전체 규칙은 docs/DOCUMENT_NAMING_RULE.md 를 보라.
 *
 * 고객ID는 거래 상대(계정·연락처)에게 한 번 부여되는 번호다(partyCode.ts).
 * 상대를 특정할 수 없는 문서(공실 견적, 서식 샘플)는 이 필드가 빠진다.
 *
 * 순번은 **사람 + 날짜** 기준으로 증가한다. 같은 사람에게 같은 날 계약서와
 * 청구서를 발행하면 `…계약서-20260803A`, `…청구서-20260803B`가 되어 문서 종류와
 * 무관하게 파일명이 겹치지 않는다. A…Z 다음은 A1…Z1 … A9…Z9로, 사람·일자당 260건.
 *
 * 이름이 없는 문서(회사 서류, 건물 등기부, 공실 견적 등)는 계정명·건물명 등
 * 대상명으로 대체하고, 그것도 없으면 `미지정`을 쓴다.
 *
 * 파일명은 문서마다 **한 번만** 정해진다. PDF는 미리보기·다운로드·이메일마다
 * 다시 렌더되므로 매번 새 순번을 뽑으면 같은 청구서가 A였다가 B가 되어 버린다.
 * 최초 발행 시 `document_file_names`에 기록하고 이후에는 읽어 쓴다.
 *
 * 테넌트 스위치 (기본 전부 off — 켜는 인스턴스만 이름이 길어진다):
 *   PARTY_CODE_PREFIX=MH       고객ID 접두사 (미설정 시 MS).
 *   DOC_NAME_INCLUDE_ORG=1     거래처 상호를 담당자 이름과 **함께** 남긴다.
 *   DOC_NAME_INCLUDE_ISSUER=1  발행사 상호를 **상시** 붙인다. 고객ID 접두사가 이미
 *                              발행사를 가리키므로 보통은 끈다(중복).
 *   DOC_NAME_ISSUER_LABEL=…    발행사 표기를 짧게 덮어쓴다(미설정 시 조직 상호).
 */
import { db, documentFileNamesTable, accountsTable, contactsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { formatPersonName } from "../nameFormat";
import { readStoredCompanyInfo } from "./companyInfo";
import { resolvePartyCode, isPartyCode, type PartyEntity } from "./partyCode";

/**
 * 문서 종류 → 3자리 코드.
 *
 * 새 문서를 추가할 때 여기에 코드를 먼저 등록한다 — 코드가 곧 문서고유코드이며,
 * 폴더에서 종류를 구분하는 유일한 수단이다.
 */
export const DOC_CODES = {
  /** 계약서 (임대차·서비스 공통) */
  contract: "CTR",
  /** 서명 완료본 스캔/전자서명본 */
  signed_contract: "SGN",
  /** 인보이스 / 세금계산서 */
  invoice: "INV",
  /** 영수증 */
  receipt: "RCP",
  /** 견적서 */
  quote: "QUO",
  /** 세대점검표 (입주·퇴거) */
  inspection: "INS",
  /** 보증금 정산 / 퇴거 세대 확인서 */
  settlement: "STL",
  /** 신청서 (홈스테이·단기 체류) */
  application: "APL",
  /** 작업지시서 */
  work_order: "WOR",
  /** 서비스 브리프 */
  brief: "BRF",
  /** 리포트 (정산·운영 보고서) */
  report: "RPT",
  /** 서식 샘플 / 빈 양식 */
  sample: "SMP",
  /** 그 외 */
  other: "DOC",
} as const;

export type DocKind = keyof typeof DOC_CODES;

/**
 * 문서 종류 → 파일명에 찍히는 **한글 이름**.
 *
 * 파일명은 사람이 읽는다. 폴더에서 `CTR`을 해독하는 것보다 `계약서`를 보는 편이
 * 빠르고, 받는 쪽(세입자·집주인·파트너)도 그대로 이해한다. 코드는 내부 키로만
 * 남는다 — 새 문서를 추가할 때 `DOC_CODES`와 여기 **둘 다** 등록한다.
 */
export const DOC_NAMES_KO: Record<DocKind, string> = {
  contract: "계약서",
  signed_contract: "서명계약서",
  invoice: "청구서",
  receipt: "영수증",
  quote: "견적서",
  inspection: "세대점검표",
  settlement: "정산서",
  application: "신청서",
  work_order: "작업지시서",
  brief: "서비스브리프",
  report: "리포트",
  sample: "서식샘플",
  other: "기타서류",
};

/** 파일명에 찍히는 서류 이름. */
export function docTypeName(kind: DocKind): string {
  return DOC_NAMES_KO[kind] ?? DOC_CODES[kind];
}

/** 이름을 못 찾았을 때 파일명에 들어가는 값. */
export const UNNAMED_PARTY = "미지정";

const MAX_NAME_CHARS = 40;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** A…Z, A1…Z1, … A9…Z9 = 260. */
const MAX_SEQ = LETTERS.length * 10;

/**
 * 0 → A, 25 → Z, 26 → A1, 51 → Z1, … 259 → Z9.
 *
 * 260건을 넘기면 규칙이 표현할 수 있는 범위를 벗어나므로 `Z9-261`처럼 숫자를
 * 덧붙인다. 하루에 한 사람 앞으로 260건을 발행하는 일은 실무상 없지만, 파일명이
 * 조용히 중복되는 것보다는 낫다.
 */
export function sequenceLabel(seq: number): string {
  if (seq < MAX_SEQ) {
    const letter = LETTERS[seq % LETTERS.length];
    const digit = Math.floor(seq / LETTERS.length);
    return digit === 0 ? letter : `${letter}${digit}`;
  }
  return `Z9-${seq + 1}`;
}

/**
 * 파일명에 쓸 수 있는 형태로 이름을 다듬는다.
 *
 * 경로·따옴표로 쓰이는 문자와 파일명 구분자(`-`, `_`)를 걷어내 규칙이 다시
 * 파싱 가능하도록 유지하고, 공백은 하나로 줄여 붙인다("John Smith" → "John-Smith"는
 * 코드 구분자와 헷갈리므로 공백 제거).
 */
export function sanitizePartyName(
  raw: string | null | undefined,
  fallback: string = UNNAMED_PARTY,
): string {
  const cleaned = String(raw ?? "")
    // 제어문자·경로문자·구분자 제거
    .replace(/[\\/:*?"<>|#%._\-\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "");
  return cleaned.slice(0, MAX_NAME_CHARS) || fallback;
}

/**
 * 여러 단어가 `_`로 이어진 이름(`Monthly_Settlement`)을 규격에 맞게 다듬는다.
 * 조각마다 금지문자를 걷어내되 조각을 잇는 `_`는 살린다 — `_`는 필드 **내부**
 * 연결자라서 지우면 안 된다.
 */
export function sanitizeNamePath(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    // 리포트 대상은 "여수 메트하임"처럼 띄어쓰기가 있다 — 필드 내부는 `_`로 잇는다.
    .replace(/\s+/g, "_")
    .split("_")
    .map((part) => sanitizePartyName(part, ""))
    .filter(Boolean)
    .join("_");
}

/** 첫 번째로 비어 있지 않은 값. */
function firstFilled(values: Array<string | null | undefined>): string | null {
  const hit = values.find((v) => String(v ?? "").trim().length > 0);
  return hit == null ? null : String(hit);
}

function envOn(key: string): boolean {
  const v = process.env[key];
  return v === "1" || v === "true";
}

/** 거래처 상호를 담당자 이름과 함께 남기는 인스턴스인가 (Metheim=예). */
export function docNameIncludesOrg(): boolean {
  return envOn("DOC_NAME_INCLUDE_ORG");
}

/** 발행사 상호를 모든 문서명에 상시 붙이는 인스턴스인가 (Metheim=예). */
export function docNameIncludesIssuer(): boolean {
  return envOn("DOC_NAME_INCLUDE_ISSUER");
}

/**
 * 발행사(우리 회사) 상호. 문서마다 조직 설정을 읽으면 PDF 한 장에 DB 왕복이
 * 늘어나므로 짧게 캐시한다 — 상호는 몇 달에 한 번 바뀌는 값이다.
 */
let issuerCache: { at: number; label: string } | null = null;
const ISSUER_TTL_MS = 60_000;

export async function resolveIssuerLabel(): Promise<string> {
  const override = process.env["DOC_NAME_ISSUER_LABEL"];
  if (override && override.trim()) return sanitizePartyName(override, "");
  const now = Date.now();
  if (issuerCache && now - issuerCache.at < ISSUER_TTL_MS) return issuerCache.label;
  let label = "";
  try {
    const info = await readStoredCompanyInfo();
    label = sanitizePartyName(info.trading_name || info.company_name, "");
  } catch {
    label = sanitizePartyName(process.env["COMPANY_TRADING_NAME"] || process.env["COMPANY_NAME"], "");
  }
  issuerCache = { at: now, label };
  return label;
}

/**
 * 거래처(계정)에서 **담당자 한글 이름**과 **법인 상호**를 함께 꺼낸다.
 *
 * 계정명은 법인이면 상호, 개인이면 사람 이름이라 그것만으로는 둘을 구분할 수
 * 없다. 대표 연락처를 한 번 더 읽어 사람 이름을 확보하고, 이름이 상호와 같으면
 * (개인 사업자·개인 임차인) 나중에 하나로 접힌다.
 */
export async function accountPartyNames(
  accountId: number | null | undefined,
): Promise<{ person: string | null; company: string | null }> {
  if (!accountId || !Number.isFinite(accountId)) return { person: null, company: null };
  try {
    const [acc] = await db
      .select({ name: accountsTable.name, primary_contact_id: accountsTable.primary_contact_id })
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .limit(1);
    if (!acc) return { person: null, company: null };
    let person: string | null = null;
    if (acc.primary_contact_id) {
      const [c] = await db
        .select({ first_name: contactsTable.first_name, last_name: contactsTable.last_name })
        .from(contactsTable)
        .where(eq(contactsTable.id, acc.primary_contact_id))
        .limit(1);
      if (c) person = formatPersonName(c.first_name, c.last_name) || null;
    }
    return { person, company: acc.name ?? null };
  } catch (err) {
    console.error("[docFileName] account lookup failed:", err);
    return { person: null, company: null };
  }
}

/**
 * 이름 필드를 조립한다 — `담당자_상호` (필드 내부는 `_`로 잇는다).
 *
 * 상호를 함께 남기지 않는 인스턴스에서는 지금까지처럼 첫 번째 값만 쓴다.
 */
export function composePartyLabel(person?: string | null, company?: string | null): string {
  const p = sanitizePartyName(person, "");
  const c = sanitizePartyName(company, "");
  if (!docNameIncludesOrg()) return p || c || UNNAMED_PARTY;
  if (p && c && p !== c) return `${p}_${c}`;
  return p || c || UNNAMED_PARTY;
}

/** 순번을 세는 기준 키 — 대소문자·공백 차이로 같은 사람이 갈리지 않게 한다. */
function partyKeyOf(name: string): string {
  return name.toLowerCase().normalize("NFC").slice(0, 128);
}

/** 문서 발행일을 세는 타임존. 테넌트별로 다르면 DOC_TZ로 덮어쓴다. */
function docTimeZone(): string {
  return process.env["DOC_TZ"] || process.env["TZ"] || "Asia/Seoul";
}

/** Date | "2026-08-03" | "2026-08-03T…" → "2026-08-03" (없으면 오늘). */
export function toIssueDate(value?: string | Date | null): string {
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
  // en-CA는 YYYY-MM-DD를 내주므로 수동 조립 없이 타임존 변환이 된다.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: docTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export interface DocFileNameArgs {
  /** 문서 종류 — DOC_CODES의 키. */
  kind: DocKind;
  /** 발행 근거 레코드 ("invoice" | "contract" | "inspection" …). */
  entityType: string;
  entityId: number;
  /**
   * 같은 레코드에서 나오는 다른 문서를 구분한다 — 인보이스의 영수증, 계약서의
   * 서명본 등. 코드가 이미 다르면 비워둔다.
   */
  variant?: string;
  /**
   * 이름 후보를 우선순위대로. 첫 번째로 비어 있지 않은 값을 쓰고, 전부 비면
   * `미지정`. (예: [세입자명, 계정명, 건물명])
   */
  party: Array<string | null | undefined>;
  /**
   * 거래처 상호 후보. `DOC_NAME_INCLUDE_ORG`를 켠 인스턴스에서만 이름 필드에
   * `담당자_상호`로 함께 실린다.
   */
  org?: Array<string | null | undefined>;
  /**
   * 거래처(계정) id. 상호를 함께 남기는 인스턴스에서 담당자 한글 이름과 법인
   * 상호를 여기서 직접 읽는다 — 라우트마다 두 이름을 따로 실어 나르지 않게.
   */
  accountId?: number | null;
  /**
   * 고객ID를 붙일 상대. 계정이면 `{ type: "account", id }`, 사람이면
   * `{ type: "contact", id }`. 생략하면 `accountId`를 계정으로 본다. 상대를
   * 특정할 수 없는 문서(공실 견적·샘플)는 비워 두면 ID 필드 없이 나간다.
   */
  partyRef?: { type: PartyEntity; id: number } | null;
  /** 문서 자체의 발생일. 없으면 발행 시점(테넌트 타임존)의 날짜. */
  issueDate?: string | Date | null;
}

/**
 * 문서의 파일명(확장자 제외)을 돌려준다. 처음이면 순번을 할당하고, 이미 발행된
 * 문서면 그때 정한 이름을 그대로 돌려준다.
 *
 * DB를 못 쓰는 상황에서도 문서 발행 자체는 막지 않는다 — 순번 없이 규칙에 맞는
 * 이름을 만들어 돌려준다.
 */
export async function resolveDocFileName(args: DocFileNameArgs): Promise<string> {
  const code = DOC_CODES[args.kind];
  // 상호를 함께 남기는 인스턴스에서만 계정을 한 번 더 읽는다. 다른 테넌트는
  // 지금까지와 똑같이 라우트가 준 이름 하나로 끝난다.
  const acct = docNameIncludesOrg() && args.accountId
    ? await accountPartyNames(args.accountId)
    : null;
  const person = firstFilled([acct?.person, ...args.party]);
  const company = firstFilled([acct?.company, ...(args.org ?? [])]);
  const partyName = composePartyLabel(person, company);
  const issuer = docNameIncludesIssuer() ? await resolveIssuerLabel() : "";
  // 고객ID — 상대가 특정되는 문서에만 붙는다. 채번이 실패해도 발행은 막지 않는다.
  const ref = args.partyRef ?? (args.accountId ? { type: "account" as const, id: args.accountId } : null);
  const partyCode = ref ? await resolvePartyCode({ entityType: ref.type, entityId: ref.id }) : null;
  const targetLabel = [partyCode, partyName, issuer !== partyName ? issuer : ""]
    .filter((f) => String(f ?? "").length > 0)
    .join("-");
  const docName = docTypeName(args.kind);
  const partyKey = partyKeyOf(partyName);
  const issueDate = toIssueDate(args.issueDate);
  const variant = (args.variant ?? "").slice(0, 32);
  const compact = issueDate.replace(/-/g, "");

  try {
    const [existing] = await db
      .select({ file_name: documentFileNamesTable.file_name })
      .from(documentFileNamesTable)
      .where(and(
        eq(documentFileNamesTable.entity_type, args.entityType),
        eq(documentFileNamesTable.entity_id, args.entityId),
        eq(documentFileNamesTable.doc_code, code),
        eq(documentFileNamesTable.variant, variant),
      ))
      .limit(1);
    if (existing) return existing.file_name;

    // 다음 빈 순번. 유니크 인덱스가 최종 심판이라 경합해서 지면 다시 뽑는다.
    for (let attempt = 0; attempt < 8; attempt++) {
      const [{ next } = { next: 0 }] = await db
        .select({ next: sql<number>`coalesce(max(${documentFileNamesTable.seq}), -1) + 1` })
        .from(documentFileNamesTable)
        .where(and(
          eq(documentFileNamesTable.party_key, partyKey),
          eq(documentFileNamesTable.issue_date, issueDate),
        ));
      const seq = Number(next) + attempt;
      const fileName = `${targetLabel}-${docName}-${compact}${sequenceLabel(seq)}`;
      try {
        await db.insert(documentFileNamesTable).values({
          doc_code: code,
          entity_type: args.entityType,
          entity_id: args.entityId,
          variant,
          party_key: partyKey,
          party_name: partyName,
          issue_date: issueDate,
          seq,
          file_name: fileName,
        });
        return fileName;
      } catch (err) {
        // 같은 문서를 두 요청이 동시에 발행했다면 이름은 이미 정해졌다.
        const [raced] = await db
          .select({ file_name: documentFileNamesTable.file_name })
          .from(documentFileNamesTable)
          .where(and(
            eq(documentFileNamesTable.entity_type, args.entityType),
            eq(documentFileNamesTable.entity_id, args.entityId),
            eq(documentFileNamesTable.doc_code, code),
            eq(documentFileNamesTable.variant, variant),
          ))
          .limit(1);
        if (raced) return raced.file_name;
        if (attempt === 7) throw err;
        // 순번만 겹친 경우 — 루프가 다음 값으로 재시도한다.
      }
    }
  } catch (err) {
    console.error("[docFileName] allocation failed — falling back to an unsequenced name:", err);
  }

  return `${targetLabel}-${docName}-${compact}`;
}

/**
 * PDF 응답에 파일명을 싣는다.
 *
 * `Content-Disposition`은 한글이 들어가므로 RFC 5987 형식이 필수다. 프론트는
 * blob으로 받아 `a.download`로 저장하기 때문에 헤더를 읽을 수 있어야 하고,
 * 그래서 `X-Document-Filename`을 같이 실어 보낸다 (CORS 노출은 app.ts에서).
 */
export function setDocFileName(
  res: import("express").Response,
  baseName: string,
  opts: { extension?: string; disposition?: "inline" | "attachment" } = {},
): string {
  const ext = opts.extension ?? "pdf";
  const full = `${baseName}.${ext}`;
  const encoded = encodeURIComponent(full);
  // ASCII 폴백은 헤더를 못 읽는 오래된 클라이언트용 — 한글이 빠져도 열리기는 한다.
  const ascii = full.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  res.setHeader(
    "Content-Disposition",
    `${opts.disposition ?? "inline"}; filename="${ascii}"; filename*=UTF-8''${encoded}`,
  );
  res.setHeader("X-Document-Filename", encoded);
  // 프리뷰 모달이 blob으로 받아 이름을 읽으려면 헤더가 CORS로 노출돼야 한다.
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Document-Filename");
  return full;
}

// ── 리포트 이름 ─────────────────────────────────────────────────────────────
//
// 정산·수수료·캠페인 같은 운영 리포트는 사람에게 발행되는 문서가 아니라서
// 사람+날짜 순번을 소비하지 않는다. 대신 대상(법인·건물·에이전트·"전체")과
// 리포트 종류, 기준일, 버전으로 이름이 정해진다.
//
//     RPT-<대상>-<리포트종류>-<기준일 YYYYMMDD>_v<버전>
//     RPT-에이치케이건설자산관리-Monthly_Settlement-20260731_v1.pdf

/**
 * 리포트 종류 통제 어휘 — 자유 서술 금지. 값은 파일명에 그대로 찍히는 **한글**
 * 이름이다. 새 리포트는 여기에 먼저 등록한다.
 */
export const REPORT_TYPES = {
  /** 월별 정산 (임대료·수수료 정산서) */
  monthly_settlement: "월별정산",
  /** 보증금 정산 내역 */
  deposit_settlement: "보증금정산",
  /** 커미션 명세 */
  commission_statement: "커미션명세",
  /** 점유·공실 현황 */
  occupancy: "공실현황",
  /** 매출·수익 */
  revenue: "매출현황",
  /** 미납 현황 */
  arrears: "미납현황",
  /** 작업지시·유지보수 실적 */
  maintenance: "유지보수현황",
  /** 파트너 정산 */
  partner_payout: "파트너정산",
  /** 마케팅 캠페인 성과 */
  campaign_performance: "캠페인성과",
  /** 서류 점검 결과 */
  document_checklist: "서류점검표",
  /** 예약 현황 */
  booking: "예약현황",
} as const;

export type ReportKind = keyof typeof REPORT_TYPES;

/** 대상이 특정되지 않는 전사 리포트의 대상 표기. */
export const ALL_TARGETS = "전체";

export interface ReportFileNameArgs {
  /** 리포트 종류 — REPORT_TYPES의 키, 또는 이미 통제 어휘를 통과한 값. */
  reportType: ReportKind | (string & {});
  /**
   * 대상. 법인 상호·건물명·에이전트명 등. 비우면 발행사 상호(없으면 `전체`)를
   * 쓴다 — 발행사 상호를 상시 표기하는 인스턴스에서 특히 이 값이 정본이 된다.
   */
  target?: string | null;
  /** 리포트 기준일(마감일). 없으면 오늘. */
  asOf?: string | Date | null;
  /** 재발행본은 버전을 올린다. 덮어쓰기 금지. */
  version?: number;
}

/** 리포트 파일명(확장자 제외). 순번을 소비하지 않으므로 DB를 타지 않는다. */
export async function buildReportFileName(args: ReportFileNameArgs): Promise<string> {
  const type = sanitizeNamePath(
    (REPORT_TYPES as Record<string, string>)[String(args.reportType)] ?? args.reportType,
  ) || DOC_NAMES_KO.report;
  const target = sanitizeNamePath(args.target) || (await resolveIssuerLabel()) || ALL_TARGETS;
  const compact = toIssueDate(args.asOf).replace(/-/g, "");
  const version = Math.max(1, Math.floor(args.version ?? 1));
  return `${DOC_NAMES_KO.report}-${target}-${type}-${compact}_v${version}`;
}

// ── 검증 ────────────────────────────────────────────────────────────────────

/** 필드 하나 — 내부는 `_`로 이어질 수 있고 `-`는 못 들어간다. */
const FIELD = String.raw`[^\s\-]+`;

/**
 * 발행 문서명.
 *
 *     [고객ID-][대상][-발행사]-[서류종류]-[YYYYMMDD][순번]
 *
 * 필드 수가 2~4개로 흔들리는 이유: 고객ID와 발행사는 인스턴스·문서에 따라
 * 빠진다. 순번은 A…Z / A1…Z9 / 초과분 `Z9-<n>`.
 */
export const DOC_FILE_NAME_RE = new RegExp(
  String.raw`^(?:${FIELD}-){1,3}${FIELD}-\d{8}(?:[A-Z]\d?|Z9-\d+)?$`,
);

/**
 * 2026-08 이전에 발행된 이름. `<코드3>-<대상>[-<발행사>]_<YYYYMMDD><순번>`.
 * 파일은 그대로 남아 있으므로 파서는 옛 형식도 계속 읽어야 한다.
 */
export const LEGACY_DOC_FILE_NAME_RE = new RegExp(
  String.raw`^[A-Z]{3}-${FIELD}(?:-${FIELD})?_\d{8}(?:[A-Z]\d?|Z9-\d+)?$`,
);

/** 리포트명. `리포트-<대상>-<종류>-<YYYYMMDD>_v<버전>`. */
export const REPORT_FILE_NAME_RE = new RegExp(
  String.raw`^${FIELD}-${FIELD}-${FIELD}-\d{8}_v\d{1,2}$`,
);

/** 확장자를 떼고 규칙에 맞는지 본다. 업로드본 검사·야간 점검이 이걸 쓴다. */
export function isValidDocFileName(name: string): boolean {
  const base = String(name ?? "").replace(/\.[a-z0-9]{2,5}$/i, "");
  return (
    DOC_FILE_NAME_RE.test(base) ||
    LEGACY_DOC_FILE_NAME_RE.test(base) ||
    REPORT_FILE_NAME_RE.test(base)
  );
}

export interface ParsedDocFileName {
  /** 3자리 내부 코드. 서류종류 한글 이름에서 되찾는다. */
  code: string | null;
  kind: DocKind | null;
  /** 파일명에 찍힌 서류 이름 (`계약서`). */
  docName: string;
  /** 고객ID (`MH2607C001`). 붙어 있을 때만. */
  partyCode: string | null;
  /** 대상 필드 그대로 (`홍길동_재원산업`). */
  target: string;
  /** 대상 필드의 첫 조각 — 사람 이름으로 보는 값. */
  party: string;
  /** 발행사 상호(붙어 있을 때만). */
  issuer: string | null;
  /** `2026-08-03`. */
  issueDate: string;
  /** `A` / `B1` … 없으면 null. */
  sequence: string | null;
  /** 옛 형식(3자리 코드)으로 읽었는가. */
  legacy: boolean;
}

const KIND_BY_NAME: Record<string, DocKind> = Object.fromEntries(
  (Object.keys(DOC_NAMES_KO) as DocKind[]).map((k) => [DOC_NAMES_KO[k], k]),
);

/**
 * 우리가 발행했다가 서명받아 다시 올라온 파일을 되읽는다. 이름만으로 종류·대상·
 * 발행일을 알 수 있는 것이 이 규칙의 존재 이유다. 옛 형식도 읽는다.
 */
export function parseDocFileName(name: string): ParsedDocFileName | null {
  const base = String(name ?? "").replace(/\.[a-z0-9]{2,5}$/i, "");
  if (LEGACY_DOC_FILE_NAME_RE.test(base)) return parseLegacyName(base);
  if (!DOC_FILE_NAME_RE.test(base)) return null;

  const fields = base.split("-");
  // 순번이 `Z9-261`로 넘칠 때만 꼬리가 두 조각이다.
  const tail = /^\d{8}/.test(fields[fields.length - 1] ?? "")
    ? fields.pop()!
    : `${fields.splice(-2, 2).join("-")}`;
  const m = tail.match(/^(\d{4})(\d{2})(\d{2})(.*)$/);
  if (!m) return null;

  const docName = fields.pop() ?? "";
  const kind = KIND_BY_NAME[docName] ?? null;
  const partyCode = fields.length > 1 && isPartyCode(fields[0] ?? "") ? fields.shift()! : null;
  const target = fields.shift() ?? "";
  return {
    code: kind ? DOC_CODES[kind] : null,
    kind,
    docName,
    partyCode,
    target,
    party: target.split("_")[0] ?? target,
    issuer: fields.length ? (fields[fields.length - 1] ?? null) : null,
    issueDate: `${m[1]}-${m[2]}-${m[3]}`,
    sequence: m[4] || null,
    legacy: false,
  };
}

/** 옛 형식 — `CTR-김용식_20260803A`. */
function parseLegacyName(base: string): ParsedDocFileName | null {
  const code = base.slice(0, 3);
  const rest = base.slice(4);
  const cut = rest.lastIndexOf("_");
  if (cut < 0) return null;
  const fields = rest.slice(0, cut).split("-");
  const m = rest.slice(cut + 1).match(/^(\d{4})(\d{2})(\d{2})(.*)$/);
  if (!m) return null;
  const kind = (Object.keys(DOC_CODES) as DocKind[]).find((k) => DOC_CODES[k] === code) ?? null;
  const target = fields[0] ?? "";
  return {
    code,
    kind,
    docName: kind ? DOC_NAMES_KO[kind] : code,
    partyCode: null,
    target,
    party: target.split("_")[0] ?? target,
    issuer: fields.length > 1 ? (fields[fields.length - 1] ?? null) : null,
    issueDate: `${m[1]}-${m[2]}-${m[3]}`,
    sequence: m[4] || null,
    legacy: true,
  };
}

// ── 보관 폴더 ───────────────────────────────────────────────────────────────
//
// 서류의 정본 색인은 `documents` 테이블의 (entity_type, entity_id, doc_type)이고,
// 스토리지 폴더는 콘솔·백업에서 사람이 훑을 때를 위한 사본이다. 폴더명은
// 한글·공백 없이 `<엔티티코드><번호 6자리>`로만 짓는다 — Cloudinary public_id가
// URL에 실리므로 ASCII 고정이 안전하다.
//
//     millionstay/private/contract/LS000045/
//
// 엔티티 번호를 그대로 쓰는 이유: 자리번호(serial)라 등록 순서대로 정렬되고,
// 별도 채번 테이블 없이 이름·소속이 바뀌어도 불변이다.

/** 엔티티 → 폴더 접두 2자리. 새 엔티티는 여기에 먼저 등록한다. */
export const ENTITY_FOLDER_CODES: Record<string, string> = {
  account: "AC",
  contact: "CT",
  contract: "LS",
  invoice: "IV",
  quote: "QT",
  property: "PR",
  space: "SP",
  booking: "BK",
  work_order: "WO",
  service_host: "SH",
  agent: "AG",
  owner: "OW",
  inspection: "IN",
  deposit_settlement: "DS",
  company: "CO",
};

/** `contract`,45 → `LS000045`. 미등록 엔티티는 앞 2자를 대문자로 쓴다. */
export function targetFolderId(entityType: string, entityId: number): string {
  const code = ENTITY_FOLDER_CODES[entityType] ?? String(entityType).slice(0, 2).toUpperCase();
  const id = Number.isFinite(entityId) ? Math.max(0, Math.floor(entityId)) : 0;
  return `${code}${String(id).padStart(6, "0")}`;
}

/** 민감 서류의 스토리지 폴더 (Cloudinary 루트 하위 경로). */
export function docFolder(entityType: string, entityId: number): string {
  return `private/${entityType}/${targetFolderId(entityType, entityId)}`;
}

/**
 * 거래 상대의 서류는 **고객ID 폴더**에 모인다 — `private/account/MH2607C001/`.
 * 그래야 한 상대의 서류가 한 자리에 쌓이고, 고객ID에 이미 연월이 들어 있어
 * 폴더 목록이 등록 순서대로 정렬된다. 번호가 아직 없으면 엔티티 번호로 떨어진다.
 *
 * 폴더명에는 이름을 넣지 않는다 — Cloudinary public_id가 URL에 실려서 ASCII로
 * 고정하는 편이 안전하고, 이름은 바뀌지만 번호는 바뀌지 않는다.
 */
export async function resolveDocFolder(entityType: string, entityId: number): Promise<string> {
  if (entityType === "account" || entityType === "contact") {
    const code = await resolvePartyCode({ entityType, entityId });
    if (code) return `private/${entityType}/${code}`;
  }
  return docFolder(entityType, entityId);
}

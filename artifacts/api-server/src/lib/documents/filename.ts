import type { Response } from "express";
import { db, documentFileNamesTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

/**
 * Download-filename convention for every generated document:
 *
 *   `<문서코드 3자리>-<이름>_<발행일 YYYYMMDD><순번>.pdf`
 *   e.g. `CTR-김용식_20260803A.pdf`, `INV-김용식_20260803B.pdf`
 *
 * - 문서코드 tells the document type apart at a glance in a folder (`DOC_CODES`).
 * - 이름 is the counterparty the document is about; when there is no person we
 *   fall back to the account/building name, and finally to `미지정`.
 * - 발행일 is the document's own date (invoice date, payment date, contract
 *   date) — not the moment the PDF happened to be rendered.
 * - 순번 separates documents issued to the same person on the same day, running
 *   A…Z then A1…Z1 … A9…Z9. It counts across document *types*, so a contract and
 *   an invoice issued to one person on one day are …A and …B, never both …A.
 *
 * The sequence is allocated once and stored (`document_file_names`): a PDF is
 * re-rendered on every preview, download and email, and the same invoice must
 * not come back as …A now and …B a minute later.
 *
 * The server is the single source of truth: `setDocumentDownloadHeaders` writes
 * the name into Content-Disposition and the admin/portal preview modal reads it
 * back off the response, so the browser save dialog matches the API exactly.
 *
 * See docs/DOCUMENT_NAMING_RULE.md.
 */

/**
 * 문서 종류 → 3자리 코드. 새 문서를 추가할 때 여기에 코드를 먼저 등록한다.
 */
export const DOC_CODES = {
  /** 계약서 (임대차·서비스 공통) */
  contract: "CTR",
  /** 전자서명 완료본 */
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
  /** 리포트 */
  report: "RPT",
  /** 서식 샘플 / 빈 양식 */
  sample: "SMP",
  /** 그 외 */
  other: "DOC",
} as const;

export type DocKind = keyof typeof DOC_CODES;

/** 이름을 못 찾았을 때 파일명에 들어가는 값. */
export const UNNAMED_PARTY = "미지정";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** A…Z, A1…Z1, … A9…Z9 = 260건. */
const MAX_SEQ = LETTERS.length * 10;

/** Characters that are illegal (or merely annoying) in a filename, per OS. */
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\u0000-\u001f\u007f/\\:*?"<>|]+/g;

/** Trim a filename segment down to something every filesystem accepts. */
function sanitiseSegment(input: string | null | undefined): string {
  return (input ?? "")
    .replace(ILLEGAL, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 60);
}

/** `YYYYMMDD` in the server's local time — the day the document was produced. */
export function documentDateStamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/**
 * ASCII-only fallback for the plain `filename=` parameter. Non-Latin names
 * (Korean, Japanese, …) would be mangled by legacy clients, so they get the
 * transliteration-free fallback while `filename*` carries the real name.
 */
function asciiFallback(filename: string): string {
  const cleaned = filename.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "").replace(/\s+/g, " ").trim();
  // Strip separators left behind where non-ASCII segments were removed.
  const trimmed = cleaned.replace(/^[-_\s]+/, "").replace(/[-_\s]+(?=\.)/, "");
  // A fully Korean/Japanese/Thai name reduces to just the date stamp, which is
  // useless as a filename. Only keep the stripped version when it still carries
  // letters; otherwise use a neutral, self-describing name.
  const hasLetters = /[A-Za-z]{2}/.test(trimmed.replace(/\.pdf$/i, ""));
  return hasLetters && trimmed.length > 4 ? trimmed : `document_${documentDateStamp()}.pdf`;
}

/**
 * Write Content-Type + Content-Disposition for a generated document.
 *
 * Uses RFC 5987 `filename*=UTF-8''…` so Korean/Japanese/Thai filenames survive
 * the trip, with an ASCII `filename=` fallback for old clients.
 */
export function setDocumentDownloadHeaders(
  res: Response,
  filename: string,
  opts: { disposition?: "inline" | "attachment"; contentType?: string } = {},
): void {
  const disposition = opts.disposition ?? "inline";
  res.setHeader("Content-Type", opts.contentType ?? "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${asciiFallback(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  // The preview modal reads the filename off the response; without this the
  // browser hides Content-Disposition from cross-origin XHR.
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
}


/**
 * 0 → A, 25 → Z, 26 → A1, 51 → Z1, … 259 → Z9.
 *
 * 260건을 넘기면 규칙이 표현할 수 있는 범위를 벗어나므로 숫자를 덧붙인다. 하루에
 * 한 사람 앞으로 260건을 발행할 일은 없지만, 파일명이 조용히 중복되는 것보다는
 * 낫다.
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
 * 이름 구간을 파일명 규칙이 다시 파싱할 수 있는 형태로 다듬는다 — 구분자로 쓰는
 * `-`·`_`와 공백을 걷어낸다("John Smith" → "JohnSmith").
 */
export function sanitisePartyName(raw: string | null | undefined): string {
  const cleaned = sanitiseSegment(raw).replace(/[._-]/g, " ").replace(/\s+/g, "").slice(0, 40);
  return cleaned || UNNAMED_PARTY;
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
  // en-CA yields YYYY-MM-DD, so the timezone shift comes for free.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: docTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export interface IssuedDocumentParts {
  /** 문서 종류 — DOC_CODES의 키. */
  kind: DocKind;
  /** 발행 근거 레코드 ("invoice" | "contract" | "inspection" …). */
  entityType: string;
  entityId: number;
  /**
   * 같은 레코드에서 나오는 다른 문서를 구분한다 — 인보이스의 영수증 등. 코드가
   * 이미 다르면 비워둔다.
   */
  variant?: string;
  /**
   * 이름 후보를 우선순위대로. 첫 번째로 비어 있지 않은 값을 쓰고, 전부 비면
   * `미지정`. (예: [세입자명, 계정명, 호실명])
   */
  party: Array<string | null | undefined>;
  /** 문서 자체의 발생일. 없으면 발행 시점(테넌트 타임존)의 날짜. */
  issueDate?: string | Date | null;
  /** Defaults to "pdf". */
  extension?: string;
}

/**
 * 문서의 파일명을 돌려준다. 처음이면 순번을 할당하고, 이미 발행된 문서면 그때
 * 정한 이름을 그대로 돌려준다.
 *
 * DB를 못 쓰는 상황에서도 문서 발행 자체는 막지 않는다 — 순번 없이 규칙에 맞는
 * 이름을 만들어 돌려준다.
 */
export async function issueDocumentFilename(parts: IssuedDocumentParts): Promise<string> {
  const code = DOC_CODES[parts.kind];
  const partyName = sanitisePartyName(parts.party.find((p) => String(p ?? "").trim().length > 0));
  const partyKey = partyKeyOf(partyName);
  const issueDate = toIssueDate(parts.issueDate);
  const variant = (parts.variant ?? "").slice(0, 32);
  const stamp = issueDate.replace(/-/g, "");
  const ext = (parts.extension ?? "pdf").replace(/^\./, "");

  const whereThisDocument = and(
    eq(documentFileNamesTable.entity_type, parts.entityType),
    eq(documentFileNamesTable.entity_id, parts.entityId),
    eq(documentFileNamesTable.doc_code, code),
    eq(documentFileNamesTable.variant, variant),
  );

  try {
    const [existing] = await db
      .select({ file_name: documentFileNamesTable.file_name })
      .from(documentFileNamesTable)
      .where(whereThisDocument)
      .limit(1);
    if (existing) return `${existing.file_name}.${ext}`;

    // 다음 빈 순번. 유니크 인덱스가 최종 심판이라 경합해서 지면 다시 뽑는다.
    for (let attempt = 0; attempt < 8; attempt++) {
      const [row] = await db
        .select({ next: sql<number>`coalesce(max(${documentFileNamesTable.seq}), -1) + 1` })
        .from(documentFileNamesTable)
        .where(and(
          eq(documentFileNamesTable.party_key, partyKey),
          eq(documentFileNamesTable.issue_date, issueDate),
        ));
      const seq = Number(row?.next ?? 0) + attempt;
      const base = `${code}-${partyName}_${stamp}${sequenceLabel(seq)}`;
      try {
        await db.insert(documentFileNamesTable).values({
          doc_code: code,
          entity_type: parts.entityType,
          entity_id: parts.entityId,
          variant,
          party_key: partyKey,
          party_name: partyName,
          issue_date: issueDate,
          seq,
          file_name: base,
        });
        return `${base}.${ext}`;
      } catch (err) {
        // 같은 문서를 두 요청이 동시에 발행했다면 이름은 이미 정해졌다.
        const [raced] = await db
          .select({ file_name: documentFileNamesTable.file_name })
          .from(documentFileNamesTable)
          .where(whereThisDocument)
          .limit(1);
        if (raced) return `${raced.file_name}.${ext}`;
        if (attempt === 7) throw err;
        // 순번만 겹친 경우 — 루프가 다음 값으로 재시도한다.
      }
    }
  } catch (err) {
    console.error("[filename] sequence allocation failed — issuing without one:", err);
  }

  return `${code}-${partyName}_${stamp}.${ext}`;
}

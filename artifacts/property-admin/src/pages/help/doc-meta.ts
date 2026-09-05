/** 사내 문서(규정·지침·매뉴얼·서식) 레지스트리 — Docs 리스트의 단일 원천.
 *
 *  번역 대상이 아닌 메타데이터만 담는다. 문서 제목은 로케일 번들
 *  (`locales/<lang>/translation.json` → `help.doc_titles.<id>`)에 있고, 여기에는
 *  분류·유형·주관·상태·일자처럼 언어와 무관한 값만 둔다. 문서를 추가할 때는
 *  이 배열에 한 줄, 각 로케일 파일에 제목 한 줄을 더하면 된다.
 *
 *  문서번호는 `<분류코드>-<일련번호>` 이며 일련번호는 재사용하지 않는다.
 *  폐지된 문서는 목록에서 지우지 말고 status를 "retired"로 두고 supersededBy에
 *  대체 문서를 적는다. */

export type DocCategory = "fin" | "ops" | "hr" | "leg" | "sec" | "tec" | "sal";

/** 문서 위계. 상위가 하위에 우선한다 — 매뉴얼이 규정과 충돌하면 규정을 따른다. */
export type DocKind = "regulation" | "guideline" | "manual" | "form";

/** live = 승인되어 시행 중(구속력 있음), missing = 필요성만 확인된 공백. */
export type DocStatus = "live" | "draft" | "review" | "amending" | "missing" | "retired";

export type DocOwner = "admin" | "ops" | "tech" | "sales";

export interface DocEntry {
  /** 문서번호. 로케일 번들의 제목 키이기도 하다. */
  id: string;
  category: DocCategory;
  kind: DocKind;
  owner: DocOwner;
  status: DocStatus;
  /** 제정일 ISO `yyyy-MM-dd`. 미작성 문서는 null. */
  issued: string | null;
  /** 최종개정일. 제정 후 개정이 없으면 null. */
  revised: string | null;
  /** 본문이 이 앱 안에 있을 때의 라우트. 없으면 목록에만 등재된다. */
  href?: string;
  /** 앱 밖에 본문이 있을 때(발행된 문서 링크 등). */
  externalUrl?: string;
  /** status가 "retired"일 때 이 문서를 대체한 문서번호. */
  supersededBy?: string;
}

/** 정기검토 주기 — 최종개정일(없으면 제정일)로부터 12개월. */
export const REVIEW_CYCLE_MONTHS = 12;

export const DOC_CATEGORIES: DocCategory[] = ["fin", "ops", "hr", "leg", "sec", "tec", "sal"];

export const DOC_REGISTRY: DocEntry[] = [
  // 재무회계
  {
    id: "FIN-001", category: "fin", kind: "regulation", owner: "admin", status: "draft",
    issued: "2026-09-04", revised: null,
    externalUrl: "https://claude.ai/code/artifact/3b799de6-e381-4e10-b1c9-b3f0b5039b23",
  },
  { id: "FIN-002", category: "fin", kind: "guideline", owner: "admin", status: "missing", issued: null, revised: null },
  { id: "FIN-003", category: "fin", kind: "manual", owner: "admin", status: "live", issued: "2026-04-10", revised: "2026-08-28" },
  { id: "FIN-004", category: "fin", kind: "guideline", owner: "admin", status: "live", issued: "2026-03-02", revised: "2026-07-15" },
  { id: "FIN-005", category: "fin", kind: "manual", owner: "ops", status: "review", issued: "2026-06-01", revised: null },
  { id: "FIN-006", category: "fin", kind: "guideline", owner: "admin", status: "draft", issued: "2026-08-19", revised: null },

  // 운영
  { id: "OPS-001", category: "ops", kind: "manual", owner: "ops", status: "live", issued: "2026-02-14", revised: "2026-07-12" },
  { id: "OPS-002", category: "ops", kind: "manual", owner: "ops", status: "live", issued: "2026-03-20", revised: "2026-08-20" },
  { id: "OPS-003", category: "ops", kind: "manual", owner: "ops", status: "live", issued: "2026-01-08", revised: "2026-06-30" },
  { id: "OPS-004", category: "ops", kind: "form", owner: "ops", status: "live", issued: "2025-02-14", revised: "2025-05-11" },
  { id: "OPS-005", category: "ops", kind: "guideline", owner: "ops", status: "amending", issued: "2026-04-02", revised: "2026-08-05" },
  { id: "OPS-006", category: "ops", kind: "manual", owner: "ops", status: "missing", issued: null, revised: null },
  { id: "OPS-007", category: "ops", kind: "guideline", owner: "ops", status: "draft", issued: "2026-08-22", revised: null },

  // 인사
  { id: "HR-001", category: "hr", kind: "regulation", owner: "admin", status: "live", issued: "2025-11-03", revised: "2026-03-01" },
  { id: "HR-002", category: "hr", kind: "guideline", owner: "admin", status: "live", issued: "2025-08-12", revised: null },
  { id: "HR-003", category: "hr", kind: "manual", owner: "admin", status: "review", issued: "2026-07-01", revised: null },
  { id: "HR-004", category: "hr", kind: "guideline", owner: "admin", status: "missing", issued: null, revised: null },

  // 법무·계약
  { id: "LEG-001", category: "leg", kind: "manual", owner: "sales", status: "live", issued: "2026-01-20", revised: "2026-08-14" },
  { id: "LEG-002", category: "leg", kind: "form", owner: "sales", status: "live", issued: "2026-05-06", revised: "2026-09-01" },
  { id: "LEG-003", category: "leg", kind: "guideline", owner: "tech", status: "live", issued: "2025-04-18", revised: null },
  { id: "LEG-004", category: "leg", kind: "regulation", owner: "admin", status: "draft", issued: "2026-08-03", revised: null },

  // 정보보호
  { id: "SEC-001", category: "sec", kind: "regulation", owner: "admin", status: "live", issued: "2025-10-15", revised: "2026-05-30" },
  { id: "SEC-002", category: "sec", kind: "manual", owner: "tech", status: "live", issued: "2026-02-28", revised: null },
  { id: "SEC-003", category: "sec", kind: "guideline", owner: "tech", status: "amending", issued: "2025-12-01", revised: "2026-06-11" },
  { id: "SEC-004", category: "sec", kind: "guideline", owner: "tech", status: "live", issued: "2026-06-11", revised: null },
  { id: "SEC-005", category: "sec", kind: "manual", owner: "admin", status: "missing", issued: null, revised: null },

  // 기술
  { id: "TEC-001", category: "tec", kind: "manual", owner: "tech", status: "live", issued: "2026-03-11", revised: "2026-08-30" },
  { id: "TEC-002", category: "tec", kind: "manual", owner: "tech", status: "live", issued: "2026-05-22", revised: null },
  { id: "TEC-003", category: "tec", kind: "guideline", owner: "tech", status: "live", issued: "2026-04-05", revised: "2026-07-28" },

  // 영업
  { id: "SAL-001", category: "sal", kind: "manual", owner: "sales", status: "live", issued: "2026-02-05", revised: "2026-06-18" },
  { id: "SAL-002", category: "sal", kind: "form", owner: "sales", status: "review", issued: "2026-07-20", revised: null },
  { id: "SAL-003", category: "sal", kind: "manual", owner: "sales", status: "draft", issued: "2026-08-27", revised: null },
];

/** 차기검토일 — 최종개정일(없으면 제정일) + REVIEW_CYCLE_MONTHS. 일자가 없으면 null. */
export function nextReviewDate(doc: DocEntry): string | null {
  const base = doc.revised ?? doc.issued;
  if (!base) return null;
  const d = new Date(`${base}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMonth(d.getUTCMonth() + REVIEW_CYCLE_MONTHS);
  return d.toISOString().slice(0, 10);
}

/** 정기검토 기한이 지났는지. 폐지·미작성 문서는 검토 대상이 아니다. */
export function isReviewOverdue(doc: DocEntry, today = new Date()): boolean {
  if (doc.status === "missing" || doc.status === "retired") return false;
  const next = nextReviewDate(doc);
  return next !== null && next < today.toISOString().slice(0, 10);
}

// 내부 문서함 — 운영 지도·정책 문서·세입자 링크 목록 (직원 교육용).
//
// 신입 담당자가 "이 일은 어느 화면에서 하고 세입자에게는 뭐가 나가는가"를 물을
// 곳이 없어 매번 사람에게 묻던 것을 대신한다. 파일을 담지 않고 가리키기만 한다 —
// 실물은 이미 `documents`(발행 서류)와 `knowledge_documents`(AI 자료)가 갖고 있다.
import { Router, type IRouter } from "express";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db, helpDocumentsTable } from "@workspace/db";
import { logAction } from "../utils/auditLog";
import { signingBaseUrl } from "../services/contractSigning.js";

const router: IRouter = Router();

/** 저장소 문서 링크의 기준 주소. 인스턴스마다 다를 수 있어 env 로 뺀다. */
function repoDocsBase(): string {
  return (process.env["HELP_DOCS_REPO_URL"]
    || "https://github.com/sunjae2020/millionstay/blob/main").replace(/\/+$/, "");
}

interface SeedRow {
  title: string;
  description: string;
  category: string;
  audience: "staff" | "tenant";
  url?: string | null;
  route_pattern?: string | null;
  issue_hint?: string | null;
  tags: string[];
  sort_order: number;
}

/**
 * 문서함이 비어 있을 때 채워 넣는 기본 목록.
 *
 * 주소를 코드에 박아 두지 않고 **인스턴스 자신의 설정에서 만든다** — 세입자 링크의
 * 기준 주소는 테넌트마다 다르고(SIGNING_BASE_URL), 저장소 주소도 마찬가지다.
 * 그래서 Metheim 에서 채우면 Metheim 주소가, MillionStay 에서 채우면 그쪽 주소가
 * 들어간다.
 */
function defaultCatalog(): SeedRow[] {
  const web = signingBaseUrl();
  const repo = repoDocsBase();

  return [
    // ── 운영 가이드 ─────────────────────────────────────────────────────────
    {
      title: "세입자 입주 → 퇴거 전과정 운영 지도",
      description: "계약부터 보증금 반환까지 12단계. 단계마다 담당·화면·세입자가 받는 것·남는 기록을 정리한 그림 문서. 신입 교육의 출발점.",
      category: "운영 가이드", audience: "staff",
      url: "https://claude.ai/code/artifact/9c4a432b-8bf2-4755-829d-b210a5f431d0",
      tags: ["온보딩", "교육", "전과정", "다이어그램"], sort_order: 10,
    },
    {
      title: "세입자 온보딩 링크 규칙",
      description: "무로그인 토큰 링크 8종의 정본 문서. 원장을 둘로 나눈 이유, 토큰 만료 규칙, 일부러 하지 않은 것들.",
      category: "운영 가이드", audience: "staff",
      url: `${repo}/docs/TENANT_ONBOARDING_LINKS.md`,
      tags: ["링크", "토큰", "규칙"], sort_order: 20,
    },
    {
      title: "직원 교육 자료",
      description: "제품·업무 흐름 전반을 다루는 교육용 슬라이드 콘텐츠.",
      category: "운영 가이드", audience: "staff",
      url: `${repo}/docs/training/MILLIONSTAY_%EC%A7%81%EC%9B%90%EA%B5%90%EC%9C%A1_PPT_%EC%BD%98%ED%85%90%EC%B8%A0.md`,
      tags: ["교육", "신입"], sort_order: 30,
    },
    {
      title: "작업지시서 · 하자 청구 명세서",
      description: "작업지시 PDF와 호수별 사진 증빙 명세서를 발행하는 절차.",
      category: "운영 가이드", audience: "staff",
      url: `${repo}/docs/WORK_ORDER_DOCUMENTS.md`,
      tags: ["작업지시", "하자", "청구"], sort_order: 40,
    },

    // ── 정책 · 규정 ────────────────────────────────────────────────────────
    {
      title: "문서 파일명 규칙",
      description: "고객ID-대상-서류종류-발행일. 발행되는 모든 서류의 이름이 따르는 단일 규칙과 고객ID 부여 방식.",
      category: "정책 · 규정", audience: "staff",
      url: `${repo}/docs/DOCUMENT_NAMING_RULE.md`,
      tags: ["파일명", "고객ID", "서류"], sort_order: 10,
    },
    {
      title: "개인정보 보호 준수",
      description: "서류 보존기간, 비공개 저장, 마케팅 동의. 신분증을 어디에 붙이는지가 여기서 갈린다.",
      category: "정책 · 규정", audience: "staff",
      url: `${repo}/docs/PRIVACY_COMPLIANCE.md`,
      tags: ["개인정보", "보존기간", "신분증"], sort_order: 20,
    },
    {
      title: "개인정보 유출 사고 대응 절차",
      description: "유출이 의심될 때 누가 무엇을 몇 시간 안에 해야 하는지.",
      category: "정책 · 규정", audience: "staff",
      url: `${repo}/docs/NDB_INCIDENT_RUNBOOK.md`,
      tags: ["사고", "대응", "긴급"], sort_order: 30,
    },
    {
      title: "주소 표기 규칙",
      description: "주소는 읽는 사람이 아니라 주소지 국가의 순서를 따른다. 한국·일본은 큰 단위부터, 그 외는 서양식.",
      category: "정책 · 규정", audience: "staff",
      url: `${repo}/docs/ADDRESS_FORMAT_RULE.md`,
      tags: ["주소", "표기"], sort_order: 40,
    },
    {
      title: "여수 세대 인벤토리 기준",
      description: "정본 269세대. 타입 8행과 데모 호실은 집계에서 제외한다 — 대시보드 숫자가 틀리면 여기부터 본다.",
      category: "정책 · 규정", audience: "staff",
      url: `${repo}/docs/tenants/metheim/UNIT_INVENTORY.md`,
      tags: ["여수", "세대수", "집계"], sort_order: 50,
    },

    // ── 세입자에게 나가는 링크 ──────────────────────────────────────────────
    {
      title: "계약 서명",
      description: "31일 이하 + 자사 서식일 때만 열린다. 장기 계약은 출력·날인 후 스캔 업로드.",
      category: "세입자 링크", audience: "tenant",
      url: "/booking/contracts", route_pattern: `${web}/sign/:token`,
      issue_hint: "계약 상세 → 전자서명 카드",
      tags: ["계약", "서명"], sort_order: 10,
    },
    {
      title: "입주 신청서",
      description: "인적사항 재확인·비상연락처·증명사진·차량·반려동물. 제출 후 담당자가 [레코드에 반영]을 눌러야 반영된다.",
      category: "세입자 링크", audience: "tenant",
      url: "/booking/contracts", route_pattern: `${web}/intake/:token`,
      issue_hint: "계약 상세 → 입주 신청서 카드",
      tags: ["입주", "신청서", "비상연락처"], sort_order: 20,
    },
    {
      title: "서류 제출",
      description: "신분증·통장 사본 등 요청한 서류만 받는다. 임차인 연락처가 연결돼 있어야 발급된다.",
      category: "세입자 링크", audience: "tenant",
      url: "/booking/contracts", route_pattern: `${web}/documents/:token`,
      issue_hint: "계약 상세 → 서류 제출 요청 카드",
      tags: ["서류", "신분증", "통장"], sort_order: 30,
    },
    {
      title: "세대점검표 (입주 · 퇴거)",
      description: "항목별 동의·이의제기와 사진 첨부, 마지막에 손서명. 퇴거 정산의 근거가 된다.",
      category: "세입자 링크", audience: "tenant",
      url: "/booking/contracts", route_pattern: `${web}/inspection/:token`,
      issue_hint: "계약 상세 → 세대점검표 → 서명 링크",
      tags: ["점검", "입주", "퇴거"], sort_order: 40,
    },
    {
      title: "청구서 조회 · 입금 통보",
      description: "금액·계좌 확인 후 입금 통보. 통보가 청구서를 납부 완료로 바꾸지는 않는다 — 수납은 통장 확인 후 사람이 한다.",
      category: "세입자 링크", audience: "tenant",
      url: "/finance/invoices", route_pattern: `${web}/pay/:token`,
      issue_hint: "청구서 상세 → 결제 링크 카드",
      tags: ["청구", "입금", "월세"], sort_order: 50,
    },
    {
      title: "작업 완료 확인 서명",
      description: "작업 전·후 사진을 확인하고 서명. 포털 계정이 없는 시설 담당자도 카톡 링크로 서명한다.",
      category: "세입자 링크", audience: "tenant",
      url: "/maintenance/work-orders", route_pattern: `${web}/work-order/:token`,
      issue_hint: "작업지시 상세 → 확인 서명 링크",
      tags: ["작업지시", "하자", "서명"], sort_order: 60,
    },
    {
      title: "퇴거 정산 확인",
      description: "차감 내역을 확인하고 서명하면 정산이 임차인 확인 상태로 넘어간다. 초안 상태에서는 보낼 수 없다.",
      category: "세입자 링크", audience: "tenant",
      url: "/booking/contracts", route_pattern: `${web}/sign/:token`,
      issue_hint: "퇴거 정산 카드 → 확인 요청",
      tags: ["퇴거", "정산", "보증금"], sort_order: 70,
    },

    // ── 자주 쓰는 화면 ─────────────────────────────────────────────────────
    {
      title: "세입자 링크 대기열",
      description: "입금 통보·서류 제출·입주 신청서가 들어온 링크를 한 화면에서. 아침에 여기부터 본다.",
      category: "자주 쓰는 화면", audience: "staff",
      url: "/documents/tenant-links",
      tags: ["대기열", "입금", "제출"], sort_order: 10,
    },
    {
      title: "문서 라이브러리",
      description: "연도·종류·키워드로 발행·보관된 모든 서류를 찾는다.",
      category: "자주 쓰는 화면", audience: "staff",
      url: "/documents/library",
      tags: ["검색", "서류"], sort_order: 20,
    },
    {
      title: "서류 일괄 업로드",
      description: "폴더 통째로 올리면 AI가 판독해 계약에 자동 매칭한다. 검토 후 첨부.",
      category: "자주 쓰는 화면", audience: "staff",
      url: "/documents/intake",
      tags: ["업로드", "일괄", "AI"], sort_order: 30,
    },
    {
      title: "서류 체크리스트",
      description: "계약마다 필요한 서류가 다 모였는지 확인한다.",
      category: "자주 쓰는 화면", audience: "staff",
      url: "/documents/checklist",
      tags: ["체크리스트", "누락"], sort_order: 40,
    },
  ];
}

/* ── 목록 ─────────────────────────────────────────────────────────────────── */

router.get("/v1/help-docs", async (req, res): Promise<void> => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const audience = typeof req.query.audience === "string" ? req.query.audience : "";
    const includeArchived = req.query.include_archived === "true";

    const where = [
      includeArchived ? undefined : eq(helpDocumentsTable.status, "active"),
      category ? eq(helpDocumentsTable.category, category) : undefined,
      audience ? eq(helpDocumentsTable.audience, audience) : undefined,
      // 태그는 jsonb 라 텍스트로 훑는다 — 문서함 규모가 수백 건을 넘지 않는다.
      q ? or(
        ilike(helpDocumentsTable.title, `%${q}%`),
        ilike(helpDocumentsTable.description, `%${q}%`),
        sql`${helpDocumentsTable.tags}::text ILIKE ${`%${q}%`}`,
      ) : undefined,
    ].filter(Boolean);

    const rows = await db
      .select()
      .from(helpDocumentsTable)
      .where(where.length ? and(...(where as any[])) : undefined)
      .orderBy(asc(helpDocumentsTable.category), asc(helpDocumentsTable.sort_order), asc(helpDocumentsTable.id));

    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

/* ── 생성 · 수정 · 보관 ───────────────────────────────────────────────────── */

function parseBody(body: any) {
  const title = String(body?.title ?? "").trim().slice(0, 200);
  if (!title) return null;
  const tags = Array.isArray(body?.tags)
    ? body.tags.map((t: unknown) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 12)
    : [];
  return {
    title,
    description: typeof body?.description === "string" ? body.description.slice(0, 1000) : null,
    category: String(body?.category ?? "운영 가이드").trim().slice(0, 60) || "운영 가이드",
    audience: body?.audience === "tenant" ? "tenant" : "staff",
    url: typeof body?.url === "string" && body.url.trim() ? body.url.trim().slice(0, 1000) : null,
    route_pattern: typeof body?.route_pattern === "string" && body.route_pattern.trim() ? body.route_pattern.trim().slice(0, 200) : null,
    issue_hint: typeof body?.issue_hint === "string" && body.issue_hint.trim() ? body.issue_hint.trim().slice(0, 300) : null,
    tags,
    sort_order: Number.isFinite(Number(body?.sort_order)) ? Number(body.sort_order) : 100,
    status: body?.status === "archived" ? "archived" : "active",
  };
}

router.post("/v1/help-docs", async (req, res): Promise<void> => {
  const parsed = parseBody(req.body);
  if (!parsed) { res.status(400).json({ success: false, error: { code: "NO_TITLE", message: "제목을 입력해 주세요." } }); return; }
  const [row] = await db.insert(helpDocumentsTable)
    .values({ ...parsed, created_by: (req as any).user?.id ?? null } as never)
    .returning();
  void logAction({ entityType: "help_document", entityId: row!.id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { title: parsed.title } });
  res.status(201).json({ success: true, data: row });
});

router.put("/v1/help-docs/:id", async (req, res): Promise<void> => {
  const parsed = parseBody(req.body);
  if (!parsed) { res.status(400).json({ success: false, error: { code: "NO_TITLE", message: "제목을 입력해 주세요." } }); return; }
  const [row] = await db.update(helpDocumentsTable)
    .set({ ...parsed, updated_at: new Date() } as never)
    .where(eq(helpDocumentsTable.id, Number(req.params.id)))
    .returning();
  if (!row) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "자료를 찾을 수 없습니다." } }); return; }
  void logAction({ entityType: "help_document", entityId: row.id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { title: parsed.title } });
  res.json({ success: true, data: row });
});

router.delete("/v1/help-docs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(helpDocumentsTable).where(eq(helpDocumentsTable.id, id));
  void logAction({ entityType: "help_document", entityId: id, action: "DELETE", actorId: (req as any).user?.id ?? null });
  res.json({ success: true });
});

/**
 * 기본 자료 채우기. 제목이 같은 항목은 건드리지 않으므로 여러 번 눌러도 안전하고,
 * 새 기본 항목이 코드에 추가되면 그것만 들어온다. 담당자가 고쳐 쓴 설명을 덮어쓰지
 * 않는 것이 요점이다 — 문서함은 팀이 쓰는 물건이지 코드의 사본이 아니다.
 */
router.post("/v1/help-docs/seed", async (req, res): Promise<void> => {
  try {
    const existing = await db.select({ title: helpDocumentsTable.title }).from(helpDocumentsTable);
    const have = new Set(existing.map((r) => r.title));
    const missing = defaultCatalog().filter((row) => !have.has(row.title));
    if (missing.length) {
      await db.insert(helpDocumentsTable).values(
        missing.map((m) => ({ ...m, created_by: (req as any).user?.id ?? null })) as never,
      );
    }
    void logAction({ entityType: "help_document", entityId: 0, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { seeded: missing.length } });
    res.json({ success: true, data: { added: missing.length, skipped: defaultCatalog().length - missing.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

export default router;

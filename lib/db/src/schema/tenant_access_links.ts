import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * TENANT ACCESS LINKS — 로그인 없이 여는 세입자 링크 원장.
 *
 * 세입자 온보딩에서 서명이 필요한 단계(계약서·세대점검표·퇴거 확인서)는 이미
 * `contract_signing_requests` 라는 전자서명 원장을 탄다. 반대로 **서명이 아닌**
 * 단계 — 청구서를 열어 계좌를 확인하고 입금했다고 알리는 것, 신분증·재직증명 같은
 * 서류를 제출하는 것 — 은 지금까지 게스트 포털 로그인을 요구했다. 한국 임대차
 * 세입자는 포털 계정을 거의 만들지 않으므로 그 요구가 곧 "카톡으로 사진 주세요"
 * 라는 우회로가 되고, 기록은 개인 대화방에 흩어진다.
 *
 * 이 표는 그 두 종류의 링크를 한 원장에 담는다. 토큰 하나가 (kind, context) 한
 * 쌍을 가리키고, 세입자가 무엇을 보았고 무엇을 냈는지가 `submissions` 와
 * `audit_trail` 에 남는다. 서명 원장과 굳이 합치지 않은 이유는 저쪽의 정본이
 * "서명 이미지 + 법적 메타데이터"라서, 서명이 없는 링크를 끼워 넣으면 그 표의
 * 의미(= 서명된 문서의 증거)가 흐려지기 때문이다.
 *
 * 링크 종류(kind)
 *   application  임차 신청서(계약 전)   (context: lead)
 *   intake       입주 신청서           (context: contract)
 *   invoice_pay  청구서 조회 + 입금 통보 (context: invoice)
 *   doc_request  서류 제출 요청        (context: contract | booking)
 *
 * 상태(status)
 *   pending → viewed → completed, 그리고 expired / cancelled.
 *   completed 의 뜻은 kind 마다 다르다 — 입금 통보를 남겼거나, 요청된 필수 서류를
 *   모두 제출한 시점이다.
 */
export const tenantAccessLinksTable = pgTable(
  "tenant_access_links",
  {
    id: serial("id").primaryKey(),
    /** 공개 링크 토큰. 추측 불가능해야 하므로 randomBytes(32) 16진수. */
    token: text("token").notNull().unique(),
    kind: text("kind").notNull(), // application | intake | invoice_pay | doc_request
    context_type: text("context_type").notNull(), // lead | invoice | contract | booking
    context_id: integer("context_id").notNull(),

    /** 링크를 받은 사람 — 있으면 이름·연락처를 그대로 화면에 쓴다. */
    contact_id: integer("contact_id"),
    account_id: integer("account_id"),
    /** 발송 당시 수신 주소(재발송·감사 추적용). */
    sent_to: text("sent_to"),
    /** 세입자가 읽을 언어. 링크 화면과 메일 문안이 같은 말을 하도록 고정한다. */
    lang: text("lang"),

    status: text("status").notNull().default("pending"),

    /**
     * kind 별 요청 내용.
     *   doc_request  { items: [{ doc_type, label, required }], note }
     *   invoice_pay  { amount, currency, due_date, bank: {...} } — 발급 시점 스냅숏.
     * 발급 시점을 굳혀 두는 이유는 나중에 청구서가 정정되어도 "그때 세입자가 본
     * 금액"이 기록으로 남아야 하기 때문이다.
     */
    payload: jsonb("payload").notNull().default({}),

    /**
     * 세입자가 이 링크로 남긴 것.
     *   doc_request  [{ doc_type, document_id, file_name, at }]
     *   invoice_pay  [{ event: "paid_notice", payer_name, paid_on, amount, memo, at, ip }]
     */
    submissions: jsonb("submissions").notNull().default([]),

    /** append-only [{ event, at, ip, userAgent, ... }] */
    audit_trail: jsonb("audit_trail").notNull().default([]),

    expires_at: timestamp("expires_at", { withTimezone: true }),
    viewed_at: timestamp("viewed_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),

    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    // 상세 화면이 "이 청구서/계약의 링크"를 그리는 조회 경로.
    index("idx_tenant_links_context").on(t.kind, t.context_type, t.context_id),
    // 관리자 대기열 — 제출·입금 통보가 들어온 순서로 훑는다.
    index("idx_tenant_links_status").on(t.status, t.updated_at),
  ],
);

export type TenantAccessLink = typeof tenantAccessLinksTable.$inferSelect;
export type InsertTenantAccessLink = typeof tenantAccessLinksTable.$inferInsert;

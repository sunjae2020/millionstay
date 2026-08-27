import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * HELP DOCUMENTS — 내부 문서함.
 *
 * 운영 지도·정책 문서·세입자에게 나가는 링크의 목록을 한자리에 모아 두는 표.
 * 신입 담당자가 "이 일은 어느 화면에서 하고, 세입자에게는 뭐가 나가는가"를
 * 물을 곳이 없어 매번 사람에게 묻던 것을 대신한다(직원 교육용).
 *
 * 파일을 담지 않는다 — **가리키기만 한다.** 발행된 서류의 실물은 이미
 * `documents`(비공개 원본 + 보존기한)가 갖고 있고, AI 어시스턴트가 읽는 자료는
 * `knowledge_documents` 가 갖는다. 여기에 파일을 또 두면 같은 문서가 세 곳에서
 * 각자 낡는다. 그래서 이 표에는 제목·설명·주소만 있다.
 *
 * `url` 이 비어 있는 항목도 있다 — 세입자 링크는 대상마다 토큰이 달라 고정
 * 주소가 없기 때문이다. 그런 항목은 `route_pattern`(`/pay/:token`)으로 모양을
 * 보여 주고 `issue_hint` 로 발급 화면을 알려 준다.
 */
export const helpDocumentsTable = pgTable(
  "help_documents",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    /** 화면에서 묶이는 단위. 자유 문자열이라 팀이 필요한 분류를 그때그때 만든다. */
    category: text("category").notNull().default("운영 가이드"),
    /** staff = 내부용, tenant = 세입자에게 나가는 것. 배지로 구분해 그린다. */
    audience: text("audience").notNull().default("staff"),
    /** 새 탭으로 열 주소. 어드민 내부 경로(/finance/invoices)도 들어간다. */
    url: text("url"),
    /** 고정 주소가 없는 토큰 링크의 모양. 예: /pay/:token */
    route_pattern: text("route_pattern"),
    /** 그 링크를 어디서 발급하는지 한 줄. */
    issue_hint: text("issue_hint"),
    /** 검색용 키워드(문자열 배열). */
    tags: jsonb("tags").notNull().default([]),
    sort_order: integer("sort_order").notNull().default(100),
    status: text("status").notNull().default("active"), // active | archived
    created_by: integer("created_by"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_help_documents_category").on(t.status, t.category, t.sort_order),
  ],
);

export type HelpDocument = typeof helpDocumentsTable.$inferSelect;
export type InsertHelpDocument = typeof helpDocumentsTable.$inferInsert;

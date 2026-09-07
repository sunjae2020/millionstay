import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

/**
 * DOCUMENT SHARE LINKS — 문자로 보낸 문서의 열람 링크 원장.
 *
 * 문자에는 파일을 실을 수 없다. 이메일이 PDF 를 첨부해 보내는 자리를 문자에서는
 * **짧은 열람 링크**가 대신한다. 링크가 가리키는 파일은 비공개 Cloudinary 에
 * 올라가 있고, 링크를 연 순간 서버가 짧은 유효기간의 서명 URL 로 넘겨준다 —
 * 그래서 문자에 실리는 것은 `https://<api>/d/<12자>` 한 줄뿐이고, 만료된 링크는
 * 그 자리에서 막힌다(Cloudinary URL 을 직접 보내면 만료 뒤에도 캡처가 남는다).
 *
 * 문서 종류를 가리지 않는다. 미리보기 모달이 이미 받아 둔 바이트를 그대로
 * 올리므로(이메일 공통 경로와 같은 모양) 새 문서가 생겨도 발송 경로를 따로
 * 만들 필요가 없다. `entity_type/entity_id` 는 알 때만 채운다 — 이력·검색용이지
 * 링크 동작의 전제가 아니다.
 */
export const documentShareLinksTable = pgTable(
  "document_share_links",
  {
    id: serial("id").primaryKey(),
    /** 공개 링크 토큰. 문자 길이가 곧 요금이라 짧게(12자 base62) 두되 추측은 불가능하게. */
    token: text("token").notNull().unique(),

    cloudinary_public_id: text("cloudinary_public_id").notNull(),
    /** Cloudinary resource_type — 서명 URL 은 올릴 때와 같은 값을 써야 한다. */
    resource_type: text("resource_type").notNull().default("image"),
    file_name: text("file_name").notNull(),
    mime_type: text("mime_type").notNull(),
    file_size: integer("file_size").notNull(),

    /** 문자 본문에 들어간 문서 이름(예: "계약서"). */
    label: text("label"),
    /** 문서 참조번호(있으면). */
    ref: text("ref"),
    entity_type: text("entity_type"),
    entity_id: integer("entity_id"),

    /** 받은 번호·이름 — 재발송·감사 추적용. */
    sent_to: text("sent_to"),
    recipient_name: text("recipient_name"),

    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    viewed_at: timestamp("viewed_at", { withTimezone: true }),
    view_count: integer("view_count").notNull().default(0),
    revoked_at: timestamp("revoked_at", { withTimezone: true }),

    created_by: integer("created_by"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_document_share_links_entity").on(t.entity_type, t.entity_id),
  ],
);

export type DocumentShareLink = typeof documentShareLinksTable.$inferSelect;
export type InsertDocumentShareLink = typeof documentShareLinksTable.$inferInsert;

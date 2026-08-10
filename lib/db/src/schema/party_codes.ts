import { pgTable, serial, integer, varchar, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * 고객 ID — 거래 상대(계정·연락처)에게 한 번 부여하고 끝까지 따라다니는 번호.
 *
 *     [테넌트접두사 2][YY][MM][유형 1][일련 3]
 *          MH          26   07     C      001     → MH2607C001  (고정 10자리)
 *
 *  - 접두사   인스턴스 고정 2자 대문자 (Metheim = MH, MillionStay = MS).
 *             `PARTY_CODE_PREFIX`로 주입한다.
 *  - YYMM     **최초 등록** 연월. 계약이 몇 건 더 생겨도 바뀌지 않는다.
 *  - 유형     C 개인 / B 기업·파트너·B2B.
 *  - 일련     001~999 → 소진 시 A01~Z99 (월 3,573건).
 *
 * 번호는 DB가 채번한다 — 수동 부여 금지, 폐기 번호 재사용 금지. 동시 요청은
 * `uq_party_codes_run`에서 부딪히고 진 쪽이 다음 번호로 재시도하므로 번호가
 * 비거나 겹치지 않는다. 서류 파일명·보관 폴더가 이 값을 쓴다
 * (docs/DOCUMENT_NAMING_RULE.md).
 */
export const partyCodesTable = pgTable(
  "party_codes",
  {
    id: serial("id").primaryKey(),
    /** 번호를 받은 레코드 — "account" | "contact". */
    entity_type: varchar("entity_type", { length: 32 }).notNull(),
    entity_id: integer("entity_id").notNull(),
    /** 완성된 고객 ID (MH2607C001). */
    code: varchar("code", { length: 16 }).notNull(),
    /** 인스턴스 접두사 — 채번 당시 값을 남겨 둔다. */
    prefix: varchar("prefix", { length: 4 }).notNull(),
    /** 최초 등록 연월 YYMM. */
    period: varchar("period", { length: 4 }).notNull(),
    /** C 개인 / B 기업. */
    party_type: varchar("party_type", { length: 1 }).notNull(),
    /** 0-based 위치. 0 → 001, 998 → 999, 999 → A01. */
    seq: integer("seq").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    // 레코드 하나에 번호 하나. 두 번 채번되지 않는다.
    uniqueIndex("uq_party_codes_entity").on(t.entity_type, t.entity_id),
    uniqueIndex("uq_party_codes_code").on(t.code),
    // 같은 (접두사·연월·유형) 안에서 일련번호는 유일하다 — 동시 채번의 심판.
    uniqueIndex("uq_party_codes_run").on(t.prefix, t.period, t.party_type, t.seq),
    index("idx_party_codes_entity_id").on(t.entity_id),
  ],
);

export type PartyCode = typeof partyCodesTable.$inferSelect;
export type InsertPartyCode = typeof partyCodesTable.$inferInsert;

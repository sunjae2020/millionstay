import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * IP → 예상 지역 캐시.
 *
 * 시스템 로그의 IP 옆에 지역을 보여 주려고 외부 조회 서비스를 부르는데, 같은 IP 를
 * 화면 열 때마다 다시 묻는 것은 낭비이고 무료 한도도 금방 닳는다. 한 번 조회한
 * 결과는 여기에 남기고 다음부터는 DB 에서 읽는다.
 *
 * 실패한 조회도 `status='failed'` 로 남긴다 — 남기지 않으면 조회가 안 되는 IP 를
 * 화면 열 때마다 계속 다시 물어보게 된다.
 */
export const ipGeoCacheTable = pgTable("ip_geo_cache", {
  ip: text("ip").primaryKey(),
  /** ok | failed | private — private 은 사설·루프백이라 조회 자체를 하지 않는다. */
  status: text("status").notNull().default("ok"),
  country_code: text("country_code"),
  country: text("country"),
  region: text("region"),
  city: text("city"),
  /** 어느 서비스가 준 값인지. 나중에 공급자를 바꿔도 옛 값의 출처가 남는다. */
  source: text("source"),
  looked_up_at: timestamp("looked_up_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_ip_geo_looked_up").on(table.looked_up_at),
]);

export type IpGeoCache = typeof ipGeoCacheTable.$inferSelect;

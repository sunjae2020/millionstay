import { db, workOrdersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * 작업지시 번호(`MS-WO-<연도>-<5자리>`) 발급 — invoiceRef.ts 와 같은 안전 패턴.
 *
 * 예전에는 **행 개수 + 1**로 번호를 지었다. 번호에 구멍이 하나만 나도(행을 물리
 * 삭제했거나, 다른 발급기가 매긴 번호가 끼거나) 다음 발급이 이미 쓰인 번호를 다시
 * 내고, `work_orders.order_ref` 의 UNIQUE 제약에 걸려 생성 자체가 실패한다 —
 * 청구서 번호에서 실제로 났던 사고와 같은 패턴이다(lib/billing/invoiceRef.ts 참고).
 *
 * 그래서 번호는 **최댓값 + 1**이고, 실제 INSERT 는 `insertWorkOrderWithRef()` 로
 * 해서 동시 발행이 같은 번호를 집는 좁은 경합(23505)을 재시도로 흡수한다.
 */

const PREFIX = "MS-WO";

function refYearPattern(year: number): string {
  return `^${PREFIX}-${year}-[0-9]+$`;
}

/** 그 해에 이미 쓰인 가장 큰 일련번호 — 번호는 재사용하지 않는다. */
async function maxSerial(year: number): Promise<number> {
  const rows = await db.execute<{ max: number | null }>(sql`
    select max((regexp_replace(${workOrdersTable.order_ref}, '^.*-', ''))::int) as max
    from ${workOrdersTable}
    where ${workOrdersTable.order_ref} ~ ${refYearPattern(year)}
  `);
  const raw = (rows as any).rows?.[0]?.max ?? (rows as any)[0]?.max;
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatRef(year: number, serial: number): string {
  return `${PREFIX}-${year}-${String(serial).padStart(5, "0")}`;
}

/** 다음 작업지시 번호 한 개. */
export async function nextOrderRef(year = new Date().getFullYear()): Promise<string> {
  return formatRef(year, (await maxSerial(year)) + 1);
}

/** Postgres 유니크 위반(23505)인가. */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as any)?.code ?? (err as any)?.cause?.code;
  return code === "23505";
}

type WorkOrderInsert = typeof workOrdersTable.$inferInsert;

/**
 * 번호를 붙여 작업지시 한 건을 INSERT 한다. 중복 키를 만나면 번호를 다시 매겨
 * 재시도하므로, 동시에 두 곳에서 생성해도 한쪽이 조용히 실패하지 않는다.
 */
export async function insertWorkOrderWithRef(
  values: Omit<WorkOrderInsert, "order_ref">,
): Promise<typeof workOrdersTable.$inferSelect> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const order_ref = await nextOrderRef();
    try {
      const [row] = await db.insert(workOrdersTable).values({ ...values, order_ref } as WorkOrderInsert).returning();
      return row!;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Could not allocate a free order_ref after 5 attempts");
}

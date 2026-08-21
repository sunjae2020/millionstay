import { db, invoicesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * 청구서 번호(`MS-INV-<연도>-<5자리>`) 발급 — 이 파일이 정본이다.
 *
 * 예전에는 발급기가 라우트마다 하나씩, 모두 일곱 벌 있었고 그중 셋은 **행 개수
 * + 1**로 번호를 지었다. 번호에 구멍이 하나만 나도 — 청구서를 물리 삭제하거나,
 * 다른 발급기가 매긴 번호가 끼거나 — 다음 발급이 이미 쓰인 번호를 다시 내고,
 * `invoices.invoice_ref` 의 UNIQUE 인덱스에 걸려 발행 자체가 실패한다.
 * (2026-08 실측: MillionStay DB 는 `MS-INV-2026-*` 50건에 최댓값 51 — 다음
 * 개수 기반 발행이 곧바로 중복 키로 죽는 상태였다.)
 *
 * 그래서 번호는 **개수가 아니라 최댓값 + 1**이다. 소프트 삭제된 행도 함께 세어
 * 번호를 재사용하지 않고, `RENT-…` 처럼 형식이 다른 번호는 애초에 세지 않는다.
 * 동시 발행이 같은 번호를 집는 좁은 경합은 남으므로, 실제 INSERT 는
 * `insertInvoiceWithRef()` 로 하면 중복 키를 만났을 때 다음 번호로 다시 시도한다.
 */

const PREFIX = "MS-INV";

/** `MS-INV-2026-00042` → 42. 형식이 다르면 0. */
function refYearPattern(year: number): string {
  return `^${PREFIX}-${year}-[0-9]+$`;
}

/** 그 해에 이미 쓰인 가장 큰 일련번호. 소프트 삭제분도 센다 — 번호는 재사용하지 않는다. */
async function maxSerial(year: number): Promise<number> {
  const rows = await db.execute<{ max: number | null }>(sql`
    select max((regexp_replace(${invoicesTable.invoice_ref}, '^.*-', ''))::int) as max
    from ${invoicesTable}
    where ${invoicesTable.invoice_ref} ~ ${refYearPattern(year)}
  `);
  const raw = (rows as any).rows?.[0]?.max ?? (rows as any)[0]?.max;
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatRef(year: number, serial: number): string {
  return `${PREFIX}-${year}-${String(serial).padStart(5, "0")}`;
}

/** 다음 청구서 번호 한 개. */
export async function nextInvoiceRef(year = new Date().getFullYear()): Promise<string> {
  return formatRef(year, (await maxSerial(year)) + 1);
}

/**
 * 한 요청에서 청구서를 여러 장 만들 때 쓰는 연속 발급기 — DB 를 한 번만 읽고
 * 그 뒤로는 메모리에서 이어 센다(계약 활성화가 회차별 청구서를 한꺼번에 만든다).
 */
export async function createInvoiceRefSequence(year = new Date().getFullYear()): Promise<() => string> {
  let serial = await maxSerial(year);
  return () => formatRef(year, ++serial);
}

/** Postgres 유니크 위반(23505)인가. */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as any)?.code ?? (err as any)?.cause?.code;
  return code === "23505";
}

type InvoiceInsert = typeof invoicesTable.$inferInsert;

/**
 * 번호를 붙여 청구서 한 장을 INSERT 한다. 중복 키를 만나면 번호를 다시 매겨
 * 재시도하므로, 동시에 두 곳에서 발행해도 한쪽이 조용히 실패하지 않는다.
 */
export async function insertInvoiceWithRef(
  values: Omit<InvoiceInsert, "invoice_ref">,
): Promise<typeof invoicesTable.$inferSelect> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const invoice_ref = await nextInvoiceRef();
    try {
      const [row] = await db.insert(invoicesTable).values({ ...values, invoice_ref }).returning();
      return row!;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Could not allocate a free invoice_ref after 5 attempts");
}

/**
 * 목록(list) 엔드포인트 공통 검색 헬퍼.
 *
 * 관리자 리스트의 검색은 두 가지가 반복된다.
 *  1) 키워드 — 자기 테이블의 사람이 읽는 컬럼 + 화면에 함께 보이는 참조 엔티티 이름
 *     (계정·연락처·공간·매물). 이름 조건은 조인 대신 참조 테이블에서 id 를 먼저 뽑아
 *     OR 로 붙인다. 목록 쿼리를 단순하게 유지하고, 각 라우트의 enrich 경로와도 일관된다.
 *  2) 기간 — 단일 날짜 컬럼 구간, 또는 시작/종료가 있는 계약형 기간의 겹침.
 *
 * 날짜 컬럼은 대부분 text('YYYY-MM-DD')다. ISO 문자열은 사전순 = 시간순이라
 * 문자열 비교로 안전하게 구간 필터가 된다.
 */
import { db, accountsTable, spacesTable, propertiesTable, contactsTable } from "@workspace/db";
import { inArray, or, and, gte, lte, isNull, sql, type SQL } from "drizzle-orm";

/**
 * 키워드 비교는 "잡음 제거 후 ILIKE" 다.
 *
 * 저장값과 검색어 양쪽에서 공백·하이픈·점·괄호·가운뎃점을 지운 뒤 비교하기 때문에
 *   · "홍 길동" ↔ "홍길동"
 *   · "010-1234-5678" ↔ "01012345678"
 *   · "MS-INV-2026-00002" ↔ "MSINV202600002"
 * 가 서로 걸린다. 잡음을 지운 매칭은 기존 ILIKE 매칭의 상위집합이라
 * 예전에 찾히던 것이 안 찾히는 일은 없다.
 *
 * 선행 와일드카드라 인덱스를 못 타는 것은 원래 `%term%` ILIKE 와 같다(회귀 아님).
 */
const NOISE_SQL = "[[:space:]().,·/-]";
const NOISE_RE = /[\s().,·/-]/g;

/** 검색어에 들어온 LIKE 메타문자는 리터럴로 취급한다. */
const escapeLike = (q: string) => q.replace(/([\\%_])/g, "\\$1");

const normalized = (expr: SQL) =>
  sql`regexp_replace(coalesce(${expr}, ''), ${NOISE_SQL}, '', 'g')`;

function matches(expr: SQL, q: string): SQL {
  return sql`${normalized(expr)} ILIKE ${`%${escapeLike(q.replace(NOISE_RE, ""))}%`}`;
}

const colText = (col: any): SQL => sql`${col}::text`;

/** 컬럼 하나에 대한 키워드 조건. 라우트에서 단독으로 쓸 때. */
export const columnMatches = (col: any, q: string): SQL => matches(colText(col), q);

/**
 * 성·이름이 두 컬럼으로 나뉜 사람 이름 조건.
 *
 * 각 컬럼 단독뿐 아니라 **성+이름 / 이름+성 결합형**까지 본다. 컬럼별로만 훑으면
 * "조"(성)로는 찾히는데 "조수민"(전체 이름)으로는 한 컬럼에도 통째로 들어있지 않아
 * 0건이 된다 — 한국·일본·중국 이름은 사용자가 붙여서 통으로 입력한다.
 */
export function nameMatches(first: any, last: any, q: string): SQL[] {
  const f = sql`coalesce(${first}::text, '')`;
  const l = sql`coalesce(${last}::text, '')`;
  return [
    matches(colText(first), q),
    matches(colText(last), q),
    matches(sql`(${l} || ${f})`, q),
    matches(sql`(${f} || ${l})`, q),
  ];
}

/** 이름이 키워드에 걸리는 참조 행의 id 목록. */
async function idsByName(table: any, nameCol: any, q: string): Promise<number[]> {
  const rows = await db.select({ id: table.id }).from(table).where(columnMatches(nameCol, q));
  return rows.map((r: { id: number }) => r.id);
}

export const accountIdsByName = (q: string) => idsByName(accountsTable, accountsTable.name, q);
export const spaceIdsByName = (q: string) => idsByName(spacesTable, spacesTable.name, q);
export const propertyIdsByName = (q: string) => idsByName(propertiesTable, propertiesTable.name, q);

/** 연락처는 성·이름이 나뉘어 있어 각 컬럼과 결합형 어느 쪽으로도 찾아야 한다. */
export async function contactIdsByName(q: string): Promise<number[]> {
  const rows = await db.select({ id: contactsTable.id }).from(contactsTable)
    .where(or(
      ...nameMatches(contactsTable.first_name, contactsTable.last_name, q),
      columnMatches(contactsTable.email, q),
    ));
  return rows.map(r => r.id);
}

/**
 * 키워드 OR 조건을 만든다.
 * @param columns  훑을 자기 테이블 컬럼
 * @param refs     참조 컬럼과 그 id 목록 쌍(빈 목록은 무시)
 * @param names    성·이름이 나뉜 컬럼 쌍(결합형까지 매칭)
 */
export function keywordCondition(
  q: string,
  columns: any[],
  refs: { column: any; ids: number[] }[] = [],
  names: { first: any; last: any }[] = [],
): any {
  const parts: any[] = columns.map(c => columnMatches(c, q));
  for (const n of names) parts.push(...nameMatches(n.first, n.last, q));
  for (const r of refs) if (r.ids.length) parts.push(inArray(r.column, r.ids));
  // 아무 축도 없으면 전부 걸러 낸다(키워드를 무시하고 전체를 주는 편이 더 헷갈린다).
  return parts.length ? or(...parts) : sql`false`;
}

/** 단일 날짜 컬럼의 [from, to] 구간 조건. */
export function dateRangeConditions(column: any, from?: string, to?: string): any[] {
  const out: any[] = [];
  if (from) out.push(gte(column, from));
  if (to) out.push(lte(column, to));
  return out;
}

/**
 * 시작/종료가 있는 기간과 [from, to] 가 겹치는 조건.
 * 종료가 비어 있으면 열린 기간으로 본다(진행 중 계약이 빠지지 않게).
 */
export function periodOverlapConditions(
  startColumn: any, endColumn: any, from?: string, to?: string,
): any[] {
  const out: any[] = [];
  if (from) out.push(or(isNull(endColumn), gte(endColumn, from)));
  if (to) out.push(or(isNull(startColumn), lte(startColumn, to)));
  return out;
}

/** 연도(YYYY)에 기간이 걸쳐 있는 조건. 시작일만 보면 다년 건이 빠진다. */
export function yearOverlapConditions(startColumn: any, endColumn: any, year?: string): any[] {
  if (!/^\d{4}$/.test(year ?? "")) return [];
  return periodOverlapConditions(startColumn, endColumn, `${year}-01-01`, `${year}-12-31`);
}

/** 연도(YYYY)로 단일 날짜 컬럼을 거르는 조건. */
export function yearConditions(column: any, year?: string): any[] {
  if (!/^\d{4}$/.test(year ?? "")) return [];
  return [gte(column, `${year}-01-01`), lte(column, `${year}-12-31`)];
}

/**
 * 목록 화면의 연도 선택지. 날짜 컬럼의 앞 4자리를 최신순으로 준다.
 * 날짜 컬럼은 text 인 곳과 date 인 곳이 섞여 있어 반드시 text 로 캐스팅한다
 * (date 에 substring 을 걸면 함수를 못 찾고 500 이 난다).
 */
export async function distinctYears(table: any, column: any, baseCondition?: any): Promise<string[]> {
  const rows = await db
    .select({ v: sql<string>`substring(${column}::text from 1 for 4)` })
    .from(table)
    .where(and(baseCondition, sql`${column} is not null`))
    .groupBy(sql`substring(${column}::text from 1 for 4)`);
  return rows.map((r: { v: string }) => r.v).filter(v => /^\d{4}$/.test(v ?? "")).sort().reverse();
}

/** 목록 화면의 코드/구분 선택지. */
export async function distinctValues(table: any, column: any, baseCondition?: any): Promise<string[]> {
  const rows = await db.select({ v: column }).from(table)
    .where(and(baseCondition, sql`${column} is not null`))
    .groupBy(column);
  return rows.map((r: { v: string }) => r.v).filter(Boolean).sort();
}

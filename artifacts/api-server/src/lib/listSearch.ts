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
import { ilike, inArray, or, and, gte, lte, isNull, sql } from "drizzle-orm";

/** 이름이 키워드에 걸리는 참조 행의 id 목록. */
async function idsByName(table: any, nameCol: any, q: string): Promise<number[]> {
  const rows = await db.select({ id: table.id }).from(table).where(ilike(nameCol, `%${q}%`));
  return rows.map((r: { id: number }) => r.id);
}

export const accountIdsByName = (q: string) => idsByName(accountsTable, accountsTable.name, q);
export const spaceIdsByName = (q: string) => idsByName(spacesTable, spacesTable.name, q);
export const propertyIdsByName = (q: string) => idsByName(propertiesTable, propertiesTable.name, q);

/** 연락처는 성·이름이 나뉘어 있어 둘 중 하나만 걸려도 찾아야 한다. */
export async function contactIdsByName(q: string): Promise<number[]> {
  const term = `%${q}%`;
  const rows = await db.select({ id: contactsTable.id }).from(contactsTable)
    .where(or(ilike(contactsTable.first_name, term), ilike(contactsTable.last_name, term), ilike(contactsTable.email, term)));
  return rows.map(r => r.id);
}

/**
 * 키워드 OR 조건을 만든다.
 * @param columns  ilike 로 훑을 자기 테이블 컬럼
 * @param refs     참조 컬럼과 그 id 목록 쌍(빈 목록은 무시)
 */
export function keywordCondition(
  q: string,
  columns: any[],
  refs: { column: any; ids: number[] }[] = [],
): any {
  const term = `%${q}%`;
  const parts: any[] = columns.map(c => ilike(c, term));
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

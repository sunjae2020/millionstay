import { db, ipGeoCacheTable } from "@workspace/db";
import { inArray, sql } from "drizzle-orm";

/**
 * IP → 예상 지역.
 *
 * 시스템 로그의 IP 만으로는 "이 접속이 평소와 다른가"를 알 수 없어서 지역을 함께
 * 보여 준다. 값은 외부 조회 서비스(기본 ipwho.is)에서 받아 `ip_geo_cache` 에 남기고,
 * 다음부터는 DB 에서 읽는다.
 *
 * 프라이버시: 밖으로 나가는 것은 **IP 주소 하나뿐**이고 사용자·계정 정보는 보내지
 * 않는다. 사설·루프백 주소는 아예 조회하지 않는다. 조회 자체를 끄려면
 * `IP_GEO_LOOKUP=0` — 그 경우 캐시에 있는 값만 보여 준다.
 *
 * 값은 "예상"이다. VPN·모바일 캐리어·회사 프록시면 실제 위치와 다르다. 화면에도
 * 예상 지역이라고 적는다.
 */

export interface IpGeo {
  country_code: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
}

/** 화면 한 장(50행)에서 새로 조회할 IP 상한. 무료 한도와 응답 시간을 함께 지킨다. */
const MAX_NEW_LOOKUPS = 20;
const CONCURRENCY = 5;
const PER_LOOKUP_TIMEOUT_MS = 2500;
/** 실패한 IP 를 다시 두드리기까지의 간격. */
const FAILED_RETRY_MS = 24 * 60 * 60 * 1000;

const API_TEMPLATE = process.env["IP_GEO_API_URL"] ?? "https://ipwho.is/{ip}";
const LOOKUP_ENABLED = process.env["IP_GEO_LOOKUP"] !== "0";

/** 사설·루프백·링크로컬 — 외부에 물어봐야 답이 없는 주소들. */
export function isPrivateIp(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  if (!v) return true;
  if (v === "::1" || v === "localhost") return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
  const m = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isLikelyIp(ip: string): boolean {
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip.trim());
}

async function lookupOne(ip: string): Promise<IpGeo | null> {
  const url = API_TEMPLATE.replace("{ip}", encodeURIComponent(ip));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, unknown>;
    // ipwho.is 는 실패해도 200 + success:false 로 답한다.
    if (body["success"] === false) return null;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const geo: IpGeo = {
      country_code: str(body["country_code"]) ?? str(body["countryCode"]),
      country: str(body["country"]),
      region: str(body["region"]) ?? str(body["regionName"]),
      city: str(body["city"]),
    };
    return geo.country_code || geo.country || geo.city ? geo : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 동시 실행 수를 묶어 순서대로 흘린다 — 한 화면 때문에 외부 API 를 몰아치지 않는다. */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * 주어진 IP 들의 예상 지역을 돌려준다. 캐시에 있으면 그대로, 없으면 조회해서 캐시에
 * 남긴다. 조회가 실패해도 예외를 던지지 않는다 — 지역 하나 때문에 로그 화면이
 * 통째로 죽으면 안 된다.
 */
export async function resolveIpGeos(rawIps: Array<string | null | undefined>): Promise<Map<string, IpGeo>> {
  const result = new Map<string, IpGeo>();
  const ips = [...new Set(rawIps.map((v) => (v ?? "").trim()).filter((v) => v && isLikelyIp(v)))];
  if (ips.length === 0) return result;

  const cached = await db
    .select()
    .from(ipGeoCacheTable)
    .where(inArray(ipGeoCacheTable.ip, ips))
    .catch(() => []);

  const cachedByIp = new Map(cached.map((r) => [r.ip, r]));
  for (const row of cached) {
    if (row.status !== "ok") continue;
    result.set(row.ip, {
      country_code: row.country_code,
      country: row.country,
      region: row.region,
      city: row.city,
    });
  }

  if (!LOOKUP_ENABLED) return result;

  const now = Date.now();
  const misses = ips.filter((ip) => {
    if (isPrivateIp(ip)) return false;
    const row = cachedByIp.get(ip);
    if (!row) return true;
    if (row.status === "ok") return false;
    // 실패·비공개로 남은 항목은 하루 지난 뒤에만 다시 묻는다.
    return now - new Date(row.looked_up_at).getTime() > FAILED_RETRY_MS;
  }).slice(0, MAX_NEW_LOOKUPS);

  // 사설 주소는 조회하지 않되 캐시에 표시해 둔다(다음 화면에서 후보로도 안 뜬다).
  const privates = ips.filter((ip) => isPrivateIp(ip) && !cachedByIp.has(ip));

  if (misses.length === 0 && privates.length === 0) return result;

  const looked = await mapLimited(misses, CONCURRENCY, async (ip) => ({ ip, geo: await lookupOne(ip) }));

  const rows = [
    ...looked.map(({ ip, geo }) => ({
      ip,
      status: geo ? "ok" : "failed",
      country_code: geo?.country_code ?? null,
      country: geo?.country ?? null,
      region: geo?.region ?? null,
      city: geo?.city ?? null,
      source: geo ? new URL(API_TEMPLATE.replace("{ip}", "0.0.0.0")).host : null,
      looked_up_at: new Date(),
    })),
    ...privates.map((ip) => ({
      ip,
      status: "private",
      country_code: null, country: null, region: null, city: null,
      source: null,
      looked_up_at: new Date(),
    })),
  ];

  if (rows.length > 0) {
    await db
      .insert(ipGeoCacheTable)
      .values(rows)
      .onConflictDoUpdate({
        target: ipGeoCacheTable.ip,
        // 같은 IP 를 다시 조회했으면 새 값으로 덮는다(EXCLUDED = 방금 넣으려던 행).
        set: {
          status: sql`excluded.status`,
          country_code: sql`excluded.country_code`,
          country: sql`excluded.country`,
          region: sql`excluded.region`,
          city: sql`excluded.city`,
          source: sql`excluded.source`,
          looked_up_at: sql`excluded.looked_up_at`,
        },
      })
      .catch((err) => {
        console.warn("[geoip] cache write failed:", (err as Error)?.message ?? err);
      });
  }

  for (const { ip, geo } of looked) {
    if (geo) result.set(ip, geo);
  }
  return result;
}

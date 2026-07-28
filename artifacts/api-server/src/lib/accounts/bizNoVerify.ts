/**
 * 사업자등록번호 verification against the Korean NTS (국세청) status API,
 * published on data.go.kr as `nts-businessman/v1/status`.
 *
 * Used by Account detail → 사업자등록번호 "확인" and by the website-enrichment
 * approval dialog, so a number scraped off a footer is checked before it is
 * trusted. Requires the `NTS_BIZ_API_KEY` service key (the DECODED form of the
 * data.go.kr key); without it the feature reports itself as unconfigured and
 * the button stays disabled rather than failing at click time.
 */

const NTS_STATUS_URL = "https://api.odcloud.kr/api/nts-businessman/v1/status";
const TIMEOUT_MS = 8_000;

/** Normalised outcome stored on `accounts.biz_verify_status`. */
export type BizVerifyStatus = "Valid" | "Suspended" | "Closed" | "NotFound";

export interface BizVerifyResult {
  /** The 10 digits actually checked. */
  b_no: string;
  status: BizVerifyStatus;
  /** 국세청 wording, e.g. "계속사업자" / "폐업자". Shown verbatim in the UI. */
  status_text: string | null;
  /** 과세유형, e.g. "부가가치세 일반과세자". */
  tax_type: string | null;
  /** 폐업일자 (YYYYMMDD) when the business is closed. */
  end_date: string | null;
}

export function isBizVerifyConfigured(): boolean {
  return !!process.env["NTS_BIZ_API_KEY"];
}

/** Strips separators; returns null when the input is not 10 digits. */
export function normaliseBizNo(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  return digits.length === 10 ? digits : null;
}

/** "1234567890" → "123-45-67890". Leaves anything else untouched. */
export function formatBizNo(input: string): string {
  const digits = normaliseBizNo(input);
  return digits ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}` : input;
}

/**
 * Korean 사업자등록번호 check digit. Catches typos before spending an API call
 * (and gives a usable answer when the NTS key is not configured).
 */
export function isValidBizNoChecksum(input: string): boolean {
  const digits = normaliseBizNo(input);
  if (!digits) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (weights[i] as number);
  sum += Math.floor((Number(digits[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(digits[9]);
}

function mapStatus(code: string | undefined, taxType: string | undefined): BizVerifyStatus {
  // 01 계속사업자 · 02 휴업자 · 03 폐업자. An unregistered number comes back with
  // no b_stt_cd and a tax_type saying it is not registered.
  if (code === "01") return "Valid";
  if (code === "02") return "Suspended";
  if (code === "03") return "Closed";
  if (taxType && /등록되지\s*않은/.test(taxType)) return "NotFound";
  return "NotFound";
}

/**
 * Look a number up at the NTS. Throws when the key is missing or the upstream
 * call fails — the route maps those to 503 so the admin can still save the
 * number unverified.
 */
export async function verifyBizNo(input: string): Promise<BizVerifyResult> {
  const b_no = normaliseBizNo(input);
  if (!b_no) throw new Error("사업자등록번호 must be 10 digits");

  const key = process.env["NTS_BIZ_API_KEY"];
  if (!key) {
    throw new Error("Business-number verification is not configured: set NTS_BIZ_API_KEY.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${NTS_STATUS_URL}?serviceKey=${encodeURIComponent(key)}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ b_no: [b_no] }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("국세청 verification timed out. Please try again.");
    }
    throw new Error("국세청 verification could not be reached");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`국세청 verification failed (HTTP ${res.status})`);
  }
  const body = (await res.json().catch(() => null)) as {
    data?: Array<{ b_no?: string; b_stt?: string; b_stt_cd?: string; tax_type?: string; end_dt?: string }>;
  } | null;

  const row = body?.data?.[0];
  if (!row) throw new Error("국세청 verification returned no result");

  return {
    b_no,
    status: mapStatus(row.b_stt_cd, row.tax_type),
    status_text: row.b_stt?.trim() || null,
    tax_type: row.tax_type?.trim() || null,
    end_date: row.end_dt?.trim() || null,
  };
}

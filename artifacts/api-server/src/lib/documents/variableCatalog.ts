/**
 * 문안 변수 카탈로그 — "이 문안이 받는 값" + "같은 종류의 다른 문안이 쓰는 값".
 *
 * 편집 화면의 변수 목록은 지금까지 그 문안이 선언한 변수만 보여 줬다. 새 문안을
 * 쓰는 사람에게는 그게 빈 목록이거나 두어 개뿐이고, 옆 문안이 무엇을 쓰는지
 * 보려면 다른 문안을 하나씩 열어 봐야 했다.
 *
 * 그래서 같은 `kind` 의 모든 문안이 선언한 변수를 모아 **관련 변수**로 함께 보인다.
 * 다만 이 구분이 장식이 아니다 —
 *
 *   `renderString()` 은 **모르는 변수를 빈 문자열로** 바꾼다(templateEngine.ts).
 *
 * 즉 발송 코드가 보내지 않는 변수를 문안에 넣으면 경고 없이 빈칸이 나간다.
 * "금액 원 납부 바랍니다" 같은 문자가 그렇게 만들어진다. 그래서 카탈로그는
 * 세 묶음을 **분명히 갈라서** 돌려준다.
 *
 *   declared  이 문안이 선언한 변수 — 발송 코드가 보낸다. 안전하다.
 *   auto      호출부가 안 보내도 서버가 채운다(상호·문의번호).
 *   related   다른 문안이 쓰는 변수 — 넣으려면 **발송 코드도 함께 고쳐야 한다.**
 *
 * 화면은 related 를 넣을 때 그 사실을 말해 준다. 카탈로그가 하는 일은 고르기를
 * 쉽게 하는 것이지, 아무 변수나 넣어도 된다고 말하는 것이 아니다.
 */

export interface CatalogVariable {
  name: string;
  type: string;
  /** 미리보기용 표본값. 문자 문안에서는 이 길이가 곧 요금이라 특히 쓸모 있다. */
  sample: string;
  /** 화면 분류(아래 GROUPS). */
  group: string;
  /** 이 변수를 선언한 다른 문안의 키(최대 몇 개만). related 에만 있다. */
  used_by?: string[];
  /** 그 변수를 쓰는 문안 수. */
  used_count?: number;
}

export interface VariableCatalog {
  declared: CatalogVariable[];
  auto: CatalogVariable[];
  related: CatalogVariable[];
}

/**
 * 분류. 변수 수가 스무 개를 넘어가면 한 덩어리 목록은 훑어지지 않는다.
 * 이름 규칙으로 가른다 — 새 변수가 생겨도 대개 알아서 제자리에 들어가고,
 * 못 가른 것은 "기타" 로 간다(숨기지 않는다).
 */
const GROUPS: Array<{ group: string; test: RegExp }> = [
  { group: "link", test: /^(url|link)$|_url$/ },
  { group: "money", test: /amount|price|fee|deposit|balance|rent$/ },
  { group: "date", test: /^(date|period)$|_date$|_at$|days_|_days$|time_window|expiry|month|year/ },
  { group: "person", test: /^(name|recipient|client_name|tenant_name|guest_name|partner_company|company)$|_name$/ },
  { group: "place", test: /space|address|unit|floor|building|room/ },
  { group: "contact", test: /phone|mobile|email|code$/ },
  { group: "doc", test: /^(ref|doc_type|status|purpose|job_type|subject)$|_ref$|_type$/ },
];

export function groupOf(name: string): string {
  // 순서가 곧 우선순위다. space_name 은 person(_name$) 보다 place 가 맞으므로
  // place 를 person 뒤에 두지 않는다 — 아래 특례가 그 몇 개를 먼저 가른다.
  if (/^space_name$|_space_name$/.test(name)) return "place";
  if (/^contact_phone$/.test(name)) return "contact";
  for (const g of GROUPS) if (g.test.test(name)) return g.group;
  return "other";
}

/** 호출부가 넘기지 않아도 서버가 채우는 변수. lib/sms.ts · lib/notify.ts 와 맞춘다. */
const AUTO: Record<string, Array<{ name: string; type: string; sample: string }>> = {
  sms: [
    { name: "brand", type: "string", sample: "브랜드" },
    { name: "contact_phone", type: "string", sample: "061-123-4567" },
  ],
  email: [{ name: "brand", type: "string", sample: "브랜드" }],
};

/** 표본값 — 문자 시드 검증기(scripts/lib/email-templates/_sms.mjs)와 같은 값을 쓴다. */
const SAMPLES: Record<string, string> = {
  url: "https://mth.kr/a1B2c3",
  ref: "INV-2026-00123",
  name: "김민수",
  recipient: "김민수",
  client_name: "박지연",
  brand: "브랜드",
  space_name: "101동 1203호",
  address: "전남 여수시 좌수영로 101",
  amount: "1,250,000원",
  net_amount: "820,000원",
  due_date: "8월 25일",
  date: "8월 25일(화)",
  time_window: "14시–16시",
  contact_phone: "061-123-4567",
  code: "384712",
  access_code: "#1234*",
  expiry_minutes: "10",
  days_overdue: "15",
  job_type: "입주청소",
  purpose: "세대 점검",
  partner_company: "행복공인중개사",
  period: "2026년 7월",
  status: "계약 완료",
  doc_type: "계약서",
};

function sampleFor(name: string, type: string): string {
  const known = SAMPLES[name];
  if (known) return known;
  if (type === "url") return "https://mth.kr/a1B2c3";
  if (type === "date") return "8월 25일";
  if (type === "number") return "3";
  return `[${name}]`;
}

function toVar(name: string, type: string): CatalogVariable {
  return { name, type, sample: sampleFor(name, type), group: groupOf(name) };
}

type SchemaRow = { key: string; kind: string; variables_schema: unknown };

/**
 * @param target 편집 중인 문안
 * @param siblings 같은 인스턴스의 모든 문안(같은 kind 만 골라 쓴다)
 */
export function buildVariableCatalog(target: SchemaRow, siblings: SchemaRow[]): VariableCatalog {
  const schemaOf = (row: SchemaRow) =>
    (row.variables_schema && typeof row.variables_schema === "object"
      ? (row.variables_schema as Record<string, { type?: string }>)
      : {});

  const declared = Object.entries(schemaOf(target))
    // 알림톡 메타는 변수가 아니다(variables_schema.kakao 에 얹혀 있다).
    .filter(([name]) => name !== "kakao")
    .map(([name, def]) => toVar(name, def?.type ?? "string"));

  const auto = (AUTO[target.kind] ?? [])
    .filter((a) => !declared.some((d) => d.name === a.name))
    .map((a) => ({ ...a, group: groupOf(a.name) }));

  const taken = new Set([...declared, ...auto].map((v) => v.name));
  const usage = new Map<string, { type: string; keys: string[] }>();
  for (const row of siblings) {
    if (row.kind !== target.kind || row.key === target.key) continue;
    for (const [name, def] of Object.entries(schemaOf(row))) {
      if (name === "kakao" || taken.has(name)) continue;
      const cur = usage.get(name) ?? { type: (def as { type?: string } | undefined)?.type ?? "string", keys: [] as string[] };
      cur.keys.push(row.key);
      usage.set(name, cur);
    }
  }

  const related = [...usage.entries()]
    .map(([name, u]) => ({
      ...toVar(name, u.type),
      // 어느 문안이 쓰는지 몇 개만 — "이걸 넣으려면 어디를 참고하면 되나" 의 답이다.
      used_by: u.keys.slice(0, 3),
      used_count: u.keys.length,
    }))
    // 많이 쓰이는 것이 대개 찾는 것이다.
    .sort((a, b) => (b.used_count! - a.used_count!) || a.name.localeCompare(b.name));

  return { declared, auto, related };
}

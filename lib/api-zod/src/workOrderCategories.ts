/**
 * 작업 지시서 카테고리 분류(SSOT).
 *
 * 카테고리는 오랫동안 자유 입력이라 같은 뜻이 언어·대소문자별로 흩어졌다
 * (`Cleaning` / `cleaning` / `청소`). 표기를 여기 한 곳에 모아 두고,
 * 저장·조회·표시는 모두 아래 canonical 값(소문자 스네이크)을 쓴다.
 *
 * 순서는 화면 노출 순서 그대로다. `common: false` 는 실제 사용 빈도가 낮아
 * 셀렉트 하단(기타 그룹)으로 내린 항목.
 */
export type WorkOrderCategoryDef = {
  /** DB 에 저장되는 canonical 값. */
  value: string;
  /** i18n 키(admin: `workorder.*`, 파트너 포털: `workorders.cat_<value>`). */
  labelKey: string;
  /** 자주 쓰는 항목인지 — 셀렉트 상단 그룹에 묶인다. */
  common: boolean;
};

export const WORK_ORDER_CATEGORIES: readonly WorkOrderCategoryDef[] = [
  // 자주 쓰는 순 — Metheim 여수 운영 실적(하자보수 32 / 퇴거청소 22 / 입주청소 12)이 기준.
  { value: "repair", labelKey: "workorder.category_repair", common: true },
  { value: "move_out_cleaning", labelKey: "workorder.category_move_out_cleaning", common: true },
  { value: "move_in_cleaning", labelKey: "workorder.category_move_in_cleaning", common: true },
  { value: "cleaning", labelKey: "workorder.category_cleaning", common: true },
  { value: "wallpaper", labelKey: "workorder.category_wallpaper", common: true },
  { value: "plumbing", labelKey: "workorder.category_plumbing", common: true },
  { value: "electrical", labelKey: "workorder.category_electrical", common: true },
  { value: "hvac", labelKey: "workorder.category_hvac", common: true },
  // 여기부터는 사용 빈도가 낮아 하단으로 내린다.
  { value: "painting", labelKey: "workorder.category_painting", common: false },
  { value: "carpentry", labelKey: "workorder.category_carpentry", common: false },
  { value: "pest_control", labelKey: "workorder.category_pest_control", common: false },
  { value: "landscaping", labelKey: "workorder.category_landscaping", common: false },
  { value: "security", labelKey: "workorder.category_security", common: false },
  { value: "day_tour", labelKey: "workorder.category_day_tour", common: false },
  { value: "fishing", labelKey: "workorder.category_fishing", common: false },
  { value: "general", labelKey: "workorder.category_general", common: false },
];

/**
 * 과거에 저장된 표기 → canonical. 키는 모두 소문자·trim 된 형태로 둔다
 * (`Cleaning`, ` cleaning ` 모두 같은 키로 떨어지도록).
 */
const CATEGORY_ALIASES: Record<string, string> = {
  "하자보수": "repair", "유지보수": "repair", "maintenance": "repair", "repair": "repair",
  "퇴거청소": "move_out_cleaning", "move_out_cleaning": "move_out_cleaning", "move out cleaning": "move_out_cleaning",
  "입주청소": "move_in_cleaning", "move_in_cleaning": "move_in_cleaning", "move in cleaning": "move_in_cleaning",
  "청소": "cleaning", "cleaning": "cleaning",
  "벽지": "wallpaper", "도배": "wallpaper", "wallpaper": "wallpaper",
  "배관": "plumbing", "plumbing": "plumbing",
  "전기": "electrical", "electrical": "electrical",
  "냉난방": "hvac", "냉난방공조": "hvac", "hvac": "hvac",
  "도장": "painting", "painting": "painting",
  "목공": "carpentry", "carpentry": "carpentry",
  "방역": "pest_control", "pest control": "pest_control", "pest_control": "pest_control",
  "조경": "landscaping", "landscaping": "landscaping",
  "보안": "security", "security": "security",
  "데이투어": "day_tour", "day tour": "day_tour", "day_tour": "day_tour",
  "낚시": "fishing", "fishing": "fishing",
  "일반": "general", "기타": "general", "general": "general", "other": "general",
};

const ORDER = new Map(WORK_ORDER_CATEGORIES.map((c, i) => [c.value, i]));

/** 임의 표기를 canonical 값으로. 알 수 없는 값은 원문을 그대로 돌려준다(자료 유실 방지). */
export function canonicalWorkOrderCategory(raw: unknown): string | null {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return null;
  return CATEGORY_ALIASES[key] ?? key;
}

/** canonical 값 하나가 DB 에서 가질 수 있는 모든 표기(소문자 기준). 조회 조건에 쓴다. */
export function workOrderCategoryAliases(canonical: string): string[] {
  const key = String(canonical ?? "").trim().toLowerCase();
  if (!key) return [];
  const out = Object.entries(CATEGORY_ALIASES)
    .filter(([, v]) => v === key)
    .map(([k]) => k);
  return out.length ? out : [key];
}

/** 목록/셀렉트 노출 순서. 분류표에 없는 값은 뒤로 밀고 사전순. */
export function sortWorkOrderCategories(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const ai = ORDER.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bi = ORDER.get(b) ?? Number.MAX_SAFE_INTEGER;
    return ai !== bi ? ai - bi : a.localeCompare(b);
  });
}

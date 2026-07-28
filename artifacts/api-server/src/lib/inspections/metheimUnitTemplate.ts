/**
 * 세대점검표 (unit inspection checklist) templates.
 *
 * `metheim_unit` reproduces the Metheim 여수 임대세대 점검표 paper form verbatim:
 * the 입주물품 hand-over list plus six area groups, in the printed order. Item
 * codes are stable so a report seeded today stays comparable with one seeded a
 * year from now even if labels are reworded.
 *
 * Templates are data, not schema — adding a template here makes it selectable
 * without a migration, and a report keeps its own copy of the items once seeded
 * (so later template edits never mutate signed history).
 */

export type InspectionGroupKey =
  | "provided"
  | "entrance"
  | "bathroom"
  | "kitchen"
  | "living"
  | "bedroom"
  | "boiler";

export interface InspectionTemplateItem {
  code: string;
  label: string;
}

export interface InspectionTemplateGroup {
  key: InspectionGroupKey;
  label: string;
  items: InspectionTemplateItem[];
}

export interface InspectionTemplate {
  key: string;
  name: string;
  /** Heading printed at the top of the paper form. */
  heading: string;
  /** Unit types offered in the header (타입 A B C D E). */
  unitTypes: string[];
  groups: InspectionTemplateGroup[];
  /** 특약 사항 — printed under the checklist, numbered as on the paper form. */
  specialTerms: string[];
}

const g = (
  key: InspectionGroupKey,
  label: string,
  items: Array<[string, string]>,
): InspectionTemplateGroup => ({
  key,
  label,
  items: items.map(([code, itemLabel]) => ({ code: `${key}.${code}`, label: itemLabel })),
});

export const METHEIM_UNIT_TEMPLATE: InspectionTemplate = {
  key: "metheim_unit",
  name: "메트하임 여수 임대세대 점검표",
  heading: "임대세대 점검표",
  unitTypes: ["A", "B", "C", "D", "E"],
  groups: [
    g("provided", "입주물품", [
      ["aircon_remote", "에어컨 리모컨 (1개)"],
      ["hrv_remote", "전열교환기 리모컨 (1개)"],
      ["rf_card", "현관 RF카드 (2장)"],
    ]),
    g("entrance", "현관", [
      ["fire_door", "방화문"],
      ["door_lock", "도어락"],
      ["extinguisher", "소화기"],
      ["sensor_light", "센서등"],
      ["shoe_rack", "신발장"],
      ["wallpaper", "벽지"],
      ["mirror", "거울"],
      ["grout", "줄눈"],
      ["floor_tile", "바닥타일"],
      ["marble_sill", "대리석문턱"],
      ["master_switch", "일괄소등스위치"],
    ]),
    g("bathroom", "욕실", [
      ["door", "욕실 문 (목문)"],
      ["light", "전등"],
      ["outlet", "콘센트"],
      ["mirror_cabinet", "거울장"],
      ["towel_rail", "수건걸이"],
      ["toilet", "변기(작동/흔들림)"],
      ["tile", "벽 / 바닥 타일"],
      ["grout", "벽 / 바닥 줄눈"],
      ["zendai", "젠다이"],
      ["basin", "세면대"],
      ["basin_tap", "세면대 수전"],
      ["basin_popup", "세면대 폽업마개"],
      ["shower_fan", "샤워실 환풍기"],
      ["shower_head", "샤워헤드"],
      ["soap_holder", "샤워기 비누받침대"],
      ["rain_shower", "해바라기샤워헤드"],
      ["shower_glass", "샤워실 유리문/손잡이"],
    ]),
    g("kitchen", "주방", [
      ["light", "전등"],
      ["sprinkler", "스프링쿨러"],
      ["range_hood", "렌지후드"],
      ["auto_extinguisher", "자동소화기"],
      ["breaker", "전기차단기"],
      ["cabinets", "주방가구"],
      ["cutlery_holder", "수저통/행주걸이(A,B,C)"],
      ["food_dehydrator", "음식물탈수기/뚜껑2EA"],
      ["knife_block", "싱크대 하단 칼보관함"],
      ["dish_rack", "식기 건조대"],
      ["tile", "주방타일"],
      ["washer", "세탁기"],
      ["fridge", "냉장고"],
      ["floor", "강마루"],
      ["mobile_table", "이동식 식탁(B,C타입)"],
      ["folding_dryer", "접이식 건조대(B,C타입)"],
    ]),
    g("living", "거실", [
      ["light", "전등"],
      ["sprinkler", "스프링쿨러"],
      ["smoke_detector", "화재 감지기"],
      ["boiler_thermostat", "보일러 온도조절기"],
      ["comms_box", "통신단자함"],
      ["distribution_box", "세대분전함(두꺼비집)"],
      ["wall_pad", "월패드(홈네트웍)"],
      ["tv_stand", "티비장/접이식테이블"],
      ["tv_cabinet_hook", "티비수납장고리"],
      ["wallpaper", "벽지"],
      ["floor", "강마루"],
      ["aircon", "에어컨"],
      ["hrv", "전열 교환기"],
      ["sash_handle", "샷시 손잡이"],
      ["fly_screen", "방충망"],
      ["window_sash", "창문 / 창틀 샷시"],
    ]),
    g("bedroom", "침실", [
      ["light", "전등"],
      ["sprinkler", "스프링쿨러"],
      ["smoke_detector", "화재 감지기"],
      ["speaker", "스피커"],
      ["boiler_thermostat", "보일러 온도조절기"],
      ["wardrobe", "붙박이장"],
      ["dresser", "화장대"],
      ["door", "방 문(목문)"],
      ["wallpaper", "벽지"],
      ["floor", "강마루"],
      ["sash_handle", "샷시 손잡이"],
      ["fly_screen", "방충망"],
      ["window_sash", "창문 / 창틀 샷시"],
    ]),
    g("boiler", "보일러 + 실외기실", [
      ["light", "전등"],
      ["gas_safety", "가스 안전장치"],
      ["boiler", "보일러"],
      ["outdoor_unit", "실외기"],
      ["switch", "스위치"],
      ["drain", "배수관 / 배수구"],
      ["fire_door_handle", "보일러 방화문 손잡이"],
      ["gallery_screen", "갤러리창 방충망"],
      ["gallery_window", "갤러리 창 작동여부"],
    ]),
  ],
  specialTerms: [
    "위 세대점검표는 아파트시설관리차원에서 추후 하자 관리와 더불어 입주전 하자점검에서 발견된 부분을 임대인과 임차인 모두 인지하고 있다는 것에 동의하고 작성한다.",
    "퇴거 시 퇴거점검 이후 세대점검표에 작성된 입주하자부분 이외 추가로 고의적 파손에 대한 원상복구비용은 보증금에서 공제한다. ※세대 내 못질, 스티커 자국 금지 — 못자국 및 스티커 자국으로 인한 벽지 등 파손 등.",
    "임차인은 퇴거 시 세대 내 자연적 노후로 인한 하자는 책임지지 않는다. (예시: 벽지변색, 전등, 줄눈변색, 실리콘 변색 등)",
  ],
};

export const INSPECTION_TEMPLATES: Record<string, InspectionTemplate> = {
  [METHEIM_UNIT_TEMPLATE.key]: METHEIM_UNIT_TEMPLATE,
};

export const DEFAULT_INSPECTION_TEMPLATE_KEY = METHEIM_UNIT_TEMPLATE.key;

export function getInspectionTemplate(key?: string | null): InspectionTemplate {
  return INSPECTION_TEMPLATES[key ?? ""] ?? METHEIM_UNIT_TEMPLATE;
}

/** Flatten a template into insertable item rows (order preserved). */
export function templateItemRows(template: InspectionTemplate): Array<{
  group_key: string;
  item_code: string;
  label: string;
  sort_order: number;
}> {
  const rows: Array<{ group_key: string; item_code: string; label: string; sort_order: number }> = [];
  let order = 0;
  for (const group of template.groups) {
    for (const item of group.items) {
      rows.push({ group_key: group.key, item_code: item.code, label: item.label, sort_order: order++ });
    }
  }
  return rows;
}

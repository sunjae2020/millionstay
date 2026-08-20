/**
 * 작업 지시서 카테고리 — 화면 표시용 헬퍼.
 * 분류표 자체는 `@workspace/api-zod` 의 workOrderCategories 가 정본이고,
 * 여기서는 i18n 라벨 붙이기만 한다.
 */
import { useTranslation } from "react-i18next";
import {
  WORK_ORDER_CATEGORIES,
  canonicalWorkOrderCategory,
} from "@workspace/api-zod";

export { WORK_ORDER_CATEGORIES, canonicalWorkOrderCategory, sortWorkOrderCategories } from "@workspace/api-zod";

/** 자주 쓰는 항목 / 그 밖의 항목 — 셀렉트를 두 그룹으로 나눌 때 쓴다. */
export const COMMON_WORK_ORDER_CATEGORIES = WORK_ORDER_CATEGORIES.filter(c => c.common);
export const OTHER_WORK_ORDER_CATEGORIES = WORK_ORDER_CATEGORIES.filter(c => !c.common);

const LABEL_KEY = new Map(WORK_ORDER_CATEGORIES.map(c => [c.value, c.labelKey]));

/** 저장값(옛 표기 포함)을 현재 언어의 라벨로. 분류표에 없는 값은 원문 그대로 보여 준다. */
export function useWorkOrderCategoryLabel() {
  const { t } = useTranslation();
  return (raw: string | null | undefined): string => {
    const value = canonicalWorkOrderCategory(raw);
    if (!value) return "—";
    const key = LABEL_KEY.get(value);
    return key ? t(key as any, value) : value;
  };
}

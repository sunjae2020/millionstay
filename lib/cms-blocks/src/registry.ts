import type { BlockSpec, BlockType, FieldDef } from "./types";

// ---------------------------------------------------------------------------
// The UI Blocks catalog. Each entry declares (a) the fields the admin edit form
// renders, (b) which of those fields the AI translator rewrites, and (c) the
// props a freshly inserted block starts with. The public renderer has one
// component per type; `cms_block_templates` rows seed from `defaultProps` and
// let staff override the defaults per site.
// ---------------------------------------------------------------------------

const T = (key: string, label: string, type: FieldDef["type"] = "text"): FieldDef => ({
  key,
  label,
  type,
  translatable: type === "text" || type === "textarea" || type === "richtext",
});

const IMG = (key: string, label: string): FieldDef => ({ key, label, type: "image" });
const LINK = (key = "href", label = "링크 URL"): FieldDef => ({ key, label, type: "link" });

export const BLOCK_SPECS: Record<BlockType, BlockSpec> = {
  // ── Layout ───────────────────────────────────────────────────────────────
  section: {
    type: "section",
    name: "섹션 (컨테이너)",
    description: "다른 블록을 담는 컨테이너. 배경과 여백을 한 번에 지정합니다.",
    category: "Layout",
    container: true,
    fields: [T("title", "섹션 제목 (선택)"), T("subtitle", "섹션 부제 (선택)", "textarea")],
    defaultProps: { title: "", subtitle: "" },
    defaultStyle: { bg: "transparent", spacingTop: 2, spacingBottom: 2, width: "contained" },
  },
  "hero-banner": {
    type: "hero-banner",
    name: "히어로 배너",
    description: "페이지 최상단 대형 배너 — 제목, 설명, 버튼, 배경 이미지.",
    category: "Layout",
    fields: [
      T("title", "제목"),
      T("subtitle", "부제"),
      T("description", "설명", "textarea"),
      T("buttonLabel", "버튼 문구"),
      LINK("buttonUrl", "버튼 링크"),
      T("secondaryLabel", "보조 버튼 문구"),
      LINK("secondaryUrl", "보조 버튼 링크"),
      IMG("backgroundImage", "배경 이미지"),
      { key: "overlay", label: "어두운 오버레이", type: "boolean" },
    ],
    defaultProps: {
      title: "제목을 입력하세요",
      subtitle: "",
      description: "",
      buttonLabel: "",
      buttonUrl: "",
      overlay: true,
    },
    defaultStyle: { bg: "ink", spacingTop: 0, spacingBottom: 0, align: "center", width: "full" },
  },
  "hero-slider": {
    type: "hero-slider",
    name: "히어로 슬라이더",
    description: "여러 장을 자동으로 넘기는 대형 배너.",
    category: "Layout",
    fields: [
      { key: "autoplaySeconds", label: "자동 넘김 (초)", type: "number" },
      {
        key: "slides",
        label: "슬라이드",
        type: "items",
        max: 8,
        fields: [T("title", "제목"), T("description", "설명", "textarea"), T("buttonLabel", "버튼 문구"), LINK("buttonUrl", "버튼 링크"), IMG("image", "이미지")],
      },
    ],
    defaultProps: { autoplaySeconds: 6, slides: [] },
    defaultStyle: { width: "full", spacingTop: 0, spacingBottom: 0 },
  },

  // ── Content ──────────────────────────────────────────────────────────────
  "rich-text": {
    type: "rich-text",
    name: "본문 텍스트",
    description: "제목 + 서식 있는 본문 한 덩어리.",
    category: "Content",
    fields: [T("title", "제목"), T("body", "본문", "richtext")],
    defaultProps: { title: "", body: "" },
    defaultStyle: { spacingTop: 2, spacingBottom: 2, width: "contained" },
  },
  "about-us": {
    type: "about-us",
    name: "회사 소개",
    description: "소개 문구 + 이미지 + 핵심 지표.",
    category: "Content",
    fields: [
      T("title", "제목"),
      T("subtitle", "부제"),
      T("description", "설명", "richtext"),
      IMG("image", "이미지"),
      {
        key: "highlights",
        label: "강조 항목",
        type: "items",
        max: 6,
        fields: [T("title", "제목"), T("description", "설명", "textarea")],
      },
    ],
    defaultProps: { title: "", subtitle: "", description: "", highlights: [] },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
  "content-featured": {
    type: "content-featured",
    name: "이미지 + 텍스트",
    description: "이미지와 글을 좌우로 배치한 소개 블록.",
    category: "Content",
    fields: [
      T("title", "제목"),
      T("body", "본문", "richtext"),
      IMG("image", "이미지"),
      {
        key: "imagePosition",
        label: "이미지 위치",
        type: "select",
        options: [
          { value: "left", label: "왼쪽" },
          { value: "right", label: "오른쪽" },
        ],
      },
      T("buttonLabel", "버튼 문구"),
      LINK("buttonUrl", "버튼 링크"),
    ],
    defaultProps: { title: "", body: "", imagePosition: "right" },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
  "feature-list": {
    type: "feature-list",
    name: "특징 목록",
    description: "아이콘·제목·설명 카드를 나열합니다.",
    category: "Content",
    fields: [
      T("title", "제목"),
      T("subtitle", "부제", "textarea"),
      {
        key: "columns",
        label: "열 수",
        type: "select",
        options: [
          { value: "2", label: "2열" },
          { value: "3", label: "3열" },
          { value: "4", label: "4열" },
        ],
      },
      {
        key: "items",
        label: "항목",
        type: "items",
        max: 12,
        fields: [T("title", "제목"), T("description", "설명", "textarea"), IMG("icon", "아이콘/이미지")],
      },
    ],
    defaultProps: { title: "", subtitle: "", columns: "3", items: [] },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
  quote: {
    type: "quote",
    name: "인용문",
    description: "강조된 한 문장과 출처.",
    category: "Content",
    fields: [T("quote", "인용문", "textarea"), T("author", "작성자"), T("role", "직함")],
    defaultProps: { quote: "", author: "", role: "" },
    defaultStyle: { bg: "muted", spacingTop: 2, spacingBottom: 2, align: "center" },
  },
  steps: {
    type: "steps",
    name: "진행 절차",
    description: "번호가 매겨진 단계 안내.",
    category: "Content",
    fields: [
      T("title", "제목"),
      T("subtitle", "부제", "textarea"),
      {
        key: "items",
        label: "단계",
        type: "items",
        max: 10,
        fields: [T("title", "단계 제목"), T("description", "설명", "textarea"), IMG("icon", "아이콘")],
      },
    ],
    defaultProps: { title: "", subtitle: "", items: [] },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
  statistics: {
    type: "statistics",
    name: "숫자 지표",
    description: "핵심 수치를 나란히 보여줍니다.",
    category: "Content",
    fields: [
      T("title", "제목"),
      {
        key: "items",
        label: "지표",
        type: "items",
        max: 6,
        fields: [T("value", "수치"), T("label", "설명")],
      },
    ],
    defaultProps: { title: "", items: [] },
    defaultStyle: { bg: "surface", spacingTop: 3, spacingBottom: 3 },
  },
  "custom-html": {
    type: "custom-html",
    name: "직접 입력 HTML",
    description: "제한된 태그만 허용됩니다. 스크립트는 저장 시 제거됩니다.",
    category: "Content",
    fields: [{ key: "html", label: "HTML", type: "html", hint: "script/iframe/style 등은 저장 시 자동 제거됩니다." }],
    defaultProps: { html: "" },
    defaultStyle: { spacingTop: 2, spacingBottom: 2, width: "contained" },
  },

  // ── Offer ────────────────────────────────────────────────────────────────
  services: {
    type: "services",
    name: "서비스 소개",
    description: "제공 서비스를 카드로 소개합니다.",
    category: "Content",
    fields: [
      T("title", "제목"),
      T("subtitle", "부제", "textarea"),
      {
        key: "items",
        label: "서비스",
        type: "items",
        max: 12,
        fields: [T("title", "제목"), T("description", "설명", "textarea"), IMG("image", "이미지"), LINK("href", "링크")],
      },
    ],
    defaultProps: { title: "", subtitle: "", items: [] },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
  pricing: {
    type: "pricing",
    name: "요금제",
    description: "요금 플랜 비교 카드.",
    category: "Marketing",
    fields: [
      T("title", "제목"),
      T("subtitle", "부제", "textarea"),
      {
        key: "plans",
        label: "플랜",
        type: "items",
        max: 6,
        fields: [
          T("name", "플랜명"),
          T("price", "가격"),
          T("period", "기간 표기"),
          T("description", "설명", "textarea"),
          T("features", "포함 항목 (줄바꿈 구분)", "textarea"),
          T("buttonLabel", "버튼 문구"),
          LINK("buttonUrl", "버튼 링크"),
          { key: "featured", label: "추천 표시", type: "boolean" },
        ],
      },
    ],
    defaultProps: { title: "", subtitle: "", plans: [] },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
  faqs: {
    type: "faqs",
    name: "자주 묻는 질문",
    description: "펼침형 질문·답변 목록.",
    category: "Content",
    fields: [
      T("title", "제목"),
      {
        key: "items",
        label: "질문",
        type: "items",
        max: 30,
        fields: [T("question", "질문"), T("answer", "답변", "richtext")],
      },
    ],
    defaultProps: { title: "", items: [] },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },

  // ── Trust ────────────────────────────────────────────────────────────────
  brands: {
    type: "brands",
    name: "제휴 로고",
    description: "파트너·제휴사 로고를 나열합니다.",
    category: "Media",
    fields: [
      T("title", "제목"),
      {
        key: "items",
        label: "로고",
        type: "items",
        max: 20,
        fields: [T("name", "이름"), IMG("image", "로고"), LINK("href", "링크")],
      },
    ],
    defaultProps: { title: "", items: [] },
    defaultStyle: { bg: "surface", spacingTop: 2, spacingBottom: 2 },
  },
  testimonials: {
    type: "testimonials",
    name: "고객 후기",
    description: "이용 후기 카드.",
    category: "Content",
    fields: [
      T("title", "제목"),
      T("subtitle", "부제", "textarea"),
      {
        key: "items",
        label: "후기",
        type: "items",
        max: 12,
        fields: [T("quote", "후기", "textarea"), T("author", "작성자"), T("role", "소속/직함"), IMG("avatar", "사진")],
      },
    ],
    defaultProps: { title: "", subtitle: "", items: [] },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
  team: {
    type: "team",
    name: "팀 소개",
    description: "구성원 프로필 카드.",
    category: "Content",
    fields: [
      T("title", "제목"),
      {
        key: "items",
        label: "구성원",
        type: "items",
        max: 20,
        fields: [T("name", "이름"), T("role", "직함"), T("bio", "소개", "textarea"), IMG("photo", "사진")],
      },
    ],
    defaultProps: { title: "", items: [] },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },

  // ── Media ────────────────────────────────────────────────────────────────
  gallery: {
    type: "gallery",
    name: "이미지 갤러리",
    description: "이미지를 격자로 배열합니다.",
    category: "Media",
    fields: [
      T("title", "제목"),
      {
        key: "columns",
        label: "열 수",
        type: "select",
        options: [
          { value: "2", label: "2열" },
          { value: "3", label: "3열" },
          { value: "4", label: "4열" },
        ],
      },
      {
        key: "items",
        label: "이미지",
        type: "items",
        max: 40,
        fields: [IMG("image", "이미지"), T("caption", "설명")],
      },
    ],
    defaultProps: { title: "", columns: "3", items: [] },
    defaultStyle: { spacingTop: 2, spacingBottom: 2, width: "contained" },
  },
  video: {
    type: "video",
    name: "동영상",
    description: "YouTube/Vimeo 링크 또는 영상 파일 URL.",
    category: "Media",
    fields: [T("title", "제목"), LINK("url", "영상 URL"), IMG("poster", "썸네일")],
    defaultProps: { title: "", url: "" },
    defaultStyle: { spacingTop: 2, spacingBottom: 2, width: "contained" },
  },

  // ── Marketing / forms ────────────────────────────────────────────────────
  "cta-banner": {
    type: "cta-banner",
    name: "행동 유도 배너",
    description: "문의·신청을 유도하는 강조 배너.",
    category: "Marketing",
    fields: [
      T("title", "제목"),
      T("subtitle", "부제", "textarea"),
      T("buttonLabel", "버튼 문구"),
      LINK("buttonUrl", "버튼 링크"),
    ],
    defaultProps: { title: "", subtitle: "", buttonLabel: "", buttonUrl: "" },
    defaultStyle: { bg: "primary", spacingTop: 3, spacingBottom: 3, align: "center", width: "full" },
  },
  "contact-block": {
    type: "contact-block",
    name: "연락처 정보",
    description: "주소·전화·이메일·영업시간. 비워두면 회사정보 값을 사용합니다.",
    category: "Content",
    fields: [
      T("title", "제목"),
      T("address", "주소", "textarea"),
      T("phone", "전화"),
      T("email", "이메일"),
      T("hours", "영업시간", "textarea"),
      { key: "useCompanyInfo", label: "회사정보 값 사용", type: "boolean" },
    ],
    defaultProps: { title: "", useCompanyInfo: true },
    defaultStyle: { spacingTop: 2, spacingBottom: 2, width: "contained" },
  },
  "contact-form": {
    type: "contact-form",
    name: "문의 폼",
    description: "이름·연락처·문의 내용을 받는 폼.",
    category: "Form",
    fields: [
      T("title", "제목"),
      T("description", "안내 문구", "textarea"),
      T("submitLabel", "전송 버튼 문구"),
      T("successMessage", "전송 후 안내", "textarea"),
    ],
    defaultProps: { title: "", description: "", submitLabel: "보내기", successMessage: "" },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
  "google-maps": {
    type: "google-maps",
    name: "지도",
    description: "주소 기반 지도 임베드.",
    category: "Media",
    fields: [
      T("title", "제목"),
      T("address", "주소"),
      { key: "zoom", label: "확대 수준", type: "number" },
    ],
    defaultProps: { title: "", address: "", zoom: 15 },
    defaultStyle: { spacingTop: 2, spacingBottom: 2, width: "contained" },
  },

  // ── Data-backed ──────────────────────────────────────────────────────────
  "space-listings": {
    type: "space-listings",
    name: "공간/임대 목록",
    description: "공개 공간 목록에서 실시간으로 불러옵니다.",
    category: "Data",
    dataBacked: true,
    fields: [
      T("title", "제목"),
      { key: "limit", label: "표시 개수", type: "number" },
      T("propertyId", "매물 ID 필터 (선택)"),
    ],
    defaultProps: { title: "", limit: 6 },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
  "sale-listings": {
    type: "sale-listings",
    name: "분양·판매 목록",
    description: "판매 매물 목록에서 실시간으로 불러옵니다.",
    category: "Data",
    dataBacked: true,
    fields: [T("title", "제목"), { key: "limit", label: "표시 개수", type: "number" }],
    defaultProps: { title: "", limit: 6 },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
  "blog-posts": {
    type: "blog-posts",
    name: "블로그 글 목록",
    description: "이 사이트의 최신 글을 불러옵니다.",
    category: "Data",
    dataBacked: true,
    fields: [
      T("title", "제목"),
      T("category", "카테고리 필터 (선택)"),
      { key: "limit", label: "표시 개수", type: "number" },
    ],
    defaultProps: { title: "", limit: 3 },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
};

export const BLOCK_SPEC_LIST: BlockSpec[] = Object.values(BLOCK_SPECS);

export function getBlockSpec(type: string): BlockSpec | undefined {
  return BLOCK_SPECS[type as BlockType];
}

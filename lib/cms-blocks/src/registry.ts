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
    defaultProps: {
      title: "섹션 제목",
      subtitle: "이 섹션이 무엇을 다루는지 한 줄로 설명합니다.",
    },
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
      title: "머무는 순간을 설계합니다",
      subtitle: "합리적인 임대, 믿을 수 있는 관리",
      description: "입주 상담부터 계약, 입주 후 관리까지 한 곳에서 처리합니다.",
      buttonLabel: "매물 보기",
      buttonUrl: "/rent",
      secondaryLabel: "상담 문의",
      secondaryUrl: "/contact",
      backgroundImage: { url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80", alt: "" },
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
    defaultProps: {
      autoplaySeconds: 6,
      slides: [
        {
          title: "여수 신축 레지던스",
          description: "바다가 보이는 269세대 규모의 임대 주거 단지.",
          buttonLabel: "자세히 보기",
          buttonUrl: "/rent",
          image: { url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80", alt: "" },
        },
        {
          title: "분양 문의 접수 중",
          description: "타입별 잔여 세대와 조건을 안내해 드립니다.",
          buttonLabel: "분양 안내",
          buttonUrl: "/buy",
          image: { url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80", alt: "" },
        },
      ],
    },
    defaultStyle: { width: "full", spacingTop: 0, spacingBottom: 0 },
  },

  // ── Content ──────────────────────────────────────────────────────────────
  "rich-text": {
    type: "rich-text",
    name: "본문 텍스트",
    description: "제목 + 서식 있는 본문 한 덩어리.",
    category: "Content",
    fields: [T("title", "제목"), T("body", "본문", "richtext")],
    defaultProps: {
      title: "안내 사항",
      body: "<p>여기에 본문을 작성합니다. 굵게, <strong>강조</strong>와 목록 등 기본 서식을 쓸 수 있습니다.</p><ul><li>첫 번째 안내</li><li>두 번째 안내</li></ul>",
    },
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
    defaultProps: {
      title: "우리가 하는 일",
      subtitle: "임대 · 관리 · 운영",
      description: "<p>세대 하나하나를 직접 관리합니다. 임대 상담부터 입주, 유지보수, 퇴거 정산까지 한 회사가 책임집니다.</p>",
      image: { url: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80", alt: "" },
      highlights: [
        { title: "직접 관리", description: "위탁하지 않고 자체 인력이 관리합니다." },
        { title: "투명한 정산", description: "관리비와 정산 내역을 매월 공개합니다." },
      ],
    },
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
    defaultProps: {
      title: "입주까지 3일이면 충분합니다",
      body: "<p>서류 준비부터 계약, 열쇠 수령까지의 절차를 담당자가 함께 진행합니다.</p>",
      image: { url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80", alt: "" },
      imagePosition: "right",
      buttonLabel: "절차 보기",
      buttonUrl: "/stayplan",
    },
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
    defaultProps: {
      title: "이런 점이 다릅니다",
      subtitle: "고객이 가장 많이 언급한 세 가지",
      columns: "3",
      items: [
        { title: "합리적인 임대료", description: "주변 시세와 비교해 조건을 투명하게 안내합니다." },
        { title: "즉시 입주", description: "공실 현황이 실시간으로 반영됩니다." },
        { title: "상주 관리", description: "고장 접수 후 영업일 기준 1일 내 방문합니다." },
      ],
    },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
  quote: {
    type: "quote",
    name: "인용문",
    description: "강조된 한 문장과 출처.",
    category: "Content",
    fields: [T("quote", "인용문", "textarea"), T("author", "작성자"), T("role", "직함")],
    defaultProps: {
      quote: "상담부터 입주까지 막히는 구간이 없었습니다.",
      author: "김민준",
      role: "장기 임대 입주자",
    },
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
    defaultProps: {
      title: "입주 절차",
      subtitle: "네 단계로 끝납니다.",
      items: [
        { title: "상담 신청", description: "원하는 조건과 일정을 남겨 주세요." },
        { title: "현장 확인", description: "담당자와 함께 세대를 둘러봅니다." },
        { title: "계약", description: "표준 계약서로 온라인 서명이 가능합니다." },
        { title: "입주", description: "열쇠 수령과 함께 점검표를 작성합니다." },
      ],
    },
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
    defaultProps: {
      title: "숫자로 보는 우리",
      items: [
        { value: "269", label: "관리 세대" },
        { value: "98%", label: "임대율" },
        { value: "24시간", label: "고장 접수" },
        { value: "12년", label: "운영 경력" },
      ],
    },
    defaultStyle: { bg: "surface", spacingTop: 3, spacingBottom: 3 },
  },
  "custom-html": {
    type: "custom-html",
    name: "직접 입력 HTML",
    description: "제한된 태그만 허용됩니다. 스크립트는 저장 시 제거됩니다.",
    category: "Content",
    fields: [{ key: "html", label: "HTML", type: "html", hint: "script/iframe/style 등은 저장 시 자동 제거됩니다." }],
    defaultProps: {
      html: "<p>직접 작성한 HTML이 이 자리에 표시됩니다. 스크립트는 저장할 때 제거됩니다.</p>",
    },
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
    defaultProps: {
      title: "제공 서비스",
      subtitle: "필요한 것만 골라 이용하세요.",
      items: [
        { title: "장기 임대", description: "1년 이상 거주를 위한 표준 임대 계약.", image: { url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80", alt: "" }, href: "/rent" },
        { title: "단기 체류", description: "한 달 단위로 이용하는 가구 포함 세대.", image: { url: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80", alt: "" }, href: "/stayplan" },
        { title: "건물 관리", description: "소유주를 대신해 임대와 관리를 대행합니다.", image: { url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80", alt: "" }, href: "/manage" },
      ],
    },
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
    defaultProps: {
      title: "이용 요금",
      subtitle: "부가세 별도 기준입니다.",
      plans: [
        {
          name: "기본 관리", price: "3%", period: "/ 월 임대료",
          description: "임대료 수납과 기본 응대를 포함합니다.",
          features: "임대료 수납\n입주자 응대\n월간 리포트",
          buttonLabel: "상담 신청", buttonUrl: "/contact", featured: false,
        },
        {
          name: "종합 관리", price: "5%", period: "/ 월 임대료",
          description: "시설 관리와 정산까지 맡깁니다.",
          features: "기본 관리 전체\n시설 유지보수\n퇴거 정산 대행\n연간 세무 자료",
          buttonLabel: "상담 신청", buttonUrl: "/contact", featured: true,
        },
      ],
    },
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
    defaultProps: {
      title: "자주 묻는 질문",
      items: [
        { question: "계약 최소 기간이 있나요?", answer: "<p>장기 임대는 12개월, 단기 체류는 1개월부터 가능합니다.</p>" },
        { question: "보증금은 어떻게 반환되나요?", answer: "<p>퇴거 점검 후 정산 내역을 확인하고 영업일 기준 5일 이내에 반환합니다.</p>" },
        { question: "반려동물을 키울 수 있나요?", answer: "<p>세대별로 다릅니다. 상담 시 확인해 드립니다.</p>" },
      ],
    },
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
    defaultProps: {
      title: "함께하는 곳",
      items: [
        { name: "파트너 A", image: { url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80", alt: "" }, href: "" },
        { name: "파트너 B", image: { url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80", alt: "" }, href: "" },
        { name: "파트너 C", image: { url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80", alt: "" }, href: "" },
      ],
    },
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
    defaultProps: {
      title: "이용 후기",
      subtitle: "실제 입주자들이 남긴 이야기입니다.",
      items: [
        { quote: "관리실 응대가 빨라서 살면서 스트레스가 없었습니다.", author: "이서연", role: "2년차 입주자", avatar: { url: "", alt: "" } },
        { quote: "계약 조건을 처음부터 끝까지 명확하게 설명해 주셨어요.", author: "박도현", role: "신규 입주자", avatar: { url: "", alt: "" } },
        { quote: "출장이 잦은데 단기로 쓰기 딱 좋았습니다.", author: "최유진", role: "단기 체류", avatar: { url: "", alt: "" } },
      ],
    },
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
    defaultProps: {
      title: "담당자 소개",
      items: [
        { name: "홍성진", role: "대표", bio: "부동산 자산관리 20년.", photo: { url: "", alt: "" } },
        { name: "김하늘", role: "임대 상담", bio: "계약과 입주 절차를 안내합니다.", photo: { url: "", alt: "" } },
        { name: "정우성", role: "시설 관리", bio: "고장 접수와 유지보수를 담당합니다.", photo: { url: "", alt: "" } },
      ],
    },
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
    defaultProps: {
      title: "둘러보기",
      columns: "3",
      items: [
        { image: { url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80", alt: "" }, caption: "거실" },
        { image: { url: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80", alt: "" }, caption: "주방" },
        { image: { url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80", alt: "" }, caption: "침실" },
      ],
    },
    defaultStyle: { spacingTop: 2, spacingBottom: 2, width: "contained" },
  },
  video: {
    type: "video",
    name: "동영상",
    description: "YouTube/Vimeo 링크 또는 영상 파일 URL.",
    category: "Media",
    fields: [T("title", "제목"), LINK("url", "영상 URL"), IMG("poster", "썸네일")],
    defaultProps: {
      title: "소개 영상",
      url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      poster: { url: "", alt: "" },
    },
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
    defaultProps: {
      title: "지금 바로 상담받으세요",
      subtitle: "원하는 조건을 남겨 주시면 담당자가 연락드립니다.",
      buttonLabel: "상담 신청",
      buttonUrl: "/contact",
    },
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
    defaultProps: {
      title: "연락처",
      address: "",
      phone: "",
      email: "",
      hours: "평일 09:00 – 18:00",
      useCompanyInfo: true,
    },
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
    defaultProps: {
      title: "문의하기",
      description: "남겨 주신 연락처로 담당자가 회신드립니다.",
      submitLabel: "보내기",
      successMessage: "문의가 접수되었습니다. 곧 연락드리겠습니다.",
    },
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
    defaultProps: {
      title: "오시는 길",
      address: "",
      zoom: 15,
    },
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
      T("emptyText", "표시할 항목이 없을 때 문구"),
    ],
    defaultProps: {
      title: "임대 가능한 세대",
      limit: 6,
      emptyText: "현재 공개된 세대가 없습니다.",
    },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
  "sale-listings": {
    type: "sale-listings",
    name: "분양·판매 목록",
    description: "판매 매물 목록에서 실시간으로 불러옵니다.",
    category: "Data",
    dataBacked: true,
    fields: [
      T("title", "제목"),
      { key: "limit", label: "표시 개수", type: "number" },
      T("emptyText", "표시할 항목이 없을 때 문구"),
    ],
    defaultProps: {
      title: "분양 · 판매 매물",
      limit: 6,
      emptyText: "현재 공개된 매물이 없습니다.",
    },
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
      T("emptyText", "표시할 항목이 없을 때 문구"),
    ],
    defaultProps: {
      title: "최근 소식",
      category: "",
      limit: 3,
      emptyText: "아직 등록된 글이 없습니다.",
    },
    defaultStyle: { spacingTop: 3, spacingBottom: 3, width: "contained" },
  },
};

export const BLOCK_SPEC_LIST: BlockSpec[] = Object.values(BLOCK_SPECS);

export function getBlockSpec(type: string): BlockSpec | undefined {
  return BLOCK_SPECS[type as BlockType];
}

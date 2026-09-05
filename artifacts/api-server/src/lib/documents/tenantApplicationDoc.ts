/**
 * 임차 신청서 문서 — 신청인이 `/apply` 에 적어 보낸 내용을 그대로 한 장으로 만든다.
 *
 * 신청서에는 문의(lead) 칸에 앉을 자리가 없는 값이 많다 — 주차 필요 여부, 반려동물,
 * 함께 거주할 인원, 재직처, 희망 예산. 그 값들을 문의 화면에 낱개로 흩어 두면
 * 어느 것이 본인이 적은 것이고 어느 것이 담당자가 고친 것인지 구분되지 않는다.
 * 그래서 **제출본은 문서 한 장으로 굳혀 두고**, 계약으로 전환할 때 계약에 첨부한다.
 *
 * 본문은 저장하지 않는다. 원본 답변이 `tenant_access_links.submissions` 에 그대로
 * 있으므로 언제든 같은 문서가 다시 만들어진다 — 파일을 따로 보관하면 원본과
 * 어긋날 자리만 하나 더 생긴다. 계약에 붙는 첨부본만 발행 시점에 굳힌다.
 */
import { buildApplicationHtml, type ApplicationDocInput, type ApplicationDocSection } from "./applicationPdf";
import { normalizeLang, type DocLang } from "./i18n";
import type { CompanyInfo } from "./theme";
import { formatPersonName } from "../nameFormat";

/** 화면(`tenant-apply.tsx`)의 구획과 같은 순서·같은 이름. */
const SECTIONS: Array<{ heading: Record<DocLang, string>; fields: string[] }> = [
  {
    heading: {
      ko: "신청인", en: "Applicant", ja: "申込者", zh: "申请人",
      th: "ผู้ยื่นคำขอ", vi: "Người nộp đơn",
    },
    fields: ["last_name", "first_name", "mobile_number", "email", "sns_type", "sns_id", "date_of_birth", "nationality"],
  },
  {
    heading: {
      ko: "재직 · 재학", en: "Work or study", ja: "勤務先・学校", zh: "工作 · 学业",
      th: "ที่ทำงาน · สถานศึกษา", vi: "Nơi làm việc · học tập",
    },
    fields: ["company_name", "job_title"],
  },
  {
    heading: {
      ko: "현재 주소", en: "Current address", ja: "現住所", zh: "现居地址",
      th: "ที่อยู่ปัจจุบัน", vi: "Địa chỉ hiện tại",
    },
    fields: ["address_line1", "suburb", "state", "postcode", "country"],
  },
  {
    heading: {
      ko: "희망 조건", en: "Requirements", ja: "ご希望の条件", zh: "租房需求",
      th: "เงื่อนไขที่ต้องการ", vi: "Điều kiện mong muốn",
    },
    fields: ["preferred_move_in_date", "preferred_duration_months", "preferred_space_type", "preferred_budget"],
  },
  {
    heading: {
      ko: "거주 구성", en: "Household", ja: "入居構成", zh: "居住成员",
      th: "ผู้พักอาศัย", vi: "Người ở cùng",
    },
    fields: ["household_size", "has_vehicle", "has_pet"],
  },
];

/** 칸 이름. 신청 화면의 라벨과 같은 말을 써야 신청인이 자기가 적은 것을 알아본다. */
const FIELD_LABELS: Record<string, Record<DocLang, string>> = {
  last_name: { ko: "성", en: "Surname", ja: "姓", zh: "姓", th: "นามสกุล", vi: "Họ" },
  first_name: { ko: "이름", en: "Given name", ja: "名", zh: "名", th: "ชื่อ", vi: "Tên" },
  mobile_number: { ko: "휴대전화", en: "Mobile", ja: "携帯電話", zh: "手机号", th: "เบอร์มือถือ", vi: "Số di động" },
  email: { ko: "이메일", en: "Email", ja: "メールアドレス", zh: "邮箱", th: "อีเมล", vi: "Email" },
  sns_type: { ko: "메신저", en: "Messenger", ja: "メッセンジャー", zh: "即时通讯", th: "แอปแชท", vi: "Ứng dụng nhắn tin" },
  sns_id: { ko: "메신저 아이디", en: "Messenger ID", ja: "メッセンジャーID", zh: "通讯账号", th: "ไอดีแอปแชท", vi: "ID nhắn tin" },
  date_of_birth: { ko: "생년월일", en: "Date of birth", ja: "生年月日", zh: "出生日期", th: "วันเกิด", vi: "Ngày sinh" },
  nationality: { ko: "국적", en: "Nationality", ja: "国籍", zh: "国籍", th: "สัญชาติ", vi: "Quốc tịch" },
  company_name: { ko: "직장 · 학교", en: "Employer or school", ja: "勤務先・学校名", zh: "单位 · 学校", th: "ที่ทำงาน · สถานศึกษา", vi: "Nơi làm việc · trường" },
  job_title: { ko: "직위 · 학과", en: "Role", ja: "役職・学科", zh: "职位 · 专业", th: "ตำแหน่ง · สาขา", vi: "Chức vụ · ngành" },
  address_line1: { ko: "주소", en: "Street address", ja: "住所", zh: "详细地址", th: "ที่อยู่", vi: "Địa chỉ" },
  suburb: { ko: "시 · 군 · 구", en: "Suburb / district", ja: "市区町村", zh: "区 · 县", th: "เขต · อำเภอ", vi: "Quận · huyện" },
  state: { ko: "시 · 도", en: "State / province", ja: "都道府県", zh: "省 · 直辖市", th: "จังหวัด", vi: "Tỉnh · thành phố" },
  postcode: { ko: "우편번호", en: "Postcode", ja: "郵便番号", zh: "邮编", th: "รหัสไปรษณีย์", vi: "Mã bưu chính" },
  country: { ko: "국가", en: "Country", ja: "国", zh: "国家", th: "ประเทศ", vi: "Quốc gia" },
  preferred_move_in_date: { ko: "희망 입주일", en: "Preferred move-in date", ja: "ご希望の入居日", zh: "期望入住日期", th: "วันที่ต้องการเข้าอยู่", vi: "Ngày muốn chuyển vào" },
  preferred_duration_months: { ko: "희망 거주 기간(개월)", en: "Length of stay (months)", ja: "ご希望の居住期間（か月）", zh: "期望租期（月）", th: "ระยะเวลาเช่า (เดือน)", vi: "Thời hạn thuê (tháng)" },
  preferred_space_type: { ko: "희망 주거 형태", en: "Type of home", ja: "ご希望の住居タイプ", zh: "期望房型", th: "ประเภทที่พักที่ต้องการ", vi: "Loại chỗ ở mong muốn" },
  preferred_budget: { ko: "월 예산", en: "Monthly budget", ja: "月額予算", zh: "月预算", th: "งบประมาณต่อเดือน", vi: "Ngân sách hằng tháng" },
  household_size: { ko: "함께 거주할 인원", en: "People living with you", ja: "同居される人数", zh: "同住人数", th: "จำนวนผู้พักอาศัยร่วม", vi: "Số người ở cùng" },
  has_vehicle: { ko: "주차 필요", en: "Parking needed", ja: "駐車場の必要", zh: "需要车位", th: "ต้องการที่จอดรถ", vi: "Cần chỗ đỗ xe" },
  has_pet: { ko: "반려동물", en: "Pet", ja: "ペット", zh: "宠物", th: "สัตว์เลี้ยง", vi: "Thú cưng" },
};

const YES: Record<DocLang, string> = { ko: "있음", en: "Yes", ja: "あり", zh: "有", th: "มี", vi: "Có" };
const NO: Record<DocLang, string> = { ko: "없음", en: "No", ja: "なし", zh: "无", th: "ไม่มี", vi: "Không" };

const DOC_TYPE: Record<DocLang, string> = {
  ko: "임차 신청서", en: "Rental application", ja: "賃貸申込書", zh: "租赁申请表",
  th: "แบบฟอร์มขอเช่า", vi: "Đơn xin thuê",
};
const NOTE_HEADING: Record<DocLang, string> = {
  ko: "그 밖에 알려주실 내용", en: "Anything else", ja: "その他", zh: "其他说明",
  th: "ข้อมูลอื่น", vi: "Nội dung khác",
};
const NO_ANSWER: Record<DocLang, string> = {
  ko: "미기재", en: "Not provided", ja: "未記入", zh: "未填写", th: "ไม่ได้ระบุ", vi: "Chưa điền",
};

/** 예/아니오 칸은 값을 그대로 찍으면 "yes" 가 나온다. */
function displayValue(field: string, raw: string, lang: DocLang): string {
  if (field === "has_vehicle" || field === "has_pet") {
    if (raw === "yes") return YES[lang];
    if (raw === "no") return NO[lang];
  }
  return raw;
}

export interface TenantApplicationDocInput {
  answers: Record<string, string>;
  leadRef: string;
  submittedAt?: string | Date | null;
  status?: string | null;
  lang?: string | null;
}

export function tenantApplicationToDoc(input: TenantApplicationDocInput): ApplicationDocInput {
  const lang = normalizeLang(input.lang ?? undefined);
  const a = input.answers ?? {};

  const sections: ApplicationDocSection[] = SECTIONS.map((sec) => ({
    heading: sec.heading[lang],
    // 빈 칸도 남긴다. "적지 않았다"는 것 자체가 심사에서 읽어야 할 정보다.
    rows: sec.fields.map((f) => ({
      label: FIELD_LABELS[f]?.[lang] ?? f,
      value: a[f]?.trim() ? displayValue(f, a[f]!.trim(), lang) : NO_ANSWER[lang],
    })),
  }));

  return {
    docType: DOC_TYPE[lang],
    ref: input.leadRef,
    status: input.status ?? "Submitted",
    submittedAt: input.submittedAt ?? null,
    sections,
    freeText: a["note"]?.trim() ? [{ heading: NOTE_HEADING[lang], body: a["note"]!.trim() }] : [],
    // 임차 신청서는 서명 단계가 아니다 — 서명은 계약서가 받는다.
    signatures: [],
    signed: false,
    lang,
  };
}

export function buildTenantApplicationHtml(
  input: TenantApplicationDocInput,
  company: CompanyInfo,
): string {
  return buildApplicationHtml(tenantApplicationToDoc(input), true, company);
}

/** 신청인 이름 — 파일명과 메일 문안이 같은 이름을 쓰도록 한자리에서 만든다. */
export function applicantName(answers: Record<string, string>): string {
  return formatPersonName(answers["first_name"] ?? null, answers["last_name"] ?? null);
}

/**
 * Document Hub — multi-language labels (follow-up)
 *
 * Static document labels translated for every locale MillionStay serves on its
 * guest-facing documents (English, Korean, Chinese, Japanese, Thai, Vietnamese).
 * Dynamic data (names, amounts, refs) is untouched. Pass `lang` to the document
 * builders / PDF endpoints (`?lang=ko`); unknown languages fall back to English.
 *
 * NOTE: transactional *emails* remain English-only per project policy — this
 * i18n applies to the rendered documents (PDF / preview) and the editable
 * document-template bodies.
 */
export type DocLang = "en" | "ko" | "zh" | "ja" | "th" | "vi";

const SUPPORTED: DocLang[] = ["en", "ko", "zh", "ja", "th", "vi"];

/**
 * The tenant-wide default document language, used when a request carries no
 * (or an unrecognised) `lang`. MillionStay leaves this unset → English; a
 * white-label instance sets `DEFAULT_DOC_LANG` in its config.env (Metheim = `ko`)
 * so all its invoices/receipts/quotes/contracts/applications render in the local
 * language by default, without every caller having to pass `?lang=`.
 * Read once at module load — it is fixed for the life of the process.
 */
const DEFAULT_DOC_LANG: DocLang = (() => {
  const l = (process.env.DEFAULT_DOC_LANG ?? "").toLowerCase().slice(0, 2);
  return (SUPPORTED as string[]).includes(l) ? (l as DocLang) : "en";
})();

export function normalizeLang(input: string | undefined | null): DocLang {
  const l = (input ?? "").toLowerCase().slice(0, 2);
  return (SUPPORTED as string[]).includes(l) ? (l as DocLang) : DEFAULT_DOC_LANG;
}

/** Intl locale used for date formatting per document language. */
export function docLocale(lang: DocLang): string {
  return { en: "en-AU", ko: "ko-KR", zh: "zh-CN", ja: "ja-JP", th: "th-TH", vi: "vi-VN" }[lang];
}

// ── App-wide date format (Settings → Organisation / Design → Date format) ─────
// Every document (invoice, receipt, quote, contract, application, service brief)
// renders its date portion in the admin's configured format so all paperwork is
// consistent with the landing site, admin and portals. Mirrors the option list
// in property-admin/src/lib/date.ts. The value is a single global branding
// setting, refreshed via `setDocDateFormat()` from `resolveCompanyInfo()` before
// each build. Time (when shown) is always appended as 24-hour HH:mm.
type DateFormatLabel = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "YYYY/MM/DD" | "D MMM YYYY";
const KNOWN_DATE_FORMATS: string[] = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "YYYY/MM/DD", "D MMM YYYY"];
let currentDateFormat: DateFormatLabel = "YYYY/MM/DD";

/** Set the app-wide document date format (ignores unknown labels). */
export function setDocDateFormat(label: string | null | undefined): void {
  if (label && KNOWN_DATE_FORMATS.includes(label)) currentDateFormat = label as DateFormatLabel;
}

function toDateObj(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Format a date using the configured app-wide format. `lang` only affects the
 * localized month name of the "D MMM YYYY" style; the numeric styles are
 * locale-independent so every document reads identically.
 */
export function formatDocDate(value: string | number | Date | null | undefined, lang: DocLang, fallback = "—"): string {
  const d = toDateObj(value);
  if (!d) return fallback;
  const Y = d.getFullYear();
  const M = d.getMonth() + 1;
  const D = d.getDate();
  switch (currentDateFormat) {
    case "MM/DD/YYYY": return `${pad2(M)}/${pad2(D)}/${Y}`;
    case "YYYY-MM-DD": return `${Y}-${pad2(M)}-${pad2(D)}`;
    case "YYYY/MM/DD": return `${Y}/${pad2(M)}/${pad2(D)}`;
    case "D MMM YYYY": return d.toLocaleDateString(docLocale(lang), { year: "numeric", month: "short", day: "numeric" });
    case "DD/MM/YYYY":
    default: return `${pad2(D)}/${pad2(M)}/${Y}`;
  }
}

/** Format date + 24-hour time (e.g. "2026/06/13 14:30"). */
export function formatDocDateTime(value: string | number | Date | null | undefined, lang: DocLang, fallback = "—"): string {
  const d = toDateObj(value);
  if (!d) return fallback;
  return `${formatDocDate(d, lang)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

type Dict = Record<string, Record<DocLang, string>>;

const LABELS: Dict = {
  "doctype.invoice":  { en: "Tax Invoice", ko: "청구서",       zh: "发票",       ja: "請求書",   th: "ใบกำกับภาษี",    vi: "Hóa đơn thuế" },
  "doctype.receipt":  { en: "Receipt",     ko: "영수증",       zh: "收据",       ja: "領収書",   th: "ใบเสร็จรับเงิน", vi: "Biên nhận" },
  "doctype.quote":    { en: "Quotation",   ko: "견적서",       zh: "报价单",     ja: "見積書",   th: "ใบเสนอราคา",     vi: "Báo giá" },
  "doctype.contract": { en: "Agreement",   ko: "계약서",       zh: "协议",       ja: "契約書",   th: "ข้อตกลง",        vi: "Thỏa thuận" },

  "invoice.heading":  { en: "Invoice",     ko: "청구서",       zh: "发票",       ja: "請求書",   th: "ใบแจ้งหนี้",     vi: "Hóa đơn" },
  "billTo":           { en: "Bill To",     ko: "청구 대상",    zh: "付款方",     ja: "請求先",   th: "เรียกเก็บจาก",   vi: "Bên thanh toán" },
  "details":          { en: "Details",     ko: "상세 내역",    zh: "明细",       ja: "明細",     th: "รายละเอียด",     vi: "Chi tiết" },
  "description":      { en: "Description", ko: "내역",         zh: "描述",       ja: "内容",     th: "รายการ",         vi: "Mô tả" },
  "amount":           { en: "Amount",      ko: "금액",         zh: "金额",       ja: "金額",     th: "จำนวนเงิน",      vi: "Số tiền" },
  "dueDate":          { en: "Due Date",    ko: "지급 기한",    zh: "到期日",     ja: "支払期限", th: "วันครบกำหนด",    vi: "Ngày đến hạn" },
  "paid":             { en: "Paid",        ko: "결제 완료",    zh: "已付款",     ja: "支払済",   th: "ชำระแล้ว",       vi: "Đã thanh toán" },
  "amountDue":        { en: "Amount Due",  ko: "청구 금액",    zh: "应付金额",   ja: "請求金額", th: "ยอดที่ต้องชำระ", vi: "Số tiền phải trả" },
  "amountPaid":       { en: "Amount Paid", ko: "결제 금액",    zh: "已付金额",   ja: "支払金額", th: "ยอดที่ชำระ",     vi: "Số tiền đã trả" },
  "notes":            { en: "Notes",       ko: "비고",         zh: "备注",       ja: "備考",     th: "หมายเหตุ",       vi: "Ghi chú" },
  "issued":           { en: "Issued",      ko: "발행일",       zh: "开具日期",   ja: "発行日",   th: "วันที่ออก",      vi: "Ngày phát hành" },
  // 통합(단체) 청구서 — 여러 공간을 한 장으로 묶은 월 청구서
  "invoice.consolidated": { en: "Consolidated Invoice", ko: "통합 청구서", zh: "合并发票", ja: "一括請求書", th: "ใบแจ้งหนี้รวม", vi: "Hóa đơn gộp" },
  "billingPeriod":    { en: "Billing Period", ko: "청구 대상 월", zh: "结算月份", ja: "請求対象月", th: "รอบบิล",     vi: "Kỳ thanh toán" },

  "receipt.heading":  { en: "Receipt",          ko: "영수증",      zh: "收据",     ja: "領収書",   th: "ใบเสร็จรับเงิน", vi: "Biên nhận" },
  "receivedFrom":     { en: "Received From",    ko: "지급인",      zh: "付款人",   ja: "支払者",   th: "รับเงินจาก",     vi: "Nhận từ" },
  "for":              { en: "For",              ko: "항목",        zh: "项目",     ja: "項目",     th: "สำหรับ",         vi: "Cho" },
  "paymentMethod":    { en: "Payment Method",   ko: "결제 수단",   zh: "付款方式", ja: "支払方法", th: "วิธีการชำระเงิน", vi: "Phương thức thanh toán" },
  "paymentDate":      { en: "Payment Date",     ko: "결제일",      zh: "付款日期", ja: "支払日",   th: "วันที่ชำระเงิน",  vi: "Ngày thanh toán" },
  "amountReceived":   { en: "Amount Received",  ko: "수령 금액",   zh: "收款金额", ja: "受領金額", th: "จำนวนเงินที่ได้รับ", vi: "Số tiền đã nhận" },
  "paymentReceived":  { en: "Payment received", ko: "결제 완료일", zh: "已收款",   ja: "受領日",   th: "ได้รับชำระเงินแล้ว", vi: "Đã nhận thanh toán" },
  "paymentPending":   { en: "Payment pending",  ko: "결제 대기",   zh: "待付款",   ja: "支払待ち", th: "รอการชำระเงิน",  vi: "Chờ thanh toán" },
  "receipt.confirm":  {
    en: "This document confirms receipt of the amount shown above against invoice {ref}. Thank you.",
    ko: "본 문서는 청구서 {ref}에 대한 상기 금액의 수령을 확인합니다. 감사합니다.",
    zh: "本文件确认已收到上述金额，对应发票 {ref}。谢谢。",
    ja: "本書は、請求書 {ref} に対する上記金額の受領を確認するものです。ありがとうございます。",
    th: "เอกสารนี้ยืนยันการได้รับเงินตามจำนวนข้างต้นสำหรับใบแจ้งหนี้ {ref} ขอบคุณค่ะ",
    vi: "Tài liệu này xác nhận đã nhận số tiền nêu trên cho hóa đơn {ref}. Xin cảm ơn.",
  },

  "quote.heading":    { en: "Quotation",     ko: "견적서",     zh: "报价单",     ja: "見積書",   th: "ใบเสนอราคา",     vi: "Báo giá" },
  "preparedFor":      { en: "Prepared For",  ko: "견적 대상",  zh: "报价对象",   ja: "見積先",   th: "จัดทำสำหรับ",    vi: "Lập cho" },
  "quoteItems":       { en: "Quote Items",   ko: "견적 항목",  zh: "报价项目",   ja: "見積項目", th: "รายการเสนอราคา", vi: "Hạng mục báo giá" },
  "unit":             { en: "Unit",          ko: "단가",       zh: "单价",       ja: "単価",     th: "ราคาต่อหน่วย",   vi: "Đơn giá" },
  "qty":              { en: "Qty",           ko: "수량",       zh: "数量",       ja: "数量",     th: "จำนวน",          vi: "Số lượng" },
  "total":            { en: "Total",         ko: "합계",       zh: "合计",       ja: "合計",     th: "รวม",            vi: "Tổng cộng" },
  "validUntil":       { en: "Valid until",   ko: "유효 기한",  zh: "有效期至",   ja: "有効期限", th: "ใช้ได้ถึง",      vi: "Có hiệu lực đến" },
  "prepared":         { en: "Prepared",      ko: "작성일",     zh: "制作日期",   ja: "作成日",   th: "วันที่จัดทำ",    vi: "Ngày lập" },
  "noItems":          { en: "No items",      ko: "항목 없음",  zh: "无项目",     ja: "項目なし", th: "ไม่มีรายการ",    vi: "Không có hạng mục" },

  "contract.heading": { en: "Accommodation Agreement", ko: "숙박 계약서",       zh: "住宿协议",     ja: "宿泊契約書", th: "ข้อตกลงที่พัก",       vi: "Thỏa thuận lưu trú" },
  "parties":          { en: "Parties",                 ko: "당사자",            zh: "双方",         ja: "当事者",     th: "คู่สัญญา",            vi: "Các bên" },
  "landlord":         { en: "Landlord / Provider",     ko: "임대인 / 제공자",   zh: "房东 / 提供方", ja: "貸主 / 提供者", th: "ผู้ให้เช่า / ผู้ให้บริการ", vi: "Bên cho thuê / Bên cung cấp" },
  "tenant":           { en: "Tenant",                  ko: "임차인",            zh: "租客",         ja: "借主",       th: "ผู้เช่า",             vi: "Bên thuê" },
  "premisesTerm":     { en: "Premises & Term",         ko: "임대 대상 및 기간", zh: "房源与租期",   ja: "物件と期間", th: "สถานที่และระยะเวลา",  vi: "Nơi ở & Thời hạn" },
  "premises":         { en: "Premises",                ko: "임대 대상",         zh: "房源",         ja: "物件",       th: "สถานที่",             vi: "Nơi ở" },
  "product":          { en: "Product",                 ko: "상품",              zh: "产品",         ja: "商品",       th: "ผลิตภัณฑ์",           vi: "Sản phẩm" },
  "startDate":        { en: "Start Date",              ko: "시작일",            zh: "开始日期",     ja: "開始日",     th: "วันที่เริ่ม",         vi: "Ngày bắt đầu" },
  "endDate":          { en: "End Date",                ko: "종료일",            zh: "结束日期",     ja: "終了日",     th: "วันที่สิ้นสุด",       vi: "Ngày kết thúc" },
  "financials":       { en: "Financials",              ko: "비용",              zh: "费用",         ja: "費用",       th: "ค่าใช้จ่าย",          vi: "Tài chính" },
  "weeklyRate":       { en: "Weekly Rate",             ko: "주당 요금",         zh: "每周租金",     ja: "週額料金",   th: "อัตรารายสัปดาห์",     vi: "Giá theo tuần" },
  "totalRent":        { en: "Total Rent",              ko: "총 임대료",         zh: "总租金",       ja: "総賃料",     th: "ค่าเช่ารวม",          vi: "Tổng tiền thuê" },
  "bond":             { en: "Bond",                    ko: "보증금",            zh: "押金",         ja: "敷金",       th: "เงินประกัน",          vi: "Tiền đặt cọc" },
  "advance":          { en: "Advance",                 ko: "선급금",            zh: "预付款",       ja: "前払金",     th: "เงินล่วงหน้า",        vi: "Tiền trả trước" },
  "terms":            { en: "Terms & Conditions",      ko: "약관",              zh: "条款与条件",   ja: "利用規約",   th: "ข้อกำหนดและเงื่อนไข",  vi: "Điều khoản & Điều kiện" },
  "signatures":       { en: "Signatures",              ko: "서명",              zh: "签名",         ja: "署名",       th: "ลายเซ็น",             vi: "Chữ ký" },
  "signed":           { en: "Signed",                  ko: "서명일",            zh: "签署日期",     ja: "署名日",     th: "ลงนามเมื่อ",          vi: "Đã ký" },

  // ── Tenancy/Accommodation Agreement — section + fee detail ──────────────
  "name":             { en: "Name",            ko: "이름",        zh: "姓名",     ja: "氏名",         th: "ชื่อ",                vi: "Tên" },
  "email":            { en: "Email",           ko: "이메일",      zh: "邮箱",     ja: "メール",       th: "อีเมล",               vi: "Email" },
  "address":          { en: "Address",         ko: "주소",        zh: "地址",     ja: "住所",         th: "ที่อยู่",             vi: "Địa chỉ" },
  "effectiveDate":    { en: "Effective date",  ko: "발효일",      zh: "生效日期", ja: "発効日",       th: "วันที่มีผล",          vi: "Ngày hiệu lực" },
  "expiryDate":       { en: "Expiry date",     ko: "만료일",      zh: "到期日期", ja: "満了日",       th: "วันหมดอายุ",          vi: "Ngày hết hạn" },
  "rent":             { en: "Rent",            ko: "임대료",      zh: "租金",     ja: "賃料",         th: "ค่าเช่า",             vi: "Tiền thuê" },
  "billingCycle":     { en: "Billing cycle",   ko: "청구 주기",   zh: "账单周期", ja: "請求サイクル", th: "รอบการเรียกเก็บเงิน", vi: "Chu kỳ thanh toán" },
  "totalDueNow":      { en: "Total due now",   ko: "즉시 납부 합계", zh: "立即应付总额", ja: "今すぐお支払い合計", th: "ยอดที่ต้องชำระทันที", vi: "Tổng phải trả ngay" },
  "feesInitial":      { en: "Fees — initial payment (due now)", ko: "비용 — 초기 납부(즉시)", zh: "费用 — 首期付款（立即）", ja: "費用 — 初回支払い（即時）", th: "ค่าธรรมเนียม — การชำระครั้งแรก (ทันที)", vi: "Chi phí — thanh toán ban đầu (ngay)" },
  "feesOngoing":      { en: "Fees — ongoing (rent)", ko: "비용 — 정기 임대료", zh: "费用 — 经常性（租金）", ja: "費用 — 継続（賃料）", th: "ค่าธรรมเนียม — ต่อเนื่อง (ค่าเช่า)", vi: "Chi phí — định kỳ (tiền thuê)" },
  "freq.monthly":     { en: "Monthly",     ko: "매월",  zh: "每月",   ja: "毎月", th: "รายเดือน",   vi: "Hàng tháng" },
  "freq.weekly":      { en: "Weekly",      ko: "매주",  zh: "每周",   ja: "毎週", th: "รายสัปดาห์", vi: "Hàng tuần" },
  "freq.fortnightly": { en: "Fortnightly", ko: "격주",  zh: "每两周", ja: "隔週", th: "รายปักษ์",   vi: "Hai tuần một lần" },

  // ── Property description table (부동산의 표시) — Korean lease agreements ────
  // Filled from the contract's `spaces` row (unit type + the six Korean area
  // columns), so one standard agreement adapts to whichever unit type applies.
  "propertyDescription": { en: "Property Description", ko: "부동산의 표시", zh: "不动产的表示", ja: "不動産の表示", th: "รายละเอียดทรัพย์สิน", vi: "Mô tả bất động sản" },
  "location":         { en: "Location",           ko: "소재지",       zh: "所在地",     ja: "所在地",     th: "ที่ตั้ง",           vi: "Địa điểm" },
  "building":         { en: "Building",           ko: "건물명",       zh: "建筑名称",   ja: "建物名",     th: "อาคาร",             vi: "Tòa nhà" },
  "unitNo":           { en: "Unit",               ko: "호수",         zh: "房号",       ja: "号室",       th: "ห้อง",              vi: "Căn hộ" },
  "floor":            { en: "Floor",              ko: "층",           zh: "楼层",       ja: "階",         th: "ชั้น",              vi: "Tầng" },
  "unitType":         { en: "Unit type",          ko: "타입",         zh: "户型",       ja: "タイプ",     th: "ประเภทห้อง",        vi: "Loại căn" },
  "structureUse":     { en: "Structure / Use",    ko: "구조 · 용도",  zh: "结构 · 用途", ja: "構造・用途", th: "โครงสร้าง · การใช้", vi: "Kết cấu · Mục đích" },
  "areaExclusive":    { en: "Exclusive area",     ko: "전용면적",     zh: "专用面积",   ja: "専有面積",   th: "พื้นที่ใช้สอยส่วนตัว", vi: "Diện tích riêng" },
  "areaResidentialCommon": { en: "Residential common area", ko: "주거공용면적", zh: "居住公用面积", ja: "住居共用面積", th: "พื้นที่ส่วนกลางที่พัก", vi: "Diện tích chung nhà ở" },
  "areaSupply":       { en: "Supply area",        ko: "공급면적",     zh: "供给面积",   ja: "供給面積",   th: "พื้นที่จัดสรร",     vi: "Diện tích cung cấp" },
  "areaOtherCommon":  { en: "Other common area",  ko: "기타공용면적", zh: "其他公用面积", ja: "その他共用面積", th: "พื้นที่ส่วนกลางอื่น", vi: "Diện tích chung khác" },
  "areaContract":     { en: "Contract area",      ko: "계약면적",     zh: "合同面积",   ja: "契約面積",   th: "พื้นที่ตามสัญญา",   vi: "Diện tích hợp đồng" },
  "areaLandShare":    { en: "Land share",         ko: "대지지분",     zh: "土地份额",   ja: "敷地権割合", th: "สัดส่วนที่ดิน",     vi: "Phần đất" },

  // ── Annex / special terms (별지 · 특약사항) — bound into the same PDF ───────
  "annex":            { en: "Annex — Special Terms", ko: "별지 — 특약사항", zh: "附件 — 特别约定", ja: "別紙 — 特約事項", th: "ภาคผนวก — ข้อตกลงพิเศษ", vi: "Phụ lục — Điều khoản đặc biệt" },

  // ── Additional services & fees (airport pickup, settlement, prepaid phone…) ──
  "additionalServices": { en: "Additional Services & Fees", ko: "추가 서비스 및 비용", zh: "附加服务与费用", ja: "追加サービス・料金", th: "บริการและค่าใช้จ่ายเพิ่มเติม", vi: "Dịch vụ & phí bổ sung" },
  "servicesSubtotal":   { en: "Services subtotal",          ko: "서비스 합계",        zh: "服务小计",        ja: "サービス小計",      th: "ยอดรวมบริการ",            vi: "Tổng phụ dịch vụ" },
  "recurring":          { en: "Recurring",                  ko: "정기 청구",          zh: "经常性",          ja: "継続",              th: "ต่อเนื่อง",               vi: "Định kỳ" },
  "oneOff":             { en: "One-off",                    ko: "1회성",              zh: "一次性",          ja: "一回",              th: "ครั้งเดียว",              vi: "Một lần" },

  // ── Payment options (card surcharge) ─────────────────────────────────────
  "paymentOptions":   { en: "Payment options", ko: "결제 옵션", zh: "付款方式", ja: "お支払い方法", th: "ตัวเลือกการชำระเงิน", vi: "Tùy chọn thanh toán" },
  "byBankTransfer":   { en: "By bank transfer", ko: "계좌이체", zh: "银行转账", ja: "銀行振込", th: "โอนผ่านธนาคาร", vi: "Chuyển khoản ngân hàng" },
  "byCard":           {
    en: "By card (incl. {pct}% surcharge)",
    ko: "카드 결제 ({pct}% 수수료 포함)",
    zh: "刷卡（含 {pct}% 手续费）",
    ja: "カード払い（{pct}% 手数料込み）",
    th: "ชำระด้วยบัตร (รวมค่าธรรมเนียม {pct}%)",
    vi: "Thanh toán bằng thẻ (gồm phụ phí {pct}%)",
  },
  "cardSurchargeNote": {
    en: "A {pct}% surcharge applies to card payments and is added at checkout when the card option is selected.",
    ko: "카드 결제 시 {pct}% 수수료가 적용되며, 결제 단계에서 카드를 선택하면 추가됩니다.",
    zh: "刷卡支付将收取 {pct}% 手续费，在结账时选择刷卡即会加收。",
    ja: "カード決済には{pct}%の手数料がかかり、お支払い時にカードを選択すると加算されます。",
    th: "การชำระด้วยบัตรมีค่าธรรมเนียม {pct}% และจะถูกบวกเพิ่มเมื่อเลือกชำระด้วยบัตรในขั้นตอนชำระเงิน",
    vi: "Thanh toán bằng thẻ chịu phụ phí {pct}%, được cộng vào khi chọn thẻ ở bước thanh toán.",
  },

  // ── 부가세 (과세 청구서) ──────────────────────────────────────────────────
  "supplyAmount":     { en: "Subtotal (ex. tax)", ko: "공급가액", zh: "供货金额", ja: "供給価額", th: "มูลค่าก่อนภาษี", vi: "Giá trị trước thuế" },
  "taxAmount":        {
    en: "VAT ({pct}%)",
    ko: "부가세 ({pct}%)",
    zh: "增值税（{pct}%）",
    ja: "消費税（{pct}%）",
    th: "ภาษีมูลค่าเพิ่ม ({pct}%)",
    vi: "Thuế GTGT ({pct}%)",
  },

  // ── Bank account (입금 계좌 안내) ─────────────────────────────────────────
  "bankAccount":      { en: "Bank account", ko: "입금 계좌", zh: "汇款账户", ja: "振込口座", th: "บัญชีธนาคาร", vi: "Tài khoản ngân hàng" },
  "bankName":         { en: "Bank", ko: "은행", zh: "开户行", ja: "銀行", th: "ธนาคาร", vi: "Ngân hàng" },
  "bsb":              { en: "BSB", ko: "BSB", zh: "BSB", ja: "BSB", th: "BSB", vi: "BSB" },
  "accountNumber":    { en: "Account number", ko: "계좌번호", zh: "账号", ja: "口座番号", th: "เลขที่บัญชี", vi: "Số tài khoản" },
  "accountHolder":    { en: "Account name", ko: "예금주", zh: "户名", ja: "口座名義", th: "ชื่อบัญชี", vi: "Chủ tài khoản" },
  "swift":            { en: "SWIFT", ko: "SWIFT", zh: "SWIFT", ja: "SWIFT", th: "SWIFT", vi: "SWIFT" },
  "bankAccountNote":  {
    en: "Please quote {ref} as the transfer reference.",
    ko: "이체 시 받는 분 통장 표시에 {ref}를 남겨 주세요.",
    zh: "转账时请备注 {ref} 作为参考编号。",
    ja: "お振込の際は依頼人名に {ref} をご記入ください。",
    th: "กรุณาระบุ {ref} เป็นข้อมูลอ้างอิงในการโอน",
    vi: "Vui lòng ghi {ref} trong nội dung chuyển khoản.",
  },

  // ── Move-out confirmation / deposit settlement (퇴거 세대 확인서) ──────────
  "doctype.move_out":     { en: "Move-out Settlement Confirmation", ko: "퇴거 세대 정산 확인서", zh: "退租结算确认书", ja: "退去世帯精算確認書", th: "หนังสือยืนยันการชำระบัญชีย้ายออก", vi: "Xác nhận quyết toán trả phòng" },
  "doctype.inspection":   { en: "Unit Inspection", ko: "세대점검표", zh: "房屋验收表", ja: "住戸点検表", th: "ใบตรวจสภาพห้อง", vi: "Phiếu kiểm tra căn hộ" },
  "doctype.blank_form":   { en: "Blank Form", ko: "빈 양식", zh: "空白表格", ja: "白紙様式", th: "แบบฟอร์มเปล่า", vi: "Mẫu trống" },
  "doctype.sample":       { en: "Sample", ko: "샘플", zh: "样本", ja: "サンプル", th: "ตัวอย่าง", vi: "Mẫu" },
  "moveout.heading":      { en: "Move-out Settlement Confirmation", ko: "퇴거 세대 정산 확인서", zh: "退租结算确认书", ja: "退去世帯精算確認書", th: "หนังสือยืนยันการชำระบัญชีย้ายออก", vi: "Xác nhận quyết toán trả phòng" },
  "moveout.asOf":         { en: "as of {date}",          ko: "{date} 기준",     zh: "截至 {date}",  ja: "{date} 基準",     th: "ณ วันที่ {date}",       vi: "tính đến {date}" },
  "moveout.household":    { en: "Household",             ko: "세대 정보",       zh: "住户信息",     ja: "世帯情報",        th: "ข้อมูลผู้เช่า",         vi: "Thông tin hộ" },
  "moveout.unit":         { en: "Unit",                  ko: "세대호수",        zh: "房号",         ja: "世帯番号",        th: "หมายเลขห้อง",           vi: "Số căn hộ" },
  "moveout.contractPeriod": { en: "Contract Period",     ko: "계약기간",        zh: "合同期间",     ja: "契約期間",        th: "ระยะเวลาสัญญา",         vi: "Thời hạn hợp đồng" },
  "moveout.settlement":   { en: "Settlement",            ko: "정산 내역",       zh: "结算明细",     ja: "精算内訳",        th: "รายการชำระบัญชี",       vi: "Chi tiết quyết toán" },
  "moveout.no":           { en: "No.",                   ko: "순번",            zh: "序号",         ja: "番号",            th: "ลำดับ",                 vi: "STT" },
  "moveout.item":         { en: "Item",                  ko: "항목",            zh: "项目",         ja: "項目",            th: "รายการ",                vi: "Hạng mục" },
  "moveout.remark":       { en: "Remark",                ko: "비고",            zh: "备注",         ja: "備考",            th: "หมายเหตุ",              vi: "Ghi chú" },
  "moveout.totalA":       { en: "Total (A)",             ko: "합계 A",          zh: "合计 A",       ja: "合計 A",          th: "รวม A",                 vi: "Tổng A" },
  "moveout.depositB":     { en: "Deposit (B)",           ko: "보증금 B",        zh: "押金 B",       ja: "保証金 B",        th: "เงินประกัน B",          vi: "Tiền cọc B" },
  "moveout.diffC":        { en: "Balance C (B−A)",       ko: "차액 C (B-A)",    zh: "差额 C (B-A)", ja: "差額 C (B-A)",    th: "ส่วนต่าง C (B-A)",      vi: "Chênh lệch C (B-A)" },
  // Move-out settlement form (2026 layout) — sections 1/2/3 + issuer block.
  "moveout.asOfLabel":    { en: "As of",                  ko: "기준일자",        zh: "基准日",       ja: "基準日",          th: "ณ วันที่",              vi: "Ngày cơ sở" },
  "moveout.sec1":         { en: "Lease Details",          ko: "기본 임대차 정보", zh: "基本租赁信息", ja: "基本賃貸借情報",  th: "ข้อมูลการเช่าพื้นฐาน",  vi: "Thông tin thuê cơ bản" },
  "moveout.sec2":         { en: "Settlement (arrears & adjustments)", ko: "정산 내역 (미납금 및 정산액)", zh: "结算明细（欠款及结算额）", ja: "精算内訳（未納金および精算額）", th: "รายการชำระบัญชี (ค้างชำระและยอดปรับ)", vi: "Chi tiết quyết toán (nợ và điều chỉnh)" },
  "moveout.sec3":         { en: "Deposit refund & move-out guidance", ko: "보증금 반환 및 퇴거 절차 안내사항", zh: "押金退还及退租流程须知", ja: "保証金返還および退去手続きのご案内", th: "คำแนะนำการคืนเงินประกันและขั้นตอนย้ายออก", vi: "Hướng dẫn hoàn cọc và thủ tục trả phòng" },
  "moveout.tenantName":   { en: "Tenant",                 ko: "임차인명",        zh: "承租人",       ja: "賃借人名",        th: "ชื่อผู้เช่า",           vi: "Tên người thuê" },
  "moveout.monthlyRent":  { en: "Rent (monthly)",         ko: "임대료(월)",      zh: "租金（月）",   ja: "賃料（月）",      th: "ค่าเช่า (ต่อเดือน)",    vi: "Tiền thuê (tháng)" },
  "moveout.deposit":      { en: "Security deposit",       ko: "임대보증금",      zh: "租赁保证金",   ja: "賃貸保証金",      th: "เงินประกันการเช่า",     vi: "Tiền đặt cọc thuê" },
  "moveout.settleType":   { en: "Settlement type",        ko: "정산구분",        zh: "结算类型",     ja: "精算区分",        th: "ประเภทการชำระบัญชี",    vi: "Loại quyết toán" },
  "moveout.typeEarly":    { en: "Early termination",      ko: "중도퇴거",        zh: "中途退租",     ja: "中途退去",        th: "ย้ายออกก่อนกำหนด",      vi: "Trả phòng sớm" },
  "moveout.typeExpiry":   { en: "End of term",            ko: "만기퇴거",        zh: "期满退租",     ja: "満期退去",        th: "ครบกำหนดสัญญา",         vi: "Hết hạn hợp đồng" },
  "moveout.kind":         { en: "Type",                   ko: "구분",            zh: "区分",         ja: "区分",            th: "ประเภท",                vi: "Phân loại" },
  "moveout.deduct":       { en: "Deduction (−)",          ko: "차감(-)",         zh: "扣除(-)",      ja: "差引(-)",         th: "หัก(-)",                vi: "Khấu trừ(-)" },
  "moveout.refund":       { en: "Refund (+)",             ko: "환급(+)",         zh: "退还(+)",      ja: "還付(+)",         th: "คืน(+)",                vi: "Hoàn(+)" },
  "moveout.amountCol":    { en: "Amount",                 ko: "금액 (원)",       zh: "金额",         ja: "金額",            th: "จำนวนเงิน",             vi: "Số tiền" },
  "moveout.remarkGuide":  { en: "Remarks & handling",     ko: "비고 및 처리 안내", zh: "备注及处理说明", ja: "備考および処理案内", th: "หมายเหตุและการดำเนินการ", vi: "Ghi chú & xử lý" },
  "moveout.rowA":         { en: "Settlement total (A = deductions + refunds)", ko: "정산 합계 (A = 차감액 + 환급액)", zh: "结算合计（A = 扣除额 + 退还额）", ja: "精算合計（A = 差引額 + 還付額）", th: "รวมการชำระบัญชี (A = ยอดหัก + ยอดคืน)", vi: "Tổng quyết toán (A = khấu trừ + hoàn)" },
  "moveout.rowB":         { en: "Security deposit (B)",   ko: "임대 보증금 (B)", zh: "租赁保证金 (B)", ja: "賃貸保証金 (B)",  th: "เงินประกันการเช่า (B)", vi: "Tiền đặt cọc (B)" },
  "moveout.rowC":         { en: "Final amount returned (C = B + A)", ko: "최종 반환 차액 (C = B + A)", zh: "最终返还差额 (C = B + A)", ja: "最終返還差額 (C = B + A)", th: "ยอดคืนสุทธิ (C = B + A)", vi: "Số tiền hoàn cuối (C = B + A)" },
  "moveout.rowA.remark":  { en: "Deductions and refunds combined",       ko: "미납 차감액 · 환급액 통산",        zh: "扣除额与退还额合计",       ja: "差引額・還付額の通算",          th: "รวมยอดหักและยอดคืน",             vi: "Tổng hợp khấu trừ và hoàn" },
  "moveout.rowB.remark":  { en: "Security deposit already paid",          ko: "기 납부 임대보증금 원금",          zh: "已缴纳的租赁保证金本金",   ja: "既納の賃貸保証金元本",          th: "เงินประกันการเช่าที่ชำระแล้ว",   vi: "Tiền cọc đã nộp" },
  "moveout.rowC.remark":  { en: "Amount to be deposited to the tenant's account", ko: "임차인 계좌 최종 입금 예정 금액", zh: "将汇入承租人账户的最终金额", ja: "賃借人口座への最終入金予定額", th: "ยอดที่จะโอนเข้าบัญชีผู้เช่า",     vi: "Số tiền sẽ chuyển vào tài khoản người thuê" },
  "moveout.issuer":       { en: "Landlord",               ko: "임 대 인",        zh: "出租人",       ja: "賃 貸 人",        th: "ผู้ให้เช่า",            vi: "Bên cho thuê" },
  "moveout.sealMark":     { en: "(seal)",                 ko: "(인)",            zh: "(印)",         ja: "(印)",            th: "(ตราประทับ)",           vi: "(dấu)" },

  // Section 3 default guidance (editable via the pdf.move_out_confirmation template).
  "moveout.guide.refund.title": { en: "Submitting your refund account", ko: "보증금 반환 계좌 제출 안내", zh: "退还账户提交须知", ja: "保証金返還口座のご提出案内", th: "การส่งบัญชีรับเงินคืน", vi: "Nộp tài khoản nhận hoàn tiền" },
  "moveout.guide.refund.lead":  {
    en: "The balance C ({amount}) above is returned to a bank account held in the tenant's own name.",
    ko: "상기 차액 C({amount})는 계약자 명의 통장으로 반환됩니다.",
    zh: "上述差额 C（{amount}）将退还至承租人本人名下账户。",
    ja: "上記差額 C（{amount}）は契約者名義の口座へ返還されます。",
    th: "ยอดส่วนต่าง C ({amount}) ข้างต้นจะคืนเข้าบัญชีที่เป็นชื่อผู้เช่าเท่านั้น",
    vi: "Khoản chênh lệch C ({amount}) nêu trên sẽ được hoàn vào tài khoản đứng tên người thuê.",
  },
  "moveout.guide.refund.docs":  {
    en: "Documents required: 1 copy of the bankbook in the tenant's name, or a screenshot of the account in a mobile banking app.",
    ko: "제출 서류: 계약자 명의 통장 사본 또는 모바일 뱅킹 계좌 캡처본 1부",
    zh: "所需材料：承租人名下存折复印件或手机银行账户截图 1 份",
    ja: "提出書類：契約者名義の通帳の写し、またはモバイルバンキングの口座画面のスクリーンショット 1 部",
    th: "เอกสารที่ต้องส่ง: สำเนาสมุดบัญชีในชื่อผู้เช่า หรือภาพหน้าจอบัญชีจากโมบายแบงก์กิ้ง 1 ฉบับ",
    vi: "Hồ sơ cần nộp: 1 bản sao sổ tài khoản đứng tên người thuê hoặc ảnh chụp màn hình tài khoản trên ứng dụng ngân hàng.",
  },
  "moveout.guide.refund.how":   {
    en: "How to submit: text it to the leasing office contact ({phone}).",
    ko: "제출 방법: 임대사무실 담당자에게 문자전송 (연락처: {phone})",
    zh: "提交方式：发短信给租赁办公室负责人（联系电话：{phone}）。",
    ja: "提出方法：賃貸事務所の担当者へSMS送信（連絡先：{phone}）",
    th: "วิธีส่ง: ส่งข้อความถึงเจ้าหน้าที่สำนักงานเช่า (ติดต่อ: {phone})",
    vi: "Cách nộp: nhắn tin cho người phụ trách văn phòng cho thuê (liên hệ: {phone}).",
  },
  "moveout.guide.refund.howNoPhone": {
    en: "How to submit: text it to the leasing office contact.",
    ko: "제출 방법: 임대사무실 담당자에게 문자전송",
    zh: "提交方式：发短信给租赁办公室负责人。",
    ja: "提出方法：賃貸事務所の担当者へSMS送信",
    th: "วิธีส่ง: ส่งข้อความถึงเจ้าหน้าที่สำนักงานเช่า",
    vi: "Cách nộp: nhắn tin cho người phụ trách văn phòng cho thuê.",
  },
  "moveout.guide.transfer.title": { en: "Move-out report & resident registration", ko: "전출신고 및 주민등록 이전 의무", zh: "迁出登记及户籍迁移义务", ja: "転出届および住民登録移転の義務", th: "การแจ้งย้ายออกและย้ายทะเบียนบ้าน", vi: "Nghĩa vụ khai báo chuyển đi" },
  "moveout.guide.transfer.b1": {
    en: "If you registered your residence at this address, file the move-out report once the deposit refund is confirmed.",
    ko: "기존에 전입신고를 하신 세대는 보증금 반환 확인 후 주소지 '전출신고'를 완료하셔야 합니다.",
    zh: "如已办理迁入登记，请在确认押金退还后完成“迁出登记”。",
    ja: "転入届を提出された世帯は、保証金の返還確認後に住所地の「転出届」を完了してください。",
    th: "หากเคยแจ้งย้ายเข้าตามที่อยู่นี้ กรุณาแจ้งย้ายออกหลังยืนยันการคืนเงินประกัน",
    vi: "Nếu đã đăng ký cư trú tại địa chỉ này, hãy hoàn tất khai báo chuyển đi sau khi xác nhận hoàn cọc.",
  },
  "moveout.guide.transfer.b2": {
    en: "Failing to do so may restrict the following tenant's move-in registration and cause related disadvantages.",
    ko: "미전출 시 후속 입주자의 전입신고 제한 및 관련 불이익이 발생할 수 있습니다.",
    zh: "未办理迁出可能导致后续入住者迁入受限及相关不利影响。",
    ja: "未転出の場合、今後の入居者の転入届が制限されるなどの不利益が生じる可能性があります。",
    th: "หากไม่ดำเนินการ อาจทำให้ผู้เช่ารายถัดไปแจ้งย้ายเข้าไม่ได้และเกิดผลเสียตามมา",
    vi: "Nếu không thực hiện, người thuê kế tiếp có thể không đăng ký cư trú được và phát sinh bất lợi liên quan.",
  },
  "moveout.guide.utility.title": { en: "Utility settlement notes", ko: "공과금 정산 관련 주의사항", zh: "公共费用结算注意事项", ja: "公共料金精算に関する注意事項", th: "ข้อควรทราบเรื่องค่าสาธารณูปโภค", vi: "Lưu ý quyết toán tiện ích" },
  "moveout.guide.utility.internet": {
    en: "Internet: cancel the service directly with your provider — the set-top box or Wi-Fi equipment must also have been collected.",
    ko: "인터넷: 사용 중인 통신사에 직접 해지 신청하여 셋톱박스 또는 와이파이 기기 수거까지 완료되어야 합니다.",
    zh: "网络：请自行向通信运营商申请解约，并完成机顶盒或 Wi-Fi 设备的回收。",
    ja: "インターネット：ご利用の通信会社へ直接解約を申請し、セットトップボックスまたはWi-Fi機器の回収まで完了させてください。",
    th: "อินเทอร์เน็ต: แจ้งยกเลิกกับผู้ให้บริการโดยตรง และต้องมีการเก็บกล่องรับสัญญาณหรืออุปกรณ์ Wi-Fi คืนให้เรียบร้อย",
    vi: "Internet: tự liên hệ nhà mạng để hủy dịch vụ và hoàn tất việc thu hồi bộ giải mã hoặc thiết bị Wi-Fi.",
  },
  "moveout.guide.utility.b1": {
    en: "Gas: apply for disconnection directly with the city gas provider and pay the charges up to the move-out date.",
    ko: "가스비: 도시가스사에 직접 해지 신청(계량기 검침) 후 퇴거일까지의 요금을 직접 납부하셔야 합니다.",
    zh: "燃气费：请自行向燃气公司申请解约（抄表），并支付至退租日的费用。",
    ja: "ガス料金：都市ガス会社へ直接解約を申請（検針）し、退去日までの料金をご負担ください。",
    th: "ค่าแก๊ส: ติดต่อบริษัทแก๊สเพื่อยกเลิก (จดมิเตอร์) และชำระค่าใช้จ่ายถึงวันย้ายออกด้วยตนเอง",
    vi: "Phí gas: tự liên hệ công ty gas để ngưng dịch vụ (chốt đồng hồ) và thanh toán đến ngày trả phòng.",
  },
  "moveout.guide.utility.b2": {
    en: "Management fees: any additional amount arising after settlement may be billed separately.",
    ko: "관리비: 정산일 이후 추가 발생분이 있는 경우 별도 청구될 수 있습니다.",
    zh: "管理费：结算日之后如有额外产生费用，可另行收取。",
    ja: "管理費：精算日以降に追加発生分がある場合、別途請求されることがあります。",
    th: "ค่าส่วนกลาง: หากมีค่าใช้จ่ายเพิ่มหลังวันชำระบัญชี อาจเรียกเก็บเพิ่มเติม",
    vi: "Phí quản lý: nếu phát sinh thêm sau ngày quyết toán, có thể được thu riêng.",
  },
  "moveout.guide.restore.title": { en: "Restoration & key return", ko: "시설물 원상복구 및 열쇠 반납", zh: "设施恢复原状及钥匙归还", ja: "設備の原状回復および鍵の返却", th: "การคืนสภาพและคืนกุญแจ", vi: "Khôi phục hiện trạng & trả chìa khóa" },
  "moveout.guide.restore.b1Pin": {
    en: "Reset the entrance door PIN to {pin}, leave the card keys and equipment remotes inside the unit, and text the contact a photo of them.",
    ko: "세대 출입문 비밀번호를 {pin}로 변경하고, 세대 안에 둔 카드키·시설물 리모컨 등의 확인 사진을 담당자에게 문자전송해 주셔야 합니다.",
    zh: "请将入户门密码改为 {pin}，将门禁卡、设施遥控器等留在室内，并把确认照片用短信发送给负责人。",
    ja: "玄関の暗証番号を {pin} に変更し、住戸内に残したカードキー・設備リモコン等の確認写真を担当者へSMSで送信してください。",
    th: "เปลี่ยนรหัสประตูทางเข้าเป็น {pin} วางคีย์การ์ดและรีโมตอุปกรณ์ไว้ในห้อง แล้วส่งรูปยืนยันให้เจ้าหน้าที่ทางข้อความ",
    vi: "Đổi mật khẩu cửa ra vào thành {pin}, để lại thẻ từ và điều khiển thiết bị trong căn hộ và nhắn tin gửi ảnh xác nhận cho người phụ trách.",
  },
  "moveout.guide.restore.b1": {
    en: "Reset any changed entrance door PIN, leave the card keys and equipment remotes inside the unit, and text the contact a photo of them.",
    ko: "세대 출입문 비밀번호를 원복하고, 세대 안에 둔 카드키·시설물 리모컨 등의 확인 사진을 담당자에게 문자전송해 주셔야 합니다.",
    zh: "如更改过入户门密码请复原，将门禁卡、设施遥控器等留在室内，并把确认照片用短信发送给负责人。",
    ja: "玄関の暗証番号を変更された場合は復元し、住戸内に残したカードキー・設備リモコン等の確認写真を担当者へSMSで送信してください。",
    th: "หากเปลี่ยนรหัสประตูให้ตั้งคืนค่า วางคีย์การ์ดและรีโมตอุปกรณ์ไว้ในห้อง แล้วส่งรูปยืนยันให้เจ้าหน้าที่ทางข้อความ",
    vi: "Nếu đã đổi mật khẩu cửa hãy khôi phục, để lại thẻ từ và điều khiển thiết bị trong căn hộ và nhắn tin gửi ảnh xác nhận cho người phụ trách.",
  },
  "moveout.transferNote": {
    en: "* If you registered your residence at this address, be sure to file a move-out (residence transfer) report after confirming the deposit refund.",
    ko: "* 전입신고하셨다면 보증금 반환 확인 후 필히 전출신고 하셔야 합니다.",
    zh: "* 如已办理迁入登记，请在确认押金退还后务必办理迁出登记。",
    ja: "* 転入届を提出された場合は、保証金の返還を確認後、必ず転出届を提出してください。",
    th: "* หากท่านได้แจ้งย้ายเข้าตามที่อยู่นี้ กรุณาแจ้งย้ายออกหลังจากยืนยันการคืนเงินประกันแล้ว",
    vi: "* Nếu bạn đã đăng ký cư trú tại địa chỉ này, hãy chắc chắn khai báo chuyển đi sau khi xác nhận việc hoàn trả tiền cọc.",
  },

  // ── Email cover (when documents are emailed) ──────────────────────────
  // {brand} = the sending tenant's trading name (Settings → Organisation), never
  // a hard-coded "MillionStay" — a Metheim invoice must say Metheim.
  "email.subject": {
    en: "{doc} {ref} from {brand}",
    ko: "{brand} {doc} {ref}",
    zh: "{brand} {doc} {ref}",
    ja: "{brand} {doc} {ref}",
    th: "{doc} {ref} จาก {brand}",
    vi: "{doc} {ref} từ {brand}",
  },
  "email.greeting.named": {
    en: "Hi {name},", ko: "{name}님, 안녕하세요.", zh: "您好 {name}：", ja: "{name} 様", th: "เรียน คุณ{name},", vi: "Xin chào {name},",
  },
  "email.greeting.plain": {
    en: "Hello,", ko: "안녕하세요.", zh: "您好：", ja: "ご担当者様", th: "เรียน ท่านผู้เกี่ยวข้อง,", vi: "Xin chào,",
  },
  "email.body": {
    en: "Please find your {doc} attached as a PDF.",
    ko: "{doc}를 PDF 파일로 첨부합니다.",
    zh: "请查收附件中的{doc}（PDF）。",
    ja: "{doc}をPDFファイルで添付いたします。",
    th: "โปรดดู{doc}ของท่านที่แนบมาในรูปแบบ PDF",
    vi: "Vui lòng xem {doc} của bạn được đính kèm dưới dạng PDF.",
  },
  "email.questions": {
    en: "Questions? Contact us at {email}.",
    ko: "문의사항은 {email}로 연락 주세요.",
    zh: "如有疑问，请联系 {email}。",
    ja: "ご不明な点は {email} までお問い合わせください。",
    th: "มีคำถาม? ติดต่อเราที่ {email}",
    vi: "Có thắc mắc? Liên hệ với chúng tôi tại {email}.",
  },
  "email.sentTo": {
    en: "This email was sent to {to}",
    ko: "이 이메일은 {to} 주소로 발송되었습니다",
    zh: "本邮件发送至 {to}",
    ja: "このメールは {to} 宛に送信されました",
    th: "อีเมลนี้ถูกส่งถึง {to}",
    vi: "Email này được gửi đến {to}",
  },
  "email.note.due": {
    en: "Payment is due by {date}.",
    ko: "지급 기한은 {date}입니다.",
    zh: "付款截止日期为 {date}。",
    ja: "お支払期限は {date} です。",
    th: "กำหนดชำระเงินภายในวันที่ {date}",
    vi: "Thanh toán đến hạn trước ngày {date}.",
  },
  "email.note.validUntil": {
    en: "This quote is valid until {date}.",
    ko: "본 견적은 {date}까지 유효합니다.",
    zh: "本报价有效期至 {date}。",
    ja: "本見積の有効期限は {date} です。",
    th: "ใบเสนอราคานี้ใช้ได้ถึงวันที่ {date}",
    vi: "Báo giá này có hiệu lực đến ngày {date}.",
  },
  "email.note.reviewAgreement": {
    en: "Please review the attached agreement and reply to confirm.",
    ko: "첨부된 계약서를 검토하신 후 회신하여 확인해 주세요.",
    zh: "请查阅所附协议并回复确认。",
    ja: "添付の契約書をご確認の上、ご返信ください。",
    th: "โปรดตรวจสอบข้อตกลงที่แนบมาและตอบกลับเพื่อยืนยัน",
    vi: "Vui lòng xem lại thỏa thuận đính kèm và trả lời để xác nhận.",
  },

  // ── Document status labels (used for the diagonal status watermark) ──────
  "status.Draft":    { en: "Draft",     ko: "초안",      zh: "草稿",   ja: "下書き",   th: "ฉบับร่าง",  vi: "Bản nháp" },
  "status.Sent":     { en: "Sent",      ko: "발송됨",    zh: "已发送", ja: "送信済",   th: "ส่งแล้ว",   vi: "Đã gửi" },
  "status.Paid":     { en: "Paid",      ko: "결제완료",  zh: "已付款", ja: "支払済",   th: "ชำระแล้ว",  vi: "Đã thanh toán" },
  "status.Void":     { en: "Void",      ko: "무효",      zh: "作废",   ja: "無効",     th: "ยกเลิก",    vi: "Đã hủy" },
  "status.Archived": { en: "Archived",  ko: "보관됨",    zh: "已归档", ja: "アーカイブ", th: "เก็บถาวร",  vi: "Đã lưu trữ" },
  "status.Accepted": { en: "Accepted",  ko: "수락됨",    zh: "已接受", ja: "承認済",   th: "ยอมรับแล้ว", vi: "Đã chấp nhận" },
  "status.Declined": { en: "Declined",  ko: "거절됨",    zh: "已拒绝", ja: "却下",     th: "ปฏิเสธแล้ว", vi: "Đã từ chối" },
  "status.Expired":  { en: "Expired",   ko: "만료됨",    zh: "已过期", ja: "期限切れ", th: "หมดอายุ",   vi: "Đã hết hạn" },
  "status.Overdue":  { en: "Overdue",   ko: "연체",      zh: "逾期",   ja: "期限超過", th: "เกินกำหนด", vi: "Quá hạn" },
  // Application / placement lifecycle (student, host family, short-term).
  "status.Submitted": { en: "Submitted", ko: "제출됨",  zh: "已提交", ja: "提出済",   th: "ส่งแล้ว",     vi: "Đã nộp" },
  "status.Approved":  { en: "Approved",  ko: "승인됨",  zh: "已批准", ja: "承認済",   th: "อนุมัติแล้ว",  vi: "Đã duyệt" },
  "status.Rejected":  { en: "Rejected",  ko: "반려됨",  zh: "已拒绝", ja: "却下",     th: "ถูกปฏิเสธ",   vi: "Bị từ chối" },
  "status.Placed":    { en: "Placed",    ko: "배정 완료", zh: "已安置", ja: "配属済",  th: "จัดที่พักแล้ว", vi: "Đã sắp xếp" },
  "status.Active":    { en: "Active",    ko: "진행 중",  zh: "进行中", ja: "進行中",   th: "กำลังดำเนินการ", vi: "Đang hoạt động" },
  "status.Completed": { en: "Completed", ko: "완료됨",  zh: "已完成", ja: "完了",     th: "เสร็จสิ้น",    vi: "Đã hoàn tất" },
  "status.Cancelled": { en: "Cancelled", ko: "취소됨",  zh: "已取消", ja: "キャンセル", th: "ยกเลิกแล้ว",  vi: "Đã hủy" },

  // ── 작업지시 상태 (work_orders.status) ──────────────────────────────────────
  "status.Open":          { en: "Open",           ko: "접수",      zh: "待处理",   ja: "受付",       th: "เปิด",            vi: "Đang mở" },
  "status.InProgress":    { en: "In progress",    ko: "진행 중",   zh: "进行中",   ja: "作業中",     th: "กำลังดำเนินการ",  vi: "Đang thực hiện" },
  "status.PendingReview": { en: "Pending review", ko: "검수 대기", zh: "待验收",   ja: "検収待ち",   th: "รอตรวจรับ",       vi: "Chờ nghiệm thu" },

  // ── 작업지시서 (A) / 하자·청소 청구 명세서 (B) ─────────────────────────────
  "wo.heading":         { en: "Work Order",          ko: "작업지시서",     zh: "工作指令书",   ja: "作業指示書",     th: "ใบสั่งงาน",              vi: "Lệnh công việc" },
  "wo.billing.heading": { en: "Repair & Cleaning Billing Statement", ko: "임대청소 · 하자 청구 명세서", zh: "保洁与维修请款明细", ja: "清掃・不具合請求明細書", th: "ใบแจ้งค่าทำความสะอาดและซ่อมแซม", vi: "Bảng kê chi phí vệ sinh & sửa chữa" },
  "wo.category":        { en: "Work type",           ko: "작업분류",       zh: "作业分类",     ja: "作業区分",       th: "ประเภทงาน",              vi: "Loại công việc" },
  "wo.status":          { en: "Status",              ko: "상태",           zh: "状态",         ja: "状態",           th: "สถานะ",                  vi: "Trạng thái" },
  "wo.reportedAt":      { en: "Reported",            ko: "접수일",         zh: "受理日",       ja: "受付日",         th: "วันที่แจ้ง",             vi: "Ngày tiếp nhận" },
  "wo.scheduledAt":     { en: "Work Date",           ko: "작업일",         zh: "作业日期",     ja: "作業日",         th: "วันปฏิบัติงาน",          vi: "Ngày thi công" },
  "wo.completedAt":     { en: "Completed",           ko: "완료일",         zh: "完成日",       ja: "完了日",         th: "วันที่เสร็จ",            vi: "Ngày hoàn thành" },
  "wo.partner":         { en: "Partner",             ko: "작업 파트너",    zh: "合作方",       ja: "施工パートナー", th: "พันธมิตรผู้ดำเนินงาน",   vi: "Đối tác thi công" },
  "wo.assignee":        { en: "Assignee",            ko: "담당자",         zh: "负责人",       ja: "担当者",         th: "ผู้รับผิดชอบ",           vi: "Người phụ trách" },
  "wo.attendee":        { en: "Attendee",            ko: "입회자",         zh: "在场人",       ja: "立会人",         th: "ผู้เข้าร่วม",            vi: "Người chứng kiến" },
  "wo.accessMethod":    { en: "Access",              ko: "출입 방법",      zh: "进入方式",     ja: "入室方法",       th: "วิธีเข้าถึง",            vi: "Cách vào" },
  "wo.locationNote":    { en: "Location note",       ko: "현장 안내",      zh: "现场说明",     ja: "現場メモ",       th: "หมายเหตุสถานที่",        vi: "Ghi chú hiện trường" },
  "wo.subject":         { en: "Subject",             ko: "작업명",         zh: "作业名称",     ja: "作業名",         th: "ชื่องาน",                vi: "Tên công việc" },
  "wo.workDetail":      { en: "Work details",        ko: "작업내용",       zh: "作业内容",     ja: "作業内容",       th: "รายละเอียดงาน",          vi: "Nội dung công việc" },
  "wo.costs":           { en: "Costs",               ko: "비용",           zh: "费用",         ja: "費用",           th: "ค่าใช้จ่าย",             vi: "Chi phí" },
  "wo.workCost":        { en: "Work cost",           ko: "작업비용",       zh: "作业费用",     ja: "作業費用",       th: "ค่าดำเนินงาน",           vi: "Chi phí thi công" },
  "wo.withholding":     { en: "Withholding",         ko: "원천징수",       zh: "代扣税",       ja: "源泉徴収",       th: "ภาษีหัก ณ ที่จ่าย",      vi: "Thuế khấu trừ" },
  "wo.vat":             { en: "VAT",                 ko: "부가세",         zh: "增值税",       ja: "消費税",         th: "ภาษีมูลค่าเพิ่ม",        vi: "Thuế GTGT" },
  "wo.billedCost":      { en: "Billed amount",       ko: "청구비용",       zh: "请款金额",     ja: "請求費用",       th: "ยอดเรียกเก็บ",           vi: "Số tiền yêu cầu" },
  "wo.chargedTo":       { en: "Charged to",          ko: "부담 주체",      zh: "费用承担方",   ja: "費用負担者",     th: "ผู้รับภาระค่าใช้จ่าย",   vi: "Bên chịu chi phí" },
  "wo.chargedTo.tenant":   { en: "Tenant",           ko: "임차인",         zh: "租客",         ja: "借主",           th: "ผู้เช่า",                vi: "Bên thuê" },
  "wo.chargedTo.landlord": { en: "Landlord",         ko: "임대인",         zh: "房东",         ja: "貸主",           th: "ผู้ให้เช่า",             vi: "Bên cho thuê" },
  "wo.chargedTo.company":  { en: "Company",          ko: "회사",           zh: "公司",         ja: "会社",           th: "บริษัท",                 vi: "Công ty" },
  "wo.access.tenant_present": { en: "Tenant present",     ko: "임차인 입회",   zh: "租客在场",     ja: "借主立会",       th: "ผู้เช่าอยู่ด้วย",       vi: "Có mặt bên thuê" },
  "wo.access.vacant_key":     { en: "Vacant — office key", ko: "공실 — 사무실 키", zh: "空置 — 办公室钥匙", ja: "空室 — 事務所の鍵", th: "ห้องว่าง — กุญแจสำนักงาน", vi: "Trống — chìa khóa văn phòng" },
  "wo.access.lockbox":        { en: "Lockbox / door code", ko: "락박스 / 도어락", zh: "钥匙盒 / 门锁密码", ja: "キーボックス / 暗証番号", th: "กล่องกุญแจ / รหัสประตู", vi: "Hộp khóa / mã cửa" },
  "wo.access.agent":          { en: "Agent opens",        ko: "중개인 개문",   zh: "中介开门",     ja: "仲介が開錠",     th: "นายหน้าเปิดให้",        vi: "Môi giới mở cửa" },
  "wo.access.other":          { en: "Other",              ko: "기타",         zh: "其他",         ja: "その他",         th: "อื่น ๆ",                vi: "Khác" },
  "wo.contract":        { en: "Contract",            ko: "계약",           zh: "合同",         ja: "契約",           th: "สัญญา",                  vi: "Hợp đồng" },
  "wo.photosBefore":    { en: "Photos — before",     ko: "사진 — 작업 전", zh: "照片 — 施工前", ja: "写真 — 作業前",  th: "ภาพ — ก่อนทำงาน",        vi: "Ảnh — trước khi làm" },
  "wo.photosAfter":     { en: "Photos — after",      ko: "사진 — 작업 후", zh: "照片 — 施工后", ja: "写真 — 作業後",  th: "ภาพ — หลังทำงาน",        vi: "Ảnh — sau khi làm" },
  "wo.noPhotos":        { en: "No photos",           ko: "사진 없음",      zh: "无照片",       ja: "写真なし",       th: "ไม่มีรูปภาพ",            vi: "Không có ảnh" },
  "wo.requestedBy":     { en: "Requested by",        ko: "요청자",         zh: "申请人",       ja: "依頼者",         th: "ผู้ร้องขอ",              vi: "Người yêu cầu" },
  "wo.performedBy":     { en: "Performed by",        ko: "작업자",         zh: "施工人",       ja: "作業者",         th: "ผู้ปฏิบัติงาน",          vi: "Người thực hiện" },
  "wo.confirmedBy":     { en: "Confirmed by",        ko: "확인자",         zh: "确认人",       ja: "確認者",         th: "ผู้ตรวจรับ",             vi: "Người xác nhận" },
  // 작업 확인서(서명본) — 시설 담당자가 무로그인 링크로 확인 서명한 결과.
  "wo.confirmHeading":  { en: "Work Completion Confirmation", ko: "작업 확인서", zh: "作业确认书", ja: "作業確認書", th: "หนังสือยืนยันงาน", vi: "Xác nhận công việc" },
  "wo.signature":       { en: "Signature",           ko: "서명",           zh: "签名",         ja: "署名",           th: "ลายเซ็น",                vi: "Chữ ký" },
  "wo.signedAt":        { en: "Signed at",           ko: "서명 일시",      zh: "签署时间",     ja: "署名日時",       th: "เวลาที่ลงนาม",           vi: "Thời điểm ký" },
  "wo.signerName":      { en: "Signer",              ko: "서명자",         zh: "签署人",       ja: "署名者",         th: "ผู้ลงนาม",               vi: "Người ký" },
  "wo.signAudit":       { en: "Verification record", ko: "인증 정보",      zh: "认证信息",     ja: "認証情報",       th: "ข้อมูลการยืนยัน",        vi: "Thông tin xác thực" },
  "wo.signIp":          { en: "IP address",          ko: "IP 주소",        zh: "IP 地址",      ja: "IP アドレス",    th: "ที่อยู่ IP",             vi: "Địa chỉ IP" },
  "wo.signDevice":      { en: "Device",              ko: "기기",           zh: "设备",         ja: "端末",           th: "อุปกรณ์",                vi: "Thiết bị" },
  "wo.signConsent":     { en: "Consent",             ko: "동의",           zh: "同意",         ja: "同意",           th: "ความยินยอม",             vi: "Đồng ý" },
  "wo.signHash":        { en: "Document hash",       ko: "문서 해시",      zh: "文档哈希",     ja: "文書ハッシュ",   th: "แฮชเอกสาร",              vi: "Mã băm tài liệu" },
  "wo.signConsentText": {
    en: "I confirm that I have inspected the work described above and that it has been completed as recorded.",
    ko: "위 작업 내용을 확인하였으며, 기재된 대로 작업이 완료되었음을 확인합니다.",
    zh: "本人已确认上述作业内容，并确认作业已按记录完成。",
    ja: "上記の作業内容を確認し、記載のとおり作業が完了したことを確認します。",
    th: "ข้าพเจ้าได้ตรวจสอบงานตามรายละเอียดข้างต้นแล้ว และยืนยันว่างานเสร็จสมบูรณ์ตามที่บันทึกไว้",
    vi: "Tôi xác nhận đã kiểm tra công việc nêu trên và công việc đã hoàn thành đúng như ghi nhận.",
  },
  "wo.photoSession":    { en: "Session {n}",         ko: "{n}차",          zh: "第{n}次",      ja: "{n}回目",        th: "ครั้งที่ {n}",           vi: "Lần {n}" },
  "wo.no":              { en: "No.",                 ko: "순번",           zh: "序号",         ja: "番号",           th: "ลำดับ",                  vi: "STT" },
  "wo.workDate":        { en: "Work date",           ko: "작업일자",       zh: "作业日期",     ja: "作業日",         th: "วันที่ทำงาน",            vi: "Ngày thi công" },
  "wo.itemCount":       { en: "Items",               ko: "작업 건수",      zh: "作业件数",     ja: "作業件数",       th: "จำนวนรายการ",            vi: "Số hạng mục" },
  "wo.workCostTotal":   { en: "Work cost total",     ko: "작업비용 합계",  zh: "作业费用合计", ja: "作業費用合計",   th: "รวมค่าดำเนินงาน",        vi: "Tổng chi phí thi công" },
  "wo.billedTotal":     { en: "Billed total",        ko: "청구비용 합계",  zh: "请款金额合计", ja: "請求費用合計",   th: "รวมยอดเรียกเก็บ",        vi: "Tổng số tiền yêu cầu" },
  "wo.noRows":          { en: "No work orders in this period", ko: "해당 기간의 작업이 없습니다", zh: "该期间没有作业记录", ja: "対象期間の作業はありません", th: "ไม่มีงานในช่วงเวลานี้", vi: "Không có công việc trong kỳ này" },
  "wo.evidence":        { en: "Evidence photos by unit", ko: "호수별 증빙 사진", zh: "各房号证明照片", ja: "号室別の証拠写真", th: "ภาพหลักฐานแยกตามห้อง", vi: "Ảnh chứng minh theo căn hộ" },
  "wo.withholdingNote": {
    en: "Rows without a stored net amount are billed at the work cost less {pct}% withholding tax.",
    ko: "실지급액이 저장되지 않은 항목은 작업비용에서 원천징수 {pct}%를 뺀 금액으로 청구합니다.",
    zh: "未登记实付金额的项目，按作业费用扣除 {pct}% 代扣税后请款。",
    ja: "実支払額が未登録の項目は、作業費用から源泉徴収 {pct}% を差し引いて請求します。",
    th: "รายการที่ยังไม่บันทึกยอดสุทธิ จะเรียกเก็บตามค่าดำเนินงานหักภาษี ณ ที่จ่าย {pct}%",
    vi: "Các hạng mục chưa có số thực trả được tính bằng chi phí thi công trừ {pct}% thuế khấu trừ.",
  },

  // ── 작업분류 라벨 — 정본은 @workspace/api-zod의 WORK_ORDER_CATEGORIES ────────
  "wo.cat.repair":            { en: "Repair", ko: "하자보수", zh: "缺陷维修", ja: "不具合修繕", th: "ซ่อมแซมข้อบกพร่อง", vi: "Sửa lỗi kỹ thuật" },
  "wo.cat.move_out_cleaning": { en: "Move-out cleaning", ko: "퇴거청소", zh: "退租保洁", ja: "退去清掃", th: "ทำความสะอาดเมื่อย้ายออก", vi: "Dọn dẹp trả nhà" },
  "wo.cat.move_in_cleaning":  { en: "Move-in cleaning", ko: "입주청소", zh: "入住保洁", ja: "入居清掃", th: "ทำความสะอาดก่อนเข้าอยู่", vi: "Dọn dẹp nhận nhà" },
  "wo.cat.cleaning":          { en: "Cleaning", ko: "청소", zh: "清洁", ja: "清掃", th: "ทำความสะอาด", vi: "Vệ sinh" },
  "wo.cat.wallpaper":     { en: "Wallpaper",  ko: "도배",  zh: "墙纸",  ja: "壁紙",  th: "วอลเปเปอร์",  vi: "Giấy dán tường" },
  "wo.cat.plumbing":          { en: "Plumbing", ko: "배관", zh: "管道", ja: "配管", th: "งานประปา", vi: "Ống nước" },
  "wo.cat.electrical":        { en: "Electrical", ko: "전기", zh: "电气", ja: "電気", th: "งานไฟฟ้า", vi: "Điện" },
  "wo.cat.hvac":              { en: "HVAC", ko: "냉난방공조", zh: "暖通空调", ja: "空調", th: "ระบบปรับอากาศ", vi: "Điều hòa/Thông gió" },
  "wo.cat.painting":          { en: "Painting", ko: "도장", zh: "油漆", ja: "塗装", th: "งานทาสี", vi: "Sơn" },
  "wo.cat.carpentry":         { en: "Carpentry", ko: "목공", zh: "木工", ja: "木工", th: "งานไม้", vi: "Mộc" },
  "wo.cat.pest_control":      { en: "Pest Control", ko: "방역", zh: "虫害防治", ja: "害虫駆除", th: "กำจัดแมลง", vi: "Kiểm soát côn trùng" },
  "wo.cat.landscaping":       { en: "Landscaping", ko: "조경", zh: "园艺", ja: "造園", th: "จัดสวน", vi: "Cảnh quan" },
  "wo.cat.security":          { en: "Security", ko: "보안", zh: "安防", ja: "警備", th: "รักษาความปลอดภัย", vi: "An ninh" },
  "wo.cat.day_tour":          { en: "Day tour", ko: "데이투어", zh: "一日游", ja: "デイツアー", th: "ทัวร์รายวัน", vi: "Tour trong ngày" },
  "wo.cat.fishing":           { en: "Fishing", ko: "낚시", zh: "钓鱼", ja: "釣り", th: "ตกปลา", vi: "Câu cá" },
  "wo.cat.general":           { en: "General", ko: "일반", zh: "通用", ja: "一般", th: "ทั่วไป", vi: "Chung" },
};

/** Localised display label for a document status; falls back to the raw value. */
export function statusLabel(lang: DocLang, status: string): string {
  const entry = LABELS[`status.${status}`];
  return entry ? (entry[lang] ?? entry.en) : status;
}

/** Translate a label key into the given language, interpolating {var} tokens. */
export function t(lang: DocLang, key: string, vars?: Record<string, string>): string {
  const entry = LABELS[key];
  let str = entry ? (entry[lang] ?? entry.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
  return str;
}

/**
 * Localised display names for known add-on service codes / placement
 * service_types (airport pickup, settlement, prepaid phone…). Mirrors the OPEN
 * `addon_services` catalogue codes; unknown codes fall back to a title-cased
 * version of the code (or the supplied human name).
 */
const SERVICE_LABELS: Record<string, Record<DocLang, string>> = {
  airport_pickup:     { en: "Airport pickup",            ko: "공항 픽업",        zh: "机场接送",     ja: "空港送迎",         th: "รับส่งสนามบิน",                         vi: "Đón sân bay" },
  airport_dropoff:    { en: "Airport drop-off",          ko: "공항 샌딩",        zh: "送机服务",     ja: "空港見送り",       th: "ส่งสนามบิน",                            vi: "Tiễn sân bay" },
  initial_settlement: { en: "Initial settlement support", ko: "초기 정착 지원",   zh: "初期安顿协助", ja: "初期定着サポート", th: "ความช่วยเหลือในการตั้งถิ่นฐานเริ่มต้น", vi: "Hỗ trợ ổn định ban đầu" },
  settlement_support: { en: "Initial settlement support", ko: "초기 정착 지원",   zh: "初期安顿协助", ja: "初期定着サポート", th: "ความช่วยเหลือในการตั้งถิ่นฐานเริ่มต้น", vi: "Hỗ trợ ổn định ban đầu" },
  guardian_service:   { en: "Guardian service",          ko: "가디언 서비스",    zh: "监护服务",     ja: "ガーディアンサービス", th: "บริการผู้ปกครอง",                  vi: "Dịch vụ giám hộ" },
  prepaid_phone:      { en: "Prepaid phone",             ko: "선불폰",           zh: "预付费手机",   ja: "プリペイド携帯",   th: "โทรศัพท์เติมเงิน",                      vi: "Điện thoại trả trước" },
  sim_card:           { en: "Prepaid SIM",               ko: "선불 SIM",         zh: "预付 SIM 卡",  ja: "プリペイドSIM",    th: "ซิมเติมเงิน",                           vi: "SIM trả trước" },
  prepaid_sim:        { en: "Prepaid SIM",               ko: "선불 SIM",         zh: "预付 SIM 卡",  ja: "プリペイドSIM",    th: "ซิมเติมเงิน",                           vi: "SIM trả trước" },
};

/** Title-case a snake/space-separated code as a last-resort display label. */
function titleCase(code: string): string {
  return code
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Resolve a human, localised label for an add-on service code / placement
 * service_type. Falls back to `fallbackName` (a stored human label) when given,
 * otherwise to a title-cased version of the code.
 */
export function serviceLabel(lang: DocLang, code: string, fallbackName?: string | null): string {
  const entry = SERVICE_LABELS[code];
  if (entry) return entry[lang] ?? entry.en;
  if (fallbackName?.trim()) return fallbackName.trim();
  return titleCase(code);
}

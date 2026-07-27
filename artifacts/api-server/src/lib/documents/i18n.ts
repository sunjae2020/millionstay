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

export function normalizeLang(input: string | undefined | null): DocLang {
  const l = (input ?? "").toLowerCase().slice(0, 2);
  return (SUPPORTED as string[]).includes(l) ? (l as DocLang) : "en";
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
let currentDateFormat: DateFormatLabel = "DD/MM/YYYY";

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

  // ── Move-out confirmation / deposit settlement (퇴거 세대 확인서) ──────────
  "doctype.move_out":     { en: "Move-out Confirmation", ko: "퇴거 세대 확인서", zh: "退租确认书", ja: "退去世帯確認書", th: "หนังสือยืนยันการย้ายออก", vi: "Xác nhận trả phòng" },
  "moveout.heading":      { en: "Move-out Confirmation", ko: "퇴거 세대 확인서", zh: "退租确认书", ja: "退去世帯確認書", th: "หนังสือยืนยันการย้ายออก", vi: "Xác nhận trả phòng" },
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
  "moveout.transferNote": {
    en: "* If you registered your residence at this address, be sure to file a move-out (residence transfer) report after confirming the deposit refund.",
    ko: "* 전입신고하셨다면 보증금 반환 확인 후 필히 전출신고 하셔야 합니다.",
    zh: "* 如已办理迁入登记，请在确认押金退还后务必办理迁出登记。",
    ja: "* 転入届を提出された場合は、保証金の返還を確認後、必ず転出届を提出してください。",
    th: "* หากท่านได้แจ้งย้ายเข้าตามที่อยู่นี้ กรุณาแจ้งย้ายออกหลังจากยืนยันการคืนเงินประกันแล้ว",
    vi: "* Nếu bạn đã đăng ký cư trú tại địa chỉ này, hãy chắc chắn khai báo chuyển đi sau khi xác nhận việc hoàn trả tiền cọc.",
  },

  // ── Email cover (when documents are emailed) ──────────────────────────
  "email.subject": {
    en: "{doc} {ref} from MillionStay",
    ko: "MillionStay {doc} {ref}",
    zh: "MillionStay {doc} {ref}",
    ja: "MillionStay {doc} {ref}",
    th: "{doc} {ref} จาก MillionStay",
    vi: "{doc} {ref} từ MillionStay",
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

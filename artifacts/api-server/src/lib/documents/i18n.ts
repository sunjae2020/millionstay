/**
 * Document Hub — multi-language labels (follow-up)
 *
 * Static document labels translated for the languages MillionStay serves
 * (English, Korean, Chinese, Japanese). Dynamic data (names, amounts, refs) is
 * untouched. Pass `lang` to the document builders / PDF endpoints (`?lang=ko`);
 * unknown languages fall back to English.
 *
 * NOTE: transactional *emails* remain English-only per project policy — this
 * i18n applies to the rendered documents (PDF / preview).
 */
export type DocLang = "en" | "ko" | "zh" | "ja";

const SUPPORTED: DocLang[] = ["en", "ko", "zh", "ja"];

export function normalizeLang(input: string | undefined | null): DocLang {
  const l = (input ?? "").toLowerCase().slice(0, 2);
  return (SUPPORTED as string[]).includes(l) ? (l as DocLang) : "en";
}

/** Intl locale used for date formatting per document language. */
export function docLocale(lang: DocLang): string {
  return { en: "en-AU", ko: "ko-KR", zh: "zh-CN", ja: "ja-JP" }[lang];
}

type Dict = Record<string, Record<DocLang, string>>;

const LABELS: Dict = {
  "doctype.invoice":  { en: "Tax Invoice", ko: "청구서",       zh: "发票",       ja: "請求書" },
  "doctype.receipt":  { en: "Receipt",     ko: "영수증",       zh: "收据",       ja: "領収書" },
  "doctype.quote":    { en: "Quotation",   ko: "견적서",       zh: "报价单",     ja: "見積書" },
  "doctype.contract": { en: "Agreement",   ko: "계약서",       zh: "协议",       ja: "契約書" },

  "invoice.heading":  { en: "Invoice",     ko: "청구서",       zh: "发票",       ja: "請求書" },
  "billTo":           { en: "Bill To",     ko: "청구 대상",    zh: "付款方",     ja: "請求先" },
  "details":          { en: "Details",     ko: "상세 내역",    zh: "明细",       ja: "明細" },
  "description":      { en: "Description", ko: "내역",         zh: "描述",       ja: "内容" },
  "amount":           { en: "Amount",      ko: "금액",         zh: "金额",       ja: "金額" },
  "dueDate":          { en: "Due Date",    ko: "지급 기한",    zh: "到期日",     ja: "支払期限" },
  "paid":             { en: "Paid",        ko: "결제 완료",    zh: "已付款",     ja: "支払済" },
  "amountDue":        { en: "Amount Due",  ko: "청구 금액",    zh: "应付金额",   ja: "請求金額" },
  "amountPaid":       { en: "Amount Paid", ko: "결제 금액",    zh: "已付金额",   ja: "支払金額" },
  "notes":            { en: "Notes",       ko: "비고",         zh: "备注",       ja: "備考" },
  "issued":           { en: "Issued",      ko: "발행일",       zh: "开具日期",   ja: "発行日" },

  "receipt.heading":  { en: "Receipt",          ko: "영수증",      zh: "收据",     ja: "領収書" },
  "receivedFrom":     { en: "Received From",    ko: "지급인",      zh: "付款人",   ja: "支払者" },
  "for":              { en: "For",              ko: "항목",        zh: "项目",     ja: "項目" },
  "paymentMethod":    { en: "Payment Method",   ko: "결제 수단",   zh: "付款方式", ja: "支払方法" },
  "paymentDate":      { en: "Payment Date",     ko: "결제일",      zh: "付款日期", ja: "支払日" },
  "amountReceived":   { en: "Amount Received",  ko: "수령 금액",   zh: "收款金额", ja: "受領金額" },
  "paymentReceived":  { en: "Payment received", ko: "결제 완료일", zh: "已收款",   ja: "受領日" },
  "paymentPending":   { en: "Payment pending",  ko: "결제 대기",   zh: "待付款",   ja: "支払待ち" },
  "receipt.confirm":  {
    en: "This document confirms receipt of the amount shown above against invoice {ref}. Thank you.",
    ko: "본 문서는 청구서 {ref}에 대한 상기 금액의 수령을 확인합니다. 감사합니다.",
    zh: "本文件确认已收到上述金额，对应发票 {ref}。谢谢。",
    ja: "本書は、請求書 {ref} に対する上記金額の受領を確認するものです。ありがとうございます。",
  },

  "quote.heading":    { en: "Quotation",     ko: "견적서",     zh: "报价单",     ja: "見積書" },
  "preparedFor":      { en: "Prepared For",  ko: "견적 대상",  zh: "报价对象",   ja: "見積先" },
  "quoteItems":       { en: "Quote Items",   ko: "견적 항목",  zh: "报价项目",   ja: "見積項目" },
  "unit":             { en: "Unit",          ko: "단가",       zh: "单价",       ja: "単価" },
  "qty":              { en: "Qty",           ko: "수량",       zh: "数量",       ja: "数量" },
  "total":            { en: "Total",         ko: "합계",       zh: "合计",       ja: "合計" },
  "validUntil":       { en: "Valid until",   ko: "유효 기한",  zh: "有效期至",   ja: "有効期限" },
  "prepared":         { en: "Prepared",      ko: "작성일",     zh: "制作日期",   ja: "作成日" },
  "noItems":          { en: "No items",      ko: "항목 없음",  zh: "无项目",     ja: "項目なし" },

  "contract.heading": { en: "Accommodation Agreement", ko: "숙박 계약서",       zh: "住宿协议",     ja: "宿泊契約書" },
  "parties":          { en: "Parties",                 ko: "당사자",            zh: "双方",         ja: "当事者" },
  "landlord":         { en: "Landlord / Provider",     ko: "임대인 / 제공자",   zh: "房东 / 提供方", ja: "貸主 / 提供者" },
  "tenant":           { en: "Tenant",                  ko: "임차인",            zh: "租客",         ja: "借主" },
  "premisesTerm":     { en: "Premises & Term",         ko: "임대 대상 및 기간", zh: "房源与租期",   ja: "物件と期間" },
  "premises":         { en: "Premises",                ko: "임대 대상",         zh: "房源",         ja: "物件" },
  "product":          { en: "Product",                 ko: "상품",              zh: "产品",         ja: "商品" },
  "startDate":        { en: "Start Date",              ko: "시작일",            zh: "开始日期",     ja: "開始日" },
  "endDate":          { en: "End Date",                ko: "종료일",            zh: "结束日期",     ja: "終了日" },
  "financials":       { en: "Financials",              ko: "비용",              zh: "费用",         ja: "費用" },
  "weeklyRate":       { en: "Weekly Rate",             ko: "주당 요금",         zh: "每周租金",     ja: "週額料金" },
  "totalRent":        { en: "Total Rent",              ko: "총 임대료",         zh: "总租金",       ja: "総賃料" },
  "bond":             { en: "Bond",                    ko: "보증금",            zh: "押金",         ja: "敷金" },
  "advance":          { en: "Advance",                 ko: "선급금",            zh: "预付款",       ja: "前払金" },
  "terms":            { en: "Terms & Conditions",      ko: "약관",              zh: "条款与条件",   ja: "利用規約" },
  "signatures":       { en: "Signatures",              ko: "서명",              zh: "签名",         ja: "署名" },
  "signed":           { en: "Signed",                  ko: "서명일",            zh: "签署日期",     ja: "署名日" },
};

/** Translate a label key into the given language, interpolating {var} tokens. */
export function t(lang: DocLang, key: string, vars?: Record<string, string>): string {
  const entry = LABELS[key];
  let str = entry ? (entry[lang] ?? entry.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
  return str;
}

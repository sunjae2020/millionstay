/**
 * seed-pdf-templates.mjs
 *
 * Idempotently upserts the four editable PDF document templates (kind="pdf")
 * surfaced under Templates Studio → PDF:
 *   pdf.invoice                       — standard payment-terms footer
 *   pdf.quote                         — standard quote/validity footer
 *   pdf.tenancy_agreement             — full tenancy/accommodation terms body
 *   pdf.homestay_placement_agreement  — full homestay placement terms body
 *
 * The PDF endpoints (invoices/quotes/contracts + placement signing) prefer the
 * published `pdf.*` template body, falling back to the legacy contract-kind
 * templates and then to the hardcoded copy — so publishing changes nothing until
 * ops edit a template. Invoice/quote bodies are HTML (injected as a footer note);
 * the agreement bodies are PLAIN TEXT (rendered as escaped paragraphs).
 *
 * Locales: en + ko/ja/zh/th + vi (guest-facing documents ship six locales). The
 * ko/ja/zh/th agreement copy reuses the team-reviewed translations already in
 * doc-template-translations.json (contract.terms / homestay_placement_terms).
 *
 * Usage:  DATABASE_URL=... node scripts/seed-pdf-templates.mjs
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { Pool } = pg;
const __dir = dirname(fileURLToPath(import.meta.url));

// Team-reviewed ko/ja/zh/th translations for the two agreements (best-effort —
// only the locales present are seeded; en + vi are authored below).
let TEAM = {};
try {
  TEAM = JSON.parse(readFileSync(join(__dir, "..", "doc-template-translations.json"), "utf8"));
} catch {
  console.warn("⚠ doc-template-translations.json not found — seeding en + vi only for agreements.");
}
const teamBody = (key, loc) => TEAM?.[key]?.[loc]?.body_html ?? null;

// ── EN agreement bodies (mirror the hardcoded/contract-kind copy) ────────────
const TENANCY_EN = [
  "This Accommodation Agreement is made between MillionStay (or the landlord named above) and the tenant named above.",
  "",
  "1. Premises & term. The landlord agrees to let the premises shown above to the tenant for the term shown above. The tenant agrees to keep the premises in good condition and to comply with the house rules.",
  "",
  "2. Rent & charges. Rent is payable in advance at the rate shown above, as invoiced. Any bond and advance amounts shown above are payable before the start of the term.",
  "",
  "3. Bond. The bond is held as security against damage and unpaid amounts and is refundable at the end of the term subject to no outstanding amounts or damage beyond fair wear and tear.",
  "",
  "4. Use & conduct. The tenant will use the premises only for residential purposes, will not cause nuisance, and will allow reasonable access for inspection and repairs with notice.",
  "",
  "5. Termination. Either party may end this agreement in line with the notice requirements of the applicable residential tenancy laws. Rent is payable up to the move-out date.",
  "",
  "6. Privacy. Personal information is handled in line with MillionStay's Privacy Policy and the Australian Privacy Principles.",
  "",
  "By signing below, each party confirms they have read, understood and agree to these terms.",
].join("\n");

const PLACEMENT_EN = [
  "This Homestay Placement Agreement is made between MillionStay, the host family, and the student (and their guardian, where the student is under 18).",
  "",
  "1. Placement. The host family agrees to provide accommodation and the agreed meal plan to the student for the term shown above. The student agrees to respect the host family's home and house rules.",
  "",
  "2. Fees. The placement fee, deposit and ongoing accommodation fee shown above are payable in advance as invoiced. The deposit is refundable at the end of the placement subject to no outstanding amounts or damage.",
  "",
  "3. Meals & facilities. Meals are provided per the selected package. The student has use of the agreed room and shared facilities.",
  "",
  "4. Conduct & safety. The student will follow reasonable house rules. Where the student is a minor, the host family confirms all adult household members hold a valid Working with Children Check.",
  "",
  "5. Changes & cancellation. Either party may request changes through MillionStay. Cancellation before move-in: the placement fee is non-refundable; the deposit is refunded. After move-in, at least two (2) weeks' written notice is required; fees are pro-rated to the move-out date.",
  "",
  "6. Privacy. Personal information is handled in line with MillionStay's Privacy Policy and the Australian Privacy Principles.",
  "",
  "By signing below, each party confirms they have read, understood and agree to these terms.",
].join("\n");

// ── VI agreement bodies (authored) ───────────────────────────────────────────
const TENANCY_VI = [
  "Thỏa thuận Lưu trú này được lập giữa MillionStay (hoặc bên cho thuê nêu trên) và bên thuê nêu trên.",
  "",
  "1. Nơi ở & thời hạn. Bên cho thuê đồng ý cho bên thuê thuê nơi ở nêu trên trong thời hạn nêu trên. Bên thuê đồng ý giữ gìn nơi ở trong tình trạng tốt và tuân thủ nội quy nhà.",
  "",
  "2. Tiền thuê & chi phí. Tiền thuê được thanh toán trước theo mức nêu trên, theo hóa đơn. Mọi khoản tiền đặt cọc và trả trước nêu trên phải được thanh toán trước khi bắt đầu thời hạn.",
  "",
  "3. Tiền đặt cọc. Tiền đặt cọc được giữ để bảo đảm cho các hư hỏng và khoản chưa thanh toán, và được hoàn lại khi kết thúc thời hạn nếu không còn khoản nợ hoặc hư hỏng vượt quá hao mòn thông thường.",
  "",
  "4. Sử dụng & ứng xử. Bên thuê chỉ sử dụng nơi ở cho mục đích cư trú, không gây phiền hà, và cho phép tiếp cận hợp lý để kiểm tra và sửa chữa khi có thông báo.",
  "",
  "5. Chấm dứt. Mỗi bên có thể chấm dứt thỏa thuận này theo yêu cầu về thời hạn thông báo của pháp luật về thuê nhà ở hiện hành. Tiền thuê phải được thanh toán đến ngày chuyển đi.",
  "",
  "6. Quyền riêng tư. Thông tin cá nhân được xử lý theo Chính sách Bảo mật của MillionStay và các Nguyên tắc Bảo mật của Úc.",
  "",
  "Bằng việc ký tên dưới đây, mỗi bên xác nhận đã đọc, hiểu và đồng ý với các điều khoản này.",
].join("\n");

const PLACEMENT_VI = [
  "Thỏa thuận Bố trí Homestay này được lập giữa MillionStay, gia đình bản xứ và học sinh (và người giám hộ, nếu học sinh dưới 18 tuổi).",
  "",
  "1. Bố trí. Gia đình bản xứ đồng ý cung cấp chỗ ở và gói bữa ăn đã thỏa thuận cho học sinh trong thời hạn nêu trên. Học sinh đồng ý tôn trọng ngôi nhà và nội quy của gia đình bản xứ.",
  "",
  "2. Phí. Phí bố trí, tiền đặt cọc và phí lưu trú định kỳ nêu trên được thanh toán trước theo hóa đơn. Tiền đặt cọc được hoàn lại khi kết thúc thời gian lưu trú nếu không còn khoản nợ hoặc hư hỏng.",
  "",
  "3. Bữa ăn & tiện nghi. Bữa ăn được cung cấp theo gói đã chọn. Học sinh được sử dụng phòng đã thỏa thuận và các tiện nghi chung.",
  "",
  "4. Ứng xử & an toàn. Học sinh tuân thủ nội quy nhà hợp lý. Trong trường hợp học sinh là trẻ vị thành niên, gia đình bản xứ xác nhận tất cả thành viên trưởng thành trong nhà đều có Giấy kiểm tra Làm việc với Trẻ em (Working with Children Check) hợp lệ.",
  "",
  "5. Thay đổi & hủy. Mỗi bên có thể yêu cầu thay đổi thông qua MillionStay. Hủy trước khi nhận chỗ: phí bố trí không hoàn lại; tiền đặt cọc được hoàn lại. Sau khi nhận chỗ, cần thông báo bằng văn bản ít nhất hai (2) tuần; phí được tính theo tỷ lệ đến ngày chuyển đi.",
  "",
  "6. Quyền riêng tư. Thông tin cá nhân được xử lý theo Chính sách Bảo mật của MillionStay và các Nguyên tắc Bảo mật của Úc.",
  "",
  "Bằng việc ký tên dưới đây, mỗi bên xác nhận đã đọc, hiểu và đồng ý với các điều khoản này.",
].join("\n");

// ── Invoice / quote footer notes (HTML, all six locales) ─────────────────────
const INVOICE_NOTE = {
  en: "<p><strong>Payment terms.</strong> Please settle this invoice by the due date shown above using reference {{ref}}. We accept card and bank transfer; a 2% surcharge applies to card payments. For billing questions, contact us at the email shown below.</p>",
  ko: "<p><strong>결제 안내.</strong> 본 청구서는 상기 지급 기한까지 참조번호 {{ref}}로 결제해 주세요. 카드 및 계좌이체가 가능하며, 카드 결제 시 2% 수수료가 부과됩니다. 청구 관련 문의는 하단 이메일로 연락 주세요.</p>",
  ja: "<p><strong>お支払いについて.</strong> 本請求書は、上記の支払期限までに参照番号 {{ref}} にてお支払いください。カードおよび銀行振込に対応しています（カード決済には2%の手数料がかかります）。ご請求に関するお問い合わせは下記メールまでご連絡ください。</p>",
  zh: "<p><strong>付款说明。</strong>请在上述到期日前使用参考号 {{ref}} 支付本发票。我们接受银行卡和银行转账；银行卡支付将收取 2% 手续费。如有账单疑问，请通过下方邮箱联系我们。</p>",
  th: "<p><strong>เงื่อนไขการชำระเงิน</strong> กรุณาชำระใบแจ้งหนี้นี้ภายในวันครบกำหนดข้างต้นโดยอ้างอิงหมายเลข {{ref}} เรารับชำระด้วยบัตรและการโอนผ่านธนาคาร (การชำระด้วยบัตรมีค่าธรรมเนียมเพิ่ม 2%) หากมีคำถามเกี่ยวกับการเรียกเก็บเงิน โปรดติดต่อเราที่อีเมลด้านล่าง</p>",
  vi: "<p><strong>Điều khoản thanh toán.</strong> Vui lòng thanh toán hóa đơn này trước ngày đến hạn nêu trên, sử dụng mã tham chiếu {{ref}}. Chúng tôi chấp nhận thẻ và chuyển khoản ngân hàng; thanh toán bằng thẻ chịu phụ phí 2%. Mọi thắc mắc về hóa đơn, vui lòng liên hệ qua email bên dưới.</p>",
};

const QUOTE_NOTE = {
  en: "<p><strong>About this quote.</strong> This quotation is an estimate and is valid until {{valid_until}}. Prices are shown in the currency above and may change after the validity date. To proceed, reply to this quote or contact us using the details below.</p>",
  ko: "<p><strong>견적 안내.</strong> 본 견적은 예상 금액이며 {{valid_until}}까지 유효합니다. 금액은 상기 통화로 표시되며 유효 기한 이후 변경될 수 있습니다. 진행을 원하시면 본 견적에 회신하시거나 하단 연락처로 문의해 주세요.</p>",
  ja: "<p><strong>お見積りについて.</strong> 本見積は概算であり、{{valid_until}} まで有効です。金額は上記の通貨で表示され、有効期限以降は変更される場合があります。お手続きをご希望の場合は、本見積にご返信いただくか、下記の連絡先までお問い合わせください。</p>",
  zh: "<p><strong>报价说明。</strong>本报价为估算金额，有效期至 {{valid_until}}。金额以上述货币显示，有效期后可能发生变化。如需继续，请回复本报价或通过下方联系方式与我们联系。</p>",
  th: "<p><strong>เกี่ยวกับใบเสนอราคานี้</strong> ใบเสนอราคานี้เป็นการประมาณการและใช้ได้ถึง {{valid_until}} ราคาแสดงเป็นสกุลเงินข้างต้นและอาจเปลี่ยนแปลงได้หลังวันหมดอายุ หากต้องการดำเนินการต่อ กรุณาตอบกลับใบเสนอราคานี้หรือติดต่อเราตามรายละเอียดด้านล่าง</p>",
  vi: "<p><strong>Về báo giá này.</strong> Báo giá này là ước tính và có hiệu lực đến {{valid_until}}. Giá được hiển thị bằng đơn vị tiền tệ nêu trên và có thể thay đổi sau ngày hết hiệu lực. Để tiếp tục, vui lòng trả lời báo giá này hoặc liên hệ với chúng tôi theo thông tin bên dưới.</p>",
};

const TEMPLATES = [
  {
    key: "pdf.invoice", name: "Invoice — PDF document", category: "Documents",
    vars: { ref: { type: "string" }, due_date: { type: "date" } },
    bodies: INVOICE_NOTE,
  },
  {
    key: "pdf.quote", name: "Quote — PDF document", category: "Documents",
    vars: { ref: { type: "string" }, valid_until: { type: "date" } },
    bodies: QUOTE_NOTE,
  },
  {
    key: "pdf.tenancy_agreement", name: "Tenancy/Accommodation Agreement — PDF terms", category: "Documents",
    vars: {},
    bodies: {
      en: TENANCY_EN, vi: TENANCY_VI,
      ko: teamBody("contract.terms", "ko"), ja: teamBody("contract.terms", "ja"),
      zh: teamBody("contract.terms", "zh"), th: teamBody("contract.terms", "th"),
    },
  },
  {
    key: "pdf.homestay_placement_agreement", name: "Homestay Placement Agreement — PDF terms", category: "Homestay",
    vars: {},
    bodies: {
      en: PLACEMENT_EN, vi: PLACEMENT_VI,
      ko: teamBody("homestay_placement_terms", "ko"), ja: teamBody("homestay_placement_terms", "ja"),
      zh: teamBody("homestay_placement_terms", "zh"), th: teamBody("homestay_placement_terms", "th"),
    },
  },
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
try {
  for (const tpl of TEMPLATES) {
    const up = await c.query(
      `INSERT INTO document_templates (kind, key, name, category, variables_schema, status, version)
       VALUES ('pdf',$1,$2,$3,$4::jsonb,'published',1)
       ON CONFLICT (kind, key) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category,
         variables_schema=EXCLUDED.variables_schema, status='published', updated_at=now()
       RETURNING id`,
      [tpl.key, tpl.name, tpl.category, JSON.stringify(tpl.vars)],
    );
    const id = up.rows[0].id;
    let locales = 0;
    for (const [loc, body] of Object.entries(tpl.bodies)) {
      if (!body) continue;
      await c.query(
        `INSERT INTO document_template_translations (template_id, locale, subject, body_html)
         VALUES ($1,$2,NULL,$3)
         ON CONFLICT (template_id, locale) DO UPDATE SET body_html=EXCLUDED.body_html, updated_at=now()`,
        [id, loc, body],
      );
      locales++;
    }
    console.log(`✓ pdf/${tpl.key} (#${id}) — ${locales} locales`);
  }
  console.log(`Seeded ${TEMPLATES.length} PDF templates.`);
} finally {
  c.release();
  await pool.end();
}

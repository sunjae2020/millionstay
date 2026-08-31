/**
 * seed-metheim-document-templates.mjs
 *
 * Seeds the Metheim (Korea short/long-term stay) document/email/contract
 * templates into document_templates / document_template_translations, Korean
 * FIRST + full multilingual (ko/en/ja/zh/th/vi), status=published.
 *
 * Metheim is a Korea-based instance: no homestay module, KRW pricing, Korean
 * legal basis (「개인정보 보호법」, not the Australian Privacy Principles). This
 * seed therefore:
 *   1. Upserts Metheim-appropriate copy for the shared, wired template keys —
 *        email.invoice / email.receipt / email.contract   (cover-email notes)
 *        contract.terms                                    (legacy terms fallback)
 *        pdf.invoice / pdf.receipt / pdf.quote             (footer notes)
 *        pdf.tenancy_agreement                             (full terms body)
 *      with `ko` as the primary locale and en/ja/zh/th/vi filled in. The DEFAULT
 *      document language for Metheim is `ko` (DEFAULT_DOC_LANG=ko), so a document
 *      with no explicit `?lang=` renders in Korean.
 *   2. Removes the homestay-only templates the primary seed ships (homestay.*
 *      emails, homestay_placement_terms, pdf.homestay_placement_agreement) so
 *      they don't clutter the Templates Studio on a tenant with no homestay.
 *
 * The issuer block (company name, 사업자등록번호, 대표자, address, logo, email) is
 * resolved at RENDER time from Settings → Organisation (company_info) — this seed
 * only carries the body copy; company details are never baked in, so changing the
 * org profile updates every document automatically.
 *
 * The Korean tenancy-terms body was polished via the humanize-korean pass
 * (run 2026-07-27-001, grade A) — do not re-machine-translate it from English.
 *
 * Usage:  DATABASE_URL=<metheim> node scripts/seed-metheim-document-templates.mjs --apply
 *         (Metheim DB 전용 가드 내장; 기본은 dry-run — --apply 없이는 아무것도 쓰지 않는다)
 *         (add KEEP_HOMESTAY=1 to skip the homestay-template cleanup)
 */
import pg from "pg";
import { guardDbInstance, confirmWrite } from "../../../scripts/lib/dbGuard.mjs";

const { Pool } = pg;

// ── Standard tenancy/accommodation terms (plain text; escaped→paragraphs) ─────
// Referenced parties are generic ("회사"/"이용자") so the copy never names a brand;
// the actual landlord/company is filled from the org profile at render time.
const TERMS = {
  ko: [
    '제1조 (목적 및 당사자) 본 계약은 공간을 제공하는 임대인(이하 "회사")과 이를 이용하는 임차인(이하 "이용자") 사이에 상기 표시된 공간의 이용에 관한 권리와 의무를 정합니다.',
    "",
    "제2조 (이용 기간 및 대상) 회사는 상기 기간 동안 표시된 공간을 이용자에게 제공하며, 이용자는 선량한 관리자의 주의로 공간을 사용하고 건물 관리 규정과 입주 수칙을 지킵니다.",
    "",
    "제3조 (이용료 및 납부) 이용자는 상기 표시된 이용료(월 이용료와 관리비 포함)를 청구서에 따라 선납합니다. 보증금과 선급금은 이용을 시작하기 전까지 냅니다.",
    "",
    "제4조 (보증금) 보증금은 공간의 손상이나 미납 금액을 담보하기 위해 회사가 보관합니다. 통상적인 사용에 따른 자연 마모를 제외하고 손상이나 미납 금액이 없으면 이용이 끝날 때 돌려드립니다.",
    "",
    "제5조 (이용자의 의무) 이용자는 공간을 주거(체류) 목적으로만 사용하고, 다른 사람에게 피해를 주지 않으며, 미리 알린 점검이나 수리를 위한 합리적인 출입에 협조합니다.",
    "",
    "제6조 (계약의 해지) 각 당사자는 관련 법령과 본 계약에서 정한 통지 기간에 따라 계약을 해지할 수 있고, 이용료는 실제 퇴실일까지 정산합니다.",
    "",
    "제7조 (개인정보) 회사는 이용자의 개인정보를 「개인정보 보호법」과 회사의 개인정보처리방침에 따라 처리합니다.",
    "",
    "이용자와 회사는 위 내용을 충분히 읽고 이해하였으며, 아래에 서명하여 이에 동의합니다.",
  ].join("\n"),
  en: [
    'Article 1 (Purpose & Parties) This agreement sets out the rights and obligations regarding use of the space shown above, between the provider of the space (the "Company") and the person using it (the "User").',
    "",
    "Article 2 (Term & Premises) The Company provides the space shown above to the User for the term shown above. The User shall use the space with the care of a good manager and comply with the building management rules and move-in guidelines.",
    "",
    "Article 3 (Fees & Payment) The User shall pay the fees shown above (including the monthly fee and maintenance charges) in advance as invoiced. The deposit and any advance payment are due before the start of use.",
    "",
    "Article 4 (Deposit) The Company holds the deposit as security against damage to the space or unpaid amounts. Except for natural wear and tear from ordinary use, the deposit is refunded at the end of use where there is no damage or unpaid amount.",
    "",
    "Article 5 (User's Obligations) The User shall use the space for residential (stay) purposes only, shall not cause harm to others, and shall cooperate with reasonable access for inspection or repairs given prior notice.",
    "",
    "Article 6 (Termination) Either party may terminate this agreement in accordance with the applicable laws and the notice period set out in this agreement. Fees are settled up to the actual move-out date.",
    "",
    "Article 7 (Personal Information) The Company processes the User's personal information in accordance with the Personal Information Protection Act and the Company's Privacy Policy.",
    "",
    "The User and the Company confirm that they have fully read and understood the above, and agree to it by signing below.",
  ].join("\n"),
  ja: [
    "第1条（目的および当事者）本契約は、空間を提供する貸主（以下「会社」）と、これを利用する借主（以下「利用者」）との間で、上記に表示された空間の利用に関する権利と義務を定めます。",
    "",
    "第2条（利用期間および対象）会社は上記の期間中、表示された空間を利用者に提供し、利用者は善良な管理者の注意をもって空間を使用し、建物管理規定および入居規則を遵守します。",
    "",
    "第3条（利用料および支払い）利用者は、上記に表示された利用料（月額利用料および管理費を含む）を請求書に従い前納します。保証金および前払金は、利用開始前までに支払います。",
    "",
    "第4条（保証金）保証金は、空間の損傷または未納金額を担保するため会社が保管します。通常の使用による自然損耗を除き、損傷や未納金額がない場合は、利用終了時に返金します。",
    "",
    "第5条（利用者の義務）利用者は空間を居住（滞在）目的のみに使用し、他人に迷惑を及ぼさず、事前に通知された点検または修理のための合理的な立ち入りに協力します。",
    "",
    "第6条（契約の解除）各当事者は、関係法令および本契約で定めた通知期間に従い契約を解除でき、利用料は実際の退去日まで精算します。",
    "",
    "第7条（個人情報）会社は利用者の個人情報を「個人情報保護法」および会社のプライバシーポリシーに従い取り扱います。",
    "",
    "利用者と会社は上記の内容を十分に読み理解し、下記に署名してこれに同意します。",
  ].join("\n"),
  zh: [
    "第1条（目的与当事人）本合同旨在规定提供空间的出租方（以下称“公司”）与使用该空间的承租方（以下称“用户”）之间，关于使用上述空间的权利与义务。",
    "",
    "第2条（使用期限与对象）公司在上述期限内向用户提供所示空间，用户应以善良管理人的注意使用该空间，并遵守建筑管理规定及入住守则。",
    "",
    "第3条（使用费与付款）用户应按账单预先支付上述使用费（含月使用费及管理费）。保证金及预付款应在开始使用前支付。",
    "",
    "第4条（保证金）保证金由公司保管，作为空间损坏或欠款的担保。除正常使用产生的自然磨损外，如无损坏或欠款，使用结束时予以退还。",
    "",
    "第5条（用户义务）用户应仅将空间用于居住（停留）目的，不得妨害他人，并应在事先通知的情况下，配合为检查或维修而进行的合理进入。",
    "",
    "第6条（合同解除）任何一方均可依照相关法律及本合同约定的通知期限解除合同，使用费结算至实际退房日为止。",
    "",
    "第7条（个人信息）公司依照《个人信息保护法》及公司隐私政策处理用户的个人信息。",
    "",
    "用户与公司确认已充分阅读并理解上述内容，并在下方签名以示同意。",
  ].join("\n"),
  th: [
    'ข้อ 1 (วัตถุประสงค์และคู่สัญญา) สัญญานี้กำหนดสิทธิและหน้าที่เกี่ยวกับการใช้พื้นที่ตามที่ระบุข้างต้น ระหว่างผู้ให้บริการพื้นที่ (ต่อไปนี้เรียกว่า "บริษัท") กับผู้ใช้พื้นที่ (ต่อไปนี้เรียกว่า "ผู้ใช้")',
    "",
    "ข้อ 2 (ระยะเวลาและพื้นที่) บริษัทจัดหาพื้นที่ตามที่ระบุข้างต้นให้แก่ผู้ใช้ตามระยะเวลาที่ระบุข้างต้น ผู้ใช้ต้องใช้พื้นที่ด้วยความระมัดระวังเยี่ยงผู้จัดการที่ดี และปฏิบัติตามระเบียบการจัดการอาคารและข้อปฏิบัติในการเข้าพัก",
    "",
    "ข้อ 3 (ค่าใช้บริการและการชำระเงิน) ผู้ใช้ต้องชำระค่าใช้บริการตามที่ระบุข้างต้น (รวมค่าบริการรายเดือนและค่าส่วนกลาง) ล่วงหน้าตามใบแจ้งหนี้ เงินประกันและเงินล่วงหน้าต้องชำระก่อนเริ่มการใช้งาน",
    "",
    "ข้อ 4 (เงินประกัน) บริษัทเก็บรักษาเงินประกันไว้เป็นหลักประกันความเสียหายของพื้นที่หรือยอดค้างชำระ ยกเว้นการสึกหรอตามธรรมชาติจากการใช้งานปกติ หากไม่มีความเสียหายหรือยอดค้างชำระ จะคืนเงินประกันเมื่อสิ้นสุดการใช้งาน",
    "",
    "ข้อ 5 (หน้าที่ของผู้ใช้) ผู้ใช้ต้องใช้พื้นที่เพื่อการพักอาศัย (พำนัก) เท่านั้น ต้องไม่ก่อความเดือดร้อนแก่ผู้อื่น และให้ความร่วมมือในการเข้าตรวจสอบหรือซ่อมแซมตามสมควรเมื่อได้รับแจ้งล่วงหน้า",
    "",
    "ข้อ 6 (การสิ้นสุดสัญญา) คู่สัญญาฝ่ายใดฝ่ายหนึ่งอาจบอกเลิกสัญญาได้ตามกฎหมายที่เกี่ยวข้องและระยะเวลาบอกกล่าวที่กำหนดในสัญญานี้ ค่าใช้บริการจะคำนวณจนถึงวันย้ายออกจริง",
    "",
    "ข้อ 7 (ข้อมูลส่วนบุคคล) บริษัทจัดการข้อมูลส่วนบุคคลของผู้ใช้ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคลและนโยบายความเป็นส่วนตัวของบริษัท",
    "",
    "ผู้ใช้และบริษัทยืนยันว่าได้อ่านและเข้าใจเนื้อหาข้างต้นอย่างครบถ้วนแล้ว และตกลงยินยอมโดยการลงนามด้านล่าง",
  ].join("\n"),
  vi: [
    'Điều 1 (Mục đích và các bên) Thỏa thuận này quy định quyền và nghĩa vụ liên quan đến việc sử dụng không gian nêu trên, giữa bên cung cấp không gian (sau đây gọi là "Công ty") và bên sử dụng không gian (sau đây gọi là "Người sử dụng").',
    "",
    "Điều 2 (Thời hạn và đối tượng) Công ty cung cấp không gian nêu trên cho Người sử dụng trong thời hạn nêu trên. Người sử dụng phải sử dụng không gian với sự cẩn trọng của một người quản lý mẫn cán và tuân thủ quy định quản lý tòa nhà cũng như nội quy nhận phòng.",
    "",
    "Điều 3 (Phí sử dụng và thanh toán) Người sử dụng thanh toán trước các khoản phí nêu trên (bao gồm phí sử dụng hàng tháng và phí quản lý) theo hóa đơn. Tiền đặt cọc và khoản trả trước phải được thanh toán trước khi bắt đầu sử dụng.",
    "",
    "Điều 4 (Tiền đặt cọc) Công ty giữ tiền đặt cọc làm bảo đảm cho hư hỏng của không gian hoặc khoản chưa thanh toán. Ngoại trừ hao mòn tự nhiên do sử dụng thông thường, nếu không có hư hỏng hoặc khoản chưa thanh toán, tiền đặt cọc sẽ được hoàn lại khi kết thúc việc sử dụng.",
    "",
    "Điều 5 (Nghĩa vụ của Người sử dụng) Người sử dụng chỉ sử dụng không gian cho mục đích cư trú (lưu trú), không gây phiền hà cho người khác, và hợp tác cho việc ra vào hợp lý để kiểm tra hoặc sửa chữa khi được thông báo trước.",
    "",
    "Điều 6 (Chấm dứt thỏa thuận) Mỗi bên có thể chấm dứt thỏa thuận này theo quy định của pháp luật liên quan và thời hạn thông báo nêu trong thỏa thuận này. Phí sử dụng được quyết toán đến ngày chuyển đi thực tế.",
    "",
    "Điều 7 (Thông tin cá nhân) Công ty xử lý thông tin cá nhân của Người sử dụng theo Luật Bảo vệ Thông tin Cá nhân và Chính sách Bảo mật của Công ty.",
    "",
    "Người sử dụng và Công ty xác nhận đã đọc và hiểu đầy đủ nội dung trên, và đồng ý bằng cách ký tên dưới đây.",
  ].join("\n"),
};

// ── Invoice / receipt / quote footer notes (HTML, six locales) ────────────────
const INVOICE_NOTE = {
  ko: "<p><strong>결제 안내.</strong> 본 청구서는 상기 지급 기한까지 참조번호 {{ref}}로 결제해 주시기 바랍니다. 계좌이체 또는 카드로 결제하실 수 있습니다. 청구 내역에 관한 문의는 아래 이메일로 연락 주십시오.</p>",
  en: "<p><strong>Payment.</strong> Please settle this invoice by the due date shown above using reference {{ref}}. You may pay by bank transfer or card. For any questions about your bill, contact us at the email below.</p>",
  ja: "<p><strong>お支払いについて。</strong> 本請求書は、上記の支払期限までに参照番号 {{ref}} にてお支払いください。銀行振込またはカードでのお支払いが可能です。ご請求内容に関するお問い合わせは、下記メールまでご連絡ください。</p>",
  zh: "<p><strong>付款说明。</strong>请在上述到期日前使用参考号 {{ref}} 支付本账单。您可通过银行转账或银行卡付款。如对账单有疑问，请通过下方邮箱联系我们。</p>",
  th: "<p><strong>การชำระเงิน</strong> กรุณาชำระใบแจ้งหนี้นี้ภายในวันครบกำหนดข้างต้นโดยอ้างอิงหมายเลข {{ref}} ท่านสามารถชำระผ่านการโอนเงินหรือบัตรได้ หากมีคำถามเกี่ยวกับใบแจ้งหนี้ กรุณาติดต่อเราที่อีเมลด้านล่าง</p>",
  vi: "<p><strong>Thanh toán.</strong> Vui lòng thanh toán hóa đơn này trước ngày đến hạn nêu trên, sử dụng mã tham chiếu {{ref}}. Bạn có thể thanh toán bằng chuyển khoản ngân hàng hoặc thẻ. Mọi thắc mắc về hóa đơn, vui lòng liên hệ qua email bên dưới.</p>",
};

const RECEIPT_NOTE = {
  ko: "<p><strong>결제해 주셔서 감사합니다.</strong> 본 영수증은 참조번호 {{ref}}에 대한 결제가 정상적으로 완료되었음을 확인해 드립니다. 증빙 자료로 보관해 주시기 바라며, 추가로 처리하실 사항은 없습니다.</p>",
  en: "<p><strong>Thank you for your payment.</strong> This receipt confirms that payment for reference {{ref}} has been completed in full. Please keep it for your records; no further action is needed.</p>",
  ja: "<p><strong>お支払いありがとうございます。</strong> 本領収書は、参照番号 {{ref}} に対するお支払いが正常に完了したことを確認するものです。証憑として保管ください。これ以上のお手続きは必要ありません。</p>",
  zh: "<p><strong>感谢您的付款。</strong>本收据确认参考号 {{ref}} 的款项已全额结清。请妥善保存以备存档，您无需采取进一步操作。</p>",
  th: "<p><strong>ขอบคุณสำหรับการชำระเงิน</strong> ใบเสร็จนี้ยืนยันว่าการชำระเงินตามหมายเลขอ้างอิง {{ref}} เสร็จสมบูรณ์แล้ว กรุณาเก็บไว้เป็นหลักฐาน โดยไม่ต้องดำเนินการใด ๆ เพิ่มเติม</p>",
  vi: "<p><strong>Cảm ơn bạn đã thanh toán.</strong> Biên nhận này xác nhận khoản thanh toán theo mã tham chiếu {{ref}} đã hoàn tất. Vui lòng giữ lại để lưu hồ sơ; bạn không cần thực hiện thêm thao tác nào.</p>",
};

const QUOTE_NOTE = {
  ko: "<p><strong>견적 안내.</strong> 본 견적은 예상 금액이며 {{valid_until}}까지 유효합니다. 금액은 상기 통화 기준이며 유효 기한이 지나면 변동될 수 있습니다. 진행을 원하시면 본 견적서에 회신하시거나 아래 연락처로 문의해 주십시오.</p>",
  en: "<p><strong>About this quote.</strong> This quotation is an estimate and is valid until {{valid_until}}. Amounts are in the currency shown above and may change after the validity date. To proceed, reply to this quote or contact us using the details below.</p>",
  ja: "<p><strong>お見積りについて。</strong> 本見積は概算であり、{{valid_until}} まで有効です。金額は上記の通貨によるもので、有効期限を過ぎると変更される場合があります。お手続きをご希望の場合は、本見積にご返信いただくか、下記の連絡先までお問い合わせください。</p>",
  zh: "<p><strong>报价说明。</strong>本报价为估算金额，有效期至 {{valid_until}}。金额以上述货币计，有效期后可能变动。如需继续，请回复本报价或通过下方联系方式与我们联系。</p>",
  th: "<p><strong>เกี่ยวกับใบเสนอราคานี้</strong> ใบเสนอราคานี้เป็นการประมาณการและใช้ได้ถึง {{valid_until}} จำนวนเงินเป็นสกุลเงินข้างต้นและอาจเปลี่ยนแปลงได้หลังวันหมดอายุ หากต้องการดำเนินการต่อ กรุณาตอบกลับใบเสนอราคานี้หรือติดต่อเราตามรายละเอียดด้านล่าง</p>",
  vi: "<p><strong>Về báo giá này.</strong> Báo giá này là ước tính và có hiệu lực đến {{valid_until}}. Số tiền theo đơn vị tiền tệ nêu trên và có thể thay đổi sau ngày hết hiệu lực. Để tiếp tục, vui lòng trả lời báo giá này hoặc liên hệ với chúng tôi theo thông tin bên dưới.</p>",
};

// Move-out confirmation residence-transfer notice (printed under the settlement table).
// 3번 안내사항 본문 — `scripts/print-move-out-guide.mjs` 산출물.
// 문구 수정은 lib/documents/i18n.ts 의 moveout.guide.* 에서 하고 스크립트를 다시 돌린다.
const MOVE_OUT_NOTE = {
  en: `<div class="mo-guide-group">
        <div class="mo-guide-title">■ Submitting your refund account : <span class="mo-guide-lead">The balance C ({{refund_amount}}) above is returned to a bank account held in the tenant&#39;s own name.</span></div>
        <div class="mo-guide-item">· Documents required: 1 copy of the bankbook / account details in the tenant&#39;s name.</div><div class="mo-guide-item">· How to submit: hand it in at the management office, or send it to {{contact_phone}}.</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ Move-out report &amp; resident registration :</div>
        <div class="mo-guide-item">· If you registered your residence at this address, file the move-out report once the deposit refund is confirmed.</div><div class="mo-guide-item">· Failing to do so may restrict the following tenant&#39;s move-in registration and cause related disadvantages.</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ Utility settlement notes :</div>
        <div class="mo-guide-item">· Gas: apply for disconnection directly with the city gas provider and pay the charges up to the move-out date.</div><div class="mo-guide-item">· Management fees: any additional amount arising after settlement may be billed separately.</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ Restoration &amp; key return :</div>
        <div class="mo-guide-item">· Reset the entrance door PIN to {{door_password}}, and return all card keys and equipment remotes to the management office.</div>
      </div>`,
  ko: `<div class="mo-guide-group">
        <div class="mo-guide-title">■ 보증금 반환 계좌 제출 안내 : <span class="mo-guide-lead">상기 차액 C({{refund_amount}})는 계약자 명의 통장으로 반환됩니다.</span></div>
        <div class="mo-guide-item">· 제출 서류: 계약자 명의 통장 사본 1부</div><div class="mo-guide-item">· 제출 방법: 관리사무소 방문 제출 또는 {{contact_phone}} 문자전송</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ 전출신고 및 주민등록 이전 의무 :</div>
        <div class="mo-guide-item">· 기존에 전입신고를 하신 세대는 보증금 반환 확인 후 주소지 &#39;전출신고&#39;를 완료하셔야 합니다.</div><div class="mo-guide-item">· 미전출 시 후속 입주자의 전입신고 제한 및 관련 불이익이 발생할 수 있습니다.</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ 공과금 정산 관련 주의사항 :</div>
        <div class="mo-guide-item">· 가스비: 도시가스사에 직접 해지 신청(계량기 검침) 후 퇴거일까지의 요금을 직접 납부하셔야 합니다.</div><div class="mo-guide-item">· 관리비: 정산일 이후 추가 발생분이 있는 경우 별도 청구될 수 있습니다.</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ 시설물 원상복구 및 열쇠 반납 :</div>
        <div class="mo-guide-item">· 세대 출입문 비밀번호 {{door_password}}로 변경 및 카드키, 시설물 리모컨 등을 관리사무소에 전량 반납하셔야 합니다.</div>
      </div>`,
  ja: `<div class="mo-guide-group">
        <div class="mo-guide-title">■ 保証金返還口座のご提出案内 : <span class="mo-guide-lead">上記差額 C（{{refund_amount}}）は契約者名義の口座へ返還されます。</span></div>
        <div class="mo-guide-item">· 提出書類：契約者名義の通帳の写し 1 部</div><div class="mo-guide-item">· 提出方法：管理事務所へのご持参、または {{contact_phone}} へのSMS送信</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ 転出届および住民登録移転の義務 :</div>
        <div class="mo-guide-item">· 転入届を提出された世帯は、保証金の返還確認後に住所地の「転出届」を完了してください。</div><div class="mo-guide-item">· 未転出の場合、今後の入居者の転入届が制限されるなどの不利益が生じる可能性があります。</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ 公共料金精算に関する注意事項 :</div>
        <div class="mo-guide-item">· ガス料金：都市ガス会社へ直接解約を申請（検針）し、退去日までの料金をご負担ください。</div><div class="mo-guide-item">· 管理費：精算日以降に追加発生分がある場合、別途請求されることがあります。</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ 設備の原状回復および鍵の返却 :</div>
        <div class="mo-guide-item">· 玄関の暗証番号を {{door_password}} に変更のうえ、カードキー・設備リモコン等はすべて管理事務所へご返却ください。</div>
      </div>`,
  zh: `<div class="mo-guide-group">
        <div class="mo-guide-title">■ 退还账户提交须知 : <span class="mo-guide-lead">上述差额 C（{{refund_amount}}）将退还至承租人本人名下账户。</span></div>
        <div class="mo-guide-item">· 所需材料：承租人名下存折复印件 1 份</div><div class="mo-guide-item">· 提交方式：到管理办公室递交，或发送至 {{contact_phone}}。</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ 迁出登记及户籍迁移义务 :</div>
        <div class="mo-guide-item">· 如已办理迁入登记，请在确认押金退还后完成“迁出登记”。</div><div class="mo-guide-item">· 未办理迁出可能导致后续入住者迁入受限及相关不利影响。</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ 公共费用结算注意事项 :</div>
        <div class="mo-guide-item">· 燃气费：请自行向燃气公司申请解约（抄表），并支付至退租日的费用。</div><div class="mo-guide-item">· 管理费：结算日之后如有额外产生费用，可另行收取。</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ 设施恢复原状及钥匙归还 :</div>
        <div class="mo-guide-item">· 请将入户门密码改回 {{door_password}}，并将门禁卡、设施遥控器等全部交回管理办公室。</div>
      </div>`,
  th: `<div class="mo-guide-group">
        <div class="mo-guide-title">■ การส่งบัญชีรับเงินคืน : <span class="mo-guide-lead">ยอดส่วนต่าง C ({{refund_amount}}) ข้างต้นจะคืนเข้าบัญชีที่เป็นชื่อผู้เช่าเท่านั้น</span></div>
        <div class="mo-guide-item">· เอกสารที่ต้องส่ง: สำเนาสมุดบัญชีในชื่อผู้เช่า 1 ฉบับ</div><div class="mo-guide-item">· วิธีส่ง: ยื่นที่สำนักงานนิติบุคคล หรือส่งมาที่ {{contact_phone}}</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ การแจ้งย้ายออกและย้ายทะเบียนบ้าน :</div>
        <div class="mo-guide-item">· หากเคยแจ้งย้ายเข้าตามที่อยู่นี้ กรุณาแจ้งย้ายออกหลังยืนยันการคืนเงินประกัน</div><div class="mo-guide-item">· หากไม่ดำเนินการ อาจทำให้ผู้เช่ารายถัดไปแจ้งย้ายเข้าไม่ได้และเกิดผลเสียตามมา</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ ข้อควรทราบเรื่องค่าสาธารณูปโภค :</div>
        <div class="mo-guide-item">· ค่าแก๊ส: ติดต่อบริษัทแก๊สเพื่อยกเลิก (จดมิเตอร์) และชำระค่าใช้จ่ายถึงวันย้ายออกด้วยตนเอง</div><div class="mo-guide-item">· ค่าส่วนกลาง: หากมีค่าใช้จ่ายเพิ่มหลังวันชำระบัญชี อาจเรียกเก็บเพิ่มเติม</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ การคืนสภาพและคืนกุญแจ :</div>
        <div class="mo-guide-item">· ตั้งรหัสประตูกลับเป็น {{door_password}} และคืนคีย์การ์ด รีโมตอุปกรณ์ทั้งหมดให้สำนักงานนิติบุคคล</div>
      </div>`,
  vi: `<div class="mo-guide-group">
        <div class="mo-guide-title">■ Nộp tài khoản nhận hoàn tiền : <span class="mo-guide-lead">Khoản chênh lệch C ({{refund_amount}}) nêu trên sẽ được hoàn vào tài khoản đứng tên người thuê.</span></div>
        <div class="mo-guide-item">· Hồ sơ cần nộp: 1 bản sao sổ/thông tin tài khoản đứng tên người thuê.</div><div class="mo-guide-item">· Cách nộp: nộp tại văn phòng quản lý hoặc gửi tới {{contact_phone}}.</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ Nghĩa vụ khai báo chuyển đi :</div>
        <div class="mo-guide-item">· Nếu đã đăng ký cư trú tại địa chỉ này, hãy hoàn tất khai báo chuyển đi sau khi xác nhận hoàn cọc.</div><div class="mo-guide-item">· Nếu không thực hiện, người thuê kế tiếp có thể không đăng ký cư trú được và phát sinh bất lợi liên quan.</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ Lưu ý quyết toán tiện ích :</div>
        <div class="mo-guide-item">· Phí gas: tự liên hệ công ty gas để ngưng dịch vụ (chốt đồng hồ) và thanh toán đến ngày trả phòng.</div><div class="mo-guide-item">· Phí quản lý: nếu phát sinh thêm sau ngày quyết toán, có thể được thu riêng.</div>
      </div><div class="mo-guide-group">
        <div class="mo-guide-title">■ Khôi phục hiện trạng &amp; trả chìa khóa :</div>
        <div class="mo-guide-item">· Đổi mật khẩu cửa về {{door_password}} và trả toàn bộ thẻ từ, điều khiển thiết bị cho văn phòng quản lý.</div>
      </div>`,
};

// ── Cover-email note sentences (plain text; injected into the branded cover) ───
const EMAIL_INVOICE = {
  ko: "청구서를 첨부해 드립니다. 지급 기한은 {{due_date}}이며, 기한 내에 납부해 주시기 바랍니다.",
  en: "Please find your invoice attached. Payment is due by {{due_date}}.",
  ja: "請求書を添付いたします。お支払期限は {{due_date}} です。期限内にお支払いください。",
  zh: "随附您的账单。付款截止日期为 {{due_date}}，请在期限内完成付款。",
  th: "แนบใบแจ้งหนี้ของท่านมาด้วย กำหนดชำระภายในวันที่ {{due_date}} กรุณาชำระภายในกำหนด",
  vi: "Vui lòng xem hóa đơn đính kèm. Hạn thanh toán là {{due_date}}.",
};

const EMAIL_RECEIPT = {
  ko: "결제해 주셔서 감사합니다. 증빙을 위한 영수증을 첨부해 드립니다.",
  en: "Thank you for your payment. A receipt is attached for your records.",
  ja: "お支払いありがとうございます。証憑として領収書を添付いたします。",
  zh: "感谢您的付款。随附收据以供存档。",
  th: "ขอบคุณสำหรับการชำระเงิน แนบใบเสร็จไว้เป็นหลักฐานสำหรับท่าน",
  vi: "Cảm ơn bạn đã thanh toán. Biên nhận được đính kèm để bạn lưu hồ sơ.",
};

const EMAIL_CONTRACT = {
  ko: "계약서를 첨부해 드립니다. 내용을 확인하신 후 이상이 없으시면 서명하여 회신해 주시기 바랍니다.",
  en: "Please review the attached agreement. If everything is correct, sign and return it at your convenience.",
  ja: "契約書を添付いたします。内容をご確認のうえ、問題がなければご署名の上ご返信ください。",
  zh: "随附合同，请查阅。如内容无误，请签署后回复我们。",
  th: "กรุณาตรวจสอบสัญญาที่แนบมา หากถูกต้องครบถ้วน กรุณาลงนามและส่งกลับเมื่อสะดวก",
  vi: "Vui lòng xem lại thỏa thuận đính kèm. Nếu mọi thứ chính xác, hãy ký và gửi lại khi thuận tiện.",
};

const CATEGORY = "문서";

const TEMPLATES = [
  // ── Cover emails (subject left null → localized brand-aware default subject) ──
  { kind: "email", key: "email.invoice", name: "청구서 — 발송 이메일", category: CATEGORY,
    vars: { ref: { type: "string" }, name: { type: "string" }, amount: { type: "string" }, due_date: { type: "date" } },
    bodies: EMAIL_INVOICE },
  { kind: "email", key: "email.receipt", name: "영수증 — 발송 이메일", category: CATEGORY,
    vars: { ref: { type: "string" }, name: { type: "string" }, amount: { type: "string" } },
    bodies: EMAIL_RECEIPT },
  { kind: "email", key: "email.contract", name: "계약서 — 발송 이메일", category: CATEGORY,
    vars: { ref: { type: "string" }, name: { type: "string" }, amount: { type: "string" } },
    bodies: EMAIL_CONTRACT },

  // ── Legacy contract-kind terms (fallback when no pdf.* terms) ─────────────────
  { kind: "contract", key: "contract.terms", name: "숙박·임대차 이용약관 — 기본 약관", category: CATEGORY,
    vars: {}, bodies: TERMS },

  // ── PDF documents ────────────────────────────────────────────────────────────
  { kind: "pdf", key: "pdf.invoice", name: "청구서 — PDF 문서", category: CATEGORY,
    vars: { ref: { type: "string" }, due_date: { type: "date" } }, bodies: INVOICE_NOTE },
  { kind: "pdf", key: "pdf.receipt", name: "영수증 — PDF 문서", category: CATEGORY,
    vars: { ref: { type: "string" } }, bodies: RECEIPT_NOTE },
  { kind: "pdf", key: "pdf.quote", name: "견적서 — PDF 문서", category: CATEGORY,
    vars: { ref: { type: "string" }, valid_until: { type: "date" } }, bodies: QUOTE_NOTE },
  { kind: "pdf", key: "pdf.tenancy_agreement", name: "숙박·임대차 이용약관 — PDF 본문", category: CATEGORY,
    vars: {}, bodies: TERMS },
  { kind: "pdf", key: "pdf.move_out_confirmation", name: "퇴거 세대 정산 확인서 — PDF 문서", category: CATEGORY,
    vars: { ref: { type: "string" }, refund_amount: { type: "string" }, deposit_amount: { type: "string" }, contact_phone: { type: "string" }, door_password: { type: "string" }, unit: { type: "string" }, tenant_name: { type: "string" } }, bodies: MOVE_OUT_NOTE },
];

// Homestay-only templates the primary seed ships. Metheim has no homestay module,
// so remove them (and their translations) unless KEEP_HOMESTAY=1.
const HOMESTAY_KEYS = [
  { kind: "email", key: "homestay.host_received" },
  { kind: "email", key: "homestay.docs_requested" },
  { kind: "email", key: "homestay.approved" },
  { kind: "email", key: "homestay.rejected" },
  { kind: "email", key: "homestay.placement_proposed" },
  { kind: "email", key: "homestay.placement_signed" },
  { kind: "email", key: "homestay.payment_due" },
  { kind: "contract", key: "homestay_placement_terms" },
  { kind: "pdf", key: "pdf.homestay_placement_agreement" },
];

const LOCALES = ["ko", "en", "ja", "zh", "th", "vi"];

// Metheim 전용 시드 — 다른 운영 DB에 붙으면 여기서 멈춘다.
guardDbInstance({ expected: "metheim" });
if (!confirmWrite()) process.exit(0);

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
try {
  for (const tpl of TEMPLATES) {
    const up = await c.query(
      `INSERT INTO document_templates (kind, key, name, category, variables_schema, status, version)
       VALUES ($1,$2,$3,$4,$5::jsonb,'published',1)
       ON CONFLICT (kind, key) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category,
         variables_schema=EXCLUDED.variables_schema, status='published', updated_at=now()
       RETURNING id`,
      [tpl.kind, tpl.key, tpl.name, tpl.category, JSON.stringify(tpl.vars)],
    );
    const id = up.rows[0].id;
    let n = 0;
    for (const loc of LOCALES) {
      const body = tpl.bodies[loc];
      if (!body) continue;
      await c.query(
        `INSERT INTO document_template_translations (template_id, locale, subject, body_html)
         VALUES ($1,$2,NULL,$3)
         ON CONFLICT (template_id, locale) DO UPDATE SET body_html=EXCLUDED.body_html, updated_at=now()`,
        [id, loc, body],
      );
      n++;
    }
    console.log(`✓ ${tpl.kind}/${tpl.key} (#${id}) — ${n} locales`);
  }

  if (process.env.KEEP_HOMESTAY === "1") {
    console.log("↷ KEEP_HOMESTAY=1 — leaving homestay templates in place.");
  } else {
    let removed = 0;
    for (const h of HOMESTAY_KEYS) {
      const found = await c.query(
        `SELECT id FROM document_templates WHERE kind=$1 AND key=$2 LIMIT 1`,
        [h.kind, h.key],
      );
      if (!found.rows.length) continue;
      const tid = found.rows[0].id;
      await c.query(`DELETE FROM document_template_translations WHERE template_id=$1`, [tid]);
      await c.query(`DELETE FROM document_templates WHERE id=$1`, [tid]);
      console.log(`✗ removed homestay template ${h.kind}/${h.key} (#${tid})`);
      removed++;
    }
    console.log(`Removed ${removed} homestay template(s).`);
  }

  console.log(`Seeded ${TEMPLATES.length} Metheim document templates.`);
} finally {
  c.release();
  await pool.end();
}

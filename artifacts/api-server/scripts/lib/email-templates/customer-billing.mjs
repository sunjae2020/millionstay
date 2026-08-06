// customer — 청구·수납 (billing.*)
//
// leaseRentInvoices.ts 가 월세 인보이스를 자동 생성하고 기한이 지나면 status 를
// 'Overdue' 로 바꾸지만, **현재 메일은 한 통도 나가지 않는다**. 아래 3단계 독촉이
// 그 구멍을 메운다 — 발송부 배선(Phase E)에서 연체 일수별로 이 키를 걸어야 한다.
//
// ⚠️ 금액·이율·기한은 전부 변수다. 문장에 숫자를 리터럴로 쓰면 청구서 PDF 와
//    갈라져 "메일엔 3일, 문서엔 5일" 같은 사고가 난다.
// ⚠️ 3차(최고장)의 법적 문구는 **테넌트 법률 자문 검토 대상**이다. 계약 해지·명도
//    요건은 계약서와 관할 법령을 따르므로, 여기서는 "검토한다"는 예고까지만 쓰고
//    구체적 조항 인용은 {{legal_note}} 로 뺐다.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const CUSTOMER_BILLING = [
  {
    key: "billing.invoice_issued",
    name: "청구서 발행",
    description: "월세·관리비 등 청구서가 나갔을 때. 금액·기한·납부 방법을 한눈에 준다.",
    vars: vars("recipient", "ref", "period", "amount", "due_date", "payment_method", "url"),
    tr: {
      ko: {
        subject: "{{period}} 청구서 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{period}} 청구서를 보내 드립니다.</p>` +
          `<div class="box"><div class="label">청구 금액</div><div class="amount">{{amount}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">청구번호</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">납부 기한</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">납부 방법</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">청구서 보기</a>` +
          `<p class="muted">금액이 예상과 다르면 납부 전에 알려 주세요. 산출 내역을 확인해 드리겠습니다.</p>`,
      },
      en: {
        subject: "Invoice for {{period}} ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Here is your invoice for {{period}}.</p>` +
          `<div class="box"><div class="label">Amount due</div><div class="amount">{{amount}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">Invoice</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Due by</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">How to pay</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View invoice</a>` +
          `<p class="muted">If the amount isn't what you expected, tell us before you pay and we'll go through the workings.</p>`,
      },
      ja: {
        subject: "{{period}} のご請求書（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{period}} のご請求書をお送りいたします。</p>` +
          `<div class="box"><div class="label">ご請求金額</div><div class="amount">{{amount}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">請求番号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">お支払期限</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">お支払方法</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">請求書を確認する</a>` +
          `<p class="muted">金額が想定と異なる場合は、お支払いの前にお知らせください。内訳を確認いたします。</p>`,
      },
      zh: {
        subject: "{{period}} 账单（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>现将 {{period}} 的账单发送给您。</p>` +
          `<div class="box"><div class="label">应付金额</div><div class="amount">{{amount}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">账单编号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">付款期限</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">付款方式</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看账单</a>` +
          `<p class="muted">若金额与您预期不符，请在付款前告知我们，我们会核对计算明细。</p>`,
      },
      th: {
        subject: "ใบแจ้งหนี้งวด {{period}} ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ขอส่งใบแจ้งหนี้ประจำงวด {{period}} มาให้ท่าน</p>` +
          `<div class="box"><div class="label">ยอดที่ต้องชำระ</div><div class="amount">{{amount}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">เลขที่ใบแจ้งหนี้</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">กำหนดชำระ</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">วิธีชำระ</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูใบแจ้งหนี้</a>` +
          `<p class="muted">หากยอดไม่ตรงกับที่ท่านคาดไว้ กรุณาแจ้งก่อนชำระ เราจะตรวจสอบวิธีคำนวณให้</p>`,
      },
      vi: {
        subject: "Hóa đơn kỳ {{period}} ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi xin gửi hóa đơn kỳ {{period}}.</p>` +
          `<div class="box"><div class="label">Số tiền phải trả</div><div class="amount">{{amount}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">Số hóa đơn</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Hạn thanh toán</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">Hình thức</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem hóa đơn</a>` +
          `<p class="muted">Nếu số tiền khác với dự kiến, xin báo trước khi thanh toán để chúng tôi rà lại cách tính.</p>`,
      },
    },
  },

  {
    key: "billing.rent_due",
    name: "납부 기한 안내 (사전)",
    description: "기한 며칠 전 알림. 독촉이 아니라 리마인더이므로 어조를 가볍게 둔다.",
    vars: vars("recipient", "ref", "amount", "due_date", "days_left", "payment_method", "url"),
    tr: {
      ko: {
        subject: "{{due_date}} 납부 기한 안내",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{due_date}}이 납부 기한입니다. {{days_left}}일 남았습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">청구 금액</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">납부 방법</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">청구서 보기</a>` +
          `<p class="muted">이미 보내 주셨다면 이 메일은 지나쳐 주세요. 입금 확인에 하루 이틀 걸릴 때가 있습니다.</p>`,
      },
      en: {
        subject: "Payment due {{due_date}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Your payment is due on {{due_date}} — {{days_left}} days from now.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Amount</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">How to pay</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View invoice</a>` +
          `<p class="muted">If you've already sent it, please ignore this. Payments can take a day or two to show up on our side.</p>`,
      },
      ja: {
        subject: "{{due_date}} お支払期限のご案内",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>お支払期限は {{due_date}} で、残り {{days_left}} 日となりました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ご請求金額</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">お支払方法</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">請求書を確認する</a>` +
          `<p class="muted">すでにお振込みいただいている場合は、本メールをご放念ください。ご入金の確認までに1～2日いただくことがございます。</p>`,
      },
      zh: {
        subject: "{{due_date}} 付款到期提醒",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>付款期限为 {{due_date}}，还剩 {{days_left}} 天。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">应付金额</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">付款方式</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看账单</a>` +
          `<p class="muted">如您已付款，请忽略本邮件。到账确认有时需要一两天。</p>`,
      },
      th: {
        subject: "แจ้งกำหนดชำระวันที่ {{due_date}}",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>กำหนดชำระคือวันที่ {{due_date}} เหลืออีก {{days_left}} วัน</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ยอดที่ต้องชำระ</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">วิธีชำระ</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูใบแจ้งหนี้</a>` +
          `<p class="muted">หากท่านชำระแล้ว กรุณาข้ามอีเมลฉบับนี้ การตรวจสอบยอดเข้าอาจใช้เวลาหนึ่งถึงสองวัน</p>`,
      },
      vi: {
        subject: "Hạn thanh toán ngày {{due_date}}",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Hạn thanh toán là ngày {{due_date}}, còn {{days_left}} ngày nữa.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số tiền</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">Hình thức</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem hóa đơn</a>` +
          `<p class="muted">Nếu Quý khách đã chuyển, xin bỏ qua email này. Việc đối soát có thể mất một hai ngày.</p>`,
      },
    },
  },

  {
    key: "billing.rent_overdue_1",
    name: "연체 1차 안내",
    description: "기한 후 며칠. 실수로 놓친 경우가 대부분이므로 부드럽게 확인만 한다.",
    vars: vars("recipient", "ref", "amount", "due_date", "days_overdue", "payment_method", "url"),
    tr: {
      ko: {
        subject: "납부 확인이 되지 않았습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{due_date}}까지였던 {{amount}}이 아직 입금 확인되지 않아 안내드립니다. 기한에서 {{days_overdue}}일 지났습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">청구번호</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">납부 방법</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">청구서 보기</a>` +
          `<p class="muted">이미 보내셨다면 이 메일은 지나쳐 주세요. 사정이 있으시면 편하게 말씀해 주세요. 방법을 함께 찾아보겠습니다.</p>`,
      },
      en: {
        subject: "We haven't seen your payment yet ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>{{amount}} was due on {{due_date}} and hasn't reached us yet — that's {{days_overdue}} days past the date.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Invoice</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">How to pay</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View invoice</a>` +
          `<p class="muted">If you've already sent it, please ignore this. And if something has come up, tell us — we can usually work something out.</p>`,
      },
      ja: {
        subject: "ご入金が確認できておりません（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{due_date}} が期限の {{amount}} につきまして、ご入金が確認できておりませんのでご案内いたします。期限から {{days_overdue}} 日が経過しております。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">請求番号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">お支払方法</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">請求書を確認する</a>` +
          `<p class="muted">すでにお振込み済みの場合は、本メールをご放念ください。ご事情がおありでしたら、お気軽にお知らせください。一緒に方法を考えます。</p>`,
      },
      zh: {
        subject: "尚未确认到您的付款（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{due_date}} 到期的 {{amount}} 尚未收到，距期限已过 {{days_overdue}} 天，特此告知。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">账单编号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">付款方式</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看账单</a>` +
          `<p class="muted">如您已付款，请忽略本邮件。若有难处，也请告诉我们，我们可以一起想办法。</p>`,
      },
      th: {
        subject: "ยังไม่พบการชำระเงินของท่าน ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ยอด {{amount}} ที่ครบกำหนดวันที่ {{due_date}} ยังไม่เข้าระบบ ล่วงเลยกำหนดมาแล้ว {{days_overdue}} วัน</p>` +
          `<table class="kv">` +
          `<tr><td class="k">เลขที่ใบแจ้งหนี้</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">วิธีชำระ</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูใบแจ้งหนี้</a>` +
          `<p class="muted">หากท่านชำระแล้ว กรุณาข้ามอีเมลนี้ และหากติดขัดเรื่องใด แจ้งมาได้ เราจะหาทางออกร่วมกัน</p>`,
      },
      vi: {
        subject: "Chúng tôi chưa nhận được thanh toán ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Khoản {{amount}} đến hạn ngày {{due_date}} vẫn chưa về tài khoản, đã quá hạn {{days_overdue}} ngày.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số hóa đơn</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Hình thức</td><td>{{payment_method}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem hóa đơn</a>` +
          `<p class="muted">Nếu Quý khách đã chuyển, xin bỏ qua email này. Còn nếu có khó khăn, xin cứ báo để chúng ta cùng tìm cách.</p>`,
      },
    },
  },

  {
    key: "billing.rent_overdue_2",
    name: "연체 2차 독촉",
    description: "연체가 이어질 때. 연체료 발생을 분명히 알리고 분할 납부 창구를 연다.",
    vars: vars("recipient", "ref", "amount", "late_fee", "total_due", "days_overdue", "reply_by", "url", "contact_phone"),
    tr: {
      ko: {
        subject: "연체 안내 — {{days_overdue}}일 경과 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>앞서 안내드린 청구액이 아직 입금되지 않았습니다. 계약에 따라 연체료가 붙기 시작했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">원금</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">연체료</td><td>{{late_fee}}</td></tr>` +
          `<tr><td class="k">현재 납부액</td><td>{{total_due}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">지금 납부하기</a>` +
          `<p>{{reply_by}}까지 납부하시거나 연락을 주시기 바랍니다. 한 번에 내기 어려우시면 나눠 내는 방법도 있으니 {{contact_phone}}으로 상의해 주세요.</p>` +
          `<p class="muted">연체료는 납부가 늦어질수록 늘어납니다. 이미 납부하셨다면 입금 내역을 알려 주시면 바로 확인하겠습니다.</p>`,
      },
      en: {
        subject: "Overdue — {{days_overdue}} days ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>The amount we wrote to you about is still outstanding, and under your agreement a late fee has started to accrue.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Principal</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">Late fee</td><td>{{late_fee}}</td></tr>` +
          `<tr><td class="k">Total now due</td><td>{{total_due}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Pay now</a>` +
          `<p>Please pay or get in touch by {{reply_by}}. If paying in one go is difficult, we can arrange instalments — call {{contact_phone}} and we'll talk it through.</p>` +
          `<p class="muted">The late fee keeps growing while this is outstanding. If you have paid, send us the transfer details and we'll check straight away.</p>`,
      },
      ja: {
        subject: "お支払い遅延のご連絡 — {{days_overdue}} 日経過（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>先般ご案内いたしましたご請求額が、いまだご入金いただけておりません。ご契約に基づき、遅延損害金が発生し始めております。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">元本</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">遅延損害金</td><td>{{late_fee}}</td></tr>` +
          `<tr><td class="k">現在のお支払額</td><td>{{total_due}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">今すぐお支払いいただく</a>` +
          `<p>{{reply_by}} までにお支払い、またはご連絡をお願いいたします。一括でのお支払いが難しい場合は分割のご相談も承りますので、{{contact_phone}} までご連絡ください。</p>` +
          `<p class="muted">遅延損害金はお支払いが遅れるほど増えてまいります。すでにお振込み済みでしたら、お振込内容をお知らせいただければ、すぐに確認いたします。</p>`,
      },
      zh: {
        subject: "逾期通知 — 已逾期 {{days_overdue}} 天（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>此前告知的应付款项仍未到账。按合同约定，滞纳金已开始计收。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">本金</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">滞纳金</td><td>{{late_fee}}</td></tr>` +
          `<tr><td class="k">当前应付</td><td>{{total_due}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">立即付款</a>` +
          `<p>请于 {{reply_by}} 前付款或与我们联系。若一次性支付有困难，也可以分期，请拨 {{contact_phone}} 商议。</p>` +
          `<p class="muted">拖欠越久，滞纳金越多。如您已付款，请告知转账信息，我们会立即核对。</p>`,
      },
      th: {
        subject: "แจ้งค้างชำระ — เกินกำหนด {{days_overdue}} วัน ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ยอดที่เราแจ้งไปก่อนหน้านี้ยังไม่ได้รับชำระ ตามสัญญาจึงเริ่มคิดค่าปรับล่าช้าแล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">เงินต้น</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">ค่าปรับล่าช้า</td><td>{{late_fee}}</td></tr>` +
          `<tr><td class="k">ยอดรวมปัจจุบัน</td><td>{{total_due}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ชำระเงินตอนนี้</a>` +
          `<p>กรุณาชำระหรือติดต่อเราภายในวันที่ {{reply_by}} หากชำระครั้งเดียวลำบาก สามารถผ่อนได้ โทรปรึกษาที่ {{contact_phone}}</p>` +
          `<p class="muted">ค่าปรับจะเพิ่มขึ้นตามระยะเวลาที่ค้าง หากท่านชำระแล้ว กรุณาส่งหลักฐานการโอนมา เราจะตรวจสอบทันที</p>`,
      },
      vi: {
        subject: "Thông báo quá hạn — {{days_overdue}} ngày ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Khoản tiền chúng tôi đã nhắc vẫn chưa được thanh toán. Theo hợp đồng, phí chậm trả đã bắt đầu phát sinh.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Tiền gốc</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">Phí chậm trả</td><td>{{late_fee}}</td></tr>` +
          `<tr><td class="k">Tổng phải trả</td><td>{{total_due}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Thanh toán ngay</a>` +
          `<p>Xin Quý khách thanh toán hoặc liên hệ trước ngày {{reply_by}}. Nếu trả một lần khó khăn, chúng tôi có thể chia kỳ — xin gọi {{contact_phone}} để trao đổi.</p>` +
          `<p class="muted">Phí chậm trả tăng theo thời gian còn nợ. Nếu Quý khách đã chuyển, xin gửi thông tin giao dịch để chúng tôi kiểm tra ngay.</p>`,
      },
    },
  },

  {
    key: "billing.rent_overdue_3",
    name: "연체 3차 — 최고장",
    description: "장기 연체 최종 통보. 법적 문구는 테넌트 법률 자문 검토 대상이며 {{legal_note}}로 뺀다.",
    vars: vars("recipient", "ref", "amount", "late_fee", "total_due", "days_overdue", "final_date", "legal_note", "contact_name", "contact_phone", "url"),
    tr: {
      ko: {
        subject: "[최고] 연체 대금 납부 요청 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님께</p>` +
          `<p>수차례 안내드렸음에도 아래 대금이 {{days_overdue}}일째 납부되지 않고 있습니다. 부득이 최고장으로 알려 드립니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">청구번호</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">원금</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">연체료</td><td>{{late_fee}}</td></tr>` +
          `<tr><td class="k">납부할 금액</td><td>{{total_due}}</td></tr>` +
          `<tr><td class="k">최종 기한</td><td>{{final_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">납부하기</a>` +
          `<p>{{final_date}}까지 납부되지 않으면 계약에 따른 조치를 검토할 수밖에 없습니다. {{legal_note}}</p>` +
          `<p>지금이라도 사정을 말씀해 주시면 함께 방법을 찾겠습니다. {{contact_name}} ({{contact_phone}})으로 연락 주세요.</p>` +
          `<p class="muted">이미 납부하셨다면 입금 내역을 보내 주시기 바랍니다. 착오라면 즉시 바로잡겠습니다.</p>`,
      },
      en: {
        subject: "[Final notice] Overdue payment ({{ref}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Despite several reminders, the amount below has been outstanding for {{days_overdue}} days. We are writing to you formally.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Invoice</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Principal</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">Late fee</td><td>{{late_fee}}</td></tr>` +
          `<tr><td class="k">Total payable</td><td>{{total_due}}</td></tr>` +
          `<tr><td class="k">Final date</td><td>{{final_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Pay now</a>` +
          `<p>If payment does not reach us by {{final_date}}, we will have to consider the remedies available under the agreement. {{legal_note}}</p>` +
          `<p>It is not too late to talk. Tell us your situation and we'll try to find a way — {{contact_name}} on {{contact_phone}}.</p>` +
          `<p class="muted">If you have already paid, please send us the transfer details. If this is our error, we will correct it immediately.</p>`,
      },
      ja: {
        subject: "【催告】延滞金のお支払いのお願い（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>再三ご案内を差し上げましたが、下記の金額が {{days_overdue}} 日にわたり未納となっております。やむを得ず、催告状にてご連絡申し上げます。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">請求番号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">元本</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">遅延損害金</td><td>{{late_fee}}</td></tr>` +
          `<tr><td class="k">お支払額</td><td>{{total_due}}</td></tr>` +
          `<tr><td class="k">最終期限</td><td>{{final_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">お支払いいただく</a>` +
          `<p>{{final_date}} までにご入金が確認できない場合、ご契約に基づく措置を検討せざるを得ません。{{legal_note}}</p>` +
          `<p>今からでもご事情をお聞かせいただければ、一緒に方法を考えます。{{contact_name}}（{{contact_phone}}）までご連絡ください。</p>` +
          `<p class="muted">すでにお支払い済みの場合は、お振込内容をお送りください。当方の手違いであれば、直ちに訂正いたします。</p>`,
      },
      zh: {
        subject: "【催告】请缴纳逾期款项（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 先生/女士：</p>` +
          `<p>虽经多次提醒，下列款项已逾期 {{days_overdue}} 天仍未缴纳。我们不得不以催告函形式通知您。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">账单编号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">本金</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">滞纳金</td><td>{{late_fee}}</td></tr>` +
          `<tr><td class="k">应缴金额</td><td>{{total_due}}</td></tr>` +
          `<tr><td class="k">最后期限</td><td>{{final_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">立即缴纳</a>` +
          `<p>若 {{final_date}} 前仍未到账，我们将不得不考虑依合同采取相应措施。{{legal_note}}</p>` +
          `<p>现在沟通仍不算晚。请告知您的实际情况，我们会尽力寻找办法 — {{contact_name}}（{{contact_phone}}）。</p>` +
          `<p class="muted">如您已缴纳，请将转账信息发给我们。若属我方失误，我们会立即更正。</p>`,
      },
      th: {
        subject: "[หนังสือทวงถาม] ขอให้ชำระยอดค้าง ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>แม้จะแจ้งเตือนหลายครั้งแล้ว แต่ยอดด้านล่างยังค้างชำระมา {{days_overdue}} วัน เราจึงจำเป็นต้องมีหนังสือทวงถามฉบับนี้</p>` +
          `<table class="kv">` +
          `<tr><td class="k">เลขที่ใบแจ้งหนี้</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">เงินต้น</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">ค่าปรับล่าช้า</td><td>{{late_fee}}</td></tr>` +
          `<tr><td class="k">ยอดที่ต้องชำระ</td><td>{{total_due}}</td></tr>` +
          `<tr><td class="k">กำหนดสุดท้าย</td><td>{{final_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ชำระเงิน</a>` +
          `<p>หากไม่ได้รับชำระภายในวันที่ {{final_date}} เราจำเป็นต้องพิจารณามาตรการตามสัญญา {{legal_note}}</p>` +
          `<p>ตอนนี้ยังไม่สาย หากท่านแจ้งสถานการณ์มา เราจะหาทางออกร่วมกัน ติดต่อ {{contact_name}} ที่ {{contact_phone}}</p>` +
          `<p class="muted">หากท่านชำระแล้ว กรุณาส่งหลักฐานการโอน หากเป็นความผิดพลาดของเรา จะแก้ไขทันที</p>`,
      },
      vi: {
        subject: "[Thông báo cuối] Yêu cầu thanh toán khoản quá hạn ({{ref}})",
        body:
          `<p class="lead">Kính gửi Quý khách {{recipient}},</p>` +
          `<p>Dù đã nhắc nhiều lần, khoản tiền dưới đây vẫn chưa được thanh toán suốt {{days_overdue}} ngày. Chúng tôi buộc phải gửi thông báo chính thức này.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số hóa đơn</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Tiền gốc</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">Phí chậm trả</td><td>{{late_fee}}</td></tr>` +
          `<tr><td class="k">Tổng phải trả</td><td>{{total_due}}</td></tr>` +
          `<tr><td class="k">Hạn cuối</td><td>{{final_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Thanh toán</a>` +
          `<p>Nếu đến ngày {{final_date}} vẫn chưa nhận được thanh toán, chúng tôi buộc phải cân nhắc các biện pháp theo hợp đồng. {{legal_note}}</p>` +
          `<p>Bây giờ trao đổi vẫn chưa muộn. Xin Quý khách cho biết hoàn cảnh để chúng ta cùng tìm cách — {{contact_name}}, {{contact_phone}}.</p>` +
          `<p class="muted">Nếu Quý khách đã thanh toán, xin gửi thông tin giao dịch. Nếu là sai sót của chúng tôi, chúng tôi sẽ sửa ngay.</p>`,
      },
    },
  },

  {
    key: "billing.payment_received",
    name: "입금 확인",
    description: "입금이 확인됐을 때. 잔액이 남았는지 반드시 밝힌다.",
    vars: vars("recipient", "ref", "paid_amount", "paid_date", "balance", "url"),
    tr: {
      ko: {
        subject: "입금이 확인되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{paid_date}}자로 입금을 확인했습니다. 감사합니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">입금액</td><td>{{paid_amount}}</td></tr>` +
          `<tr><td class="k">남은 금액</td><td>{{balance}}</td></tr></table>` +
          `<p>영수증을 첨부해 드립니다.</p>` +
          `<a class="btn" href="{{url}}">납부 내역 보기</a>` +
          `<p class="muted">남은 금액이 있으면 다음 안내를 따로 보내 드립니다.</p>`,
      },
      en: {
        subject: "Payment received ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We received your payment on {{paid_date}}. Thank you.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Paid</td><td>{{paid_amount}}</td></tr>` +
          `<tr><td class="k">Balance</td><td>{{balance}}</td></tr></table>` +
          `<p>Your receipt is attached.</p>` +
          `<a class="btn" href="{{url}}">View payment history</a>` +
          `<p class="muted">If there's a balance left, we'll send a separate note about it.</p>`,
      },
      ja: {
        subject: "ご入金を確認いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{paid_date}} 付でご入金を確認いたしました。ありがとうございます。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ご入金額</td><td>{{paid_amount}}</td></tr>` +
          `<tr><td class="k">残額</td><td>{{balance}}</td></tr></table>` +
          `<p>領収書を添付いたします。</p>` +
          `<a class="btn" href="{{url}}">お支払い履歴を確認する</a>` +
          `<p class="muted">残額がございます場合は、改めてご案内をお送りいたします。</p>`,
      },
      zh: {
        subject: "已确认收款（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们已于 {{paid_date}} 确认收到您的款项，谢谢。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">收款金额</td><td>{{paid_amount}}</td></tr>` +
          `<tr><td class="k">剩余金额</td><td>{{balance}}</td></tr></table>` +
          `<p>随附收据。</p>` +
          `<a class="btn" href="{{url}}">查看付款记录</a>` +
          `<p class="muted">如仍有余额，我们会另行通知。</p>`,
      },
      th: {
        subject: "ยืนยันรับชำระเงินแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้รับชำระเงินของท่านเมื่อวันที่ {{paid_date}} ขอบคุณครับ</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ยอดที่ชำระ</td><td>{{paid_amount}}</td></tr>` +
          `<tr><td class="k">ยอดคงเหลือ</td><td>{{balance}}</td></tr></table>` +
          `<p>แนบใบเสร็จมาด้วย</p>` +
          `<a class="btn" href="{{url}}">ดูประวัติการชำระ</a>` +
          `<p class="muted">หากยังมียอดคงเหลือ เราจะแจ้งให้ทราบอีกครั้งต่างหาก</p>`,
      },
      vi: {
        subject: "Đã nhận được thanh toán ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi đã nhận được khoản thanh toán vào ngày {{paid_date}}. Xin cảm ơn Quý khách.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Đã trả</td><td>{{paid_amount}}</td></tr>` +
          `<tr><td class="k">Còn lại</td><td>{{balance}}</td></tr></table>` +
          `<p>Biên nhận được đính kèm.</p>` +
          `<a class="btn" href="{{url}}">Xem lịch sử thanh toán</a>` +
          `<p class="muted">Nếu còn số dư, chúng tôi sẽ gửi thông báo riêng.</p>`,
      },
    },
  },

  {
    key: "billing.payment_failed",
    name: "자동이체·결제 실패",
    description: "결제 수단에서 출금이 실패했을 때. 재시도 일정과 대체 수단을 함께 준다.",
    vars: vars("recipient", "ref", "amount", "reason", "retry_date", "url", "payment_method"),
    tr: {
      ko: {
        subject: "결제가 처리되지 않았습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{amount}} 결제를 시도했으나 처리되지 않았습니다.</p>` +
          `<div class="box"><div class="label">사유</div><div>{{reason}}</div></div>` +
          `<p>{{retry_date}}에 한 번 더 시도합니다. 그 전에 결제 수단을 확인해 주시거나 아래에서 직접 납부하셔도 됩니다.</p>` +
          `<a class="btn" href="{{url}}">직접 납부하기</a>` +
          `<p class="muted">다른 방법으로 내고 싶으시면 {{payment_method}}도 가능합니다. 재시도까지 연체료는 붙지 않습니다.</p>`,
      },
      en: {
        subject: "Your payment didn't go through ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We tried to take {{amount}} but the payment failed.</p>` +
          `<div class="box"><div class="label">Reason</div><div>{{reason}}</div></div>` +
          `<p>We'll try once more on {{retry_date}}. Before then, check your payment method or simply pay directly below.</p>` +
          `<a class="btn" href="{{url}}">Pay directly</a>` +
          `<p class="muted">You can also use {{payment_method}} if you prefer. No late fee applies before the retry.</p>`,
      },
      ja: {
        subject: "お支払いの処理ができませんでした（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{amount}} のお支払いを試みましたが、処理できませんでした。</p>` +
          `<div class="box"><div class="label">理由</div><div>{{reason}}</div></div>` +
          `<p>{{retry_date}} に再度お試しいたします。それまでにお支払方法をご確認いただくか、下記より直接お支払いいただくこともできます。</p>` +
          `<a class="btn" href="{{url}}">直接お支払いいただく</a>` +
          `<p class="muted">別の方法をご希望でしたら、{{payment_method}} もご利用いただけます。再試行までは遅延損害金は発生いたしません。</p>`,
      },
      zh: {
        subject: "扣款未能成功（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们尝试扣取 {{amount}}，但未能成功。</p>` +
          `<div class="box"><div class="label">原因</div><div>{{reason}}</div></div>` +
          `<p>我们将于 {{retry_date}} 再试一次。在此之前，请检查您的付款方式，或直接在下方付款。</p>` +
          `<a class="btn" href="{{url}}">直接付款</a>` +
          `<p class="muted">如愿意改用其他方式，也可使用{{payment_method}}。重试之前不会产生滞纳金。</p>`,
      },
      th: {
        subject: "การชำระเงินไม่สำเร็จ ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราพยายามตัดชำระยอด {{amount}} แต่ทำรายการไม่สำเร็จ</p>` +
          `<div class="box"><div class="label">สาเหตุ</div><div>{{reason}}</div></div>` +
          `<p>เราจะลองอีกครั้งในวันที่ {{retry_date}} ก่อนหน้านั้น กรุณาตรวจสอบวิธีชำระเงินของท่าน หรือจะชำระเองผ่านลิงก์ด้านล่างก็ได้</p>` +
          `<a class="btn" href="{{url}}">ชำระเงินเอง</a>` +
          `<p class="muted">หากต้องการเปลี่ยนช่องทาง ใช้{{payment_method}}ได้เช่นกัน ก่อนถึงรอบลองใหม่จะยังไม่มีค่าปรับล่าช้า</p>`,
      },
      vi: {
        subject: "Thanh toán không thành công ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi đã thử trừ {{amount}} nhưng giao dịch không thành công.</p>` +
          `<div class="box"><div class="label">Lý do</div><div>{{reason}}</div></div>` +
          `<p>Chúng tôi sẽ thử lại vào ngày {{retry_date}}. Trước đó, xin Quý khách kiểm tra phương thức thanh toán hoặc trả trực tiếp ở bên dưới.</p>` +
          `<a class="btn" href="{{url}}">Thanh toán trực tiếp</a>` +
          `<p class="muted">Quý khách cũng có thể dùng {{payment_method}}. Trước lần thử lại, chưa phát sinh phí chậm trả.</p>`,
      },
    },
  },

  {
    key: "billing.refund_issued",
    name: "환불 처리 완료",
    description: "환불이 나갔을 때. 사유·금액·입금 시기를 밝힌다.",
    vars: vars("recipient", "ref", "refund_amount", "reason", "refund_days", "method"),
    tr: {
      ko: {
        subject: "환불이 처리되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{reason}}으로 아래 금액을 환불 처리했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">환불 금액</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">환불 방법</td><td>{{method}}</td></tr>` +
          `<tr><td class="k">입금 예정</td><td>영업일 기준 {{refund_days}}일 이내</td></tr></table>` +
          `<p class="muted">기한이 지나도 입금되지 않으면 알려 주세요. 바로 확인하겠습니다.</p>`,
      },
      en: {
        subject: "Your refund has been processed ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We've refunded the amount below — {{reason}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Refund</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">Method</td><td>{{method}}</td></tr>` +
          `<tr><td class="k">Expected</td><td>within {{refund_days}} business days</td></tr></table>` +
          `<p class="muted">If it hasn't arrived after that, let us know and we'll chase it.</p>`,
      },
      ja: {
        subject: "ご返金の手続きが完了いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{reason}}により、下記の金額をご返金いたしました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ご返金額</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">ご返金方法</td><td>{{method}}</td></tr>` +
          `<tr><td class="k">入金予定</td><td>営業日で {{refund_days}} 日以内</td></tr></table>` +
          `<p class="muted">期日を過ぎても入金が確認できない場合は、お知らせください。すぐに確認いたします。</p>`,
      },
      zh: {
        subject: "退款已处理（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>因{{reason}}，我们已为您办理以下退款。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">退款金额</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">退款方式</td><td>{{method}}</td></tr>` +
          `<tr><td class="k">预计到账</td><td>{{refund_days}} 个工作日内</td></tr></table>` +
          `<p class="muted">若逾期仍未到账，请告知我们，我们会立即跟进。</p>`,
      },
      th: {
        subject: "ดำเนินการคืนเงินแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เนื่องจาก{{reason}} เราได้คืนเงินตามรายการด้านล่างแล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ยอดคืน</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">ช่องทางคืน</td><td>{{method}}</td></tr>` +
          `<tr><td class="k">กำหนดเข้าบัญชี</td><td>ภายใน {{refund_days}} วันทำการ</td></tr></table>` +
          `<p class="muted">หากพ้นกำหนดแล้วเงินยังไม่เข้า กรุณาแจ้งเรา จะตรวจสอบให้ทันที</p>`,
      },
      vi: {
        subject: "Đã hoàn tiền ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Vì {{reason}}, chúng tôi đã hoàn khoản tiền dưới đây.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số tiền hoàn</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">Hình thức</td><td>{{method}}</td></tr>` +
          `<tr><td class="k">Dự kiến</td><td>trong vòng {{refund_days}} ngày làm việc</td></tr></table>` +
          `<p class="muted">Quá thời hạn mà chưa nhận được, xin Quý khách báo để chúng tôi kiểm tra.</p>`,
      },
    },
  },

  {
    key: "billing.deposit_received",
    name: "보증금 수납 확인",
    description: "보증금이 들어왔을 때. 보관 성격과 반환 조건을 함께 알린다.",
    vars: vars("recipient", "ref", "deposit_amount", "paid_date", "space_name", "url"),
    tr: {
      ko: {
        subject: "보증금 입금이 확인되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{space_name}} 보증금 {{deposit_amount}}을 {{paid_date}}자로 확인했습니다.</p>` +
          `<p>보증금은 계약 기간 동안 보관하며 퇴거 점검을 마친 뒤 정산해 돌려드립니다. 손상이나 미납이 없으면 전액 반환됩니다.</p>` +
          `<a class="btn" href="{{url}}">납부 내역 보기</a>` +
          `<p class="muted">영수증을 첨부해 드립니다. 보관해 두시면 정산할 때 편합니다.</p>`,
      },
      en: {
        subject: "Bond received ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We received the {{deposit_amount}} bond for {{space_name}} on {{paid_date}}.</p>` +
          `<p>It's held for the length of your agreement and settled after the move-out inspection. With no damage or arrears, it comes back in full.</p>` +
          `<a class="btn" href="{{url}}">View payment history</a>` +
          `<p class="muted">Your receipt is attached — worth keeping for when the bond is settled.</p>`,
      },
      ja: {
        subject: "敷金のご入金を確認いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{space_name}} の敷金 {{deposit_amount}} を {{paid_date}} 付で確認いたしました。</p>` +
          `<p>敷金は契約期間中お預かりし、退去点検の完了後に精算のうえご返金いたします。損傷や未納がなければ全額をお返しいたします。</p>` +
          `<a class="btn" href="{{url}}">お支払い履歴を確認する</a>` +
          `<p class="muted">領収書を添付いたします。精算の際に必要となりますので、ご保管ください。</p>`,
      },
      zh: {
        subject: "已确认收到押金（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们已于 {{paid_date}} 确认收到 {{space_name}} 的押金 {{deposit_amount}}。</p>` +
          `<p>押金在合同期内代为保管，退租验房后结算退还。如无损坏及欠费，将全额退回。</p>` +
          `<a class="btn" href="{{url}}">查看付款记录</a>` +
          `<p class="muted">随附收据，建议保存，结算时会用到。</p>`,
      },
      th: {
        subject: "ยืนยันรับเงินประกันแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้รับเงินประกัน {{deposit_amount}} ของ {{space_name}} เมื่อวันที่ {{paid_date}}</p>` +
          `<p>เงินประกันจะเก็บรักษาไว้ตลอดอายุสัญญา และคืนให้หลังตรวจสภาพห้องเมื่อย้ายออก หากไม่มีความเสียหายหรือค้างชำระ จะคืนเต็มจำนวน</p>` +
          `<a class="btn" href="{{url}}">ดูประวัติการชำระ</a>` +
          `<p class="muted">แนบใบเสร็จมาด้วย ควรเก็บไว้เพราะจะใช้ตอนคืนเงินประกัน</p>`,
      },
      vi: {
        subject: "Đã nhận tiền cọc ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi đã nhận tiền cọc {{deposit_amount}} cho {{space_name}} vào ngày {{paid_date}}.</p>` +
          `<p>Tiền cọc được giữ trong suốt thời hạn hợp đồng và quyết toán sau khi kiểm tra bàn giao. Nếu không có hư hỏng hay nợ đọng, Quý khách được hoàn đủ.</p>` +
          `<a class="btn" href="{{url}}">Xem lịch sử thanh toán</a>` +
          `<p class="muted">Biên nhận được đính kèm — xin lưu giữ để dùng khi quyết toán.</p>`,
      },
    },
  },

  {
    key: "billing.fee_change",
    name: "요금 변경 고지",
    description: "임대료·관리비가 바뀔 때의 사전 고지. 적용 시점과 근거를 명시한다.",
    vars: vars("recipient", "space_name", "old_amount", "new_amount", "effective_date", "reason", "url"),
    tr: {
      ko: {
        subject: "요금 변경 안내 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{effective_date}}부터 {{space_name}} 요금이 아래와 같이 조정됩니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">현재</td><td>{{old_amount}}</td></tr>` +
          `<tr><td class="k">변경 후</td><td>{{new_amount}}</td></tr>` +
          `<tr><td class="k">적용일</td><td>{{effective_date}}</td></tr></table>` +
          `<div class="box"><div class="label">변경 사유</div><div>{{reason}}</div></div>` +
          `<a class="btn" href="{{url}}">계약 내역 보기</a>` +
          `<p class="muted">산출 근거가 궁금하시면 답장 주세요. 자세히 설명해 드리겠습니다.</p>`,
      },
      en: {
        subject: "Change to your charges ({{space_name}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>From {{effective_date}}, the charges for {{space_name}} change as follows.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Now</td><td>{{old_amount}}</td></tr>` +
          `<tr><td class="k">From then</td><td>{{new_amount}}</td></tr>` +
          `<tr><td class="k">Effective</td><td>{{effective_date}}</td></tr></table>` +
          `<div class="box"><div class="label">Why</div><div>{{reason}}</div></div>` +
          `<a class="btn" href="{{url}}">View your agreement</a>` +
          `<p class="muted">Reply if you'd like to see how it was worked out and we'll walk you through it.</p>`,
      },
      ja: {
        subject: "料金改定のご案内（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{effective_date}} より、{{space_name}} の料金を下記のとおり改定いたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">現行</td><td>{{old_amount}}</td></tr>` +
          `<tr><td class="k">改定後</td><td>{{new_amount}}</td></tr>` +
          `<tr><td class="k">適用日</td><td>{{effective_date}}</td></tr></table>` +
          `<div class="box"><div class="label">改定理由</div><div>{{reason}}</div></div>` +
          `<a class="btn" href="{{url}}">契約内容を確認する</a>` +
          `<p class="muted">算出の根拠をお知りになりたい場合は、ご返信ください。詳しくご説明いたします。</p>`,
      },
      zh: {
        subject: "费用调整通知（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>自 {{effective_date}} 起，{{space_name}} 的费用调整如下。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">现行</td><td>{{old_amount}}</td></tr>` +
          `<tr><td class="k">调整后</td><td>{{new_amount}}</td></tr>` +
          `<tr><td class="k">生效日</td><td>{{effective_date}}</td></tr></table>` +
          `<div class="box"><div class="label">调整原因</div><div>{{reason}}</div></div>` +
          `<a class="btn" href="{{url}}">查看合同详情</a>` +
          `<p class="muted">若想了解计算依据，请回复本邮件，我们会详细说明。</p>`,
      },
      th: {
        subject: "แจ้งปรับค่าบริการ ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ตั้งแต่วันที่ {{effective_date}} ค่าบริการของ {{space_name}} จะปรับดังนี้</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ปัจจุบัน</td><td>{{old_amount}}</td></tr>` +
          `<tr><td class="k">หลังปรับ</td><td>{{new_amount}}</td></tr>` +
          `<tr><td class="k">วันที่มีผล</td><td>{{effective_date}}</td></tr></table>` +
          `<div class="box"><div class="label">เหตุผลในการปรับ</div><div>{{reason}}</div></div>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดสัญญา</a>` +
          `<p class="muted">หากต้องการทราบวิธีคำนวณ ตอบกลับมาได้ เราจะอธิบายโดยละเอียด</p>`,
      },
      vi: {
        subject: "Thông báo điều chỉnh phí ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Từ ngày {{effective_date}}, phí của {{space_name}} được điều chỉnh như sau.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Hiện tại</td><td>{{old_amount}}</td></tr>` +
          `<tr><td class="k">Sau điều chỉnh</td><td>{{new_amount}}</td></tr>` +
          `<tr><td class="k">Ngày áp dụng</td><td>{{effective_date}}</td></tr></table>` +
          `<div class="box"><div class="label">Lý do điều chỉnh</div><div>{{reason}}</div></div>` +
          `<a class="btn" href="{{url}}">Xem chi tiết hợp đồng</a>` +
          `<p class="muted">Nếu Quý khách muốn biết cách tính, xin trả lời email để chúng tôi giải thích cụ thể.</p>`,
      },
    },
  },
];

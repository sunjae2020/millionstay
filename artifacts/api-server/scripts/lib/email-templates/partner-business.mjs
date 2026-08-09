// partner — 소개·수수료·문의 (agent.* / cs.partner_* / survey.partner_csat)
//
// ⚠️ 개인정보 주의: 파트너가 소개한 고객의 진행 상황을 알릴 때, 파트너에게 필요한
//    범위를 넘는 개인정보를 담지 않는다. 계약 금액·세대 호수는 필요하지만
//    고객의 연락처·신분증 정보는 파트너가 알 이유가 없다 — 변수 선택으로 통제한다.
//
// ⚠️ agent.inventory_update 는 **광고성 정보**에 해당할 수 있다. 파트너 담당자라도
//    「정보통신망법」 제50조 적용 대상이므로, 발송부에서 수신동의를 확인하고
//    셸이 (광고) 표기·수신거부를 붙이도록 category 를 marketing 으로 넘긴다.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const PARTNER_BUSINESS = [
  {
    key: "agent.referral_received",
    name: "고객 소개 접수",
    description: "파트너가 소개한 건의 접수 확인. 진행 주체와 다음 단계를 밝힌다.",
    vars: vars("recipient", "partner_company", "ref", "client_name", "interest", "next_step", "url"),
    tr: {
      ko: {
        subject: "소개해 주신 건을 접수했습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{partner_company}}에서 소개해 주신 건을 접수했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">접수번호</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">고객</td><td>{{client_name}}</td></tr>` +
          `<tr><td class="k">희망 조건</td><td>{{interest}}</td></tr></table>` +
          `<p>여기서부터는 저희가 고객과 직접 연락해 {{next_step}} 절차를 진행합니다. 진행 상황은 포털에서 보실 수 있습니다.</p>` +
          `<a class="btn" href="{{url}}">진행 상황 보기</a>` +
          `<p class="muted">고객에게 미리 전해 두실 내용이 있으면 알려 주세요.</p>`,
      },
      en: {
        subject: "We've received your referral ({{ref}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>The referral from {{partner_company}} has been logged.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Reference</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Client</td><td>{{client_name}}</td></tr>` +
          `<tr><td class="k">Looking for</td><td>{{interest}}</td></tr></table>` +
          `<p>From here we'll contact the client directly and take care of {{next_step}}. You can follow it in the portal.</p>` +
          `<a class="btn" href="{{url}}">Track progress</a>` +
          `<p class="muted">If there's anything you'd like passed on to the client, let us know.</p>`,
      },
      ja: {
        subject: "ご紹介いただいた件を受け付けました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{partner_company}} 様よりご紹介いただいた件を受け付けました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">受付番号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">お客様</td><td>{{client_name}}</td></tr>` +
          `<tr><td class="k">ご希望条件</td><td>{{interest}}</td></tr></table>` +
          `<p>ここから先は弊社よりお客様へ直接ご連絡し、{{next_step}}を進めてまいります。進捗はポータルでご確認いただけます。</p>` +
          `<a class="btn" href="{{url}}">進捗を確認する</a>` +
          `<p class="muted">お客様に事前にお伝えいただきたい事項がございましたら、お知らせください。</p>`,
      },
      zh: {
        subject: "已受理您推荐的客户（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>{{partner_company}} 推荐的客户我们已经受理。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">受理编号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">客户</td><td>{{client_name}}</td></tr>` +
          `<tr><td class="k">意向条件</td><td>{{interest}}</td></tr></table>` +
          `<p>接下来由我们直接联系客户，推进{{next_step}}。进展可在门户中查看。</p>` +
          `<a class="btn" href="{{url}}">查看进展</a>` +
          `<p class="muted">若有需要提前转达客户的事项，请告知我们。</p>`,
      },
      th: {
        subject: "รับเรื่องลูกค้าที่ท่านแนะนำแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>เราได้รับเรื่องลูกค้าที่ {{partner_company}} แนะนำมาแล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">หมายเลขรับเรื่อง</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">ลูกค้า</td><td>{{client_name}}</td></tr>` +
          `<tr><td class="k">เงื่อนไขที่ต้องการ</td><td>{{interest}}</td></tr></table>` +
          `<p>จากนี้เราจะติดต่อลูกค้าโดยตรงและดำเนินการ{{next_step}}ต่อ ท่านติดตามความคืบหน้าได้ในพอร์ทัล</p>` +
          `<a class="btn" href="{{url}}">ติดตามความคืบหน้า</a>` +
          `<p class="muted">หากมีเรื่องที่ต้องการให้แจ้งลูกค้าล่วงหน้า กรุณาบอกเรา</p>`,
      },
      vi: {
        subject: "Đã tiếp nhận khách quý công ty giới thiệu ({{ref}})",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Chúng tôi đã ghi nhận khách hàng do {{partner_company}} giới thiệu.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số tiếp nhận</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Khách hàng</td><td>{{client_name}}</td></tr>` +
          `<tr><td class="k">Nhu cầu</td><td>{{interest}}</td></tr></table>` +
          `<p>Từ đây chúng tôi sẽ liên hệ trực tiếp với khách và tiến hành {{next_step}}. Quý công ty theo dõi được trên cổng đối tác.</p>` +
          `<a class="btn" href="{{url}}">Theo dõi tiến độ</a>` +
          `<p class="muted">Nếu có điều gì muốn nhắn trước tới khách, xin cho chúng tôi biết.</p>`,
      },
    },
  },

  {
    key: "agent.referral_status",
    name: "소개 건 진행 상태 변경",
    description: "상담·계약 단계가 바뀔 때. 파트너가 고객에게 물어봤을 때 답할 수 있게 한다.",
    vars: vars("recipient", "ref", "client_name", "old_status", "new_status", "note", "url"),
    tr: {
      ko: {
        subject: "소개 건 진행 상태가 바뀌었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{client_name}} 건의 진행 상태를 알려 드립니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">이전</td><td>{{old_status}}</td></tr>` +
          `<tr><td class="k">현재</td><td>{{new_status}}</td></tr></table>` +
          `<div class="box"><div class="label">참고</div><div>{{note}}</div></div>` +
          `<a class="btn" href="{{url}}">진행 상황 보기</a>` +
          `<p class="muted">고객이 문의하면 이 내용까지는 안내하셔도 됩니다.</p>`,
      },
      en: {
        subject: "Status change on your referral ({{ref}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>An update on {{client_name}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Was</td><td>{{old_status}}</td></tr>` +
          `<tr><td class="k">Now</td><td>{{new_status}}</td></tr></table>` +
          `<div class="box"><div class="label">Note</div><div>{{note}}</div></div>` +
          `<a class="btn" href="{{url}}">Track progress</a>` +
          `<p class="muted">If the client asks you, you're welcome to share this much.</p>`,
      },
      ja: {
        subject: "ご紹介案件の進捗が変わりました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{client_name}} 様の案件について、進捗をご案内いたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">変更前</td><td>{{old_status}}</td></tr>` +
          `<tr><td class="k">現在</td><td>{{new_status}}</td></tr></table>` +
          `<div class="box"><div class="label">補足</div><div>{{note}}</div></div>` +
          `<a class="btn" href="{{url}}">進捗を確認する</a>` +
          `<p class="muted">お客様からお問い合わせがあった際は、この範囲までご案内いただいて差し支えございません。</p>`,
      },
      zh: {
        subject: "推荐客户的进展有变化（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>现将 {{client_name}} 一案的进展告知您。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">此前</td><td>{{old_status}}</td></tr>` +
          `<tr><td class="k">当前</td><td>{{new_status}}</td></tr></table>` +
          `<div class="box"><div class="label">备注</div><div>{{note}}</div></div>` +
          `<a class="btn" href="{{url}}">查看进展</a>` +
          `<p class="muted">客户若来询问，可向其说明至此范围。</p>`,
      },
      th: {
        subject: "สถานะเรื่องที่แนะนำเปลี่ยนแปลง ({{ref}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>ขอแจ้งความคืบหน้าของเรื่องคุณ{{client_name}}</p>` +
          `<table class="kv">` +
          `<tr><td class="k">เดิม</td><td>{{old_status}}</td></tr>` +
          `<tr><td class="k">ปัจจุบัน</td><td>{{new_status}}</td></tr></table>` +
          `<div class="box"><div class="label">หมายเหตุ</div><div>{{note}}</div></div>` +
          `<a class="btn" href="{{url}}">ติดตามความคืบหน้า</a>` +
          `<p class="muted">หากลูกค้าสอบถาม ท่านชี้แจงได้ในขอบเขตนี้</p>`,
      },
      vi: {
        subject: "Thay đổi trạng thái hồ sơ giới thiệu ({{ref}})",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Cập nhật về trường hợp {{client_name}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Trước</td><td>{{old_status}}</td></tr>` +
          `<tr><td class="k">Hiện tại</td><td>{{new_status}}</td></tr></table>` +
          `<div class="box"><div class="label">Ghi chú</div><div>{{note}}</div></div>` +
          `<a class="btn" href="{{url}}">Theo dõi tiến độ</a>` +
          `<p class="muted">Nếu khách hỏi, quý công ty có thể chia sẻ trong phạm vi này.</p>`,
      },
    },
  },

  {
    key: "agent.contract_confirmed",
    name: "소개 건 계약 체결 — 최종 확인",
    description: "소개가 계약으로 이어졌을 때. 수수료 발생 기준과 지급 시기를 함께 밝힌다.",
    vars: vars("recipient", "partner_company", "ref", "client_name", "space_name", "contract_date", "commission_amount", "payout_date", "url"),
    tr: {
      ko: {
        subject: "소개해 주신 건이 계약되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{partner_company}}에서 소개해 주신 {{client_name}} 건이 {{contract_date}}에 계약되었습니다. 감사합니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">세대</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">계약일</td><td>{{contract_date}}</td></tr>` +
          `<tr><td class="k">수수료</td><td>{{commission_amount}}</td></tr>` +
          `<tr><td class="k">지급 예정</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">수수료 내역 보기</a>` +
          `<p class="muted">수수료는 계약금 입금이 확인된 뒤 정산 주기에 맞춰 지급됩니다. 금액이 예상과 다르면 알려 주세요.</p>`,
      },
      en: {
        subject: "Your referral has signed ({{ref}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>{{client_name}}, referred by {{partner_company}}, signed on {{contract_date}}. Thank you.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Unit</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">Signed</td><td>{{contract_date}}</td></tr>` +
          `<tr><td class="k">Commission</td><td>{{commission_amount}}</td></tr>` +
          `<tr><td class="k">Payout due</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View commission</a>` +
          `<p class="muted">Commission is released once the deposit clears, on the next settlement run. Tell us if the figure isn't what you expected.</p>`,
      },
      ja: {
        subject: "ご紹介いただいた件がご成約となりました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{partner_company}} 様よりご紹介いただいた {{client_name}} 様の件が、{{contract_date}} にご成約となりました。ありがとうございます。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">お部屋</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">契約日</td><td>{{contract_date}}</td></tr>` +
          `<tr><td class="k">手数料</td><td>{{commission_amount}}</td></tr>` +
          `<tr><td class="k">お支払い予定</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">手数料明細を見る</a>` +
          `<p class="muted">手数料は契約金のご入金確認後、精算サイクルに合わせてお支払いいたします。金額が想定と異なる場合はお知らせください。</p>`,
      },
      zh: {
        subject: "您推荐的客户已签约（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>{{partner_company}} 推荐的 {{client_name}} 已于 {{contract_date}} 签约，谢谢您。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">房源</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">签约日</td><td>{{contract_date}}</td></tr>` +
          `<tr><td class="k">佣金</td><td>{{commission_amount}}</td></tr>` +
          `<tr><td class="k">预计支付</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看佣金明细</a>` +
          `<p class="muted">佣金将在确认收到定金后，按结算周期支付。若金额与预期不符，请告知我们。</p>`,
      },
      th: {
        subject: "ลูกค้าที่ท่านแนะนำทำสัญญาแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>คุณ{{client_name}} ที่ {{partner_company}} แนะนำมา ได้ทำสัญญาเมื่อวันที่ {{contract_date}} ขอบคุณมากครับ</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ห้องพัก</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">วันทำสัญญา</td><td>{{contract_date}}</td></tr>` +
          `<tr><td class="k">ค่าคอมมิชชัน</td><td>{{commission_amount}}</td></tr>` +
          `<tr><td class="k">กำหนดจ่าย</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดค่าคอมมิชชัน</a>` +
          `<p class="muted">ค่าคอมมิชชันจะจ่ายหลังยืนยันการรับเงินมัดจำ ตามรอบการจ่ายปกติ หากยอดไม่ตรงกับที่คาดไว้ กรุณาแจ้ง</p>`,
      },
      vi: {
        subject: "Khách quý công ty giới thiệu đã ký hợp đồng ({{ref}})",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Khách {{client_name}} do {{partner_company}} giới thiệu đã ký ngày {{contract_date}}. Xin chân thành cảm ơn.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Căn hộ</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">Ngày ký</td><td>{{contract_date}}</td></tr>` +
          `<tr><td class="k">Hoa hồng</td><td>{{commission_amount}}</td></tr>` +
          `<tr><td class="k">Dự kiến chi trả</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem chi tiết hoa hồng</a>` +
          `<p class="muted">Hoa hồng được chi sau khi xác nhận tiền đặt cọc, theo kỳ quyết toán. Nếu số tiền khác dự kiến, xin báo cho chúng tôi.</p>`,
      },
    },
  },

  {
    key: "agent.commission_statement",
    name: "월 수수료 명세서",
    description: "정산 명세 송부. 건별 내역은 PDF, 메일에는 합계만 둔다.",
    vars: vars("recipient", "partner_company", "period", "deal_count", "gross_amount", "deduction", "net_amount", "payout_date", "url"),
    tr: {
      ko: {
        subject: "{{period}} 수수료 명세서 ({{partner_company}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{period}} 수수료 명세서를 보내 드립니다. 건별 내역은 첨부한 명세서를 확인해 주세요.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">성사 건수</td><td>{{deal_count}}건</td></tr>` +
          `<tr><td class="k">수수료 합계</td><td>{{gross_amount}}</td></tr>` +
          `<tr><td class="k">공제</td><td>{{deduction}}</td></tr>` +
          `<tr><td class="k">지급액</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">지급 예정일</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">수수료 내역 보기</a>` +
          `<p class="muted">내역에 맞지 않는 부분이 있으면 지급일 전에 알려 주세요. 확인 후 조정해 드리겠습니다.</p>`,
      },
      en: {
        subject: "Commission statement for {{period}} ({{partner_company}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Here is the commission statement for {{period}}. The deal-by-deal breakdown is attached.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Deals</td><td>{{deal_count}}</td></tr>` +
          `<tr><td class="k">Gross commission</td><td>{{gross_amount}}</td></tr>` +
          `<tr><td class="k">Deductions</td><td>{{deduction}}</td></tr>` +
          `<tr><td class="k">Net payable</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">Payment date</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View commission</a>` +
          `<p class="muted">If anything doesn't match your records, tell us before the payment date and we'll check and adjust.</p>`,
      },
      ja: {
        subject: "{{period}} 手数料明細書（{{partner_company}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{period}} の手数料明細書をお送りいたします。案件ごとの内訳は添付の明細書をご覧ください。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ご成約件数</td><td>{{deal_count}} 件</td></tr>` +
          `<tr><td class="k">手数料合計</td><td>{{gross_amount}}</td></tr>` +
          `<tr><td class="k">控除</td><td>{{deduction}}</td></tr>` +
          `<tr><td class="k">お支払額</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">お支払予定日</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">手数料明細を見る</a>` +
          `<p class="muted">内訳に相違がございましたら、お支払日までにお知らせください。確認のうえ調整いたします。</p>`,
      },
      zh: {
        subject: "{{period}} 佣金结算单（{{partner_company}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>现将 {{period}} 的佣金结算单发送给您。逐笔明细请见随附结算单。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">成交笔数</td><td>{{deal_count}} 笔</td></tr>` +
          `<tr><td class="k">佣金合计</td><td>{{gross_amount}}</td></tr>` +
          `<tr><td class="k">扣除</td><td>{{deduction}}</td></tr>` +
          `<tr><td class="k">应付金额</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">预计支付日</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看佣金明细</a>` +
          `<p class="muted">若明细与贵方记录不符，请在支付日前告知，我们核实后予以调整。</p>`,
      },
      th: {
        subject: "ใบสรุปค่าคอมมิชชันงวด {{period}} ({{partner_company}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>ขอส่งใบสรุปค่าคอมมิชชันงวด {{period}} รายละเอียดรายดีลดูได้จากเอกสารที่แนบ</p>` +
          `<table class="kv">` +
          `<tr><td class="k">จำนวนดีล</td><td>{{deal_count}} ดีล</td></tr>` +
          `<tr><td class="k">ค่าคอมมิชชันรวม</td><td>{{gross_amount}}</td></tr>` +
          `<tr><td class="k">รายการหัก</td><td>{{deduction}}</td></tr>` +
          `<tr><td class="k">ยอดจ่ายสุทธิ</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">วันที่จ่าย</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดค่าคอมมิชชัน</a>` +
          `<p class="muted">หากรายการไม่ตรงกับบันทึกของท่าน กรุณาแจ้งก่อนวันจ่าย เราจะตรวจสอบและปรับให้</p>`,
      },
      vi: {
        subject: "Bảng kê hoa hồng kỳ {{period}} ({{partner_company}})",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Chúng tôi xin gửi bảng kê hoa hồng kỳ {{period}}. Chi tiết từng giao dịch xin xem tệp đính kèm.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số giao dịch</td><td>{{deal_count}}</td></tr>` +
          `<tr><td class="k">Tổng hoa hồng</td><td>{{gross_amount}}</td></tr>` +
          `<tr><td class="k">Khấu trừ</td><td>{{deduction}}</td></tr>` +
          `<tr><td class="k">Thực trả</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">Ngày chi trả</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem chi tiết hoa hồng</a>` +
          `<p class="muted">Nếu có khoản nào không khớp sổ sách của quý công ty, xin báo trước ngày chi trả để chúng tôi kiểm tra và điều chỉnh.</p>`,
      },
    },
  },

  {
    key: "agent.commission_paid",
    name: "수수료 지급 완료",
    description: "송금 완료 통보. 입금 계좌 끝자리와 송금일을 밝혀 대사를 돕는다.",
    vars: vars("recipient", "partner_company", "period", "net_amount", "paid_date", "account_tail", "url"),
    tr: {
      ko: {
        subject: "수수료를 지급했습니다 ({{period}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{period}} 수수료를 아래와 같이 송금했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">지급액</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">송금일</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">입금 계좌</td><td>끝자리 {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">지급 내역 보기</a>` +
          `<p class="muted">은행 사정에 따라 입금까지 하루 이틀 걸릴 수 있습니다. 그 뒤에도 입금이 확인되지 않으면 알려 주세요.</p>`,
      },
      en: {
        subject: "Commission paid ({{period}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Commission for {{period}} has been transferred as follows.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Amount</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">Sent on</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">To account ending</td><td>{{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the payment</a>` +
          `<p class="muted">Depending on the bank it can take a day or two to land. If it hasn't by then, let us know.</p>`,
      },
      ja: {
        subject: "手数料をお支払いいたしました（{{period}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{period}} の手数料を下記のとおりお振込みいたしました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">お支払額</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">お振込日</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">お振込先</td><td>下4桁 {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">お支払い内容を確認する</a>` +
          `<p class="muted">金融機関の処理により、着金まで1～2日いただく場合がございます。期日を過ぎても確認できない場合はお知らせください。</p>`,
      },
      zh: {
        subject: "佣金已支付（{{period}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>{{period}} 的佣金已按以下方式汇出。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">支付金额</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">汇款日</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">收款账户</td><td>尾号 {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看支付记录</a>` +
          `<p class="muted">因银行处理，到账可能需要一两天。若逾期仍未到账，请告知我们。</p>`,
      },
      th: {
        subject: "จ่ายค่าคอมมิชชันแล้ว ({{period}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>เราได้โอนค่าคอมมิชชันงวด {{period}} ตามรายละเอียดด้านล่างแล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ยอดจ่าย</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">วันที่โอน</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">บัญชีปลายทาง</td><td>เลขท้าย {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายการจ่าย</a>` +
          `<p class="muted">ขึ้นอยู่กับธนาคาร เงินอาจเข้าบัญชีช้าหนึ่งถึงสองวัน หากพ้นกำหนดแล้วยังไม่เข้า กรุณาแจ้งเรา</p>`,
      },
      vi: {
        subject: "Đã chi trả hoa hồng ({{period}})",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Hoa hồng kỳ {{period}} đã được chuyển như sau.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số tiền</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">Ngày chuyển</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">Tài khoản nhận</td><td>đuôi {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem giao dịch</a>` +
          `<p class="muted">Tùy ngân hàng, tiền có thể về sau một hai ngày. Quá hạn mà chưa thấy, xin báo cho chúng tôi.</p>`,
      },
    },
  },

  {
    key: "agent.quarterly_review",
    name: "분기 실적 리뷰 안내",
    description: "분기 실적 공유와 미팅 제안. 숫자를 먼저 보여 준비된 대화를 만든다.",
    vars: vars("recipient", "partner_company", "quarter", "referrals_count", "conversion_rate", "commission_total", "meeting_url"),
    tr: {
      ko: {
        subject: "{{quarter}} 실적 공유와 미팅 제안 ({{partner_company}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{quarter}} 동안 {{partner_company}}와 함께한 실적을 정리했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">소개 건수</td><td>{{referrals_count}}건</td></tr>` +
          `<tr><td class="k">계약 전환율</td><td>{{conversion_rate}}</td></tr>` +
          `<tr><td class="k">지급 수수료</td><td>{{commission_total}}</td></tr></table>` +
          `<p>다음 분기에 어떤 매물을 우선 확보할지, 조건은 어떻게 조정할지 함께 이야기 나누고 싶습니다.</p>` +
          `<a class="btn" href="{{meeting_url}}">미팅 시간 고르기</a>` +
          `<p class="muted">일정이 어려우시면 자료만 보내 드려도 됩니다. 편한 쪽으로 말씀해 주세요.</p>`,
      },
      en: {
        subject: "{{quarter}} results and a catch-up ({{partner_company}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Here's how {{quarter}} went for {{partner_company}} and us.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Referrals</td><td>{{referrals_count}}</td></tr>` +
          `<tr><td class="k">Conversion</td><td>{{conversion_rate}}</td></tr>` +
          `<tr><td class="k">Commission paid</td><td>{{commission_total}}</td></tr></table>` +
          `<p>We'd like to talk through which stock to prioritise next quarter and whether the terms need adjusting.</p>` +
          `<a class="btn" href="{{meeting_url}}">Pick a time</a>` +
          `<p class="muted">If a meeting is hard to fit in, we can just send the pack instead. Whichever suits.</p>`,
      },
      ja: {
        subject: "{{quarter}} 実績のご共有と打ち合わせのご提案（{{partner_company}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{quarter}} に {{partner_company}} 様とご一緒した実績をまとめました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ご紹介件数</td><td>{{referrals_count}} 件</td></tr>` +
          `<tr><td class="k">成約率</td><td>{{conversion_rate}}</td></tr>` +
          `<tr><td class="k">お支払い手数料</td><td>{{commission_total}}</td></tr></table>` +
          `<p>次の四半期にどの物件を優先して確保すべきか、条件をどう調整するとよいかを、ご一緒に考えられればと存じます。</p>` +
          `<a class="btn" href="{{meeting_url}}">打ち合わせの日時を選ぶ</a>` +
          `<p class="muted">日程の調整が難しい場合は、資料のみお送りすることも可能です。ご都合のよいほうをお知らせください。</p>`,
      },
      zh: {
        subject: "{{quarter}} 业绩分享与会面提议（{{partner_company}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>现将 {{quarter}} 与 {{partner_company}} 合作的业绩整理如下。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">推荐件数</td><td>{{referrals_count}} 件</td></tr>` +
          `<tr><td class="k">成交转化率</td><td>{{conversion_rate}}</td></tr>` +
          `<tr><td class="k">已付佣金</td><td>{{commission_total}}</td></tr></table>` +
          `<p>下季度应优先备哪些房源、条件是否需要调整，希望能与您当面聊聊。</p>` +
          `<a class="btn" href="{{meeting_url}}">选择会面时间</a>` +
          `<p class="muted">若日程不便，我们也可以仅寄送资料。您觉得哪种方便就选哪种。</p>`,
      },
      th: {
        subject: "ผลงานไตรมาส {{quarter}} และขอนัดหารือ ({{partner_company}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>เราสรุปผลงานที่ร่วมกับ {{partner_company}} ในไตรมาส {{quarter}} ไว้ดังนี้</p>` +
          `<table class="kv">` +
          `<tr><td class="k">จำนวนที่แนะนำ</td><td>{{referrals_count}} ราย</td></tr>` +
          `<tr><td class="k">อัตราปิดการขาย</td><td>{{conversion_rate}}</td></tr>` +
          `<tr><td class="k">ค่าคอมมิชชันที่จ่าย</td><td>{{commission_total}}</td></tr></table>` +
          `<p>เราอยากหารือร่วมกันว่าไตรมาสหน้าควรเตรียมห้องแบบใดเป็นลำดับต้น และควรปรับเงื่อนไขอย่างไร</p>` +
          `<a class="btn" href="{{meeting_url}}">เลือกเวลานัดหมาย</a>` +
          `<p class="muted">หากจัดเวลาลำบาก จะส่งเฉพาะเอกสารให้ก็ได้ แจ้งตามที่สะดวก</p>`,
      },
      vi: {
        subject: "Kết quả {{quarter}} và đề nghị gặp trao đổi ({{partner_company}})",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Chúng tôi tổng hợp kết quả hợp tác với {{partner_company}} trong {{quarter}} như sau.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số khách giới thiệu</td><td>{{referrals_count}}</td></tr>` +
          `<tr><td class="k">Tỷ lệ chốt</td><td>{{conversion_rate}}</td></tr>` +
          `<tr><td class="k">Hoa hồng đã trả</td><td>{{commission_total}}</td></tr></table>` +
          `<p>Chúng tôi muốn cùng bàn xem quý tới nên ưu tiên loại phòng nào và có cần điều chỉnh điều kiện không.</p>` +
          `<a class="btn" href="{{meeting_url}}">Chọn thời gian gặp</a>` +
          `<p class="muted">Nếu khó sắp lịch, chúng tôi có thể chỉ gửi tài liệu. Xin cho biết cách nào tiện hơn.</p>`,
      },
    },
  },

  {
    key: "agent.inventory_update",
    name: "신규 매물·공실 안내 (광고성)",
    description: "파트너 대상 매물 안내. 광고성이므로 수신동의 확인 후 발송한다.",
    vars: vars("recipient", "partner_company", "new_count", "highlights", "url", "unsubscribe_url"),
    tr: {
      ko: {
        subject: "새로 나온 매물 {{new_count}}건 안내",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>이번에 새로 나온 매물 {{new_count}}건을 정리해 보내 드립니다.</p>` +
          `<div class="box"><div class="label">눈여겨볼 만한 매물</div><div>{{highlights}}</div></div>` +
          `<a class="btn" href="{{url}}">전체 매물 보기</a>` +
          `<p class="muted">찾으시는 조건이 따로 있으면 알려 주세요. 맞는 매물이 나오면 먼저 알려 드리겠습니다.</p>`,
      },
      en: {
        subject: "{{new_count}} new listings available",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Here are the {{new_count}} properties that have just come available.</p>` +
          `<div class="box"><div class="label">Worth a look</div><div>{{highlights}}</div></div>` +
          `<a class="btn" href="{{url}}">See all listings</a>` +
          `<p class="muted">Tell us what your clients are after and we'll flag matching stock to you first.</p>`,
      },
      ja: {
        subject: "新着物件 {{new_count}} 件のご案内",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>このたび新たに募集を開始した物件 {{new_count}} 件をまとめてご案内いたします。</p>` +
          `<div class="box"><div class="label">おすすめの物件</div><div>{{highlights}}</div></div>` +
          `<a class="btn" href="{{url}}">物件一覧を見る</a>` +
          `<p class="muted">お探しの条件がございましたらお知らせください。合致する物件が出ましたら、優先的にご連絡いたします。</p>`,
      },
      zh: {
        subject: "新增房源 {{new_count}} 套",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>现将本期新上架的 {{new_count}} 套房源整理呈上。</p>` +
          `<div class="box"><div class="label">值得关注</div><div>{{highlights}}</div></div>` +
          `<a class="btn" href="{{url}}">查看全部房源</a>` +
          `<p class="muted">若您有特定的找房条件，请告知我们，有匹配房源时会优先通知您。</p>`,
      },
      th: {
        subject: "ห้องพักใหม่ {{new_count}} รายการ",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>ขอนำเสนอห้องพักที่เพิ่งเปิดให้เช่าใหม่ {{new_count}} รายการ</p>` +
          `<div class="box"><div class="label">รายการที่น่าสนใจ</div><div>{{highlights}}</div></div>` +
          `<a class="btn" href="{{url}}">ดูรายการทั้งหมด</a>` +
          `<p class="muted">หากมีเงื่อนไขที่ท่านกำลังมองหา แจ้งเราได้ เมื่อมีห้องตรงเงื่อนไข เราจะแจ้งท่านก่อน</p>`,
      },
      vi: {
        subject: "{{new_count}} căn mới có sẵn",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Chúng tôi xin giới thiệu {{new_count}} căn vừa mở cho thuê.</p>` +
          `<div class="box"><div class="label">Đáng chú ý</div><div>{{highlights}}</div></div>` +
          `<a class="btn" href="{{url}}">Xem toàn bộ danh sách</a>` +
          `<p class="muted">Nếu quý công ty đang tìm loại phòng cụ thể, xin cho biết — có căn phù hợp chúng tôi sẽ báo trước.</p>`,
      },
    },
  },

  {
    key: "cs.partner_ticket_received",
    name: "파트너 문의 접수",
    description: "파트너가 낸 문의 접수 확인. 실무 지연이 걸린 건이므로 응답 목표를 명시한다.",
    vars: vars("recipient", "ref", "subject_line", "response_hours", "url"),
    tr: {
      ko: {
        subject: "문의를 접수했습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>보내 주신 문의를 접수했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">접수번호</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">문의 내용</td><td>{{subject_line}}</td></tr></table>` +
          `<p>{{response_hours}}시간 안에 회신드립니다. 고객 응대가 걸린 건이면 답장으로 알려 주세요. 우선 처리하겠습니다.</p>` +
          `<a class="btn" href="{{url}}">문의 내역 보기</a>`,
      },
      en: {
        subject: "We've received your enquiry ({{ref}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Your enquiry is logged.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Reference</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">About</td><td>{{subject_line}}</td></tr></table>` +
          `<p>We'll reply within {{response_hours}} hours. If a client is waiting on this, say so in a reply and we'll bring it forward.</p>` +
          `<a class="btn" href="{{url}}">View your enquiry</a>`,
      },
      ja: {
        subject: "お問い合わせを受け付けました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>お問い合わせを承りました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">受付番号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">お問い合わせ内容</td><td>{{subject_line}}</td></tr></table>` +
          `<p>{{response_hours}} 時間以内にご返信いたします。お客様対応が絡む件でしたら、ご返信にてお知らせください。優先して対応いたします。</p>` +
          `<a class="btn" href="{{url}}">お問い合わせ内容を確認する</a>`,
      },
      zh: {
        subject: "已收到您的咨询（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>您的咨询已登记受理。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">受理编号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">咨询内容</td><td>{{subject_line}}</td></tr></table>` +
          `<p>我们会在 {{response_hours}} 小时内回复。若涉及客户等候，请在回复中说明，我们会优先处理。</p>` +
          `<a class="btn" href="{{url}}">查看咨询记录</a>`,
      },
      th: {
        subject: "รับเรื่องสอบถามแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>เราได้รับเรื่องที่ท่านสอบถามแล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">หมายเลขรับเรื่อง</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">เรื่อง</td><td>{{subject_line}}</td></tr></table>` +
          `<p>เราจะตอบกลับภายใน {{response_hours}} ชั่วโมง หากมีลูกค้ารออยู่ กรุณาแจ้งในการตอบกลับ เราจะเร่งให้ก่อน</p>` +
          `<a class="btn" href="{{url}}">ดูเรื่องที่สอบถาม</a>`,
      },
      vi: {
        subject: "Đã tiếp nhận yêu cầu ({{ref}})",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Yêu cầu của quý công ty đã được ghi nhận.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số tiếp nhận</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Nội dung</td><td>{{subject_line}}</td></tr></table>` +
          `<p>Chúng tôi sẽ phản hồi trong vòng {{response_hours}} giờ. Nếu có khách đang chờ, xin nói rõ khi trả lời để chúng tôi ưu tiên.</p>` +
          `<a class="btn" href="{{url}}">Xem yêu cầu</a>`,
      },
    },
  },

  {
    key: "cs.partner_ticket_resolved",
    name: "파트너 문의 처리 완료",
    description: "처리 결과 통보. 파트너가 고객에게 그대로 전할 수 있는 수준으로 쓴다.",
    vars: vars("recipient", "ref", "action_taken", "resolution", "url"),
    tr: {
      ko: {
        subject: "문의가 처리되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>접수번호 {{ref}} 문의를 처리했습니다.</p>` +
          `<div class="box"><div class="label">조치 내용</div><div>{{action_taken}}</div></div>` +
          `<table class="kv"><tr><td class="k">처리 결과</td><td>{{resolution}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">처리 내역 보기</a>` +
          `<p class="muted">고객에게 그대로 전하셔도 되는 내용입니다. 더 필요한 자료가 있으면 말씀해 주세요.</p>`,
      },
      en: {
        subject: "Your enquiry is resolved ({{ref}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Enquiry {{ref}} has been dealt with.</p>` +
          `<div class="box"><div class="label">What we did</div><div>{{action_taken}}</div></div>` +
          `<table class="kv"><tr><td class="k">Outcome</td><td>{{resolution}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the details</a>` +
          `<p class="muted">This is written so you can pass it to the client as it stands. Ask if you need anything further.</p>`,
      },
      ja: {
        subject: "お問い合わせに対応いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>受付番号 {{ref}} のお問い合わせに対応いたしました。</p>` +
          `<div class="box"><div class="label">対応内容</div><div>{{action_taken}}</div></div>` +
          `<table class="kv"><tr><td class="k">対応結果</td><td>{{resolution}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">対応内容を確認する</a>` +
          `<p class="muted">お客様へそのままお伝えいただける内容です。追加の資料が必要でしたらお申し付けください。</p>`,
      },
      zh: {
        subject: "咨询已处理完毕（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>受理编号 {{ref}} 的咨询已处理完毕。</p>` +
          `<div class="box"><div class="label">处理措施</div><div>{{action_taken}}</div></div>` +
          `<table class="kv"><tr><td class="k">处理结果</td><td>{{resolution}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看处理详情</a>` +
          `<p class="muted">上述内容可直接转达客户。如需补充材料，请随时告知。</p>`,
      },
      th: {
        subject: "ดำเนินการเรื่องสอบถามเสร็จแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>เรื่องหมายเลข {{ref}} ดำเนินการเสร็จเรียบร้อยแล้ว</p>` +
          `<div class="box"><div class="label">สิ่งที่ดำเนินการ</div><div>{{action_taken}}</div></div>` +
          `<table class="kv"><tr><td class="k">ผลการดำเนินการ</td><td>{{resolution}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียด</a>` +
          `<p class="muted">เนื้อหานี้ส่งต่อให้ลูกค้าได้เลย หากต้องการเอกสารเพิ่ม แจ้งได้</p>`,
      },
      vi: {
        subject: "Yêu cầu đã được xử lý ({{ref}})",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Yêu cầu số {{ref}} đã được xử lý xong.</p>` +
          `<div class="box"><div class="label">Việc đã làm</div><div>{{action_taken}}</div></div>` +
          `<table class="kv"><tr><td class="k">Kết quả</td><td>{{resolution}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem chi tiết</a>` +
          `<p class="muted">Nội dung này quý công ty có thể chuyển nguyên văn cho khách. Cần thêm tài liệu gì, xin cứ báo.</p>`,
      },
    },
  },

  {
    key: "survey.partner_csat",
    name: "파트너 만족도 조사",
    description: "협업 경험 조사. 응답이 조건 협상으로 이어질 수 있음을 밝혀 참여 유인을 만든다.",
    vars: vars("recipient", "partner_company", "url", "minutes", "close_date"),
    tr: {
      ko: {
        subject: "협업하며 느끼신 점을 들려주세요",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{partner_company}}와 함께 일하며 저희 쪽에서 아쉬웠던 부분이 있었는지 여쭙고 싶습니다.</p>` +
          `<a class="btn" href="{{url}}">설문 참여하기</a>` +
          `<p>{{minutes}}분이면 됩니다. 매물 정보의 정확도, 응답 속도, 수수료 조건, 포털 사용성 가운데 불편했던 점을 솔직하게 적어 주세요.</p>` +
          `<p class="muted">답변은 다음 계약 조건을 논의할 때 실제로 참고합니다. {{close_date}}까지 열려 있습니다.</p>`,
      },
      en: {
        subject: "How has working with us been?",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>We'd like to know where we've fallen short in working with {{partner_company}}.</p>` +
          `<a class="btn" href="{{url}}">Take the survey</a>` +
          `<p>It takes {{minutes}} minutes. Be candid about listing accuracy, how quickly we respond, commission terms and how usable the portal is.</p>` +
          `<p class="muted">We do use the answers when the next set of terms comes up for discussion. Open until {{close_date}}.</p>`,
      },
      ja: {
        subject: "ご協業のご感想をお聞かせください",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{partner_company}} 様とご一緒するなかで、弊社側に至らぬ点がなかったかをお伺いしたく存じます。</p>` +
          `<a class="btn" href="{{url}}">アンケートに答える</a>` +
          `<p>{{minutes}} 分ほどで終わります。物件情報の正確さ、ご返答の速さ、手数料条件、ポータルの使いやすさについて、率直にお書きください。</p>` +
          `<p class="muted">ご回答は次回の条件のご相談の際に実際に参考といたします。{{close_date}} まで受け付けております。</p>`,
      },
      zh: {
        subject: "合作至今，感受如何？",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>我们想了解在与 {{partner_company}} 的合作中，我方有哪些做得不到位的地方。</p>` +
          `<a class="btn" href="{{url}}">参与问卷</a>` +
          `<p>约 {{minutes}} 分钟。请就房源信息准确度、响应速度、佣金条件、门户易用性等方面坦率提出不便之处。</p>` +
          `<p class="muted">您的答复会在下次商议合作条件时实际参考。问卷开放至 {{close_date}}。</p>`,
      },
      th: {
        subject: "ร่วมงานกับเราแล้วรู้สึกอย่างไรบ้าง",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>เราอยากทราบว่าในการทำงานร่วมกับ {{partner_company}} ฝ่ายเรายังบกพร่องตรงไหนบ้าง</p>` +
          `<a class="btn" href="{{url}}">ตอบแบบสอบถาม</a>` +
          `<p>ใช้เวลาราว {{minutes}} นาที กรุณาเขียนอย่างตรงไปตรงมาเรื่องความถูกต้องของข้อมูลห้องพัก ความเร็วในการตอบ เงื่อนไขค่าคอมมิชชัน และความสะดวกในการใช้พอร์ทัล</p>` +
          `<p class="muted">คำตอบจะถูกนำไปใช้จริงตอนหารือเงื่อนไขรอบถัดไป เปิดรับถึงวันที่ {{close_date}}</p>`,
      },
      vi: {
        subject: "Hợp tác với chúng tôi thế nào?",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Chúng tôi muốn biết trong quá trình làm việc với {{partner_company}}, phía chúng tôi còn thiếu sót ở đâu.</p>` +
          `<a class="btn" href="{{url}}">Trả lời khảo sát</a>` +
          `<p>Chỉ mất {{minutes}} phút. Xin quý công ty nói thẳng về độ chính xác của thông tin phòng, tốc độ phản hồi, điều kiện hoa hồng và mức độ dễ dùng của cổng đối tác.</p>` +
          `<p class="muted">Câu trả lời sẽ được dùng thật khi bàn điều khoản kỳ tới. Mở đến ngày {{close_date}}.</p>`,
      },
    },
  },
];

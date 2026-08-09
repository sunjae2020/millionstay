// owner — 소유주(임대인) 리포트·정산 (owner.*)
//
// 🚨 **세입자 신원을 노출하지 않는다.** 소유주 포털은 설계상 세입자를 마스킹한다
//    (owner-portal.ts: "owner portal never exposes full guest details"). 메일도 같은
//    선을 지켜야 하며, 포털에서 가린 것을 메일로 흘리면 마스킹이 무의미해진다.
//    → 세입자 이름·연락처·국적·직장 변수를 두지 않는다. 필요한 것은 **세대·기간·금액**이다.
//    분쟁이나 법적 절차로 신원 제공이 필요하면 메일 템플릿이 아니라 별도 절차로 처리한다.
//
// ⚠️ 소유주와 세입자는 이해가 상충할 수 있다. 세입자에게 불리한 판단을 소유주에게
//    미리 흘리지 않는다(예: 연체 사실은 정산 숫자로만 드러내고 사유를 쓰지 않는다).
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const OWNER = [
  {
    key: "owner.portal_welcome",
    name: "소유주 포털 안내",
    description: "포털 계정 개설 안내. 무엇을 볼 수 있는지 먼저 알린다.",
    vars: vars("recipient", "property_name", "url", "contact_name", "contact_phone"),
    tr: {
      ko: {
        subject: "소유주 포털을 이용하실 수 있습니다",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{property_name}} 소유주 포털 계정을 만들어 드렸습니다. 포털에서 이런 내용을 보실 수 있습니다.</p>` +
          `<ul>` +
          `<li>세대별 임대 현황과 공실</li>` +
          `<li>월별 수입과 지출</li>` +
          `<li>정산 내역과 지급 기록</li>` +
          `<li>점검·수선 이력</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">포털 접속하기</a>` +
          `<p class="muted">담당은 {{contact_name}} ({{contact_phone}})입니다. 숫자 가운데 이해되지 않는 부분이 있으면 언제든 물어봐 주세요.</p>`,
      },
      en: {
        subject: "Your owner portal is ready",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Your owner portal account for {{property_name}} is open. In it you can see:</p>` +
          `<ul>` +
          `<li>Occupancy and vacancies by unit</li>` +
          `<li>Monthly income and expenditure</li>` +
          `<li>Settlements and payment records</li>` +
          `<li>Inspection and repair history</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">Open the portal</a>` +
          `<p class="muted">Your contact is {{contact_name}} on {{contact_phone}}. If any of the figures don't make sense, just ask.</p>`,
      },
      ja: {
        subject: "オーナーポータルをご利用いただけます",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{property_name}} のオーナーポータルのアカウントを開設いたしました。ポータルでは下記をご覧いただけます。</p>` +
          `<ul>` +
          `<li>お部屋ごとの稼働状況と空室</li>` +
          `<li>月々の収入と支出</li>` +
          `<li>精算内容とお支払い記録</li>` +
          `<li>点検・修繕の履歴</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">ポータルへ</a>` +
          `<p class="muted">担当は {{contact_name}}（{{contact_phone}}）です。数字でご不明な点がございましたら、いつでもお尋ねください。</p>`,
      },
      zh: {
        subject: "业主门户已开通",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{property_name}} 的业主门户账户已开通。门户中可查看：</p>` +
          `<ul>` +
          `<li>各单元的出租状况与空置情况</li>` +
          `<li>每月收入与支出</li>` +
          `<li>结算明细与支付记录</li>` +
          `<li>检查与维修履历</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">进入门户</a>` +
          `<p class="muted">对接人为 {{contact_name}}（{{contact_phone}}）。若对数字有疑问，随时垂询。</p>`,
      },
      th: {
        subject: "พอร์ทัลเจ้าของทรัพย์พร้อมใช้งานแล้ว",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>บัญชีพอร์ทัลเจ้าของทรัพย์สำหรับ {{property_name}} เปิดใช้งานแล้ว ในพอร์ทัลท่านดูได้ดังนี้</p>` +
          `<ul>` +
          `<li>สถานะการเช่าและห้องว่างรายห้อง</li>` +
          `<li>รายรับรายจ่ายรายเดือน</li>` +
          `<li>รายละเอียดการคืนเงินและบันทึกการจ่าย</li>` +
          `<li>ประวัติการตรวจและซ่อมบำรุง</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">เข้าสู่พอร์ทัล</a>` +
          `<p class="muted">ผู้ประสานงานคือ {{contact_name}} ({{contact_phone}}) หากตัวเลขตรงไหนไม่ชัดเจน สอบถามได้ตลอด</p>`,
      },
      vi: {
        subject: "Cổng chủ sở hữu đã sẵn sàng",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Tài khoản cổng chủ sở hữu cho {{property_name}} đã mở. Tại đây quý vị xem được:</p>` +
          `<ul>` +
          `<li>Tình trạng cho thuê và phòng trống theo từng căn</li>` +
          `<li>Thu chi hằng tháng</li>` +
          `<li>Bảng quyết toán và lịch sử chi trả</li>` +
          `<li>Lịch sử kiểm tra và sửa chữa</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">Vào cổng</a>` +
          `<p class="muted">Người phụ trách là {{contact_name}} ({{contact_phone}}). Nếu con số nào chưa rõ, xin cứ hỏi.</p>`,
      },
    },
  },

  {
    key: "owner.monthly_report",
    name: "월간 임대·수익 리포트",
    description: "월간 운영 보고. 세대별 세입자가 아니라 숫자로만 보여 준다.",
    vars: vars("recipient", "property_name", "period", "occupancy_rate", "occupied_units", "total_units", "gross_income", "expenses", "net_income", "url"),
    tr: {
      ko: {
        subject: "{{period}} 운영 리포트 ({{property_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{period}} {{property_name}} 운영 결과를 보내 드립니다. 세대별 상세는 첨부한 리포트에 있습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">가동률</td><td>{{occupancy_rate}} ({{occupied_units}}/{{total_units}}세대)</td></tr>` +
          `<tr><td class="k">수입</td><td>{{gross_income}}</td></tr>` +
          `<tr><td class="k">지출</td><td>{{expenses}}</td></tr>` +
          `<tr><td class="k">순수익</td><td>{{net_income}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">포털에서 자세히 보기</a>` +
          `<p class="muted">지출 항목이나 공실 사유가 궁금하시면 답장 주세요. 근거 자료와 함께 설명해 드리겠습니다.</p>`,
      },
      en: {
        subject: "{{period}} report for {{property_name}}",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Here's how {{property_name}} performed in {{period}}. The unit-by-unit detail is in the attached report.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Occupancy</td><td>{{occupancy_rate}} ({{occupied_units}} of {{total_units}})</td></tr>` +
          `<tr><td class="k">Income</td><td>{{gross_income}}</td></tr>` +
          `<tr><td class="k">Expenditure</td><td>{{expenses}}</td></tr>` +
          `<tr><td class="k">Net</td><td>{{net_income}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">See more in the portal</a>` +
          `<p class="muted">If you'd like to go through the expenses or why a unit sat empty, reply and we'll take you through the workings.</p>`,
      },
      ja: {
        subject: "{{period}} 運用レポート（{{property_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{period}} の {{property_name}} の運用結果をお送りいたします。お部屋ごとの詳細は添付のレポートをご覧ください。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">稼働率</td><td>{{occupancy_rate}}（{{occupied_units}}/{{total_units}} 室）</td></tr>` +
          `<tr><td class="k">収入</td><td>{{gross_income}}</td></tr>` +
          `<tr><td class="k">支出</td><td>{{expenses}}</td></tr>` +
          `<tr><td class="k">純収益</td><td>{{net_income}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ポータルで詳しく見る</a>` +
          `<p class="muted">支出の内訳や空室の事情についてご不明な点がございましたら、ご返信ください。根拠資料を添えてご説明いたします。</p>`,
      },
      zh: {
        subject: "{{period}} 运营报告（{{property_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>现将 {{period}} {{property_name}} 的运营结果奉上。逐户明细请见随附报告。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">出租率</td><td>{{occupancy_rate}}（{{occupied_units}}/{{total_units}} 户）</td></tr>` +
          `<tr><td class="k">收入</td><td>{{gross_income}}</td></tr>` +
          `<tr><td class="k">支出</td><td>{{expenses}}</td></tr>` +
          `<tr><td class="k">净收益</td><td>{{net_income}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">在门户中查看详情</a>` +
          `<p class="muted">若想了解支出明细或空置原因，请回复本邮件，我们会附上依据资料为您说明。</p>`,
      },
      th: {
        subject: "รายงานผลการดำเนินงานงวด {{period}} ({{property_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ขอส่งผลการดำเนินงานของ {{property_name}} ประจำงวด {{period}} รายละเอียดรายห้องอยู่ในรายงานที่แนบ</p>` +
          `<table class="kv">` +
          `<tr><td class="k">อัตราการเช่า</td><td>{{occupancy_rate}} ({{occupied_units}}/{{total_units}} ห้อง)</td></tr>` +
          `<tr><td class="k">รายรับ</td><td>{{gross_income}}</td></tr>` +
          `<tr><td class="k">รายจ่าย</td><td>{{expenses}}</td></tr>` +
          `<tr><td class="k">กำไรสุทธิ</td><td>{{net_income}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดในพอร์ทัล</a>` +
          `<p class="muted">หากต้องการทราบรายการค่าใช้จ่ายหรือสาเหตุที่ห้องว่าง ตอบกลับมาได้ เราจะอธิบายพร้อมเอกสารประกอบ</p>`,
      },
      vi: {
        subject: "Báo cáo vận hành kỳ {{period}} ({{property_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi xin gửi kết quả vận hành {{property_name}} kỳ {{period}}. Chi tiết từng căn có trong báo cáo đính kèm.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Tỷ lệ lấp đầy</td><td>{{occupancy_rate}} ({{occupied_units}}/{{total_units}} căn)</td></tr>` +
          `<tr><td class="k">Thu</td><td>{{gross_income}}</td></tr>` +
          `<tr><td class="k">Chi</td><td>{{expenses}}</td></tr>` +
          `<tr><td class="k">Lợi nhuận ròng</td><td>{{net_income}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem chi tiết trên cổng</a>` +
          `<p class="muted">Nếu quý vị muốn xem kỹ khoản chi hay lý do căn trống, xin trả lời email để chúng tôi giải thích kèm chứng từ.</p>`,
      },
    },
  },

  {
    key: "owner.settlement_statement",
    name: "월 정산서",
    description: "정산 명세 송부. 수입에서 무엇을 뺐는지 항목으로 밝힌다.",
    vars: vars("recipient", "property_name", "period", "rent_collected", "management_fee", "repair_cost", "other_deduction", "net_payout", "payout_date", "url"),
    tr: {
      ko: {
        subject: "{{period}} 정산서 ({{property_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{period}} 정산서를 보내 드립니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">수납 임대료</td><td>{{rent_collected}}</td></tr>` +
          `<tr><td class="k">관리 수수료</td><td>{{management_fee}}</td></tr>` +
          `<tr><td class="k">수선비</td><td>{{repair_cost}}</td></tr>` +
          `<tr><td class="k">기타 공제</td><td>{{other_deduction}}</td></tr>` +
          `<tr><td class="k">지급액</td><td>{{net_payout}}</td></tr>` +
          `<tr><td class="k">지급 예정일</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">정산 상세 보기</a>` +
          `<p class="muted">수선비 영수증과 사진은 포털에 올려 두었습니다. 항목이 맞지 않으면 지급일 전에 알려 주세요.</p>`,
      },
      en: {
        subject: "Settlement for {{period}} ({{property_name}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Here is your settlement for {{period}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Rent collected</td><td>{{rent_collected}}</td></tr>` +
          `<tr><td class="k">Management fee</td><td>{{management_fee}}</td></tr>` +
          `<tr><td class="k">Repairs</td><td>{{repair_cost}}</td></tr>` +
          `<tr><td class="k">Other deductions</td><td>{{other_deduction}}</td></tr>` +
          `<tr><td class="k">Payable to you</td><td>{{net_payout}}</td></tr>` +
          `<tr><td class="k">Payment date</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the settlement</a>` +
          `<p class="muted">Receipts and photos for the repairs are in the portal. If a line doesn't look right, tell us before the payment date.</p>`,
      },
      ja: {
        subject: "{{period}} 精算書（{{property_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{period}} の精算書をお送りいたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">収納賃料</td><td>{{rent_collected}}</td></tr>` +
          `<tr><td class="k">管理手数料</td><td>{{management_fee}}</td></tr>` +
          `<tr><td class="k">修繕費</td><td>{{repair_cost}}</td></tr>` +
          `<tr><td class="k">その他控除</td><td>{{other_deduction}}</td></tr>` +
          `<tr><td class="k">お支払額</td><td>{{net_payout}}</td></tr>` +
          `<tr><td class="k">お支払予定日</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">精算内容を確認する</a>` +
          `<p class="muted">修繕費の領収書と写真はポータルに掲載しております。項目に相違がございましたら、お支払日までにお知らせください。</p>`,
      },
      zh: {
        subject: "{{period}} 结算书（{{property_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>现将 {{period}} 的结算书发送给您。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">已收租金</td><td>{{rent_collected}}</td></tr>` +
          `<tr><td class="k">管理费</td><td>{{management_fee}}</td></tr>` +
          `<tr><td class="k">维修费</td><td>{{repair_cost}}</td></tr>` +
          `<tr><td class="k">其他扣除</td><td>{{other_deduction}}</td></tr>` +
          `<tr><td class="k">应付金额</td><td>{{net_payout}}</td></tr>` +
          `<tr><td class="k">预计支付日</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看结算详情</a>` +
          `<p class="muted">维修的发票与照片已上传至门户。若某项不符，请在支付日前告知我们。</p>`,
      },
      th: {
        subject: "ใบสรุปการเงินงวด {{period}} ({{property_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ขอส่งใบสรุปการเงินงวด {{period}}</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ค่าเช่าที่เก็บได้</td><td>{{rent_collected}}</td></tr>` +
          `<tr><td class="k">ค่าบริหารจัดการ</td><td>{{management_fee}}</td></tr>` +
          `<tr><td class="k">ค่าซ่อมบำรุง</td><td>{{repair_cost}}</td></tr>` +
          `<tr><td class="k">รายการหักอื่น</td><td>{{other_deduction}}</td></tr>` +
          `<tr><td class="k">ยอดจ่ายให้ท่าน</td><td>{{net_payout}}</td></tr>` +
          `<tr><td class="k">วันที่จ่าย</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียด</a>` +
          `<p class="muted">ใบเสร็จและภาพถ่ายงานซ่อมอยู่ในพอร์ทัลแล้ว หากรายการใดไม่ถูกต้อง กรุณาแจ้งก่อนวันจ่าย</p>`,
      },
      vi: {
        subject: "Bảng quyết toán kỳ {{period}} ({{property_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi xin gửi bảng quyết toán kỳ {{period}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Tiền thuê đã thu</td><td>{{rent_collected}}</td></tr>` +
          `<tr><td class="k">Phí quản lý</td><td>{{management_fee}}</td></tr>` +
          `<tr><td class="k">Chi phí sửa chữa</td><td>{{repair_cost}}</td></tr>` +
          `<tr><td class="k">Khấu trừ khác</td><td>{{other_deduction}}</td></tr>` +
          `<tr><td class="k">Số tiền chi trả</td><td>{{net_payout}}</td></tr>` +
          `<tr><td class="k">Ngày chi trả</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem chi tiết quyết toán</a>` +
          `<p class="muted">Hóa đơn và ảnh sửa chữa đã có trên cổng. Nếu khoản nào chưa đúng, xin báo trước ngày chi trả.</p>`,
      },
    },
  },

  {
    key: "owner.payout_sent",
    name: "정산금 지급 완료",
    description: "송금 완료 통보. 계좌 끝자리와 송금일로 대사를 돕는다.",
    vars: vars("recipient", "property_name", "period", "net_payout", "paid_date", "account_tail", "url"),
    tr: {
      ko: {
        subject: "{{period}} 정산금을 보내 드렸습니다",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{property_name}} {{period}} 정산금을 송금했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">지급액</td><td>{{net_payout}}</td></tr>` +
          `<tr><td class="k">송금일</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">입금 계좌</td><td>끝자리 {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">지급 내역 보기</a>` +
          `<p class="muted">은행 사정에 따라 하루 이틀 걸릴 수 있습니다. 그 뒤에도 입금이 확인되지 않으면 알려 주세요.</p>`,
      },
      en: {
        subject: "Your {{period}} payment has been sent",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>The {{period}} settlement for {{property_name}} has been transferred.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Amount</td><td>{{net_payout}}</td></tr>` +
          `<tr><td class="k">Sent on</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">To account ending</td><td>{{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the payment</a>` +
          `<p class="muted">Banks can take a day or two. If it hasn't arrived after that, let us know.</p>`,
      },
      ja: {
        subject: "{{period}} の精算金をお振込みしました",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{property_name}} の {{period}} 精算金をお振込みいたしました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">お支払額</td><td>{{net_payout}}</td></tr>` +
          `<tr><td class="k">お振込日</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">お振込先</td><td>下4桁 {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">お支払い内容を確認する</a>` +
          `<p class="muted">金融機関の処理により1～2日かかる場合がございます。その後も入金が確認できない場合はお知らせください。</p>`,
      },
      zh: {
        subject: "{{period}} 结算款已汇出",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{property_name}} {{period}} 的结算款已汇出。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">支付金额</td><td>{{net_payout}}</td></tr>` +
          `<tr><td class="k">汇款日</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">收款账户</td><td>尾号 {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看支付记录</a>` +
          `<p class="muted">银行处理可能需要一两天。若之后仍未到账，请告知我们。</p>`,
      },
      th: {
        subject: "โอนเงินงวด {{period}} แล้ว",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้โอนเงินส่วนแบ่งงวด {{period}} ของ {{property_name}} แล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ยอดจ่าย</td><td>{{net_payout}}</td></tr>` +
          `<tr><td class="k">วันที่โอน</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">บัญชีปลายทาง</td><td>เลขท้าย {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายการจ่าย</a>` +
          `<p class="muted">ธนาคารอาจใช้เวลาหนึ่งถึงสองวัน หากพ้นกำหนดแล้วยังไม่เข้า กรุณาแจ้งเรา</p>`,
      },
      vi: {
        subject: "Đã chuyển tiền kỳ {{period}}",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Khoản quyết toán kỳ {{period}} của {{property_name}} đã được chuyển.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số tiền</td><td>{{net_payout}}</td></tr>` +
          `<tr><td class="k">Ngày chuyển</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">Tài khoản nhận</td><td>đuôi {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem giao dịch</a>` +
          `<p class="muted">Ngân hàng có thể mất một hai ngày. Sau đó vẫn chưa thấy, xin báo cho chúng tôi.</p>`,
      },
    },
  },

  {
    key: "owner.vacancy_alert",
    name: "공실 발생 알림",
    description: "공실 통보와 대응 계획. 불안을 키우지 말고 무엇을 하고 있는지 알린다.",
    vars: vars("recipient", "property_name", "space_name", "vacant_since", "asking_rent", "action_plan", "url"),
    tr: {
      ko: {
        subject: "공실 안내 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{property_name}} {{space_name}}이(가) {{vacant_since}}부터 공실입니다.</p>` +
          `<table class="kv"><tr><td class="k">희망 임대료</td><td>{{asking_rent}}</td></tr></table>` +
          `<div class="box"><div class="label">진행 중인 조치</div><div>{{action_plan}}</div></div>` +
          `<a class="btn" href="{{url}}">공실 현황 보기</a>` +
          `<p class="muted">임대료나 조건을 조정하면 새 임차인을 더 빨리 찾을 수 있습니다. 상의하고 싶으시면 말씀해 주세요.</p>`,
      },
      en: {
        subject: "{{space_name}} is vacant",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>{{space_name}} at {{property_name}} has been vacant since {{vacant_since}}.</p>` +
          `<table class="kv"><tr><td class="k">Asking rent</td><td>{{asking_rent}}</td></tr></table>` +
          `<div class="box"><div class="label">What we're doing</div><div>{{action_plan}}</div></div>` +
          `<a class="btn" href="{{url}}">See vacancies</a>` +
          `<p class="muted">Adjusting the rent or the terms often shortens the void. Happy to talk it through if you'd like.</p>`,
      },
      ja: {
        subject: "空室のご案内（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{property_name}} の {{space_name}} が {{vacant_since}} より空室となっております。</p>` +
          `<table class="kv"><tr><td class="k">募集賃料</td><td>{{asking_rent}}</td></tr></table>` +
          `<div class="box"><div class="label">実施中の対応</div><div>{{action_plan}}</div></div>` +
          `<a class="btn" href="{{url}}">空室状況を見る</a>` +
          `<p class="muted">賃料や条件を調整いたしますと、決まりが早くなることがございます。ご相談をご希望でしたらお申し付けください。</p>`,
      },
      zh: {
        subject: "空置通知（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{property_name}} 的 {{space_name}} 自 {{vacant_since}} 起处于空置状态。</p>` +
          `<table class="kv"><tr><td class="k">挂牌租金</td><td>{{asking_rent}}</td></tr></table>` +
          `<div class="box"><div class="label">正在采取的措施</div><div>{{action_plan}}</div></div>` +
          `<a class="btn" href="{{url}}">查看空置情况</a>` +
          `<p class="muted">适度调整租金或条件往往能缩短空置期。若愿商议，请随时告知。</p>`,
      },
      th: {
        subject: "แจ้งห้องว่าง ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>{{space_name}} ของ {{property_name}} ว่างมาตั้งแต่ {{vacant_since}}</p>` +
          `<table class="kv"><tr><td class="k">ค่าเช่าที่ตั้งไว้</td><td>{{asking_rent}}</td></tr></table>` +
          `<div class="box"><div class="label">สิ่งที่เรากำลังดำเนินการ</div><div>{{action_plan}}</div></div>` +
          `<a class="btn" href="{{url}}">ดูสถานะห้องว่าง</a>` +
          `<p class="muted">การปรับค่าเช่าหรือเงื่อนไขมักช่วยให้ปล่อยเช่าได้เร็วขึ้น หากต้องการหารือ แจ้งได้เลย</p>`,
      },
      vi: {
        subject: "Thông báo phòng trống ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>{{space_name}} tại {{property_name}} đã trống từ {{vacant_since}}.</p>` +
          `<table class="kv"><tr><td class="k">Giá chào thuê</td><td>{{asking_rent}}</td></tr></table>` +
          `<div class="box"><div class="label">Chúng tôi đang làm gì</div><div>{{action_plan}}</div></div>` +
          `<a class="btn" href="{{url}}">Xem tình trạng trống</a>` +
          `<p class="muted">Điều chỉnh giá thuê hoặc điều kiện thường rút ngắn thời gian trống. Nếu quý vị muốn bàn thêm, xin cho biết.</p>`,
      },
    },
  },

  {
    key: "owner.new_tenancy",
    name: "신규 임차 계약 보고",
    description: "계약 체결 보고. 세입자 신원이 아니라 계약 조건을 보고한다.",
    vars: vars("recipient", "property_name", "space_name", "start_date", "end_date", "monthly_rent", "deposit_amount", "url"),
    tr: {
      ko: {
        subject: "신규 계약 체결 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{property_name}} {{space_name}}에 새 임차 계약이 체결되었습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">계약 기간</td><td>{{start_date}} ~ {{end_date}}</td></tr>` +
          `<tr><td class="k">월 임대료</td><td>{{monthly_rent}}</td></tr>` +
          `<tr><td class="k">보증금</td><td>{{deposit_amount}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">계약 내역 보기</a>` +
          `<p class="muted">임차인 개인정보는 개인정보 보호를 위해 공유하지 않습니다. 계약서 사본이 필요하시면 말씀해 주세요.</p>`,
      },
      en: {
        subject: "New tenancy at {{space_name}}",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>A new tenancy has been signed for {{space_name}} at {{property_name}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Term</td><td>{{start_date}} – {{end_date}}</td></tr>` +
          `<tr><td class="k">Monthly rent</td><td>{{monthly_rent}}</td></tr>` +
          `<tr><td class="k">Bond</td><td>{{deposit_amount}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the tenancy</a>` +
          `<p class="muted">We don't share the tenant's personal details, for privacy reasons. Tell us if you need a copy of the agreement.</p>`,
      },
      ja: {
        subject: "新規ご契約のご報告（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{property_name}} の {{space_name}} につきまして、新たに賃貸借契約が成立いたしました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">契約期間</td><td>{{start_date}} ～ {{end_date}}</td></tr>` +
          `<tr><td class="k">月額賃料</td><td>{{monthly_rent}}</td></tr>` +
          `<tr><td class="k">敷金</td><td>{{deposit_amount}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">契約内容を確認する</a>` +
          `<p class="muted">入居者様の個人情報は、個人情報保護の観点から共有いたしません。契約書の写しが必要でしたらお申し付けください。</p>`,
      },
      zh: {
        subject: "新签租约（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{property_name}} 的 {{space_name}} 已签订新的租赁合同。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">租期</td><td>{{start_date}} 至 {{end_date}}</td></tr>` +
          `<tr><td class="k">月租金</td><td>{{monthly_rent}}</td></tr>` +
          `<tr><td class="k">押金</td><td>{{deposit_amount}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看租约详情</a>` +
          `<p class="muted">出于个人信息保护，我们不共享承租人的个人资料。如需合同副本，请告知我们。</p>`,
      },
      th: {
        subject: "ทำสัญญาเช่าใหม่ ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>{{space_name}} ของ {{property_name}} มีการทำสัญญาเช่าใหม่แล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ระยะเวลาเช่า</td><td>{{start_date}} ถึง {{end_date}}</td></tr>` +
          `<tr><td class="k">ค่าเช่ารายเดือน</td><td>{{monthly_rent}}</td></tr>` +
          `<tr><td class="k">เงินประกัน</td><td>{{deposit_amount}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดสัญญา</a>` +
          `<p class="muted">เราไม่เปิดเผยข้อมูลส่วนบุคคลของผู้เช่า เพื่อคุ้มครองความเป็นส่วนตัว หากท่านต้องการสำเนาสัญญา แจ้งได้</p>`,
      },
      vi: {
        subject: "Hợp đồng thuê mới ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>{{space_name}} tại {{property_name}} đã có hợp đồng thuê mới.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Thời hạn</td><td>{{start_date}} – {{end_date}}</td></tr>` +
          `<tr><td class="k">Tiền thuê hằng tháng</td><td>{{monthly_rent}}</td></tr>` +
          `<tr><td class="k">Tiền cọc</td><td>{{deposit_amount}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem chi tiết hợp đồng</a>` +
          `<p class="muted">Vì lý do bảo mật, chúng tôi không chia sẻ thông tin cá nhân của người thuê. Nếu quý vị cần bản sao hợp đồng, xin cho biết.</p>`,
      },
    },
  },

  {
    key: "owner.tenancy_ending",
    name: "계약 만료 예정 보고",
    description: "만료 예정 통보와 갱신 전망. 소유주가 다음 결정을 준비하게 한다.",
    vars: vars("recipient", "property_name", "space_name", "end_date", "renewal_outlook", "market_rent", "url"),
    tr: {
      ko: {
        subject: "계약 만료 예정 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{property_name}} {{space_name}} 계약이 {{end_date}}에 만료됩니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">갱신 전망</td><td>{{renewal_outlook}}</td></tr>` +
          `<tr><td class="k">현재 시세</td><td>{{market_rent}}</td></tr></table>` +
          `<p>갱신 조건을 어떻게 잡을지 미리 정해 주시면 임차인과 협의를 시작하겠습니다. 별말씀 없으시면 현재 조건으로 갱신을 제안합니다.</p>` +
          `<a class="btn" href="{{url}}">계약 내역 보기</a>`,
      },
      en: {
        subject: "Tenancy ending at {{space_name}}",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>The tenancy for {{space_name}} at {{property_name}} ends on {{end_date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Likelihood of renewal</td><td>{{renewal_outlook}}</td></tr>` +
          `<tr><td class="k">Current market rent</td><td>{{market_rent}}</td></tr></table>` +
          `<p>Tell us how you'd like the renewal pitched and we'll open the conversation with the tenant. Hearing nothing, we'll offer renewal on the current terms.</p>` +
          `<a class="btn" href="{{url}}">View the tenancy</a>`,
      },
      ja: {
        subject: "契約満了のご予定（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{property_name}} の {{space_name}} のご契約は {{end_date}} に満了いたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">更新の見通し</td><td>{{renewal_outlook}}</td></tr>` +
          `<tr><td class="k">現在の相場</td><td>{{market_rent}}</td></tr></table>` +
          `<p>更新条件のご方針を事前にお決めいただければ、入居者様との協議を開始いたします。特にご指示がない場合は、現行条件での更新をご提案いたします。</p>` +
          `<a class="btn" href="{{url}}">契約内容を確認する</a>`,
      },
      zh: {
        subject: "租约即将到期（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{property_name}} 的 {{space_name}} 租约将于 {{end_date}} 到期。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">续租预期</td><td>{{renewal_outlook}}</td></tr>` +
          `<tr><td class="k">当前市场租金</td><td>{{market_rent}}</td></tr></table>` +
          `<p>请提前告知续租条件的方针，我们即着手与承租人协商。若无特别指示，我们将按现有条件提出续租。</p>` +
          `<a class="btn" href="{{url}}">查看租约详情</a>`,
      },
      th: {
        subject: "สัญญาเช่าใกล้ครบกำหนด ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>สัญญาเช่า {{space_name}} ของ {{property_name}} จะสิ้นสุดในวันที่ {{end_date}}</p>` +
          `<table class="kv">` +
          `<tr><td class="k">แนวโน้มการต่อสัญญา</td><td>{{renewal_outlook}}</td></tr>` +
          `<tr><td class="k">ค่าเช่าตลาดปัจจุบัน</td><td>{{market_rent}}</td></tr></table>` +
          `<p>หากท่านกำหนดแนวทางเงื่อนไขต่อสัญญาไว้ล่วงหน้า เราจะเริ่มเจรจากับผู้เช่าทันที หากไม่มีคำสั่งเป็นอื่น เราจะเสนอต่อสัญญาตามเงื่อนไขเดิม</p>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดสัญญา</a>`,
      },
      vi: {
        subject: "Hợp đồng sắp hết hạn ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Hợp đồng thuê {{space_name}} tại {{property_name}} sẽ hết hạn ngày {{end_date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Khả năng gia hạn</td><td>{{renewal_outlook}}</td></tr>` +
          `<tr><td class="k">Giá thuê thị trường</td><td>{{market_rent}}</td></tr></table>` +
          `<p>Xin quý vị cho biết định hướng điều kiện gia hạn để chúng tôi bắt đầu thương lượng với người thuê. Nếu không có chỉ dẫn khác, chúng tôi sẽ đề nghị gia hạn theo điều kiện hiện tại.</p>` +
          `<a class="btn" href="{{url}}">Xem chi tiết hợp đồng</a>`,
      },
    },
  },

  {
    key: "owner.maintenance_approval",
    name: "수선비 집행 승인 요청",
    description: "금액이 기준을 넘는 수선의 사전 승인. 방치했을 때의 위험도 함께 알린다.",
    vars: vars("recipient", "property_name", "space_name", "issue", "quote_amount", "risk_if_delayed", "reply_by", "url"),
    tr: {
      ko: {
        subject: "수선 승인을 부탁드립니다 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{property_name}} {{space_name}}에 수선이 필요해 승인을 여쭙습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">내용</td><td>{{issue}}</td></tr>` +
          `<tr><td class="k">견적</td><td>{{quote_amount}}</td></tr></table>` +
          `<div class="box"><div class="label">미뤘을 때의 위험</div><div>{{risk_if_delayed}}</div></div>` +
          `<a class="btn" href="{{url}}">승인 또는 보류하기</a>` +
          `<p>{{reply_by}}까지 회신 주시면 그에 맞춰 진행하겠습니다.</p>` +
          `<p class="muted">다른 업체 견적도 받아 비교해 보길 원하시면 말씀해 주세요.</p>`,
      },
      en: {
        subject: "Approval needed for a repair ({{space_name}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>{{space_name}} at {{property_name}} needs a repair, and we'd like your approval.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Issue</td><td>{{issue}}</td></tr>` +
          `<tr><td class="k">Quote</td><td>{{quote_amount}}</td></tr></table>` +
          `<div class="box"><div class="label">If it's left</div><div>{{risk_if_delayed}}</div></div>` +
          `<a class="btn" href="{{url}}">Approve or hold</a>` +
          `<p>Reply by {{reply_by}} and we'll proceed accordingly.</p>` +
          `<p class="muted">If you'd like more quotes, say so — we'll get comparisons from other contractors.</p>`,
      },
      ja: {
        subject: "修繕のご承認をお願いいたします（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{property_name}} の {{space_name}} に修繕が必要となりましたので、ご承認をお伺いいたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">内容</td><td>{{issue}}</td></tr>` +
          `<tr><td class="k">お見積</td><td>{{quote_amount}}</td></tr></table>` +
          `<div class="box"><div class="label">先送りした場合の懸念</div><div>{{risk_if_delayed}}</div></div>` +
          `<a class="btn" href="{{url}}">承認または保留する</a>` +
          `<p>{{reply_by}} までにご返信いただければ、それに沿って進めてまいります。</p>` +
          `<p class="muted">相見積をご希望でしたらお申し付けください。他社の見積も取り寄せ、比較のうえご提示いたします。</p>`,
      },
      zh: {
        subject: "请批准维修事项（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{property_name}} 的 {{space_name}} 需要维修，特请您批准。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">事项</td><td>{{issue}}</td></tr>` +
          `<tr><td class="k">报价</td><td>{{quote_amount}}</td></tr></table>` +
          `<div class="box"><div class="label">拖延的风险</div><div>{{risk_if_delayed}}</div></div>` +
          `<a class="btn" href="{{url}}">批准或暂缓</a>` +
          `<p>请在 {{reply_by}} 前回复，我们会照此推进。</p>` +
          `<p class="muted">如希望多比几家报价，请告知我们，我们会取其他厂商报价供您比较。</p>`,
      },
      th: {
        subject: "ขออนุมัติงานซ่อม ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>{{space_name}} ของ {{property_name}} จำเป็นต้องซ่อม จึงขออนุมัติจากท่าน</p>` +
          `<table class="kv">` +
          `<tr><td class="k">เรื่อง</td><td>{{issue}}</td></tr>` +
          `<tr><td class="k">ราคาประเมิน</td><td>{{quote_amount}}</td></tr></table>` +
          `<div class="box"><div class="label">ความเสี่ยงหากปล่อยไว้</div><div>{{risk_if_delayed}}</div></div>` +
          `<a class="btn" href="{{url}}">อนุมัติหรือชะลอ</a>` +
          `<p>กรุณาตอบกลับภายใน {{reply_by}} เราจะดำเนินการตามนั้น</p>` +
          `<p class="muted">หากต้องการเปรียบเทียบราคาจากผู้รับเหมารายอื่น แจ้งได้ เราจะขอใบเสนอราคามาให้</p>`,
      },
      vi: {
        subject: "Xin phê duyệt việc sửa chữa ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>{{space_name}} tại {{property_name}} cần sửa chữa, chúng tôi xin ý kiến phê duyệt của quý vị.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Nội dung</td><td>{{issue}}</td></tr>` +
          `<tr><td class="k">Báo giá</td><td>{{quote_amount}}</td></tr></table>` +
          `<div class="box"><div class="label">Rủi ro nếu để lâu</div><div>{{risk_if_delayed}}</div></div>` +
          `<a class="btn" href="{{url}}">Duyệt hoặc tạm hoãn</a>` +
          `<p>Xin phản hồi trước {{reply_by}} để chúng tôi tiến hành.</p>` +
          `<p class="muted">Nếu quý vị muốn tham khảo thêm báo giá, xin cho biết — chúng tôi sẽ lấy báo giá của nhà thầu khác để so sánh.</p>`,
      },
    },
  },

  {
    key: "owner.inspection_report",
    name: "점검 결과 공유",
    description: "정기 점검 결과를 소유주에게 공유. 자산 상태 관점으로 정리한다.",
    vars: vars("recipient", "property_name", "date", "summary", "action_items", "estimated_cost", "url"),
    tr: {
      ko: {
        subject: "점검 결과 안내 ({{property_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{date}}에 진행한 {{property_name}} 점검 결과를 보내 드립니다. 자세한 내용은 첨부한 리포트에 있습니다.</p>` +
          `<div class="box"><div class="label">요약</div><div>{{summary}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">조치할 항목</td><td>{{action_items}}</td></tr>` +
          `<tr><td class="k">예상 비용</td><td>{{estimated_cost}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">점검 리포트 보기</a>` +
          `<p class="muted">비용이 드는 항목은 따로 승인을 여쭙겠습니다. 미리 정해 두고 싶으신 기준이 있으면 알려 주세요.</p>`,
      },
      en: {
        subject: "Inspection results for {{property_name}}",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Here are the results of the {{property_name}} inspection on {{date}}. The full report is attached.</p>` +
          `<div class="box"><div class="label">Summary</div><div>{{summary}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">To be actioned</td><td>{{action_items}}</td></tr>` +
          `<tr><td class="k">Estimated cost</td><td>{{estimated_cost}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the report</a>` +
          `<p class="muted">We'll come to you separately for approval on anything chargeable. If you'd rather set a standing limit, tell us.</p>`,
      },
      ja: {
        subject: "点検結果のご共有（{{property_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{date}} に実施いたしました {{property_name}} の点検結果をご共有いたします。詳細は添付のレポートをご覧ください。</p>` +
          `<div class="box"><div class="label">概要</div><div>{{summary}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">対応が必要な項目</td><td>{{action_items}}</td></tr>` +
          `<tr><td class="k">概算費用</td><td>{{estimated_cost}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">点検レポートを見る</a>` +
          `<p class="muted">費用が発生する項目は、別途ご承認をお伺いいたします。あらかじめ基準を定めておかれる場合はお知らせください。</p>`,
      },
      zh: {
        subject: "检查结果分享（{{property_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>现将 {{date}} 对 {{property_name}} 的检查结果分享给您，详细内容请见随附报告。</p>` +
          `<div class="box"><div class="label">概要</div><div>{{summary}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">需处理事项</td><td>{{action_items}}</td></tr>` +
          `<tr><td class="k">预估费用</td><td>{{estimated_cost}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看检查报告</a>` +
          `<p class="muted">涉及费用的事项，我们会另行请您批准。若您希望预先设定额度标准，请告知我们。</p>`,
      },
      th: {
        subject: "แจ้งผลการตรวจ ({{property_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ขอแจ้งผลการตรวจ {{property_name}} เมื่อวันที่ {{date}} รายละเอียดอยู่ในรายงานที่แนบ</p>` +
          `<div class="box"><div class="label">สรุป</div><div>{{summary}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">รายการที่ต้องดำเนินการ</td><td>{{action_items}}</td></tr>` +
          `<tr><td class="k">ค่าใช้จ่ายโดยประมาณ</td><td>{{estimated_cost}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายงานการตรวจ</a>` +
          `<p class="muted">รายการที่มีค่าใช้จ่าย เราจะขออนุมัติจากท่านต่างหาก หากท่านต้องการกำหนดวงเงินไว้ล่วงหน้า แจ้งได้</p>`,
      },
      vi: {
        subject: "Kết quả kiểm tra ({{property_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi xin chia sẻ kết quả kiểm tra {{property_name}} ngày {{date}}. Chi tiết có trong báo cáo đính kèm.</p>` +
          `<div class="box"><div class="label">Tóm tắt</div><div>{{summary}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">Hạng mục cần xử lý</td><td>{{action_items}}</td></tr>` +
          `<tr><td class="k">Chi phí dự kiến</td><td>{{estimated_cost}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem báo cáo</a>` +
          `<p class="muted">Với hạng mục phát sinh chi phí, chúng tôi sẽ xin phê duyệt riêng. Nếu quý vị muốn đặt sẵn hạn mức, xin cho biết.</p>`,
      },
    },
  },

  {
    key: "owner.annual_statement",
    name: "연간 수익·비용 명세",
    description: "연말 결산 자료. 세무 신고에 쓰이므로 기간과 항목을 분명히 한다.",
    vars: vars("recipient", "property_name", "year", "gross_income", "total_expenses", "net_income", "url"),
    tr: {
      ko: {
        subject: "{{year}}년 수익·비용 명세 ({{property_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{year}}년 {{property_name}} 연간 명세를 보내 드립니다. 세무 신고에 쓰실 수 있도록 항목별로 정리했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">연간 수입</td><td>{{gross_income}}</td></tr>` +
          `<tr><td class="k">연간 비용</td><td>{{total_expenses}}</td></tr>` +
          `<tr><td class="k">순수익</td><td>{{net_income}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">명세 보기</a>` +
          `<p class="muted">세무 대리인께 바로 전달하실 수 있는 형식입니다. 증빙 원본이 필요하시면 말씀해 주세요.</p>`,
      },
      en: {
        subject: "{{year}} income and expenditure ({{property_name}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Here is the annual statement for {{property_name}} for {{year}}, itemised so you can use it for your tax return.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Income</td><td>{{gross_income}}</td></tr>` +
          `<tr><td class="k">Expenditure</td><td>{{total_expenses}}</td></tr>` +
          `<tr><td class="k">Net</td><td>{{net_income}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the statement</a>` +
          `<p class="muted">It's in a form you can hand straight to your accountant. Ask if you need the underlying receipts.</p>`,
      },
      ja: {
        subject: "{{year}}年の収支明細（{{property_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{year}} 年の {{property_name}} 年間明細をお送りいたします。確定申告にお使いいただけるよう、項目ごとに整理いたしました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">年間収入</td><td>{{gross_income}}</td></tr>` +
          `<tr><td class="k">年間費用</td><td>{{total_expenses}}</td></tr>` +
          `<tr><td class="k">純収益</td><td>{{net_income}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">明細を見る</a>` +
          `<p class="muted">税理士の先生へそのままお渡しいただける形式です。証憑の原本が必要でしたらお申し付けください。</p>`,
      },
      zh: {
        subject: "{{year}} 年度收支明细（{{property_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>现将 {{property_name}} {{year}} 年度明细发送给您，已按项目整理，可用于税务申报。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">年度收入</td><td>{{gross_income}}</td></tr>` +
          `<tr><td class="k">年度支出</td><td>{{total_expenses}}</td></tr>` +
          `<tr><td class="k">净收益</td><td>{{net_income}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看明细</a>` +
          `<p class="muted">该格式可直接交予您的税务顾问。如需原始凭证，请告知我们。</p>`,
      },
      th: {
        subject: "สรุปรายรับรายจ่ายปี {{year}} ({{property_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ขอส่งสรุปประจำปี {{year}} ของ {{property_name}} โดยจัดหมวดหมู่ไว้เพื่อให้ท่านใช้ยื่นภาษีได้</p>` +
          `<table class="kv">` +
          `<tr><td class="k">รายรับทั้งปี</td><td>{{gross_income}}</td></tr>` +
          `<tr><td class="k">รายจ่ายทั้งปี</td><td>{{total_expenses}}</td></tr>` +
          `<tr><td class="k">กำไรสุทธิ</td><td>{{net_income}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียด</a>` +
          `<p class="muted">รูปแบบนี้ส่งต่อให้ผู้ทำบัญชีได้ทันที หากต้องการเอกสารต้นฉบับ แจ้งได้</p>`,
      },
      vi: {
        subject: "Thu chi năm {{year}} ({{property_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi xin gửi bảng tổng hợp năm {{year}} của {{property_name}}, đã phân loại theo khoản mục để quý vị dùng khi quyết toán thuế.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Thu cả năm</td><td>{{gross_income}}</td></tr>` +
          `<tr><td class="k">Chi cả năm</td><td>{{total_expenses}}</td></tr>` +
          `<tr><td class="k">Lợi nhuận ròng</td><td>{{net_income}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem bảng tổng hợp</a>` +
          `<p class="muted">Định dạng này có thể đưa thẳng cho kế toán. Nếu cần chứng từ gốc, xin cho biết.</p>`,
      },
    },
  },
];

// customer — 단기 예약 (booking.*)
//
// 게스트가 예약을 잡은 순간부터 체크아웃까지. 체크인 안내는 출입 정보를 담으므로
// 예약이 확정·결제된 건에만 나가야 한다(발송부 조건 확인 필요).
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const CUSTOMER_BOOKING = [
  {
    key: "booking.confirmed",
    name: "예약 확정",
    description: "예약이 확정됐을 때. 기간·세대·금액과 취소 규정 링크를 함께 준다.",
    vars: vars("recipient", "ref", "space_name", "checkin_date", "checkout_date", "guests", "amount", "url"),
    tr: {
      ko: {
        subject: "예약이 확정되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>예약이 확정되었습니다. 내용을 확인해 주세요.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">예약번호</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">세대</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">입실</td><td>{{checkin_date}}</td></tr>` +
          `<tr><td class="k">퇴실</td><td>{{checkout_date}}</td></tr>` +
          `<tr><td class="k">인원</td><td>{{guests}}</td></tr>` +
          `<tr><td class="k">결제 금액</td><td>{{amount}}</td></tr></table>` +
          `<p>입실 사흘 전에 출입 방법과 오시는 길을 따로 보내 드립니다.</p>` +
          `<a class="btn" href="{{url}}">예약 상세 보기</a>` +
          `<p class="muted">일정을 바꾸려면 예약 상세에서 변경하거나 이 메일에 답장해 주세요. 취소 수수료는 예약 상세의 약관을 따릅니다.</p>`,
      },
      en: {
        subject: "Your booking is confirmed ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Your booking is confirmed. Please check the details below.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Booking</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Unit</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">Check-in</td><td>{{checkin_date}}</td></tr>` +
          `<tr><td class="k">Check-out</td><td>{{checkout_date}}</td></tr>` +
          `<tr><td class="k">Guests</td><td>{{guests}}</td></tr>` +
          `<tr><td class="k">Paid</td><td>{{amount}}</td></tr></table>` +
          `<p>Three days before you arrive we'll send the access details and directions.</p>` +
          `<a class="btn" href="{{url}}">View your booking</a>` +
          `<p class="muted">Need to change the dates? Do it from the booking page or reply to this email. Cancellation fees follow the terms shown there.</p>`,
      },
      ja: {
        subject: "ご予約が確定いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>ご予約が確定いたしました。内容をご確認ください。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">予約番号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">お部屋</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">チェックイン</td><td>{{checkin_date}}</td></tr>` +
          `<tr><td class="k">チェックアウト</td><td>{{checkout_date}}</td></tr>` +
          `<tr><td class="k">人数</td><td>{{guests}}</td></tr>` +
          `<tr><td class="k">ご請求額</td><td>{{amount}}</td></tr></table>` +
          `<p>チェックインの3日前に、入室方法と道順を別途お送りいたします。</p>` +
          `<a class="btn" href="{{url}}">予約内容を確認する</a>` +
          `<p class="muted">日程のご変更は予約ページから、または本メールへのご返信でも承ります。キャンセル料は予約ページ記載の規定によります。</p>`,
      },
      zh: {
        subject: "您的预订已确认（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>您的预订已确认，请核对以下信息。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">预订编号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">房源</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">入住</td><td>{{checkin_date}}</td></tr>` +
          `<tr><td class="k">退房</td><td>{{checkout_date}}</td></tr>` +
          `<tr><td class="k">人数</td><td>{{guests}}</td></tr>` +
          `<tr><td class="k">支付金额</td><td>{{amount}}</td></tr></table>` +
          `<p>入住前三天，我们会另行发送门禁方式和路线指引。</p>` +
          `<a class="btn" href="{{url}}">查看预订详情</a>` +
          `<p class="muted">如需调整日期，可在预订详情页修改，或直接回复本邮件。取消费用以预订详情页所列条款为准。</p>`,
      },
      th: {
        subject: "ยืนยันการจองแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>การจองของท่านได้รับการยืนยันแล้ว กรุณาตรวจสอบรายละเอียดด้านล่าง</p>` +
          `<table class="kv">` +
          `<tr><td class="k">หมายเลขการจอง</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">ห้องพัก</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">เช็คอิน</td><td>{{checkin_date}}</td></tr>` +
          `<tr><td class="k">เช็คเอาต์</td><td>{{checkout_date}}</td></tr>` +
          `<tr><td class="k">จำนวนผู้เข้าพัก</td><td>{{guests}}</td></tr>` +
          `<tr><td class="k">ยอดชำระ</td><td>{{amount}}</td></tr></table>` +
          `<p>เราจะส่งวิธีเข้าห้องพักและเส้นทางให้ท่านอีกครั้งก่อนเช็คอินสามวัน</p>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดการจอง</a>` +
          `<p class="muted">หากต้องการเปลี่ยนวันที่ แก้ไขได้จากหน้ารายละเอียดการจอง หรือตอบกลับอีเมลนี้ ค่าธรรมเนียมการยกเลิกเป็นไปตามเงื่อนไขที่ระบุไว้ในหน้าดังกล่าว</p>`,
      },
      vi: {
        subject: "Đặt phòng đã được xác nhận ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Đặt phòng của Quý khách đã được xác nhận. Xin kiểm tra thông tin dưới đây.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Mã đặt phòng</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Căn hộ</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">Nhận phòng</td><td>{{checkin_date}}</td></tr>` +
          `<tr><td class="k">Trả phòng</td><td>{{checkout_date}}</td></tr>` +
          `<tr><td class="k">Số khách</td><td>{{guests}}</td></tr>` +
          `<tr><td class="k">Đã thanh toán</td><td>{{amount}}</td></tr></table>` +
          `<p>Ba ngày trước khi nhận phòng, chúng tôi sẽ gửi cách vào nhà và chỉ đường.</p>` +
          `<a class="btn" href="{{url}}">Xem chi tiết đặt phòng</a>` +
          `<p class="muted">Cần đổi ngày, Quý khách có thể sửa ở trang chi tiết hoặc trả lời email này. Phí hủy áp dụng theo điều khoản ghi tại trang đó.</p>`,
      },
    },
  },

  {
    key: "booking.modified",
    name: "예약 변경 확인",
    description: "예약 내용이 바뀌었을 때. 변경 전후를 나란히 보여 주고 차액을 밝힌다.",
    vars: vars("recipient", "ref", "changed_items", "amount_diff", "url"),
    tr: {
      ko: {
        subject: "예약이 변경되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>예약번호 {{ref}} 내용을 아래와 같이 변경했습니다.</p>` +
          `<div class="box"><div class="label">변경 내용</div><div>{{changed_items}}</div></div>` +
          `<table class="kv"><tr><td class="k">차액</td><td>{{amount_diff}}</td></tr></table>` +
          `<p>추가로 낼 금액이 있으면 청구서를 따로 보내 드리고, 돌려드릴 금액이 있으면 결제하신 수단으로 환불합니다.</p>` +
          `<a class="btn" href="{{url}}">변경된 예약 보기</a>` +
          `<p class="muted">변경하신 적이 없다면 바로 알려 주세요.</p>`,
      },
      en: {
        subject: "Your booking has been changed ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Booking {{ref}} has been updated as follows.</p>` +
          `<div class="box"><div class="label">What changed</div><div>{{changed_items}}</div></div>` +
          `<table class="kv"><tr><td class="k">Difference</td><td>{{amount_diff}}</td></tr></table>` +
          `<p>If there's more to pay we'll send a separate invoice; if you're owed money it goes back to the card or account you paid with.</p>` +
          `<a class="btn" href="{{url}}">View the updated booking</a>` +
          `<p class="muted">If you didn't make this change, tell us straight away.</p>`,
      },
      ja: {
        subject: "ご予約内容を変更いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>予約番号 {{ref}} の内容を下記のとおり変更いたしました。</p>` +
          `<div class="box"><div class="label">変更内容</div><div>{{changed_items}}</div></div>` +
          `<table class="kv"><tr><td class="k">差額</td><td>{{amount_diff}}</td></tr></table>` +
          `<p>追加のお支払いが生じる場合は別途ご請求書をお送りし、ご返金が生じる場合はお支払いいただいた方法へお戻しいたします。</p>` +
          `<a class="btn" href="{{url}}">変更後の予約を確認する</a>` +
          `<p class="muted">ご変更にお心当たりがない場合は、すぐにお知らせください。</p>`,
      },
      zh: {
        subject: "您的预订已变更（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>预订编号 {{ref}} 的内容已按以下方式变更。</p>` +
          `<div class="box"><div class="label">变更内容</div><div>{{changed_items}}</div></div>` +
          `<table class="kv"><tr><td class="k">差额</td><td>{{amount_diff}}</td></tr></table>` +
          `<p>如需补缴，我们会另行发送账单；如有退款，将原路退回您的付款方式。</p>` +
          `<a class="btn" href="{{url}}">查看变更后的预订</a>` +
          `<p class="muted">如果这不是您本人的操作，请立即告知我们。</p>`,
      },
      th: {
        subject: "การจองของท่านมีการเปลี่ยนแปลง ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้แก้ไขรายละเอียดการจองหมายเลข {{ref}} ดังนี้</p>` +
          `<div class="box"><div class="label">รายการที่เปลี่ยน</div><div>{{changed_items}}</div></div>` +
          `<table class="kv"><tr><td class="k">ส่วนต่าง</td><td>{{amount_diff}}</td></tr></table>` +
          `<p>หากมียอดที่ต้องชำระเพิ่ม เราจะส่งใบแจ้งหนี้แยกต่างหาก และหากมียอดคืน จะคืนกลับไปยังช่องทางที่ท่านชำระ</p>` +
          `<a class="btn" href="{{url}}">ดูการจองที่แก้ไขแล้ว</a>` +
          `<p class="muted">หากท่านไม่ได้เป็นผู้แก้ไข กรุณาแจ้งเราทันที</p>`,
      },
      vi: {
        subject: "Đặt phòng của Quý khách đã thay đổi ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi đã cập nhật đặt phòng số {{ref}} như sau.</p>` +
          `<div class="box"><div class="label">Nội dung thay đổi</div><div>{{changed_items}}</div></div>` +
          `<table class="kv"><tr><td class="k">Chênh lệch</td><td>{{amount_diff}}</td></tr></table>` +
          `<p>Nếu phải trả thêm, chúng tôi sẽ gửi hóa đơn riêng; nếu được hoàn, tiền sẽ về đúng phương thức Quý khách đã thanh toán.</p>` +
          `<a class="btn" href="{{url}}">Xem đặt phòng đã cập nhật</a>` +
          `<p class="muted">Nếu Quý khách không thực hiện thay đổi này, xin báo ngay cho chúng tôi.</p>`,
      },
    },
  },

  {
    key: "booking.cancelled",
    name: "예약 취소",
    description: "예약이 취소됐을 때. 환불액과 입금 시기를 반드시 숫자로 밝힌다.",
    vars: vars("recipient", "ref", "date", "refund_amount", "refund_days", "reason"),
    tr: {
      ko: {
        subject: "예약이 취소되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>예약번호 {{ref}}이(가) {{date}}에 취소되었습니다. 사유는 {{reason}}입니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">환불 금액</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">입금 예정</td><td>영업일 기준 {{refund_days}}일 이내</td></tr></table>` +
          `<p>결제하신 수단으로 돌려드립니다. 카드사 사정에 따라 며칠 더 걸릴 수 있습니다.</p>` +
          `<p class="muted">환불 금액이 예상과 다르면 답장 주세요. 계산 내역을 보내 드리겠습니다.</p>`,
      },
      en: {
        subject: "Your booking has been cancelled ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Booking {{ref}} was cancelled on {{date}} — {{reason}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Refund</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">Expected</td><td>within {{refund_days}} business days</td></tr></table>` +
          `<p>It goes back to the method you paid with. Your bank may take a few extra days to show it.</p>` +
          `<p class="muted">If the refund isn't what you expected, reply and we'll send the breakdown.</p>`,
      },
      ja: {
        subject: "ご予約を取り消しました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>予約番号 {{ref}} を {{date}} に取り消しいたしました。理由は {{reason}}です。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ご返金額</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">入金予定</td><td>営業日で {{refund_days}} 日以内</td></tr></table>` +
          `<p>お支払いいただいた方法へお戻しいたします。カード会社の処理により、数日遅れる場合がございます。</p>` +
          `<p class="muted">ご返金額が想定と異なる場合は、ご返信ください。内訳をお送りいたします。</p>`,
      },
      zh: {
        subject: "您的预订已取消（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>预订编号 {{ref}} 已于 {{date}} 取消，原因是{{reason}}。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">退款金额</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">预计到账</td><td>{{refund_days}} 个工作日内</td></tr></table>` +
          `<p>款项将原路退回您的付款方式。因发卡行处理，实际到账可能再晚几天。</p>` +
          `<p class="muted">如果退款金额与您预期不符，请回复本邮件，我们会发送明细。</p>`,
      },
      th: {
        subject: "ยกเลิกการจองเรียบร้อยแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>การจองหมายเลข {{ref}} ถูกยกเลิกเมื่อวันที่ {{date}} เนื่องจาก{{reason}}</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ยอดคืนเงิน</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">กำหนดคืน</td><td>ภายใน {{refund_days}} วันทำการ</td></tr></table>` +
          `<p>เงินจะคืนกลับไปยังช่องทางที่ท่านชำระ ทั้งนี้ธนาคารอาจใช้เวลาเพิ่มอีกสองสามวัน</p>` +
          `<p class="muted">หากยอดคืนไม่ตรงกับที่ท่านคาดไว้ ตอบกลับมาได้ เราจะส่งรายละเอียดการคำนวณให้</p>`,
      },
      vi: {
        subject: "Đặt phòng của Quý khách đã bị hủy ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Đặt phòng số {{ref}} đã bị hủy vào ngày {{date}}, lý do là {{reason}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số tiền hoàn</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">Dự kiến</td><td>trong vòng {{refund_days}} ngày làm việc</td></tr></table>` +
          `<p>Tiền sẽ về đúng phương thức Quý khách đã thanh toán. Ngân hàng có thể cần thêm vài ngày để hiển thị.</p>` +
          `<p class="muted">Nếu số tiền hoàn khác với dự kiến, xin trả lời email để chúng tôi gửi bảng tính chi tiết.</p>`,
      },
    },
  },

  {
    key: "booking.checkin_guide",
    name: "입실 안내 (사흘 전)",
    description: "출입 방법·주소·주차·연락처. 출입 정보를 담으므로 결제 완료 건에만 보낸다.",
    vars: vars("recipient", "ref", "space_name", "address", "checkin_date", "access_code", "parking", "contact_phone"),
    tr: {
      ko: {
        subject: "입실 안내 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{checkin_date}} 입실을 앞두고 안내드립니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">주소</td><td>{{address}}</td></tr>` +
          `<tr><td class="k">세대</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">출입 방법</td><td>{{access_code}}</td></tr>` +
          `<tr><td class="k">주차</td><td>{{parking}}</td></tr></table>` +
          `<p>입실 시간 이후 언제든 들어가실 수 있습니다. 도착이 늦어져도 괜찮으니 미리 알려만 주세요.</p>` +
          `<p class="muted">현장에서 막히는 일이 있으면 {{contact_phone}}으로 전화 주세요. 출입 정보는 다른 분께 알려 주지 마시기 바랍니다.</p>`,
      },
      en: {
        subject: "How to get in ({{space_name}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Here's what you need for your arrival on {{checkin_date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Address</td><td>{{address}}</td></tr>` +
          `<tr><td class="k">Unit</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">Access</td><td>{{access_code}}</td></tr>` +
          `<tr><td class="k">Parking</td><td>{{parking}}</td></tr></table>` +
          `<p>You can let yourself in any time from the check-in hour. A late arrival is fine — just let us know beforehand.</p>` +
          `<p class="muted">If anything goes wrong on the day, call {{contact_phone}}. Please don't pass the access details on to anyone else.</p>`,
      },
      ja: {
        subject: "ご入室のご案内（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{checkin_date}} のご入室に向けてご案内いたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">住所</td><td>{{address}}</td></tr>` +
          `<tr><td class="k">お部屋</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">入室方法</td><td>{{access_code}}</td></tr>` +
          `<tr><td class="k">駐車場</td><td>{{parking}}</td></tr></table>` +
          `<p>チェックイン時刻以降でしたら、いつでもご入室いただけます。到着が遅くなっても差し支えありませんので、事前にお知らせください。</p>` +
          `<p class="muted">当日お困りのことがございましたら、{{contact_phone}} までお電話ください。入室情報は他の方にお伝えにならないようお願いいたします。</p>`,
      },
      zh: {
        subject: "入住指引（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>您将于 {{checkin_date}} 入住，以下是相关指引。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">地址</td><td>{{address}}</td></tr>` +
          `<tr><td class="k">房源</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">进门方式</td><td>{{access_code}}</td></tr>` +
          `<tr><td class="k">停车</td><td>{{parking}}</td></tr></table>` +
          `<p>入住时间之后，您随时可以自行进入。晚到也没关系，提前告知我们即可。</p>` +
          `<p class="muted">当天如遇任何问题，请拨打 {{contact_phone}}。门禁信息请勿转告他人。</p>`,
      },
      th: {
        subject: "วิธีเข้าที่พัก ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ข้อมูลสำหรับการเข้าพักในวันที่ {{checkin_date}} มีดังนี้</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ที่อยู่</td><td>{{address}}</td></tr>` +
          `<tr><td class="k">ห้องพัก</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">วิธีเข้าห้อง</td><td>{{access_code}}</td></tr>` +
          `<tr><td class="k">ที่จอดรถ</td><td>{{parking}}</td></tr></table>` +
          `<p>ท่านเข้าห้องพักได้ตั้งแต่เวลาเช็คอินเป็นต้นไป หากมาถึงดึกก็ไม่เป็นไร เพียงแจ้งให้เราทราบล่วงหน้า</p>` +
          `<p class="muted">หากติดขัดในวันเข้าพัก โทร {{contact_phone}} ได้เลย และกรุณาอย่าเปิดเผยข้อมูลการเข้าห้องแก่ผู้อื่น</p>`,
      },
      vi: {
        subject: "Hướng dẫn nhận phòng ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Dưới đây là thông tin cho ngày nhận phòng {{checkin_date}} của Quý khách.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Địa chỉ</td><td>{{address}}</td></tr>` +
          `<tr><td class="k">Căn hộ</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">Cách vào</td><td>{{access_code}}</td></tr>` +
          `<tr><td class="k">Đỗ xe</td><td>{{parking}}</td></tr></table>` +
          `<p>Quý khách có thể tự vào bất cứ lúc nào sau giờ nhận phòng. Đến muộn cũng không sao, chỉ cần báo trước.</p>` +
          `<p class="muted">Nếu có trục trặc trong ngày, xin gọi {{contact_phone}}. Vui lòng không chia sẻ thông tin ra vào cho người khác.</p>`,
      },
    },
  },

  {
    key: "booking.checkout_guide",
    name: "퇴실 안내 (전일)",
    description: "퇴실 시각·정리 요령·열쇠 반납. 추가 요금이 생기는 조건을 미리 알린다.",
    vars: vars("recipient", "ref", "checkout_date", "checkout_time", "key_return", "contact_phone"),
    tr: {
      ko: {
        subject: "퇴실 안내 ({{checkout_date}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>내일 {{checkout_time}}까지 퇴실해 주시면 됩니다. 떠나시기 전에 아래만 확인해 주세요.</p>` +
          `<ul>` +
          `<li>창문을 닫고 냉난방과 조명을 꺼 주세요.</li>` +
          `<li>음식물 쓰레기는 비워 주시고, 일반 쓰레기는 지정된 곳에 놓아 주세요.</li>` +
          `<li>가져오신 물건이 남지 않았는지 한 번 둘러봐 주세요.</li>` +
          `</ul>` +
          `<table class="kv"><tr><td class="k">열쇠 반납</td><td>{{key_return}}</td></tr></table>` +
          `<p class="muted">퇴실이 늦어지면 추가 요금이 생길 수 있습니다. 사정이 있으시면 {{contact_phone}}으로 미리 알려 주세요.</p>`,
      },
      en: {
        subject: "Checking out on {{checkout_date}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Check-out is by {{checkout_time}} tomorrow. Just a few things before you go.</p>` +
          `<ul>` +
          `<li>Close the windows and switch off the heating, cooling and lights.</li>` +
          `<li>Empty the food waste and leave general rubbish in the marked spot.</li>` +
          `<li>Have a last look round for anything of yours left behind.</li>` +
          `</ul>` +
          `<table class="kv"><tr><td class="k">Keys</td><td>{{key_return}}</td></tr></table>` +
          `<p class="muted">A late check-out may incur an extra charge. If something has come up, call {{contact_phone}} ahead of time.</p>`,
      },
      ja: {
        subject: "ご退室のご案内（{{checkout_date}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>明日 {{checkout_time}} までにご退室をお願いいたします。お発ちの前に、下記のみご確認ください。</p>` +
          `<ul>` +
          `<li>窓を閉め、冷暖房と照明をお切りください。</li>` +
          `<li>生ごみは処分し、一般ごみは所定の場所にお出しください。</li>` +
          `<li>お忘れ物がないか、最後にひと通りご確認ください。</li>` +
          `</ul>` +
          `<table class="kv"><tr><td class="k">鍵のご返却</td><td>{{key_return}}</td></tr></table>` +
          `<p class="muted">ご退室が遅れますと追加料金が発生する場合がございます。ご事情がある場合は {{contact_phone}} まで事前にご連絡ください。</p>`,
      },
      zh: {
        subject: "退房指引（{{checkout_date}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>请于明天 {{checkout_time}} 前退房。离开前请确认以下几项。</p>` +
          `<ul>` +
          `<li>关好窗户，关闭空调和照明。</li>` +
          `<li>清理厨余垃圾，一般垃圾请放到指定位置。</li>` +
          `<li>最后环视一圈，确认没有遗留个人物品。</li>` +
          `</ul>` +
          `<table class="kv"><tr><td class="k">钥匙归还</td><td>{{key_return}}</td></tr></table>` +
          `<p class="muted">延迟退房可能产生额外费用。如有特殊情况，请提前拨打 {{contact_phone}} 告知我们。</p>`,
      },
      th: {
        subject: "การเช็คเอาต์ ({{checkout_date}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>กรุณาเช็คเอาต์ภายในเวลา {{checkout_time}} ของวันพรุ่งนี้ ก่อนออกจากที่พัก รบกวนตรวจสอบตามนี้</p>` +
          `<ul>` +
          `<li>ปิดหน้าต่าง ปิดเครื่องปรับอากาศและไฟทั้งหมด</li>` +
          `<li>ทิ้งเศษอาหาร และนำขยะทั่วไปไปวางที่จุดที่กำหนด</li>` +
          `<li>ตรวจดูรอบห้องอีกครั้งว่าไม่มีของส่วนตัวตกค้าง</li>` +
          `</ul>` +
          `<table class="kv"><tr><td class="k">การคืนกุญแจ</td><td>{{key_return}}</td></tr></table>` +
          `<p class="muted">การเช็คเอาต์ล่าช้าอาจมีค่าใช้จ่ายเพิ่ม หากมีเหตุจำเป็น กรุณาโทรแจ้งล่วงหน้าที่ {{contact_phone}}</p>`,
      },
      vi: {
        subject: "Hướng dẫn trả phòng ({{checkout_date}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Xin Quý khách trả phòng trước {{checkout_time}} ngày mai. Trước khi rời đi, vui lòng kiểm tra vài điều sau.</p>` +
          `<ul>` +
          `<li>Đóng cửa sổ, tắt điều hòa và đèn.</li>` +
          `<li>Đổ rác thực phẩm và để rác thường ở đúng vị trí quy định.</li>` +
          `<li>Nhìn quanh một lượt xem có bỏ quên đồ đạc gì không.</li>` +
          `</ul>` +
          `<table class="kv"><tr><td class="k">Trả chìa khóa</td><td>{{key_return}}</td></tr></table>` +
          `<p class="muted">Trả phòng muộn có thể phát sinh phụ phí. Nếu có việc đột xuất, xin gọi trước tới {{contact_phone}}.</p>`,
      },
    },
  },
];
